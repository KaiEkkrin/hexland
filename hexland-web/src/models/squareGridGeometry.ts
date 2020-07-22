import { BaseGeometry, GridCoord, IGridGeometry } from './gridGeometry';
import * as THREE from 'three';

export class SquareGridGeometry extends BaseGeometry implements IGridGeometry {
  private _squareSize: number;

  constructor(squareSize: number, tileDim: number) {
    super(tileDim);
    this._squareSize = squareSize;
  }

  private createTopLeft(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3((x - 0.5) * this._squareSize, (y - 0.5) * this._squareSize, 1);
  }

  private createTopRight(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3((x + 0.5) * this._squareSize, (y - 0.5) * this._squareSize, 1);
  }

  private createBottomLeft(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3((x - 0.5) * this._squareSize, (y + 0.5) * this._squareSize, 1);
  }

  private createBottomRight(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3((x + 0.5) * this._squareSize, (y + 0.5) * this._squareSize, 1);
  }

  private pushSquareIndices(indices: number[], baseIndex: number) {
    indices.push(baseIndex);
    indices.push(baseIndex + 1);
    indices.push(baseIndex + 2);
    indices.push(-1);

    indices.push(baseIndex + 1);
    indices.push(baseIndex + 3);
    indices.push(baseIndex + 2);
    indices.push(-1);
  }

  createFaceHighlightVertices(): Float32Array {
    return new Float32Array(12);
  }

  createFaceHighlightIndices(): number[] {
    var indices: number[] = [];
    this.pushSquareIndices(indices, 0);
    return indices;
  }

  createGridVertices(tile: THREE.Vector2): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y <= this.tileDim; ++y) {
      for (var x = 0; x <= this.tileDim; ++x) {
        vertices.push(this.createTopLeft(tile.x * this.tileDim + x, tile.y * this.tileDim + y));
      }
    }

    return vertices;
  }

  createGridLineIndices(): number[] {
    // TODO Do this calculation once only
    var indices = [];

    // All the horizontal lines:
    for (var i = 0; i <= this.tileDim; ++i) {
      indices.push(i * (this.tileDim + 1));
      indices.push(i * (this.tileDim + 1) + this.tileDim);
      indices.push(-1);
    }

    // All the vertical lines:
    for (i = 0; i <= this.tileDim; ++i) {
      indices.push(i);
      indices.push(i + this.tileDim * (this.tileDim + 1));
      indices.push(-1);
    }

    return indices;
  }

  createSolidVertices(tile: THREE.Vector2): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        var xCentre = tile.x * this.tileDim + x;
        var yCentre = tile.y * this.tileDim + y;

        vertices.push(this.createTopLeft(xCentre, yCentre));
        vertices.push(this.createBottomLeft(xCentre, yCentre));
        vertices.push(this.createTopRight(xCentre, yCentre));
        vertices.push(this.createBottomRight(xCentre, yCentre));
      }
    }

    return vertices;
  }

  // Creates a buffer of indices into the output of `createSolidVertices`
  // suitable for drawing a solid mesh of the grid.
  createSolidMeshIndices(): number[] {
    var indices: number[] = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        // For some reason Three.js uses triangles rather than triangle strips, grr
        var baseIndex = y * this.tileDim * 4 + x * 4;
        this.pushSquareIndices(indices, baseIndex);
      }
    }

    return indices;
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
    var colours = new Float32Array(this.tileDim * this.tileDim * 16);
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var i = 0; i < 4; ++i) {
          var offset = y * this.tileDim * 16 + x * 16 + i * 4;
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
    this.fillFloats(vertices, 0, this.createTopLeft(x, y));
    this.fillFloats(vertices, 3, this.createBottomLeft(x, y));
    this.fillFloats(vertices, 6, this.createTopRight(x, y));
    this.fillFloats(vertices, 9, this.createBottomRight(x, y));
  }
}