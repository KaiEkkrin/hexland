import { IGridCoord, IGridEdge, createGridCoord, createGridEdge, coordMultiplyScalar, createGridVertex, IGridVertex } from '../data/coord';
import { EdgeOcclusion } from './edgeOcclusion';
import * as THREE from 'three';

// A grid geometry describes a grid's layout (currently either squares
// or hexagons.)
export interface IGridGeometry {
  // Creates the co-ordinates of the centre of this face.
  createCoordCentre(target: THREE.Vector3, coord: IGridCoord, z: number): THREE.Vector3;

  // Creates the co-ordinates of a suitable position to put an annotation.
  // Invalidates the scratch vectors.
  createAnnotationPosition(target: THREE.Vector3, scratch1: THREE.Vector3, scratch2: THREE.Vector3, coord: IGridCoord, z: number, alpha: number): THREE.Vector3;

  // Creates the co-ordinates of the centre of this edge.  Invalidates the scratch vectors.
  createEdgeCentre(target: THREE.Vector3, scratch1: THREE.Vector3, scratch2: THREE.Vector3, edge: IGridEdge, z: number): THREE.Vector3;

  // Creates the co-ordinates of the centre of this vertex.
  createVertexCentre(target: THREE.Vector3, vertex: IGridVertex, z: number): THREE.Vector3;

  // Creates the edge occlusion tester for the edge when seen from the coord.
  createEdgeOcclusion(coord: IGridCoord, edge: IGridEdge, z: number): EdgeOcclusion;

  // Creates the vertices involved in drawing a full grid tile.
  createGridVertices(tile: THREE.Vector2, z: number): Iterable<THREE.Vector3>;

  // Creates a buffer of indices into the output of `createGridVertices`
  // suitable for drawing a full grid of lines.
  createGridLineIndices(): Iterable<number>;

  // Creates the vertices to use for an occlusion test.
  createOcclusionTestVertices(coord: IGridCoord, z: number, alpha: number): Iterable<THREE.Vector3>;

  // Creates the vertices involved in drawing the grid tile in solid.
  // The alpha number specifies how much of a face is covered.
  createSolidVertices(tile: THREE.Vector2, alpha: number, z: number): Iterable<THREE.Vector3>;

  // Creates a buffer of indices into the output of `createSolidVertices`
  // suitable for drawing a solid mesh of the grid.
  createSolidMeshIndices(): Iterable<number>;

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

  // Creates the vertices involved in drawing grid vertices in solid.
  // The alpha number specifies how thick the edge is drawn.
  createSolidVertexVertices(tile: THREE.Vector2, alpha: number, z: number, maxVertex?: number | undefined): THREE.Vector3[];

  // Creates a buffer of indices into the output of `createSolidVertexVertices`
  // suitable for drawing the vertex blobs onto the grid.
  createSolidVertexIndices(maxVertex?: number | undefined): Iterable<number>;

  // Creates the colours for a vertex texture using the solid vertex vertices.
  createSolidVertexColours(tile: THREE.Vector2): Float32Array;

  // Creates some colours for testing the solid vertex vertices, above.
  createSolidVertexTestColours(): Float32Array;

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

  // Decodes the given sample from a vertex texture (these must be 4 values
  // starting from the offset) into a grid coord.
  decodeVertexSample(sample: Uint8Array, offset: number): IGridVertex | undefined;

  // A measure of the face size in this geometry.
  faceSize(): number;

  // Evaluates the function for each face adjacent to the given one.
  forEachAdjacentFace(coord: IGridCoord, fn: (face: IGridCoord, edge: IGridEdge) => void): void;

  // Gets the faces adjacent to the given edge. (TODO adjacent edges too?)
  getEdgeFaceAdjacency(edge: IGridEdge): IGridCoord[];

  // Gets the vertices adjacent to the given edge.
  getEdgeVertexAdjacency(edge: IGridEdge): IGridVertex[];

  // Gets the edges adjacent to the given vertex.
  getVertexEdgeAdjacency(vertex: IGridVertex): IGridEdge[];

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

  // Transforms the object, assumed to be at the zero vertex, to be at the
  // given one instead.
  transformToVertex(o: THREE.Object3D, coord: IGridVertex): void;
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
    this.bevel1a = tip1.clone().lerp(centre, alpha);
    this.bevel2a = tip2.clone().lerp(centre, alpha);
    this.bevel1b = tip1.clone().lerp(otherCentre, alpha);
    this.bevel2b = tip2.clone().lerp(otherCentre, alpha);
  }
}

const vertexRimCount = 12; // the number of vertices we draw around the rim of a vertex blob
                           // Higher number = more circular

export abstract class BaseGeometry {
  private readonly _tileDim: number;
  private readonly _maxEdge: number;
  private readonly _maxVertex: number;
  private readonly _epsilon: number;

  constructor(tileDim: number, maxEdge: number, maxVertex: number) {
    if (maxVertex > maxEdge) {
      throw new RangeError("maxVertex must not be greater than maxEdge");
    }

    this._tileDim = tileDim;
    this._maxEdge = maxEdge;
    this._maxVertex = maxVertex;
    this._epsilon = 1.0 / 255.0; // to avoid floor errors when decoding
                                 // TODO use an integer texture instead to avoid this yuck and handle bigger maps
                                 // (requires figuring out how to specify one, however!)
  }

  protected get tileDim() { return this._tileDim; }
  protected get maxEdge() { return this._maxEdge; }
  protected get maxVertex() { return this._maxVertex; }

  protected abstract createCentre(target: THREE.Vector3, x: number, y: number, z: number): THREE.Vector3;

  createCoordCentre(target: THREE.Vector3, coord: IGridCoord, z: number): THREE.Vector3 {
    return this.createCentre(target, coord.x, coord.y, z);
  }

  protected abstract createEdgeGeometry(coord: IGridEdge, alpha: number, z: number): EdgeGeometry;
  protected abstract createEdgeVertices(target1: THREE.Vector3, target2: THREE.Vector3, centre: THREE.Vector3, edge: number): void;

  createEdgeCentre(target: THREE.Vector3, scratch1: THREE.Vector3, scratch2: THREE.Vector3, edge: IGridEdge, z: number): THREE.Vector3 {
    this.createCoordCentre(scratch2, edge, z);
    this.createEdgeVertices(target, scratch1, scratch2, edge.edge);
    return target.lerp(scratch1, 0.5);
  }

  abstract createVertexCentre(target: THREE.Vector3, vertex: IGridVertex, z: number): THREE.Vector3;

  protected abstract getVertexRadius(alpha: number): number;

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

  private pushVertexVertices(vertices: THREE.Vector3[], tile: THREE.Vector2, radius: number, x: number, y: number, z: number, v: number) {
    const iStart = vertices.length;

    // We push the centre, followed by the rim start point rotated `vertexRimCount`
    // times around the rim, doing everything at the origin to make the rotation
    // easier:
    var origin = new THREE.Vector3(0, 0, 0);
    vertices.push(origin);

    const rimStart = new THREE.Vector3(-radius, 0, 0);
    const axis = new THREE.Vector3(0, 0, 1);
    for (var r = 0; r < vertexRimCount; ++r) {
      vertices.push(rimStart.clone().applyAxisAngle(axis, r * 2.0 * Math.PI / vertexRimCount));
    }

    // Now we translate everything
    var vertex = createGridVertex(tile, new THREE.Vector2(x, y), this.tileDim, v);
    const centre = this.createVertexCentre(new THREE.Vector3(), vertex, z);
    for (var i = iStart; i < vertices.length; ++i) {
      vertices[i].add(centre);
    }
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

  createSolidVertexVertices(tile: THREE.Vector2, alpha: number, z: number, maxVertex?: number | undefined): THREE.Vector3[] {
    var radius = this.getVertexRadius(alpha);
    var vertices: THREE.Vector3[] = [];
    maxVertex = Math.min(maxVertex ?? this.maxVertex, this.maxVertex);
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var v = 0; v < maxVertex; ++v) {
          this.pushVertexVertices(vertices, tile, radius, x, y, z, v);
        }
      }
    }

    return vertices;
  }

  *createSolidVertexIndices(maxVertex?: number | undefined) {
    var baseIndex = 0;
    maxVertex = Math.min(maxVertex ?? this.maxVertex, this.maxVertex);
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var v = 0; v < maxVertex; ++v) {
          // We create one triangle for each vertex around the rim:
          for (var t = 0; t < vertexRimCount; ++t) {
            yield baseIndex;
            yield baseIndex + 1 + (t + 1) % vertexRimCount;
            yield baseIndex + 1 + t;
            yield -1;
          }

          // There are (vertexRimCount + 1) vertices for each object --
          // one in the middle and the others around the rim
          baseIndex += vertexRimCount + 1;
        }
      }
    }
  }

  createSolidVertexColours(tile: THREE.Vector2) {
    var colours = new Float32Array(this.tileDim * this.tileDim * this.maxVertex * (vertexRimCount + 1) * 3);
    var offset = 0;
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var v = 0; v < this.maxVertex; ++v) {
          for (var w = 0; w < (vertexRimCount + 1); ++w) {
            this.toPackedXYEdge(colours, offset, tile.x, tile.y, v);
            this.toPackedXYAbs(colours, offset + 2, x, y); // never negative
            offset += 3;
          }
        }
      }
    }

    return colours;
  }

  createSolidVertexTestColours() {
    var colours = new Float32Array(this.tileDim * this.tileDim * this.maxVertex * (vertexRimCount + 1) * 3);
    var colour = new THREE.Color();
    var offset = 0;
    for (var i = 0; i < this.tileDim * this.tileDim; ++i) {
      for (var v = 0; v < this.maxVertex; ++v) {
        colour.setHSL(i / (this.tileDim * this.tileDim), v === 0 ? 0.5 : 1, 0.5);
        for (var w = 0; w < (vertexRimCount + 1); ++w) {
          colours[offset++] = colour.r;
          colours[offset++] = colour.g;
          colours[offset++] = colour.b;
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

  decodeVertexSample(sample: Uint8Array, offset: number): IGridVertex | undefined {
    var [tile, vertex] = this.fromPackedXYEdge(sample, offset);
    var face = this.fromPackedXYAbs(sample, offset + 2);
    return tile instanceof THREE.Vector2 ? createGridVertex(tile, face, this.tileDim, vertex as number)
      : undefined;
  }

  transformToCoord(o: THREE.Object3D, coord: IGridCoord): void {
    var centre = this.createCoordCentre(new THREE.Vector3(), coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
  }

  transformToOrigin(o: THREE.Object3D, coord: IGridCoord): void {
    var negated = coordMultiplyScalar(coord, -1);
    this.transformToCoord(o, negated);
  }
}
