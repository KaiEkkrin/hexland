import { IGridGeometry } from "./gridGeometry";
import { CoordDictionary, IGridCoord, IGridEdge, coordString, edgeString } from "../data/coord";

import { assert } from "console";
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
class FaceDictionary extends CoordDictionary<IGridCoord, number> {
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

  add(coord: IGridCoord, colour: number): boolean {
    var wasAdded = super.add(coord, colour);
    if (wasAdded) {
      this.updateBounds(coord);
    }

    return wasAdded;
  }

  clear() {
    super.clear();
    this.clearBounds();
  }

  get(coord: IGridCoord): number | undefined {
    var clampedCoord = new THREE.Vector2(
      Math.max(this._lowerBounds.x, Math.min(this._upperBounds.x, coord.x)),
      Math.max(this._lowerBounds.y, Math.min(this._upperBounds.y, coord.y))
    );

    return super.get(clampedCoord);
  }

  remove(coord: IGridCoord): number | undefined {
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
    this.keys.forEach(c => this.updateBounds(c));
    return removed;
  }

  // Assigns a new colour to the co-ordinate, returning the old colour or
  // undefined if there wasn't one (ignoring bounds.)
  replace(coord: IGridCoord, colour: number): number | undefined {
    var oldColour = super.get(coord);
    if (oldColour !== colour) {
      this.set(coord, colour);
    }
    return oldColour;
  }

  set(coord: IGridCoord, colour: number) {
    super.set(coord, colour);
    this.updateBounds(coord);
  }
}

export class MapColouring {
  private readonly _geometry: IGridGeometry;
  private readonly _walls: CoordDictionary<IGridEdge, boolean>;

  // This maps each face within our bounds to its map colour.
  private readonly _faces: FaceDictionary;

  // This is the next as-yet-unused colour number we could try.
  // (We can just keep incrementing this; we'll never reach MAX_SAFE_INTEGER.)
  private _nextColour = 0;

  constructor(geometry: IGridGeometry) {
    this._geometry = geometry;
    this._walls = new CoordDictionary<IGridEdge, boolean>(edgeString);
    this._faces = new FaceDictionary();

    // We always start ourselves off with colour 0 at the zero co-ordinate -- if we
    // didn't do this we couldn't handle any `colourOf` calls.
    this.assignNewColour({ x: 0, y: 0 });
  }

  colourOf(coord: IGridCoord): number {
    var colour = this._faces.get(coord) ?? -1;
    assert(colour !== -1);
    return colour;
  }

  private assignNewColour(coord: IGridCoord): number {
    var colour = this._nextColour++;
    this._faces.replace(coord, colour);
    return colour;
  }

  // Fills the colour from a given coord across all faces within bounds that
  // are connected to it, stopping when it reaches other areas of that colour.
  private fill(startCoord: IGridCoord, lowerBounds: THREE.Vector2, upperBounds: THREE.Vector2) {
    const maybeColour = this._faces.get(startCoord);
    assert(maybeColour !== undefined);
    if (maybeColour === undefined) {
      return;
    }
    
    // TODO remove debug
    //console.log("Filling " + maybeColour + " from " + coordString(startCoord) + " with bounds " + lowerBounds.toArray() + ", " + upperBounds.toArray());

    const colour = maybeColour;
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
          this._walls.get(edge) === true) {
          return;
        }

        var oldColour = this._faces.replace(face, colour);
        if (oldColour !== colour) {
          stack.push(face);
        }
      });
    }
  }

  // TODO This is going to recalculate upon every wall change, where usually
  // they come in batches.  Is that too inefficient?  Should I support batching
  // in the interface (would be a lot more awkward)
  setWall(edge: IGridEdge, present: boolean) {
    var alreadyPresent = this._walls.get(edge) === true;
    if (present === alreadyPresent) {
      // Nothing to do
      return;
    }

    var adjacentFaces = this._geometry.getEdgeFaceAdjacency(edge);
    assert(adjacentFaces.length > 1);
    if (present === false) {
      this._walls.remove(edge);

      // Here we recalculate by sampling the colour on one side of the removed
      // wall and assigning the same colour to the other(s):
      // TODO shrink the bounds if we can?
      var colour = this.colourOf(adjacentFaces[0]);
      adjacentFaces.slice(1).forEach(a => {
        var oldColour = this._faces.replace(a, colour);
        if (oldColour !== colour) {
          this.fill(a, this._faces.lowerBounds, this._faces.upperBounds);
        }
      });
    } else {
      this._walls.set(edge, true);

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
}