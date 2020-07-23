import { GridCoord, GridEdge } from '../data/coord';
import { lerp } from './extraMath';
import * as THREE from 'three';

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
  createGridVertices(tile: THREE.Vector2, z: number): THREE.Vector3[];

  // Creates a buffer of indices into the output of `createGridVertices`
  // suitable for drawing a full grid of lines.
  createGridLineIndices(): number[];

  // Creates the vertices involved in drawing the grid tile in solid.
  // (TODO: This should really just be the centres of each hex.  However,
  // it looks like Three.js support for instancing is super inadequate
  // so I'll have to create all the vertices for now.)
  createSolidVertices(tile: THREE.Vector2, z: number): THREE.Vector3[];

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
  createSolidEdgeVertices(tile: THREE.Vector2, alpha: number, z: number): THREE.Vector3[];

  // Creates the colours for an edge texture using the solid edge vertices.
  createSolidEdgeColours(tile: THREE.Vector2): Float32Array;

  // Creates the vertices for the wall instanced mesh.  This will have only
  // edge 0 (we use the instance matrix to generate the others.)
  // TODO Prettier walls would have intersection pieces :)
  createWallVertices(alpha: number, z: number): THREE.Vector3[];

  // Decodes the given sample from a coord texture (these must be 4 values
  // starting from the offset) into a grid coord.
  decodeCoordSample(sample: Uint8Array, offset: number): GridCoord | undefined;

  // Decodes the given sample from an edge texture (these must be 4 values
  // starting from the offset) into a grid coord.
  decodeEdgeSample(sample: Uint8Array, offset: number): GridEdge | undefined;

  // Emits the same grid geometry but with a tileDim of 1; useful for initialising
  // instanced draws.
  toSingle(): IGridGeometry;

  // Transforms the object, assumed to be at the zero co-ordinate, to be at the
  // given one instead.
  transformToCoord(o: THREE.Object3D, coord: GridCoord): void;

  // Transforms the object, assumed to be at the zero edge, to be at the
  // given one instead.
  transformToEdge(o: THREE.Object3D, coord: GridEdge): void;

  // Updates the vertices of the highlighted edge to a new position.
  updateEdgeHighlight(buf: THREE.BufferGeometry, coord: GridEdge | undefined, alpha: number, z: number): void;

  // Updates the vertices of the highlighted face to a new position.
  updateFaceHighlight(buf: THREE.BufferGeometry, coord: GridCoord | undefined, z: number): void;
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

  protected abstract createCentre(x: number, y: number, z: number): FaceCentre;

  protected createCoordCentre(coord: GridCoord, z: number): FaceCentre {
    return this.createCentre(
      coord.tile.x * this.tileDim + coord.face.x,
      coord.tile.y * this.tileDim + coord.face.y,
      z
    );
  }

  protected abstract createEdgeGeometry(coord: GridEdge, alpha: number, z: number): EdgeGeometry;

  private pushEdgeVertices(vertices: THREE.Vector3[], tile: THREE.Vector2, alpha: number, x: number, y: number, z: number, e: number) {
    var edge = new GridEdge(
      new GridCoord(tile, new THREE.Vector2(x, y)),
      e
    );

    var eg = this.createEdgeGeometry(edge, alpha, z);

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

  createSolidEdgeVertices(tile: THREE.Vector2, alpha: number, z: number): THREE.Vector3[] {
    var vertices: THREE.Vector3[] = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var e = 0; e < this.maxEdge; ++e) {
          this.pushEdgeVertices(vertices, tile, alpha, x, y, z, e);
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

  createWallVertices(alpha: number, z: number): THREE.Vector3[] {
    var vertices: THREE.Vector3[] = [];
    this.pushEdgeVertices(vertices, new THREE.Vector2(0, 0), alpha, 0, 0, z, 0);
    return vertices;
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

  transformToCoord(o: THREE.Object3D, coord: GridCoord): void {
    var centre = this.createCoordCentre(coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
  }

  updateEdgeHighlight(buf: THREE.BufferGeometry, coord: GridEdge | undefined, alpha: number, z: number): void {
    if (!coord) {
      buf.setDrawRange(0, 0);
      return;
    }

    var position = buf.attributes.position as THREE.BufferAttribute;
    var eg = this.createEdgeGeometry(coord, alpha, z);

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
