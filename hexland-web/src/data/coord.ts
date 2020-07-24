import { modFloor } from '../models/extraMath';
import * as THREE from 'three';

// This is the co-ordinate of a face (hex or square) inside the grid.
// (TODO should I drop this and be using the single Vector2 everywhere?)
export class GridCoord {
  readonly tile: THREE.Vector2;
  readonly face: THREE.Vector2; // within the tile

  constructor(tile: THREE.Vector2, face: THREE.Vector2) {
    this.tile = tile;
    this.face = face;
  }

  addFace(f: THREE.Vector2, tileDim: number): GridCoord {
    var vec = this.toVector(tileDim).add(f);
    return new GridCoord(
      new THREE.Vector2(Math.floor(vec.x / tileDim), Math.floor(vec.y / tileDim)),
      new THREE.Vector2(modFloor(vec.x, tileDim), modFloor(vec.y, tileDim))
    );
  }

  equals(other: any): boolean {
    return (other instanceof GridCoord &&
      other.tile.x === this.tile.x &&
      other.tile.y === this.tile.y &&
      other.face.x === this.face.x &&
      other.face.y === this.face.y);
  }

  toString(): string {
    return this.tile.x + " " + this.tile.y + " " + this.face.x + " " + this.face.y;
  }

  toVector(tileDim: number): THREE.Vector2 {
    return new THREE.Vector2(
      this.tile.x * tileDim + this.face.x,
      this.tile.y * tileDim + this.face.y
    );
  }
}

// This is the co-ordinate of an edge.  Each face "owns" some number
// of the edges around it, which are identified by the `edge` number here.
export class GridEdge extends GridCoord {
  readonly edge: number;

  constructor(coord: GridCoord, edge: number) {
    super(coord.tile, coord.face);
    this.edge = edge;
  }

  equals(other: any): boolean {
    return (other instanceof GridEdge &&
      super.equals(other) &&
      other.edge === this.edge);
  }

  toString(): string {
    return super.toString() + " " + this.edge;
  }
}

// A dictionary of objects keyed by grid coords.
export class CoordDictionary<K extends GridCoord, T> {
  private _coords: { [index: string]: K } = {};
  private _values: { [index: string]: T } = {};

  get keys(): K[] {
    var keys = [];
    for (var index in this._coords) {
      keys.push(this._coords[index]);
    }

    return keys;
  }

  clear() {
    this._coords = {};
    this._values = {};
  }

  foreach(fn: (k: K, v: T) => void) {
    for (var index in this._coords) {
      fn(this._coords[index], this._values[index]);
    }
  }

  get(k: K): T | undefined {
    var index = k.toString();
    if (index in this._values) {
      return this._values[index];
    } else {
      return undefined;
    }
  }

  remove(k: K) {
    var index = k.toString();
    if (index in this._coords) {
      delete this._coords[index];
    }

    if (index in this._values) {
      delete this._values[index];
    }
  }

  set(k: K, v: T) {
    var index = k.toString();
    this._coords[index] = k;
    this._values[index] = v;
  }
}