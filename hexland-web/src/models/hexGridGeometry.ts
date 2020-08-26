import { IGridCoord, IGridEdge, IGridVertex, coordAdd } from '../data/coord';
import { EdgeOcclusion } from './occlusion';
import { BaseGeometry, IGridGeometry, EdgeGeometry } from './gridGeometry';
import * as THREE from 'three';

// A tile of hexes.
export class HexGridGeometry extends BaseGeometry implements IGridGeometry {
  private readonly _hexSize: number;

  private readonly _xStep: number;
  private readonly _yStep: number;
  private readonly _xOffLeft: number;
  private readonly _xOffTop: number;
  private readonly _yOffTop: number;

  constructor(hexSize: number, tileDim: number) {
    super(tileDim, 3, 2);
    this._hexSize = hexSize;

    this._xStep = this._hexSize * Math.sin(Math.PI / 3.0);
    this._yStep = this._hexSize / 2.0; // * Math.sin(Math.PI / 6.0)
    this._xOffLeft = this._xStep * 2.0 / 3.0;
    this._xOffTop = this._xStep / 3.0;
    this._yOffTop = this._hexSize * 0.5;
  }

  protected createCentre(target: THREE.Vector3, x: number, y: number, z: number): THREE.Vector3 {
    return target.set(x * this._xStep, x * this._yStep + y * this._hexSize, z);
  }

  private createLeft(target: THREE.Vector3, c: THREE.Vector3) {
    return target.set(c.x - this._xOffLeft, c.y, c.z);
  }

  private createTopLeft(target: THREE.Vector3, c: THREE.Vector3) {
    return target.set(c.x - this._xOffTop, c.y - this._yOffTop, c.z);
  }

  private createTopRight(target: THREE.Vector3, c: THREE.Vector3) {
    return target.set(c.x + this._xOffTop, c.y - this._yOffTop, c.z);
  }

  private createRight(target: THREE.Vector3, c: THREE.Vector3) {
    return target.set(c.x + this._xOffLeft, c.y, c.z);
  }

  private createBottomLeft(target: THREE.Vector3, c: THREE.Vector3) {
    return target.set(c.x - this._xOffTop, c.y + this._yOffTop, c.z);
  }

  private createBottomRight(target: THREE.Vector3, c: THREE.Vector3) {
    return target.set(c.x + this._xOffTop, c.y + this._yOffTop, c.z);
  }

  createAnnotationPosition(target: THREE.Vector3, scratch1: THREE.Vector3, scratch2: THREE.Vector3, coord: IGridCoord, z: number, alpha: number): THREE.Vector3 {
    this.createCoordCentre(target, coord, z);
    this.createLeft(scratch1, target);
    return target.lerp(scratch1, alpha);
  }

  createTokenAnnotationPosition(target: THREE.Vector3, scratch1: THREE.Vector3, scratch2: THREE.Vector3, coord: IGridCoord, z: number, alpha: number): THREE.Vector3 {
    this.createCoordCentre(target, coord, z);
    this.createBottomLeft(scratch1, target);
    return target.lerp(scratch1, alpha);
  }

  createEdgeVertices(target1: THREE.Vector3, target2: THREE.Vector3, centre: THREE.Vector3, edge: number) {
    switch (edge) {
      case 0:
        this.createLeft(target1, centre);
        this.createTopLeft(target2, centre);
        break;

      case 1:
        this.createTopLeft(target1, centre);
        this.createTopRight(target2, centre);
        break;

      default:
        this.createTopRight(target1, centre);
        this.createRight(target2, centre);
        break;
    }
  }

  protected createEdgeGeometry(coord: IGridEdge, alpha: number, z: number): EdgeGeometry {
    var centre = this.createCoordCentre(new THREE.Vector3(), coord, z);
    var otherCentre = this.createCoordCentre(
      new THREE.Vector3(),
      coord.edge === 0 ? coordAdd(coord, { x: -1, y: 0 }) :
      coord.edge === 1 ? coordAdd(coord, { x: 0, y: -1 }) :
      coordAdd(coord, { x: 1, y: -1 }),
      z
    );

    var [tip1, tip2] = [new THREE.Vector3(), new THREE.Vector3()];
    this.createEdgeVertices(tip1, tip2, centre, coord.edge);
    return new EdgeGeometry(tip1, tip2, centre, otherCentre, alpha);
  }

  createVertexCentre(target: THREE.Vector3, vertex: IGridVertex, z: number): THREE.Vector3 {
    // Vertex 0 is the left, vertex 1 the top left
    this.createCoordCentre(target, vertex, z);
    return vertex.vertex === 0 ? this.createLeft(target, target) : this.createTopLeft(target, target);
  }

  protected getVertexRadius(alpha: number) {
    return this._xOffLeft * alpha;
  }

  private *getHexIndices(offset: number) {
    yield offset;
    yield offset + 2;
    yield offset + 1;
    yield -1;

    yield offset;
    yield offset + 3;
    yield offset + 2;
    yield -1;

    yield offset;
    yield offset + 4;
    yield offset + 3;
    yield -1;

    yield offset;
    yield offset + 5;
    yield offset + 4;
    yield -1;

    yield offset;
    yield offset + 6;
    yield offset + 5;
    yield -1;

    yield offset;
    yield offset + 1;
    yield offset + 6;
    yield -1;
  }

  private vertexIndexOf(x: number, y: number, v: number) {
    return (y + 1) * (this.tileDim + 1) * 2 + x * 2 + v;
  }

  createEdgeOcclusion(coord: IGridCoord, edge: IGridEdge, z: number): EdgeOcclusion {
    var [edgeA, edgeB] = [new THREE.Vector3(), new THREE.Vector3()];

    var centre = this.createCentre(new THREE.Vector3(), edge.x, edge.y, z);
    this.createEdgeVertices(edgeA, edgeB, centre, edge.edge);

    this.createCoordCentre(centre, coord, z);
    return new EdgeOcclusion(centre, edgeA, edgeB, this._hexSize * 0.01);
  }

  *createOcclusionTestVertices(coord: IGridCoord, z: number, alpha: number): Iterable<THREE.Vector3> {
    var centre = new THREE.Vector3();
    yield this.createCoordCentre(centre, coord, z);

    const invAlpha = 1 - alpha * 0.5;
    yield this.createLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
    yield this.createTopLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
    yield this.createTopRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
    yield this.createRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
    yield this.createBottomRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
    yield this.createBottomLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
  }

  *createSolidVertices(tile: THREE.Vector2, alpha: number, z: number): Iterable<THREE.Vector3> {
    const invAlpha = 1 - alpha;
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        var centre = new THREE.Vector3();
        yield this.createCentre(centre, tile.x * this.tileDim + x, tile.y * this.tileDim + y, z);
        yield this.createLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
        yield this.createTopLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
        yield this.createTopRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
        yield this.createRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
        yield this.createBottomRight(new THREE.Vector3(), centre).lerp(centre, invAlpha);
        yield this.createBottomLeft(new THREE.Vector3(), centre).lerp(centre, invAlpha);
      }
    }
  }

  *createSolidMeshIndices() {
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        var baseIndex = y * this.tileDim * 7 + x * 7;
        yield* this.getHexIndices(baseIndex);
      }
    }
  }

  createSolidTestColours(): Float32Array {
    var colours = new Float32Array(this.tileDim * this.tileDim * 21);
    var colour = new THREE.Color();
    for (var i = 0; i < this.tileDim * this.tileDim; ++i) {
      colour.setHSL(i / (this.tileDim * this.tileDim), 1, 0.5);
      for (var j = 0; j < 7; ++j) {
        colours[i * 21 + j * 3] = colour.r;
        colours[i * 21 + j * 3 + 1] = colour.g;
        colours[i * 21 + j * 3 + 2] = colour.b;
      }
    }

    return colours;
  }

  createSolidCoordColours(tile: THREE.Vector2): Float32Array {
    var colours = new Float32Array(this.tileDim * this.tileDim * 21);
    var offset = 0;
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var i = 0; i < 7; ++i) {
          this.toPackedXYEdge(colours, offset, tile.x, tile.y, 0);
          this.toPackedXYAbs(colours, offset + 2, x, y);
          offset += 3;
        }
      }
    }

    return colours;
  }

  faceSize(): number {
    return this._hexSize;
  }

  forEachAdjacentFace(coord: IGridCoord, fn: (face: IGridCoord, edge: IGridEdge) => void) {
    // Top left
    fn(
      { x: coord.x - 1, y: coord.y },
      { x: coord.x, y: coord.y, edge: 0 }
    );

    // Top
    fn(
      { x: coord.x, y: coord.y - 1 },
      { x: coord.x, y: coord.y, edge: 1 }
    );

    // Top right
    fn(
      { x: coord.x + 1, y: coord.y - 1 },
      { x: coord.x, y: coord.y, edge: 2 }
    )

    // Bottom right
    fn(
      { x: coord.x + 1, y: coord.y },
      { x: coord.x + 1, y: coord.y, edge: 0 }
    );

    // Bottom
    fn(
      { x: coord.x, y: coord.y + 1 },
      { x: coord.x, y: coord.y + 1, edge: 1 }
    );

    // Bottom left
    fn(
      { x: coord.x - 1, y: coord.y + 1 },
      { x: coord.x - 1, y: coord.y + 1, edge: 2 }
    );
  }

  getEdgeFaceAdjacency(edge: IGridEdge): IGridCoord[] {
    switch (edge.edge) {
      case 0: // left
        return [{ x: edge.x - 1, y: edge.y }, { x: edge.x, y: edge.y }];

      case 1: // top left
        return [{ x: edge.x, y: edge.y - 1 }, { x: edge.x, y: edge.y }];

      default: // top right
        return [{ x: edge.x + 1, y: edge.y - 1 }, { x: edge.x, y: edge.y }];
    }
  }

  getEdgeVertexAdjacency(edge: IGridEdge): IGridVertex[] {
    switch (edge.edge) {
      case 0:
        return [{ x: edge.x, y: edge.y, vertex: 0 }, { x: edge.x, y: edge.y, vertex: 1 }];

      case 1:
        return [{ x: edge.x, y: edge.y, vertex: 1 }, { x: edge.x + 1, y: edge.y - 1, vertex: 0 }];

      default: // 2
        return [{ x: edge.x + 1, y: edge.y - 1, vertex: 0 }, { x: edge.x + 1, y: edge.y, vertex: 1 }];
    }
  }

  getVertexEdgeAdjacency(vertex: IGridVertex): IGridEdge[] {
    switch (vertex.vertex) {
      case 0:
        return [
          { x: vertex.x, y: vertex.y, edge: 0 },
          { x: vertex.x - 1, y: vertex.y + 1, edge: 2 },
          { x: vertex.x - 1, y: vertex.y + 1, edge: 1 }
        ];

      default: // 1
        return [
          { x: vertex.x, y: vertex.y, edge: 0 },
          { x: vertex.x, y: vertex.y, edge: 1 },
          { x: vertex.x - 1, y: vertex.y, edge: 2 }
        ];
    }
  }

  toSingle(): IGridGeometry {
    return new HexGridGeometry(this._hexSize, 1);
  }

  transformToEdge(o: THREE.Object3D, coord: IGridEdge): void {
    var centre = this.createCoordCentre(new THREE.Vector3(), coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
    if (coord.edge === 1) {
      o.rotateZ(Math.PI / 3.0);
    } else if (coord.edge === 2) {
      o.rotateZ(Math.PI * 2.0 / 3.0);
    }
  }

  transformToVertex(o: THREE.Object3D, coord: IGridVertex): void {
    var centre = this.createCoordCentre(new THREE.Vector3(), coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
    if (coord.vertex === 1) {
      o.rotateZ(Math.PI / 3.0);
    }
  }
}