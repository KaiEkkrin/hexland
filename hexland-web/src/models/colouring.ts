import { IGridGeometry } from './gridGeometry';
import { IMapColouring } from './interfaces';
import { IGridCoord, IGridEdge, coordString, edgeString } from '../data/coord';
import { FeatureDictionary, IFeature, IFeatureDictionary } from '../data/feature';
import { IQuadtreeCoord, Quadtree, QuadtreeColouringDictionary } from '../data/quadtree';

import * as THREE from 'three';
import fluent from 'fluent-iterable';

// This module deals with map colouring, i.e., it tracks contiguous areas of the map
// (areas that are continuous without separation by walls) and draws them all in the
// same colour.
// Doing this allows us to decide where players can move tokens (a token can move
// only onto an area of the same map colour.)
// I'll do it in this stateful, incremental manner to try to reduce the amount of
// computation that has to be done for each change :)

// Provides clamped out-of-bounds sampling.  We'll take advantage of that along with
// the assumptions that everything around the boundary is the same colour and that
// we've filled the entire bounds.
class FaceDictionary extends FeatureDictionary<IGridCoord, IFeature<IGridCoord>> {
  // These are the bounds of the areas we've observed (both inclusive).
  private _lowerBounds: THREE.Vector2;
  private _upperBounds: THREE.Vector2;
  private _clampedCoord: THREE.Vector2; // scratch space

  constructor() {
    super(coordString);
    this._lowerBounds = new THREE.Vector2(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    this._upperBounds = new THREE.Vector2(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    this._clampedCoord = new THREE.Vector2();
  }

  private clearBounds() {
    this._lowerBounds.set(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    this._upperBounds.set(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
  }

  private updateBounds(coord: IGridCoord) {
    this._lowerBounds.x = Math.min(this._lowerBounds.x, coord.x);
    this._lowerBounds.y = Math.min(this._lowerBounds.y, coord.y);
    this._upperBounds.x = Math.max(this._upperBounds.x, coord.x);
    this._upperBounds.y = Math.max(this._upperBounds.y, coord.y);
  }

  get lowerBounds() { return this._lowerBounds; }
  get upperBounds() { return this._upperBounds; }

  add(f: IFeature<IGridCoord>): boolean {
    var wasAdded = super.add(f);
    if (wasAdded) {
      this.updateBounds(f.position);
    }

    return wasAdded;
  }

  clear() {
    super.clear();
    this.clearBounds();
  }

  get(coord: IGridCoord): IFeature<IGridCoord> | undefined {
    this._clampedCoord.set(
      Math.max(this._lowerBounds.x, Math.min(this._upperBounds.x, coord.x)),
      Math.max(this._lowerBounds.y, Math.min(this._upperBounds.y, coord.y))
    );

    return super.get(this._clampedCoord);
  }

  remove(coord: IGridCoord): IFeature<IGridCoord> | undefined {
    var removed = super.remove(coord);
    if (removed === undefined) {
      return undefined;
    }
  }

  // Assigns a new colour to the co-ordinate, returning the old colour or
  // undefined if there wasn't one (ignoring bounds.)
  replace(f: IFeature<IGridCoord>): IFeature<IGridCoord> | undefined {
    var oldFeature = super.remove(f.position); // skip the bounds re-calculate
    if (oldFeature !== undefined) {
      super.add(f); // can skip this bounds re-calculate too
    } else {
      this.add(f); 
    }

    return oldFeature;
  }

  setBounds(newLowerBounds: THREE.Vector2, newUpperBounds: THREE.Vector2) {
    // Clean out entries outside the new bounds if anything shrank
    if (
      newLowerBounds.x > this._lowerBounds.x ||
      newLowerBounds.y > this._lowerBounds.y ||
      newUpperBounds.x < this._upperBounds.x ||
      newUpperBounds.y < this._upperBounds.y
    ) {
      const toDelete = [...fluent(this).filter(f =>
        f.position.x < newLowerBounds.x || f.position.x > newUpperBounds.x ||
        f.position.y < newLowerBounds.y || f.position.y > newUpperBounds.y
      )];
      for (var f of toDelete) {
        this.remove(f.position);
      }
    }

    const boundsChanged = !(this._lowerBounds.equals(newLowerBounds) && this._upperBounds.equals(newUpperBounds));
    if (boundsChanged) {
      this._lowerBounds.copy(newLowerBounds);
      this._upperBounds.copy(newUpperBounds);
    }

    return boundsChanged;
  }
}

// We track pending wall changes (add or remove) like this; the colour is ignored
interface IPendingWall extends IFeature<IGridEdge> {
  present: boolean; // true to add this, false to remove it
}

// Describes the changes to make to a map colouring as a result of applying pending walls.
interface IColouringChanges {
  addedLowerWallBounds: THREE.Vector2;
  addedUpperWallBounds: THREE.Vector2;
  newColours: { [colour: number]: boolean };
  removedCount: number;
}

// This helper class (usable for other colouring implementations too) tracks pending wall changes
// and turns them into real wall changes and a list of faces to colour.
class PendingWalls {
  private readonly _geometry: IGridGeometry;
  private readonly _pending: FeatureDictionary<IGridEdge, IPendingWall>;

  // This is the next as-yet-unused colour number we could try.
  // (We can just keep incrementing this; we'll never reach MAX_SAFE_INTEGER.)
  private _nextColour = 1;

  constructor(geometry: IGridGeometry) {
    this._geometry = geometry;
    this._pending = new FeatureDictionary<IGridEdge, IPendingWall>(edgeString);
  }

  setWall(edge: IGridEdge, present: boolean) {
    this._pending.set({ position: edge, colour: 0, present: present });
  }

  // Applies these pending wall changes to the map colouring supplied.
  apply(
    colourOf: (c: IGridCoord) => number,
    setFill: (f: IFeature<IGridCoord>) => void,
    walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>
  ): IColouringChanges {
    var changes = {
      addedLowerWallBounds: new THREE.Vector2(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
      addedUpperWallBounds: new THREE.Vector2(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER),
      newColours: {},
      removedCount: 0
    } as IColouringChanges;
    this._pending.forEach(pw => {
      var adjacentFaces = this._geometry.getEdgeFaceAdjacency(pw.position);
      if (pw.present === false) {
        if (walls.remove(pw.position) === undefined) {
          return;
        }

        // We recalculate by sampling the colour on one side of the removed wall
        // and assigning the same colour to the other(s):
        const colour = colourOf(adjacentFaces[0]);
        adjacentFaces.slice(1).forEach(a => {
          setFill({ position: a, colour: colour });
        });
        ++changes.removedCount;
      } else {
        if (walls.add({ position: pw.position, colour: 0 }) === false) {
          return;
        }

        // We assign a fresh colour to each side of the wall
        adjacentFaces.forEach(a => {
          var newColour = this._nextColour++;
          setFill({ position: a, colour: newColour });
          changes.newColours[newColour] = true;

          // Update the bounds of our added walls
          changes.addedLowerWallBounds.x = Math.min(changes.addedLowerWallBounds.x, a.x);
          changes.addedLowerWallBounds.y = Math.min(changes.addedLowerWallBounds.y, a.y);
          changes.addedUpperWallBounds.x = Math.max(changes.addedUpperWallBounds.x, a.x);
          changes.addedUpperWallBounds.y = Math.max(changes.addedUpperWallBounds.y, a.y);
        });
      }
    });
    this._pending.clear();
    return changes;
  }
}

export class MapColouring implements IMapColouring {
  private readonly _geometry: IGridGeometry;
  private readonly _walls: FeatureDictionary<IGridEdge, IFeature<IGridEdge>>;

  // Tracks our pending walls pre-recalculate.
  private readonly _pending: PendingWalls;

  // The faces that need to be filled during a recalculate, along with the
  // suggested fill colours.
  private readonly _toFill: FeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

  // This maps each face within our bounds to its map colour.
  private readonly _faces: FaceDictionary;

  // These are the current wall bounds.  Calculating them from scratch is expensive
  // so we maintain a copy and only recalculate when we have to
  private _lowerWallBounds = new THREE.Vector2(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  private _upperWallBounds = new THREE.Vector2(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

  constructor(geometry: IGridGeometry) {
    this._geometry = geometry;
    this._walls = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
    this._pending = new PendingWalls(geometry);
    this._toFill = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
    this._faces = new FaceDictionary();

    // We always start ourselves off with colour 0 at the zero co-ordinate -- if we
    // didn't do this we couldn't handle any `colourOf` calls.
    this._faces.replace({ position: { x: 0, y: 0 }, colour: 0 });

    this.colourOf = this.colourOf.bind(this);
  }

  private addGutterToWallBounds(lowerBounds: THREE.Vector2, upperBounds: THREE.Vector2) {
    // This 2-face gutter should be enough to flow an outside colour fill around anything
    lowerBounds.subScalar(2);
    upperBounds.addScalar(2);
  }

  // Calculates the bounds around the walls.  This is the minimum bounds we need in
  // order to properly colour this map.
  private calculateWallBounds(lowerBounds: THREE.Vector2, upperBounds: THREE.Vector2) {
    lowerBounds.set(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    upperBounds.set(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    for (var w of this._walls) {
      for (var adj of this._geometry.getEdgeFaceAdjacency(w.position)) {
        lowerBounds.x = Math.min(lowerBounds.x, adj.x);
        lowerBounds.y = Math.min(lowerBounds.y, adj.y);
        upperBounds.x = Math.max(upperBounds.x, adj.x);
        upperBounds.y = Math.max(upperBounds.y, adj.y);
      }
    }

    this.addGutterToWallBounds(lowerBounds, upperBounds);
  }

  colourOf(coord: IGridCoord): number {
    var f = this._faces.get(coord);
    //assert(f?.colour !== -1);
    return f?.colour ?? 0;
  }

  getOuterColour(): number {
    return this._faces.get({
      x: this._faces.lowerBounds.x,
      y: this._faces.lowerBounds.y
    })?.colour ?? -1;
  }

  getWall(edge: IGridEdge) {
    return this._walls.get(edge);
  }

  // Fills the colour from a given coord across all faces within bounds that
  // are connected to it, stopping when it reaches other areas of that colour.
  private fill(startCoord: IGridCoord, lowerBounds: THREE.Vector2, upperBounds: THREE.Vector2) {
    const maybeFeature = this._faces.get(startCoord);
    //assert(maybeColour !== undefined);
    if (maybeFeature === undefined) {
      return;
    }
    
    //console.log("Filling " + maybeColour + " from " + coordString(startCoord) + " with bounds " + lowerBounds.toArray() + ", " + upperBounds.toArray());

    const colour = maybeFeature.colour;
    var stack = [startCoord];
    while (true) {
      var coord = stack.pop();
      if (coord === undefined) {
        break;
      }

      //console.log("Filled " + colour + " at " + coordString(coord));

      this._geometry.forEachAdjacentFace(coord, (face: IGridCoord, edge: IGridEdge) => {
        if (
          face.x < lowerBounds.x || face.y < lowerBounds.y ||
          face.x > upperBounds.x || face.y > upperBounds.y ||
          this._walls.get(edge) !== undefined
        ) {
          return;
        }

        var oldFeature = this._faces.replace({ position: face, colour: colour });
        if (oldFeature?.colour !== colour) {
          stack.push(face);
        }
      });
    }
  }

  setWall(edge: IGridEdge, present: boolean) {
    this._pending.setWall(edge, present);
  }

  recalculate() {
    this._toFill.clear();
    const changes = this._pending.apply(this.colourOf, f => this._toFill.set(f), this._walls);

    // Update the bounds.
    // Unfortunately, if any walls were removed, we do need to do a full recalculate
    if (changes.removedCount > 0) {
      this.calculateWallBounds(this._lowerWallBounds, this._upperWallBounds);
    } else {
      this.addGutterToWallBounds(changes.addedLowerWallBounds, changes.addedUpperWallBounds);
      this._lowerWallBounds.min(changes.addedLowerWallBounds);
      this._upperWallBounds.max(changes.addedUpperWallBounds);
    }

    const boundsChanged = this._faces.setBounds(this._lowerWallBounds, this._upperWallBounds);

    // Fill everything -- but skip squares that have been filled over from another
    // square already (which will hopefully be many of them in the case of a large
    // edit)
    this._toFill.forEach(f => {
      // If this square is already filled in its target colour or in another new colour,
      // I have nothing more to do with it
      const currentColour = this.colourOf(f.position);
      if (currentColour === f.colour || currentColour in changes.newColours) {
        return;
      }

      this._faces.replace(f);
      this.fill(f.position, this._lowerWallBounds, this._upperWallBounds);
    });

    if (boundsChanged) {
      // If the bounds have changed, fill them in
      // (This may or may not be redundant but it's a bit hard to determine)
      // We can safely use the zero colour for the outside; that's all it can ever
      // have been.
      var boundsPosition = { x: this._lowerWallBounds.x, y: this._upperWallBounds.y };
      this._faces.replace({ position: boundsPosition, colour: 0 });
      this.fill(boundsPosition, this._lowerWallBounds, this._upperWallBounds);
    }
  }

  // Creates a visualisation of the current colouring into another feature dictionary (of areas):
  visualise<F extends IFeature<IGridCoord>>(
    target: IFeatureDictionary<IGridCoord, F>,
    createFeature: (position: IGridCoord, mapColour: number, mapColourCount: number) => F
  ) {
    // Count the number of unique map colours
    var colourUsage: { [colour: number]: number } = {};
    this._faces.forEach(f => {
      colourUsage[f.colour] = 0;
    });

    // Assign them all hues in the range [0..mapColourCount]
    var hues: { [colour: number]: number } = {};
    var mapColourCount = [0];
    for (var c in colourUsage) {
      hues[c] = mapColourCount[0]++;
    }

    // Clear the target, and add all the features to it
    target.clear();
    this._faces.forEach(f => {
      target.add(createFeature(f.position, hues[f.colour], mapColourCount[0]));
    });
  }
}

// This colouring has a whole lot more overhead, but should be quasi-linear with respect
// to the wall count and logarithmic with respect to the map dimensions.
export class QuadtreeMapColouring implements IMapColouring {
  private readonly _geometry: IGridGeometry;
  private readonly _quadtree: Quadtree;
  private readonly _walls: FeatureDictionary<IGridEdge, IFeature<IGridEdge>>;

  // Tracks our pending walls pre-recalculate.
  private readonly _pending: PendingWalls;

  // The faces that need to be filled during a recalculate, along with the
  // suggested fill colours.
  private readonly _toFill: FeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

  // This maps each face within our bounds to its map colour.
  private readonly _faces: QuadtreeColouringDictionary<IFeature<IQuadtreeCoord>>;

  // The fill algorithm's internal stack shall be this sparse quadtree, so that we have
  // the opportunity to combine faces to fill at each step
  private readonly _stack: QuadtreeColouringDictionary<IFeature<IQuadtreeCoord>>;

  // These are the current wall bounds.  Calculating them from scratch is expensive
  // so we maintain a copy and only recalculate when we have to.
  private _lowerWallBounds = new THREE.Vector2(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  private _upperWallBounds = new THREE.Vector2(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

  constructor(geometry: IGridGeometry) {
    this._geometry = geometry;
    this._quadtree = new Quadtree();
    this._walls = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
    this._pending = new PendingWalls(geometry);
    this._toFill = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
    this._faces = new QuadtreeColouringDictionary(
      this._quadtree,
      c => ({ position: c, colour: 0 }),
      (a, b) => a.colour === b.colour,
      f => f.colour === 0
    );

    this._stack = new QuadtreeColouringDictionary(
      this._quadtree,
      c => ({ position: c, colour: 0 }),
      (a, b) => a.colour === b.colour,
      f => f.colour === 0,
      true
    );

    this.colourOf = this.colourOf.bind(this);
  }

  // TODO #58 deduplicate these somehow
  private addGutterToWallBounds(lowerBounds: THREE.Vector2, upperBounds: THREE.Vector2) {
    // This 2-face gutter should be enough to flow an outside colour fill around anything
    lowerBounds.subScalar(2);
    upperBounds.addScalar(2);
  }

  // Calculates the bounds around the walls.  This is the minimum bounds we need in
  // order to properly colour this map.
  private calculateWallBounds(lowerBounds: THREE.Vector2, upperBounds: THREE.Vector2) {
    lowerBounds.set(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    upperBounds.set(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    for (var w of this._walls) {
      for (var adj of this._geometry.getEdgeFaceAdjacency(w.position)) {
        lowerBounds.x = Math.min(lowerBounds.x, adj.x);
        lowerBounds.y = Math.min(lowerBounds.y, adj.y);
        upperBounds.x = Math.max(upperBounds.x, adj.x);
        upperBounds.y = Math.max(upperBounds.y, adj.y);
      }
    }

    this.addGutterToWallBounds(lowerBounds, upperBounds);
  }

  colourOf(coord: IGridCoord) {
    var f = this._faces.sample(coord);
    return f?.colour ?? this.getOuterColour();
  }

  getOuterColour() {
    return this._faces.sample(this._faces.bounds.min)?.colour ?? 0;
  }

  getWall(edge: IGridEdge) {
    return this._walls.get(edge);
  }

  // Fills the colour from a given coord across all faces within bounds that
  // are connected to it, stopping when it reaches other areas of that colour.
  private fill(startCoord: IGridCoord) {
    const maybeFeature = this._faces.sample(startCoord);
    if (maybeFeature === undefined) {
      return;
    }
    
    // console.log("Filling " + maybeFeature.colour + " from " + this._quadtree.toString(maybeFeature.position));

    const bounds = this._faces.bounds;
    const colour = maybeFeature.colour;
    this._stack.clear();
    this._stack.set({ position: maybeFeature.position, colour: 1 });
    while (true) {
      var coord = fluent(this._stack).first()?.position;
      if (coord === undefined) {
        break;
      }
      this._stack.set({ position: coord, colour: 0 }); // will remove it, because the stack is sparse

      // console.log("Filled " + colour + " at " + this._quadtree.toString(coord));

      this._geometry.forEachQuadtreeAdjacentFace(coord, (face: IGridCoord, edge: IGridEdge) => {
        if (
          face.x < bounds.min.x || face.y < bounds.min.y ||
          face.x >= bounds.max.x || face.y >= bounds.max.y ||
          this._walls.get(edge) !== undefined
        ) {
          return;
        }

        var changed = this._faces.set({ position: { x: face.x, y: face.y, size: 1 }, colour: colour });
        if (changed !== undefined) {
          this._stack.set({ position: changed.position, colour: 1 });
        }
      });
    }
  }

  setWall(edge: IGridEdge, present: boolean) {
    this._pending.setWall(edge, present);
  }

  recalculate() {
    this._toFill.clear();
    const changes = this._pending.apply(this.colourOf, f => this._toFill.set(f), this._walls);

    // Update the bounds.
    // Unfortunately, if any walls were removed, we do need to do a full recalculate
    if (changes.removedCount > 0) {
      this.calculateWallBounds(this._lowerWallBounds, this._upperWallBounds);
    } else {
      this.addGutterToWallBounds(changes.addedLowerWallBounds, changes.addedUpperWallBounds);
      this._lowerWallBounds.min(changes.addedLowerWallBounds);
      this._upperWallBounds.max(changes.addedUpperWallBounds);
    }

    // Ensure these bounds
    const quadtreeBounds = this._faces.bounds;
    var boundsChanged = false;
    if (this._lowerWallBounds.x < quadtreeBounds.min.x || this._lowerWallBounds.y < quadtreeBounds.min.y) {
      this._faces.set({
        position: { x: this._lowerWallBounds.x, y: this._lowerWallBounds.y, size: 1 },
        colour: 0
      });
      boundsChanged = true;
    }

    if (this._upperWallBounds.x >= quadtreeBounds.max.x || this._upperWallBounds.y >= quadtreeBounds.max.y) {
      this._faces.set({
        position: { x: this._upperWallBounds.x, y: this._upperWallBounds.y, size: 1 },
        colour: 0
      });
      boundsChanged = true;
    }

    // Fill everything -- but skip squares that have been filled over from another
    // square already (which will hopefully be many of them in the case of a large
    // edit)
    this._toFill.forEach(f => {
      // If this square is already filled in its target colour or in another new colour,
      // I have nothing more to do with it
      const currentColour = this.colourOf(f.position);
      if (currentColour === f.colour || currentColour in changes.newColours) {
        return;
      }

      this._faces.set({
        position: { x: f.position.x, y: f.position.y, size: 1 },
        colour: f.colour
      });
      this.fill(f.position);
    });

    if (boundsChanged) {
      // If the bounds have changed, fill them in
      // We can safely use the zero colour for the outside; that's all it can ever
      // have been.
      var boundsPosition = { ...this._faces.bounds.min, size: 1 };
      if (this._faces.set({ position: boundsPosition, colour: 0 }) !== undefined) {
        this.fill(boundsPosition);
      }
    }
  }

  // Creates a visualisation of the current colouring into another feature dictionary (of areas):
  visualise<F extends IFeature<IGridCoord>>(
    target: IFeatureDictionary<IGridCoord, F>,
    createFeature: (position: IGridCoord, mapColour: number, mapColourCount: number) => F
  ) {
    // Count the number of unique map colours
    var colourUsage: { [colour: number]: number } = {};
    this._faces.forEach(f => {
      colourUsage[f.colour] = 0;
    });

    // Assign them all hues in the range [0..mapColourCount]
    var hues: { [colour: number]: number } = {};
    var mapColourCount = [0];
    for (var c in colourUsage) {
      hues[c] = mapColourCount[0]++;
    }

    // Clear the target, and add all the features to it, expanding large faces as required
    // (This will be slow, of course, but the visualisation is only intended to show
    // correctness)
    // TODO #68 Hide or optimise this
    target.clear();
    this._faces.forEach(f => {
      for (var y = f.position.y; y < f.position.y + f.position.size; ++y) {
        for (var x = f.position.x; x < f.position.x + f.position.size; ++x) {
          target.add(createFeature({ x: x, y: y }, hues[f.colour], mapColourCount[0]));
        }
      }
    });
  }
}