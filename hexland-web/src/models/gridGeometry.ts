import { IGridCoord, IGridEdge, createGridCoord, createGridEdge, coordMultiplyScalar } from '../data/coord';
import { lerp } from './extraMath';
import * as THREE from 'three';

export class FaceCentre extends THREE.Vector3 {} // to help me not get muddled when handling centres

// A grid geometry describes a grid's layout (currently either squares
// or hexagons.)
export interface IGridGeometry {
  // Creates the co-ordinate of the centre of this face.
  createCoordCentre(coord: IGridCoord, z: number): FaceCentre;

  // Creates the vertices involved in drawing a full grid tile.
  createGridVertices(tile: THREE.Vector2, z: number): THREE.Vector3[];

  // Creates a buffer of indices into the output of `createGridVertices`
  // suitable for drawing a full grid of lines.
  createGridLineIndices(): number[];

  // Creates the vertices involved in drawing the grid tile in solid.
  // The alpha number specifies how much of a face is covered.
  createSolidVertices(tile: THREE.Vector2, alpha: number, z: number): THREE.Vector3[];

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
  decodeCoordSample(sample: Uint8Array, offset: number): IGridCoord | undefined;

  // Decodes the given sample from an edge texture (these must be 4 values
  // starting from the offset) into a grid coord.
  decodeEdgeSample(sample: Uint8Array, offset: number): IGridEdge | undefined;

  // A measure of the face size in this geometry.
  faceSize(): number;

  // Evaluates the function for each face adjacent to the given one.
  forEachAdjacentFace(coord: IGridCoord, fn: (face: IGridCoord, edge: IGridEdge) => void): void;


  // Gets the faces adjacent to the given edge. (TODO adjacent edges too?)
  getEdgeFaceAdjacency(edge: IGridEdge): IGridCoord[];

  // Gets a sphere covering `alpha` proportion of the edge -- use for
  // occlusion testing.
  getEdgeSphere(edge: IGridEdge, z: number, alpha: number): THREE.Sphere;

  // Emits the same grid geometry but with a tileDim of 1; useful for initialising
  // instanced draws.
  toSingle(): IGridGeometry;

  // Transforms the object, assumed to be at the zero co-ordinate, to be at the
  // given one instead.
  transformToCoord(o: THREE.Object3D, coord: IGridCoord): void;

  // Transforms the object, assumed to be at the given co-ordinate, back to the
  // origin position.
  transformToOrigin(o: THREE.Object3D, coord: IGridCoord): void;

  // Transforms the object, assumed to be at the zero edge, to be at the
  // given one instead.
  transformToEdge(o: THREE.Object3D, coord: IGridEdge): void;
}

export class EdgeGeometry { // to help me share the edge code
  readonly tip1: THREE.Vector3;
  readonly tip2: THREE.Vector3;
  readonly bevel1a: THREE.Vector3;
  readonly bevel2a: THREE.Vector3;
  readonly bevel1b: THREE.Vector3;
  readonly bevel2b: THREE.Vector3;

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
  private readonly _tileDim: number;
  private readonly _maxEdge: number;
  private readonly _epsilon: number;

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

  createCoordCentre(coord: IGridCoord, z: number): FaceCentre {
    return this.createCentre(coord.x, coord.y, z);
  }

  protected abstract createEdgeGeometry(coord: IGridEdge, alpha: number, z: number): EdgeGeometry;

  private pushEdgeVertices(vertices: THREE.Vector3[], tile: THREE.Vector2, alpha: number, x: number, y: number, z: number, e: number) {
    var edge = createGridEdge(tile, new THREE.Vector2(x, y), this.tileDim, e);
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

  decodeCoordSample(sample: Uint8Array, offset: number): IGridCoord | undefined {
    var tile = this.fromPackedXYEdge(sample, offset)[0];
    var face = this.fromPackedXYAbs(sample, offset + 2);
    return tile instanceof THREE.Vector2 ? createGridCoord(tile, face, this.tileDim) : undefined;
  }

  decodeEdgeSample(sample: Uint8Array, offset: number): IGridEdge | undefined {
    var [tile, edge] = this.fromPackedXYEdge(sample, offset);
    var face = this.fromPackedXYAbs(sample, offset + 2);
    return tile instanceof THREE.Vector2 ? createGridEdge(tile, face, this.tileDim, edge as number)
      : undefined;
  }

  transformToCoord(o: THREE.Object3D, coord: IGridCoord): void {
    var centre = this.createCoordCentre(coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
  }

  transformToOrigin(o: THREE.Object3D, coord: IGridCoord): void {
    var negated = coordMultiplyScalar(coord, -1);
    this.transformToCoord(o, negated);
  }
}
