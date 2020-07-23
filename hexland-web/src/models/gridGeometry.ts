import { modFloor, lerp } from './extraMath';
import * as THREE from 'three';

// This is the co-ordinate of a face (hex or square) inside the grid.
export class GridCoord {
  tile: THREE.Vector2;
  face: THREE.Vector2; // within the tile

  constructor(tile: THREE.Vector2, face: THREE.Vector2) {
    this.tile = tile;
    this.face = face;
  }

  addFace(f: THREE.Vector2, tileDim: number): GridCoord {
    // TODO This definitely needs a bunch of unit testing!
    var x = this.tile.x * tileDim + this.face.x + f.x;
    var y = this.tile.y * tileDim + this.face.y + f.y;
    return new GridCoord(
      new THREE.Vector2(Math.floor(x / tileDim), Math.floor(y / tileDim)),
      new THREE.Vector2(modFloor(x, tileDim), modFloor(y, tileDim))
    );
  }

  equals(other: any): boolean {
    return (other instanceof GridCoord &&
      other.tile.x === this.tile.x &&
      other.tile.y === this.tile.y &&
      other.face.x === this.face.x &&
      other.face.y === this.face.y);
  }

  hash(): string {
    return this.tile.x + " " + this.tile.y + " " + this.face.x + " " + this.face.y;
  }
}

// This is the co-ordinate of an edge.  Each face "owns" some number
// of the edges around it, which are identified by the `edge` number here.
export class GridEdge extends GridCoord {
  edge: number;

  constructor(coord: GridCoord, edge: number) {
    super(coord.tile, coord.face);
    this.edge = edge;
  }

  equals(other: any): boolean {
    return (other instanceof GridEdge &&
      super.equals(other) &&
      other.edge === this.edge);
  }

  hash(): string {
    return super.hash() + " " + this.edge;
  }
}

// A grid geometry describes a grid's layout (currently either squares
// or hexagons.)
export interface IGridGeometry {
  // Creates the buffer involved in drawing a highlighted edge.
  // (It will start off-screen.)
  createEdgeHighlight(): THREE.BufferGeometry;

  // Creates the buffer involved in drawing a highlighted face.
  // (It will start off-screen.)
  createFaceHighlight(): THREE.BufferGeometry;

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

  // Creates the vertices involved in drawing grid edges in solid.
  // The alpha number specifies how thick the edge is drawn.
  // This is a non-indexed mesh.
  // TODO Get the edge highlight working first (with a bogus edge!) before
  // moving on to making this texture, it'll be easier to debug that way around.
  createSolidEdgeVertices(tile: THREE.Vector2, alpha: number): THREE.Vector3[];

  // Creates the colours for an edge texture using the solid edge vertices.
  createSolidEdgeColours(tile: THREE.Vector2): Float32Array;

  // Decodes the given sample from a coord texture (these must be 4 values
  // starting from the offset) into a grid coord.
  decodeCoordSample(sample: Uint8Array, offset: number): GridCoord | undefined;

  // Decodes the given sample from an edge texture (these must be 4 values
  // starting from the offset) into a grid coord.
  decodeEdgeSample(sample: Uint8Array, offset: number): GridEdge | undefined;

  // Updates the vertices of the highlighted edge to a new position.
  updateEdgeHighlight(buf: THREE.BufferGeometry, coord: GridEdge | undefined, alpha: number): void;

  // Updates the vertices of the highlighted face to a new position.
  updateFaceHighlight(buf: THREE.BufferGeometry, coord: GridCoord | undefined): void;
}

export class FaceCentre extends THREE.Vector3 {} // to help me not get muddled when handling centres

export class EdgeGeometry { // to help me share the edge code
  tip1: THREE.Vector3;
  tip2: THREE.Vector3;
  bevel1a: THREE.Vector3;
  bevel2a: THREE.Vector3;
  bevel1b: THREE.Vector3;
  bevel2b: THREE.Vector3;

  constructor(tip1: THREE.Vector3, tip2: THREE.Vector3, centre: THREE.Vector3, otherCentre: THREE.Vector3, alpha: number) {
    this.tip1 = tip1;
    this.tip2 = tip2;
    this.bevel1a = lerp(tip1, centre, alpha);
    this.bevel2a = lerp(tip2, centre, alpha);
    this.bevel1b = lerp(tip1, otherCentre, alpha);
    this.bevel2b = lerp(tip2, otherCentre, alpha);
  }
}

export abstract class BaseGeometry {
  private _tileDim: number;
  private _maxEdge: number;
  private _epsilon: number;

  constructor(tileDim: number, maxEdge: number) {
    this._tileDim = tileDim;
    this._maxEdge = maxEdge;
    this._epsilon = 1.0 / 255.0; // to avoid floor errors when decoding
                                 // TODO use an integer texture instead to avoid this yuck and handle bigger maps
                                 // (requires figuring out how to specify one, however!)
  }

  protected get tileDim() { return this._tileDim; }
  protected get maxEdge() { return this._maxEdge; }

  protected abstract createCentre(x: number, y: number): FaceCentre;

  protected createCoordCentre(coord: GridCoord): FaceCentre {
    return this.createCentre(coord.tile.x * this.tileDim + coord.face.x, coord.tile.y * this.tileDim + coord.face.y);
  }

  protected abstract createEdgeGeometry(coord: GridEdge, alpha: number): EdgeGeometry;

  private pushEdgeIndices(indices: number[], baseIndex: number) {
    indices.push(baseIndex);
    indices.push(baseIndex + 2);
    indices.push(baseIndex + 1);
    indices.push(-1);

    indices.push(baseIndex + 1);
    indices.push(baseIndex + 2);
    indices.push(baseIndex + 3);
    indices.push(-1);

    indices.push(baseIndex + 3);
    indices.push(baseIndex + 2);
    indices.push(baseIndex + 4);
    indices.push(-1);

    indices.push(baseIndex + 3);
    indices.push(baseIndex + 4);
    indices.push(baseIndex + 5);
    indices.push(-1);
  }

  private createEdgeHighlightIndices(): number[] {
    var indices: number[] = [];
    this.pushEdgeIndices(indices, 0);
    return indices;
  }

  private fromPackedXYAbs(sample: Uint8Array, offset: number): THREE.Vector2 {
    const absValue = Math.floor(sample[offset] * this._tileDim * this._tileDim / 255.0);
    return new THREE.Vector2(absValue % this._tileDim, Math.floor(absValue / this._tileDim));
  }

  private fromPackedXYEdge(sample: Uint8Array, offset: number): (number | THREE.Vector2 | undefined)[] {
    var unpacked = this.fromPackedXYAbs(sample, offset);
    const signAndEdgeValue = Math.floor(sample[offset + 1] * 8 * this._maxEdge / 255.0);
    if (signAndEdgeValue === 0) {
      return [undefined, undefined];
    }

    if ((signAndEdgeValue % 2) === 1) {
      unpacked.x = -unpacked.x;
    }

    if ((Math.floor(signAndEdgeValue / 2) % 2) === 1) {
      unpacked.y = -unpacked.y;
    }

    var edge = Math.floor(signAndEdgeValue / 4) % this._maxEdge;
    return [unpacked, edge];
  }

  protected toPackedXYAbs(colours: Float32Array, offset: number, x: number, y: number) {
    colours[offset] = this._epsilon + (Math.abs(y) * this._tileDim + Math.abs(x)) / (this._tileDim * this._tileDim);
  }

  protected toPackedXYEdge(colours: Float32Array, offset: number, x: number, y: number, edge: number) {
    this.toPackedXYAbs(colours, offset, x, y);
    var packedSignAndEdge =
      (Math.sign(x) === -1 ? 1 : 0) +
      (Math.sign(y) === -1 ? 2 : 0) +
      4 * edge +
      4 * this._maxEdge; // this value mixed in so that a 0 sign-and-edge value can be identified as "nothing"
    colours[offset + 1] = this._epsilon + packedSignAndEdge / (8.0 * this._maxEdge);
  }

  createEdgeHighlight(): THREE.BufferGeometry {
    var buf = new THREE.BufferGeometry();
    buf.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
    buf.setIndex(this.createEdgeHighlightIndices());
    buf.setDrawRange(0, 0); // starts hidden
    return buf;
  }

  createSolidEdgeVertices(tile: THREE.Vector2, alpha: number): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var e = 0; e < this.maxEdge; ++e) {
          var edge = new GridEdge(
            new GridCoord(tile, new THREE.Vector2(x, y)),
            e
          );

          var eg = this.createEdgeGeometry(edge, alpha);

          vertices.push(eg.bevel1b);
          vertices.push(eg.tip1);
          vertices.push(eg.bevel2b);

          vertices.push(eg.bevel2b);
          vertices.push(eg.tip1);
          vertices.push(eg.tip2);
          
          vertices.push(eg.tip2);
          vertices.push(eg.tip1);
          vertices.push(eg.bevel1a);

          vertices.push(eg.tip2);
          vertices.push(eg.bevel1a);
          vertices.push(eg.bevel2a);
        }
      }
    }

    return vertices;
  }

  createSolidEdgeColours(tile: THREE.Vector2): Float32Array {
    var colours = new Float32Array(this.tileDim * this.tileDim * this.maxEdge * 12 * 3);
    var offset = 0;
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var e = 0; e < this.maxEdge; ++e) {
          for (var i = 0; i < 12; ++i) { // 12 vertices per edge
            this.toPackedXYEdge(colours, offset, tile.x, tile.y, e);
            this.toPackedXYAbs(colours, offset + 2, x, y); // never negative
            offset += 3;
          }
        }
      }
    }

    return colours;
  }

  decodeCoordSample(sample: Uint8Array, offset: number): GridCoord | undefined {
    var tile = this.fromPackedXYEdge(sample, offset)[0];
    return tile ? new GridCoord(
      tile as THREE.Vector2,
      this.fromPackedXYAbs(sample, offset + 2)
    ) : undefined;
  }

  decodeEdgeSample(sample: Uint8Array, offset: number): GridEdge | undefined {
    var [tile, edge] = this.fromPackedXYEdge(sample, offset);
    return tile ? new GridEdge(
      new GridCoord(
        tile as THREE.Vector2,
        this.fromPackedXYAbs(sample, offset + 2),
      ),
      edge as number
    ) : undefined;
  }

  updateEdgeHighlight(buf: THREE.BufferGeometry, coord: GridEdge | undefined, alpha: number): void {
    if (!coord) {
      buf.setDrawRange(0, 0);
      return;
    }

    var position = buf.attributes.position as THREE.BufferAttribute;
    var eg = this.createEdgeGeometry(coord, alpha);

    position.setXYZ(0, eg.bevel1b.x, eg.bevel1b.y, 2);
    position.setXYZ(1, eg.bevel2b.x, eg.bevel2b.y, 2);
    position.setXYZ(2, eg.tip1.x, eg.tip1.y, 2);
    position.setXYZ(3, eg.tip2.x, eg.tip2.y, 2);
    position.setXYZ(4, eg.bevel1a.x, eg.bevel1a.y, 2);
    position.setXYZ(5, eg.bevel2a.x, eg.bevel2a.y, 2);

    position.needsUpdate = true;
    buf.setDrawRange(0, buf.index?.array.length ?? 0);
    buf.computeBoundingSphere();
  }
}
