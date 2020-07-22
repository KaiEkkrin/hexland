import * as THREE from 'three';

// This is the co-ordinate of a face (hex or square) inside the grid.
export class GridCoord {
  tile: THREE.Vector2;
  face: THREE.Vector2; // within the tile

  constructor(tile: THREE.Vector2, face: THREE.Vector2) {
    this.tile = tile;
    this.face = face;
  }
}

// A grid geometry describes a grid's layout (currently either squares
// or hexagons.)
export interface IGridGeometry {
  // Creates the vertices involved in drawing a highlighted face.
  // (It will start off-screen.)
  createFaceHighlightVertices(): Float32Array;

  // ...and the indices (which won't change.)
  createFaceHighlightIndices(): number[];

  // Creates the vertices involved in drawing a full grid tile.
  createGridVertices(tile: THREE.Vector2): THREE.Vector3[];

  // Creates a buffer of indices into the output of `createGridVertices`
  // suitable for drawing a full grid of lines.
  createGridLineIndices(): number[];

  // Creates the vertices involved in drawing the grid tile in solid.
  // (TODO: This should really just be the centres of each hex.  However,
  // it looks like Three.js support for instancing is super inadequate
  // so I'll have to create all the vertices for now.)
  createSolidVertices(tile: THREE.Vector2): THREE.Vector3[];

  // Creates a buffer of indices into the output of `createSolidVertices`
  // suitable for drawing a solid mesh of the grid.
  createSolidMeshIndices(): number[];

  // Creates some colours for testing the solid vertices, above.
  createSolidTestColours(): Float32Array;

  // Creates the colours for a coord texture.
  createSolidCoordColours(tile: THREE.Vector2): Float32Array;

  // Decodes the given sample from a coord texture (these must be 4 values
  // starting from the offset) into a grid coord.
  decodeCoordSample(sample: Uint8Array, offset: number): GridCoord;

  // Updates the vertices of the highlighted face to a new position.
  updateFaceHighlightVertices(vertices: Float32Array, coord: GridCoord): void;
}

export class BaseGeometry {
  private _tileDim: number;
  private _epsilon: number;

  constructor(tileDim: number) {
    this._tileDim = tileDim;
    this._epsilon = 1.0 / 255.0; // to avoid floor errors when decoding
                                 // TODO use an integer texture instead to avoid this yuck and handle bigger maps
                                 // (requires figuring out how to specify one, however!)
  }

  protected get tileDim() { return this._tileDim; }

  protected fillFloats(floats: Float32Array, offset: number, vec: THREE.Vector3): void {
    floats[offset] = vec.x;
    floats[offset + 1] = vec.y;
    floats[offset + 2] = vec.z;
  }

  private fromPackedXYSign(sample: Uint8Array, offset: number): THREE.Vector2 {
    const absValue = Math.floor(sample[offset] * this._tileDim * this._tileDim / 255.0);
    var unpacked = new THREE.Vector2(absValue % this._tileDim, Math.floor(absValue / this._tileDim));

    const signValue = Math.floor(sample[offset + 1] * 4 / 255.0);
    if ((signValue % 2) === 1) {
      unpacked.x = -unpacked.x;
    }

    if (Math.floor(signValue / 2) === 1) {
      unpacked.y = -unpacked.y;
    }

    return unpacked;
  }

  protected toPackedXYSign(colours: Float32Array, offset: number, x: number, y: number) {
    colours[offset] = this._epsilon + (Math.abs(y) * this._tileDim + Math.abs(x)) / (this._tileDim * this._tileDim);
    colours[offset + 1] = this._epsilon + (Math.sign(y) === -1 ? 0.5 : 0) + (Math.sign(x) === -1 ? 0.25 : 0);
  }

  decodeCoordSample(sample: Uint8Array, offset: number): GridCoord {
    return new GridCoord(
      this.fromPackedXYSign(sample, offset),
      this.fromPackedXYSign(sample, offset + 2)
    );
  }
}
