import { IGridCoord, IGridEdge, coordAdd } from '../data/coord';
import { EdgeOcclusion } from './edgeOcclusion';
import { lerp } from './extraMath';
import { BaseGeometry, FaceCentre, IGridGeometry, EdgeGeometry } from './gridGeometry';
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
    super(tileDim, 3);
    this._hexSize = hexSize;

    this._xStep = this._hexSize * Math.sin(Math.PI / 3.0);
    this._yStep = this._hexSize / 2.0; // * Math.sin(Math.PI / 6.0)
    this._xOffLeft = this._xStep * 2.0 / 3.0;
    this._xOffTop = this._xStep / 3.0;
    this._yOffTop = this._hexSize * 0.5;
  }

  protected createCentre(x: number, y: number, z: number): FaceCentre {
    return new FaceCentre(x * this._xStep, x * this._yStep + y * this._hexSize, z);
  }

  private createLeft(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._xOffLeft, c.y, c.z);
  }

  private createTopLeft(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._xOffTop, c.y - this._yOffTop, c.z);
  }

  private createTopRight(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._xOffTop, c.y - this._yOffTop, c.z);
  }

  private createRight(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._xOffLeft, c.y, c.z);
  }

  private createBottomLeft(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._xOffTop, c.y + this._yOffTop, c.z);
  }

  private createBottomRight(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._xOffTop, c.y + this._yOffTop, c.z);
  }

  protected createEdgeGeometry(coord: IGridEdge, alpha: number, z: number): EdgeGeometry {
    var centre = this.createCoordCentre(coord, z);
    var otherCentre = this.createCoordCentre(
      coord.edge === 0 ? coordAdd(coord, { x: -1, y: 0 }) :
      coord.edge === 1 ? coordAdd(coord, { x: 0, y: -1 }) :
      coordAdd(coord, { x: 1, y: -1 }),
      z
    );

    var tip1 = coord.edge === 0 ? this.createLeft(centre) :
      coord.edge === 1 ? this.createTopLeft(centre) :
      this.createTopRight(centre);

    var tip2 = coord.edge === 0 ? this.createTopLeft(centre) :
      coord.edge === 1 ? this.createTopRight(centre) :
      this.createRight(centre);

    return new EdgeGeometry(tip1, tip2, centre, otherCentre, alpha);
  }

  private pushHexIndices(indices: number[], offset: number) {
    indices.push(offset);
    indices.push(offset + 2);
    indices.push(offset + 1);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 3);
    indices.push(offset + 2);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 4);
    indices.push(offset + 3);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 5);
    indices.push(offset + 4);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 6);
    indices.push(offset + 5);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 1);
    indices.push(offset + 6);
    indices.push(-1);
  }

  private vertexIndexOf(x: number, y: number, v: number) {
    return (y + 1) * (this.tileDim + 1) * 2 + x * 2 + v;
  }

  createEdgeOcclusion(coord: IGridCoord, edge: IGridEdge, z: number): EdgeOcclusion {
    const coordCentre = this.createCoordCentre(coord, z);
    const edgeCentre = this.createCentre(edge.x, edge.y, z);
    const [edgeA, edgeB] = edge.edge === 0 ? [this.createLeft(edgeCentre), this.createTopLeft(edgeCentre)] :
      edge.edge === 1 ? [this.createTopLeft(edgeCentre), this.createTopRight(edgeCentre)] :
      [this.createTopRight(edgeCentre), this.createRight(edgeCentre)];
    return new EdgeOcclusion(coordCentre, edgeA, edgeB, this._hexSize * 0.01);
  }

  createGridVertices(tile: THREE.Vector2, z: number): THREE.Vector3[] {
    var vertices = [];

    // For each hex, we need to add only two unique vertices out of six; we'll use
    // the left and top-left vertices.  We need to fill in enough points for createLineIndices()
    // below to have access to all it needs 
    for (var y = -1; y <= this.tileDim; ++y) {
      for (var x = 0; x <= this.tileDim; ++x) {
        var centre = this.createCentre(tile.x * this.tileDim + x, tile.y * this.tileDim + y, z);
        vertices.push(this.createLeft(centre));
        vertices.push(this.createTopLeft(centre));
      }
    }

    return vertices;
  }

  createGridLineIndices(): number[] {
    var indices = [];

    // We only need to draw the top part of each hex -- the bottom part will be taken care of.
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        // Left -- 1st vertex of the hex at (x, y)
        indices.push(this.vertexIndexOf(x, y, 0));

        // Top left -- 2nd vertex of the hex at (x, y)
        indices.push(this.vertexIndexOf(x, y, 1));

        // Top right -- 1st vertex of the hex at (x + 1, y - 1)
        indices.push(this.vertexIndexOf(x + 1, y - 1, 0));

        // Right -- 2nd vertex of the hex at (x + 1, y)
        indices.push(this.vertexIndexOf(x + 1, y, 1));

        // Push a primitive restart
        indices.push(-1);
      }
    }

    return indices;
  }

  createOcclusionTestVertices(coord: IGridCoord, z: number, alpha: number): THREE.Vector3[] {
    var vertices = [];
    var centre = this.createCoordCentre(coord, z);
    vertices.push(centre);
    vertices.push(centre.clone().lerp(this.createLeft(centre), alpha));
    vertices.push(centre.clone().lerp(this.createTopLeft(centre), alpha));
    vertices.push(centre.clone().lerp(this.createTopRight(centre), alpha));
    vertices.push(centre.clone().lerp(this.createRight(centre), alpha));
    vertices.push(centre.clone().lerp(this.createBottomRight(centre), alpha));
    vertices.push(centre.clone().lerp(this.createBottomLeft(centre), alpha));
    return vertices;
  }

  createSolidVertices(tile: THREE.Vector2, alpha: number, z: number): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        var centre = this.createCentre(tile.x * this.tileDim + x, tile.y * this.tileDim + y, z);
        vertices.push(centre);
        vertices.push(lerp(centre, this.createLeft(centre), alpha));
        vertices.push(lerp(centre, this.createTopLeft(centre), alpha));
        vertices.push(lerp(centre, this.createTopRight(centre), alpha));
        vertices.push(lerp(centre, this.createRight(centre), alpha));
        vertices.push(lerp(centre, this.createBottomRight(centre), alpha));
        vertices.push(lerp(centre, this.createBottomLeft(centre), alpha));
      }
    }

    return vertices;
  }

  createSolidMeshIndices(): number[] {
    var indices: number[] = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        var baseIndex = y * this.tileDim * 7 + x * 7;
        this.pushHexIndices(indices, baseIndex);
      }
    }

    return indices;
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

  toSingle(): IGridGeometry {
    return new HexGridGeometry(this._hexSize, 1);
  }

  transformToEdge(o: THREE.Object3D, coord: IGridEdge): void {
    var centre = this.createCoordCentre(coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
    if (coord.edge === 1) {
      o.rotateZ(Math.PI / 3.0);
    } else if (coord.edge === 2) {
      o.rotateZ(Math.PI * 2.0 / 3.0);
    }
  }
}