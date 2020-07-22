import { BaseGeometry, GridCoord, IGridGeometry } from './gridGeometry';
import * as THREE from 'three';

class HexCentre extends THREE.Vector3 {} // to help me not get muddled, as below

// A tile of hexes.
export class HexGridGeometry extends BaseGeometry implements IGridGeometry {
  private _hexSize: number;

  private _xStep: number;
  private _xOffLeft: number;
  private _xOffTop: number;
  private _yOffTop: number;

  constructor(hexSize: number, tileDim: number) {
    super(tileDim);
    this._hexSize = hexSize;

    this._xStep = this._hexSize * Math.sin(Math.PI / 3.0);
    this._xOffLeft = this._xStep * 2.0 / 3.0;
    this._xOffTop = this._xStep / 3.0;
    this._yOffTop = this._hexSize * 0.5;
  }

  private createCentre(x: number, y: number): HexCentre {
    return new HexCentre(x * this._xStep, (y - (Math.abs(x % 2) === 1 ? 0.5 : 0.0)) * this._hexSize, 1);
  }

  private createLeft(c: HexCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._xOffLeft, c.y, 1);
  }

  private createTopLeft(c: HexCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._xOffTop, c.y - this._yOffTop, 1);
  }

  private createTopRight(c: HexCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._xOffTop, c.y - this._yOffTop, 1);
  }

  private createRight(c: HexCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._xOffLeft, c.y, 1);
  }

  private createBottomLeft(c: HexCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._xOffTop, c.y + this._yOffTop, 1);
  }

  private createBottomRight(c: HexCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._xOffTop, c.y + this._yOffTop, 1);
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

  createFaceHighlightVertices(): Float32Array {
    return new Float32Array(21);
  }

  createFaceHighlightIndices(): number[] {
    var indices: number[] = [];
    this.pushHexIndices(indices, 0);
    return indices;
  }

  createGridVertices(tile: THREE.Vector2): THREE.Vector3[] {
    var vertices = [];

    // For each hex, we need to add only two unique vertices out of six; we'll use
    // the left and top-left vertices.  We need to fill in enough points for createLineIndices()
    // below to have access to all it needs 
    for (var y = -1; y <= this.tileDim; ++y) {
      for (var x = 0; x <= this.tileDim; ++x) {
        var centre = this.createCentre(tile.x * this.tileDim + x, tile.y * this.tileDim + y);
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

        // Top right -- 1st vertex of the hex at (x + 1, y) if even,
        // or (x + 1, y - 1) if odd
        indices.push(this.vertexIndexOf(x + 1, y - (x % 2), 0));

        // Right -- 2nd vertex of the hex at (x + 1, y + 1) if even,
        // or (x + 1, y) if odd
        indices.push(this.vertexIndexOf(x + 1, y + 1 - (x % 2), 1));

        // Push a primitive restart
        indices.push(-1);
      }
    }

    return indices;
  }

  createSolidVertices(tile: THREE.Vector2): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        var centre = this.createCentre(tile.x * this.tileDim + x, tile.y * this.tileDim + y);
        vertices.push(centre);
        vertices.push(this.createLeft(centre));
        vertices.push(this.createTopLeft(centre));
        vertices.push(this.createTopRight(centre));
        vertices.push(this.createRight(centre));
        vertices.push(this.createBottomRight(centre));
        vertices.push(this.createBottomLeft(centre));
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
    var colours = new Float32Array(this.tileDim * this.tileDim * 28);
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var i = 0; i < 7; ++i) {
          var offset = y * this.tileDim * 28 + x * 28 + i * 4;
          this.toPackedXYSign(colours, offset, tile.x, tile.y);
          this.toPackedXYSign(colours, offset + 2, x, y);
        }
      }
    }

    return colours;
  }

  updateFaceHighlightVertices(vertices: Float32Array, coord: GridCoord): void {
    var x = coord.tile.x * this.tileDim + coord.face.x;
    var y = coord.tile.y * this.tileDim + coord.face.y;
    var centre = this.createCentre(x, y);
    this.fillFloats(vertices, 0, centre);
    this.fillFloats(vertices, 3, this.createLeft(centre));
    this.fillFloats(vertices, 6, this.createTopLeft(centre));
    this.fillFloats(vertices, 9, this.createTopRight(centre));
    this.fillFloats(vertices, 12, this.createRight(centre));
    this.fillFloats(vertices, 15, this.createBottomRight(centre));
    this.fillFloats(vertices, 18, this.createBottomLeft(centre));
  }
}