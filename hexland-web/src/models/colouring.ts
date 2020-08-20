import { IGridGeometry } from './gridGeometry';
import { IGridCoord, IGridEdge, coordString, edgeString } from '../data/coord';
import { FeatureDictionary, IFeature, IFeatureDictionary } from '../data/feature';

import * as THREE from 'three';

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

    if (coord.x > this._lowerBounds.x && coord.y > this._lowerBounds.y &&
      coord.x < this._upperBounds.x && coord.y < this._upperBounds.y) {
      // No effect on bounds
      return removed;
    }

    // Re-calculate our bounds
    this.clearBounds();
    this.forEach(c => this.updateBounds(c.position));
    return removed;
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
}

// We track pending wall changes (add or remove) like this; the colour is ignored
interface IPendingWall extends IFeature<IGridEdge> {
  present: boolean; // true to add this, false to remove it
}

export class MapColouring {
  private readonly _geometry: IGridGeometry;
  private readonly _walls: FeatureDictionary<IGridEdge, IFeature<IGridEdge>>;

  // The pending wall changes -- commit them all and recolour with `recalculate`.
  private readonly _pending: FeatureDictionary<IGridEdge, IPendingWall>;

  // The faces that need to be filled during a recalculate, along with the
  // suggested fill colours.
  private readonly _toFill: FeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

  // This maps each face within our bounds to its map colour.
  private readonly _faces: FaceDictionary;

  // This is the next as-yet-unused colour number we could try.
  // (We can just keep incrementing this; we'll never reach MAX_SAFE_INTEGER.)
  private _nextColour = 0;

  constructor(geometry: IGridGeometry) {
    this._geometry = geometry;
    this._walls = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
    this._pending = new FeatureDictionary<IGridEdge, IPendingWall>(edgeString);
    this._toFill = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
    this._faces = new FaceDictionary();

    // We always start ourselves off with colour 0 at the zero co-ordinate -- if we
    // didn't do this we couldn't handle any `colourOf` calls.
    this._faces.replace({ position: { x: 0, y: 0 }, colour: this._nextColour++ });
  }

  colourOf(coord: IGridCoord): number {
    var f = this._faces.get(coord);
    //assert(f?.colour !== -1);
    return f?.colour ?? -1;
  }

  forEachFace(fn: (f: IFeature<IGridCoord>) => void) {
    this._faces.forEach(fn);
  }

  // Gets a dictionary of all the walls adjacent to a particular map colour.
  getWallsOfColour(colour: number) {
    var walls = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
    this._walls.forEach(w => {
      this._geometry.getEdgeFaceAdjacency(w.position).forEach(f => {
        if (this.colourOf(f) === colour) {
          walls.add(w);
        }
      });
    });

    return walls;
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

  expandBounds(lowerBounds: THREE.Vector2, upperBounds: THREE.Vector2) {
    var newLowerBounds = lowerBounds.clone().min(this._faces.lowerBounds);
    var newUpperBounds = upperBounds.clone().max(this._faces.upperBounds);
    if (!newLowerBounds.equals(this._faces.lowerBounds) || !newUpperBounds.equals(this._faces.upperBounds)) {
      // It should be sufficient to fill to the new bounds with the current
      // bounds colour:
      var start = { x: this._faces.lowerBounds.x, y: this._faces.lowerBounds.y };
      this.fill(start, newLowerBounds, newUpperBounds);
    }
  }

  setWall(edge: IGridEdge, present: boolean) {
    this._pending.set({ position: edge, colour: 0, present: present });
  }

  recalculate() {
    this._toFill.clear();
    var newColours: { [colour: number]: boolean } = {};

    // Make all the wall edits, and populate our dictionary of things to fill
    // (with what) and our new bounds
    var newLowerBounds = this._faces.lowerBounds.clone();
    var newUpperBounds = this._faces.upperBounds.clone();
    var [lowerBounds, upperBounds] = [new THREE.Vector2(), new THREE.Vector2()];
    this._pending.forEach(pw => {
      var adjacentFaces = this._geometry.getEdgeFaceAdjacency(pw.position);
      if (pw.present === false) {
        if (this._walls.remove(pw.position) === undefined) {
          return;
        }

        // We recalculate by sampling the colour on one side of the removed wall
        // and assigning the same colour to the other(s):
        const colour = this.colourOf(adjacentFaces[0]);
        adjacentFaces.slice(1).forEach(a => {
          this._toFill.set({ position: a, colour: colour });
        })
      } else {
        if (this._walls.add({ position: pw.position, colour: 0 }) === false) {
          return;
        }

        // Inflating the bounds by 2 on both sides should guarantee that the outside
        // is always all the same colour (TODO this is probably excessive and I should
        // reduce it a bit...)
        lowerBounds.set(pw.position.x, pw.position.y).addScalar(-2);
        upperBounds.set(pw.position.x, pw.position.y).addScalar(2);
        newLowerBounds.min(lowerBounds);
        newUpperBounds.max(upperBounds);

        // We assign a fresh colour to each side of the wall
        adjacentFaces.forEach(a => {
          var newColour = this._nextColour++;
          this._toFill.set({ position: a, colour: newColour });
          newColours[newColour] = true;
        })
      }
    });

    this._pending.clear();
    const originalBoundsChanged = !this._faces.lowerBounds.equals(newLowerBounds) ||
      !this._faces.upperBounds.equals(newUpperBounds);

    // Fill everything -- but skip squares that have been filled over from another
    // square already (which will hopefully be many of them in the case of a large
    // edit)
    this._toFill.forEach(f => {
      // If this square is already filled in its target colour or in another new colour,
      // I have nothing more to do with it
      const currentColour = this.colourOf(f.position);
      if (currentColour === f.colour || currentColour in newColours) {
        return;
      }

      this._faces.replace(f);
      this.fill(f.position, newLowerBounds, newUpperBounds);
    });

    if (originalBoundsChanged) {
      // If the bounds have changed, fill them in
      // (This may or may not be redundant but it's a bit hard to determine)
      var boundsPosition = { x: newLowerBounds.x, y: newLowerBounds.y };
      this._faces.replace({ position: boundsPosition, colour: this._nextColour++ });
      this.fill(boundsPosition, newLowerBounds, newUpperBounds);
    }
  }

  // Creates a visualisation of the current colouring into another feature dictionary (of areas):
  visualise<F extends IFeature<IGridCoord>>(
    target: IFeatureDictionary<IGridCoord, F>,
    createFeature: (position: IGridCoord, mapColour: number, mapColourCount: number) => F
  ) {
    // Count the number of unique map colours
    // TODO would it be better to be maintaining this dictionary as we go?
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