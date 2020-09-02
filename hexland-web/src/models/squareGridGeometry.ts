import { IGridCoord, IGridEdge, coordAdd, IGridVertex } from '../data/coord';
import { EdgeOcclusion } from './occlusion';
import { BaseGeometry, IGridGeometry, EdgeGeometry } from './gridGeometry';
import * as THREE from 'three';

export class SquareGridGeometry extends BaseGeometry implements IGridGeometry {
  private readonly _squareSize: number;
  private readonly _off: number;

  constructor(squareSize: number, tileDim: number) {
    super(tileDim, 2, 1);
    this._squareSize = squareSize;
    this._off = squareSize * 0.5;
  }

  get faceSize() { return this._squareSize; }

  protected get faceVertexCount() { return 4; }

  protected createCentre(target: THREE.Vector3, x: number, y: number, z: number): THREE.Vector3 {
    return target.set(x * this._squareSize, y * this._squareSize, z);
  }

  private createTopLeft(target: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    return target.set(c.x - this._off, c.y - this._off, c.z);
  }

  private createTopRight(target: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    return target.set(c.x + this._off, c.y - this._off, c.z);
  }

  private createBottomLeft(target: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    return target.set(c.x - this._off, c.y + this._off, c.z);
  }

  private createBottomRight(target: THREE.Vector3, c: THREE.Vector3): THREE.Vector3 {
    return target.set(c.x + this._off, c.y + this._off, c.z);
  }

  createAnnotationPosition(target: THREE.Vector3, scratch1: THREE.Vector3, scratch2: THREE.Vector3, coord: IGridCoord, z: number, alpha: number): THREE.Vector3 {
    this.createCoordCentre(target, coord, z);
    this.createBottomLeft(scratch1, target);
    this.createTopLeft(scratch2, target);
    scratch1.lerp(scratch2, 0.5);
    return target.lerp(scratch1, alpha);
  }

  createTokenAnnotationPosition(target: THREE.Vector3, scratch1: THREE.Vector3, scratch2: THREE.Vector3, coord: IGridCoord, z: number, alpha: number): THREE.Vector3 {
    this.createCoordCentre(target, coord, z);
    this.createBottomLeft(scratch1, target);
    return target.lerp(scratch1, alpha);
  }

  protected createEdgeVertices(target1: THREE.Vector3, target2: THREE.Vector3, centre: THREE.Vector3, edge: number) {
    switch (edge) {
      case 0:
        this.createBottomLeft(target1, centre);
        this.createTopLeft(target2, centre);
        break;

      case 1:
        this.createTopLeft(target1, centre);
        this.createTopRight(target2, centre);
        break;
    }
  }

  protected createEdgeGeometry(coord: IGridEdge, alpha: number, z: number): EdgeGeometry {
    var centre = this.createCoordCentre(new THREE.Vector3(), coord, z);
    var otherCentre = this.createCoordCentre(
      new THREE.Vector3(),
      coord.edge === 0 ? coordAdd(coord, { x: -1, y: 0 }) :
      coordAdd(coord, { x: 0, y: -1 }),
      z
    );

    var [tip1, tip2] = [new THREE.Vector3(), new THREE.Vector3()];
    this.createEdgeVertices(tip1, tip2, centre, coord.edge);
    return new EdgeGeometry(tip1, tip2, centre, otherCentre, alpha);
  }

  createVertexCentre(target: THREE.Vector3, vertex: IGridVertex, z: number) {
    // In the square grid, each face owns only one vertex (the top left) and we can
    // actually ignore the vertex number.
    this.createCoordCentre(target, vertex, z);
    return this.createTopLeft(target, target);
  }

  protected getVertexRadius(alpha: number) {
    return this._squareSize * alpha;
  }

  private *getSquareIndices(baseIndex: number) {
    yield baseIndex;
    yield baseIndex + 1;
    yield baseIndex + 2;
    yield -1;

    yield baseIndex + 1;
    yield baseIndex + 3;
    yield baseIndex + 2;
    yield -1;
  }

  createEdgeOcclusion(coord: IGridCoord, edge: IGridEdge, z: number): EdgeOcclusion {
    var [edgeA, edgeB] = [new THREE.Vector3(), new THREE.Vector3()];

    var centre = this.createCentre(new THREE.Vector3(), edge.x, edge.y, z);
    this.createEdgeVertices(edgeA, edgeB, centre, edge.edge);

    this.createCoordCentre(centre, coord, z);
    return new EdgeOcclusion(centre, edgeA, edgeB, this._squareSize * 0.01);
  }

  *createOcclusionTestVertices(coord: IGridCoord, z: number, alpha: number): Iterable<THREE.Vector3> {
    var centre = new THREE.Vector3();
    yield this.createCoordCentre(centre, coord, z);

    const invAlpha = 1 - alpha;
    yield this.createTopLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
    yield this.createBottomLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
    yield this.createTopRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
    yield this.createBottomRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
  }

  *createSolidVertices(tile: THREE.Vector2, alpha: number, z: number): Iterable<THREE.Vector3> {
    var centre = new THREE.Vector3();
    const invAlpha = 1 - alpha;
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        this.createCentre(centre, tile.x * this.tileDim + x, tile.y * this.tileDim + y, z);
        yield this.createTopLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
        yield this.createBottomLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
        yield this.createTopRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
        yield this.createBottomRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
      }
    }
  }

  // Creates a buffer of indices into the output of `createSolidVertices`
  // suitable for drawing a solid mesh of the grid.
  *createSolidMeshIndices() {
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        // For some reason Three.js uses triangles rather than triangle strips, grr
        var baseIndex = y * this.tileDim * 4 + x * 4;
        yield* this.getSquareIndices(baseIndex);
      }
    }
  }

  // Creates some colours for testing the solid vertices, above.
  createSolidTestColours(): Float32Array {
    var colours = new Float32Array(this.tileDim * this.tileDim * 12);
    var colour = new THREE.Color();
    for (var i = 0; i < this.tileDim * this.tileDim; ++i) {
      colour.setHSL(i / (this.tileDim * this.tileDim), 1, 0.5);
      for (var j = 0; j < 4; ++j) {
        colours[i * 12 + j * 3] = colour.r;
        colours[i * 12 + j * 3 + 1] = colour.g;
        colours[i * 12 + j * 3 + 2] = colour.b;
      }
    }

    return colours;
  }

  createSolidCoordColours(tile: THREE.Vector2): Float32Array {
    var colours = new Float32Array(this.tileDim * this.tileDim * 12);
    var offset = 0;
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var i = 0; i < 4; ++i) {
          this.toPackedXYEdge(colours, offset, tile.x, tile.y, 0);
          this.toPackedXYAbs(colours, offset + 2, x, y);
          offset += 3;
        }
      }
    }

    return colours;
  }

  forEachAdjacentFace(coord: IGridCoord, fn: (face: IGridCoord, edge: IGridEdge) => void) {
    // Left
    fn(
      { x: coord.x - 1, y: coord.y },
      { x: coord.x, y: coord.y, edge: 0 }
    );

    // Top
    fn(
      { x: coord.x, y: coord.y - 1 },
      { x: coord.x, y: coord.y, edge: 1 }
    );

    // Right
    fn(
      { x: coord.x + 1, y: coord.y },
      { x: coord.x + 1, y: coord.y, edge: 0 }
    );

    // Bottom
    fn(
      { x: coord.x, y: coord.y + 1 },
      { x: coord.x, y: coord.y + 1, edge: 1 }
    );
  }

  getEdgeFaceAdjacency(edge: IGridEdge): IGridCoord[] {
    switch (edge.edge) {
      case 0: // left
        return [{ x: edge.x - 1, y: edge.y }, { x: edge.x, y: edge.y }];

      default: // top
        return [{ x: edge.x, y: edge.y - 1 }, { x: edge.x, y: edge.y }];
    }
  }

  getEdgeVertexAdjacency(edge: IGridEdge): IGridVertex[] {
    switch (edge.edge) {
      case 0:
        return [{ x: edge.x, y: edge.y + 1, vertex: 0 }, { x: edge.x, y: edge.y, vertex: 0 }];

      default: // 1
        return [{ x: edge.x, y: edge.y, vertex: 0 }, { x: edge.x + 1, y: edge.y, vertex: 0 }];
    }
  }

  getVertexEdgeAdjacency(vertex: IGridVertex): IGridEdge[] {
    return [
      { x: vertex.x, y: vertex.y, edge: 0 },
      { x: vertex.x, y: vertex.y, edge: 1 },
      { x: vertex.x, y: vertex.y - 1, edge: 0 },
      { x: vertex.x - 1, y: vertex.y, edge: 1 }
    ];
  }

  toSingle(): IGridGeometry {
    return new SquareGridGeometry(this._squareSize, 1);
  }

  transformToEdge(o: THREE.Object3D, coord: IGridEdge): void {
    var centre = this.createCoordCentre(new THREE.Vector3(), coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
    if (coord.edge === 1) {
      o.rotateZ(Math.PI * 0.5);
    }
  }

  transformToVertex(o: THREE.Object3D, coord: IGridVertex): void {
    var centre = this.createCoordCentre(new THREE.Vector3(), coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
  }

  createShaderDeclarations() {
    return [
      "uniform float squareSize;"
    ];
  }

  createShaderSnippet() {
    return [
      "vec2 createCoordCentre(const in vec2 coord) {",
      "  return vec2(coord.x * squareSize, coord.y * squareSize);",
      "}"
    ];
  }

  createShaderUniforms() {
    return {
      squareSize: { type: 'f', value: null }
    };
  }

  populateShaderUniforms(uniforms: any) {
    uniforms['squareSize'].value = this._squareSize;
  }
}