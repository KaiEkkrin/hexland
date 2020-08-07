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

  constructor() {
    super(coordString);
    this._lowerBounds = new THREE.Vector2(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    this._upperBounds = new THREE.Vector2(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
  }

  private clearBounds() {
    this._lowerBounds = new THREE.Vector2(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    this._upperBounds = new THREE.Vector2(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
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
    var clampedCoord = new THREE.Vector2(
      Math.max(this._lowerBounds.x, Math.min(this._upperBounds.x, coord.x)),
      Math.max(this._lowerBounds.y, Math.min(this._upperBounds.y, coord.y))
    );

    return super.get(clampedCoord);
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

export class MapColouring {
  private readonly _geometry: IGridGeometry;
  private readonly _walls: FeatureDictionary<IGridEdge, IFeature<IGridEdge>>;

  // This maps each face within our bounds to its map colour.
  private readonly _faces: FaceDictionary;

  // This is the next as-yet-unused colour number we could try.
  // (We can just keep incrementing this; we'll never reach MAX_SAFE_INTEGER.)
  private _nextColour = 0;

  constructor(geometry: IGridGeometry) {
    this._geometry = geometry;
    this._walls = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
    this._faces = new FaceDictionary();

    // We always start ourselves off with colour 0 at the zero co-ordinate -- if we
    // didn't do this we couldn't handle any `colourOf` calls.
    this.assignNewColour({ x: 0, y: 0 });
  }

  colourOf(coord: IGridCoord): number {
    var f = this._faces.get(coord);
    //assert(f?.colour !== -1);
    return f?.colour ?? -1;
  }

  forEachFaceMatching(colour: number, fn: (c: IGridCoord) => void) {
    this._faces.forEach(f => {
      if (f.colour === colour) {
        fn(f.position);
      }
    });
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

  private assignNewColour(coord: IGridCoord): number {
    var colour = this._nextColour++;
    this._faces.replace({ position: coord, colour: colour });
    return colour;
  }

  // Fills the colour from a given coord across all faces within bounds that
  // are connected to it, stopping when it reaches other areas of that colour.
  private fill(startCoord: IGridCoord, lowerBounds: THREE.Vector2, upperBounds: THREE.Vector2) {
    const maybeFeature = this._faces.get(startCoord);
    //assert(maybeColour !== undefined);
    if (maybeFeature === undefined) {
      return;
    }
    
    // TODO remove debug
    //console.log("Filling " + maybeColour + " from " + coordString(startCoord) + " with bounds " + lowerBounds.toArray() + ", " + upperBounds.toArray());

    const colour = maybeFeature.colour;
    var stack = [startCoord];
    while (true) {
      var coord = stack.pop();
      if (coord === undefined) {
        break;
      }

      // TODO remove debug
      //console.log("Filled " + colour + " at " + coordString(coord));

      this._geometry.forEachAdjacentFace(coord, (face: IGridCoord, edge: IGridEdge) => {
        if (face.x < lowerBounds.x || face.y < lowerBounds.y ||
          face.x > upperBounds.x || face.y > upperBounds.y ||
          this._walls.get(edge) !== undefined) {
          return;
        }

        var oldFeature = this._faces.replace({ position: face, colour: colour });
        if (oldFeature?.colour !== colour) {
          stack.push(face);
        }
      });
    }
  }

  // TODO This is going to recalculate upon every wall change, where usually
  // they come in batches.  Is that too inefficient?  Should I support batching
  // in the interface -- set all the new walls, and then do a single recalculate
  // pass?  (Test that it works well like this first, I think.)
  setWall(edge: IGridEdge, present: boolean) {
    var alreadyPresent = this._walls.get(edge) !== undefined;
    if (present === alreadyPresent) {
      // Nothing to do
      return;
    }

    var adjacentFaces = this._geometry.getEdgeFaceAdjacency(edge);
    //assert(adjacentFaces.length > 1);
    if (present === false) {
      this._walls.remove(edge);

      // Here we recalculate by sampling the colour on one side of the removed
      // wall and assigning the same colour to the other(s):
      // TODO shrink the bounds if we can?
      var colour = this.colourOf(adjacentFaces[0]);
      adjacentFaces.slice(1).forEach(a => {
        var oldFeature = this._faces.replace({ position: a, colour: colour });
        if (oldFeature?.colour !== colour) {
          this.fill(a, this._faces.lowerBounds, this._faces.upperBounds);
        }
      });
    } else {
      this._walls.add({ position: edge, colour: 0 });

      // Inflating the bounds by 2 on both sides should guarantee that the outside
      // is always all the same colour (TODO this is probably excessive and I should
      // reduce it a bit...)
      const lowerBounds = adjacentFaces.map(c => new THREE.Vector2(c.x, c.y))
        .reduce((a, b) => a.min(b)).addScalar(-2)
        .min(this._faces.lowerBounds);
      const upperBounds = adjacentFaces.map(c => new THREE.Vector2(c.x, c.y))
        .reduce((a, b) => a.max(b)).addScalar(2)
        .max(this._faces.upperBounds);

      // We fill with fresh colours:
      // - all sides of the wall (TODO I could optimise this to check for a fresh colour already)
      // - a point on the new bounds, which should all be connected naturally
      adjacentFaces.forEach(a => {
        this.assignNewColour(a);
        this.fill(a, lowerBounds, upperBounds);
      });

      if (!lowerBounds.equals(this._faces.lowerBounds) || !upperBounds.equals(this._faces.upperBounds)) {
        var onBounds = { x: lowerBounds.x, y: lowerBounds.y };
        this.assignNewColour(onBounds);
        this.fill(onBounds, lowerBounds, upperBounds);
      }
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