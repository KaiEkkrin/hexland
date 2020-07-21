import * as THREE from 'three';

// This is the co-ordinate of a hex (or square) inside the grid.
export class GridCoord {
  tile: THREE.Vector2;
  hex: THREE.Vector2; // within the tile

  constructor(tile: THREE.Vector2, hex: THREE.Vector2) {
    this.tile = tile;
    this.hex = hex;
  }
}

// A grid geometry describes a grid's layout (currently either squares
// or hexagons.)
export interface IGridGeometry {
  // Creates the vertices involved in drawing a full grid tile.
  createGridVertices(tile: THREE.Vector2): THREE.Vector3[];

  // Creates a buffer of indices into the output of `createGridVertices`
  // suitable for drawing a full grid of lines.
  createGridLineIndices(): number[];
}

export class SquareGridGeometry implements IGridGeometry {
  private _squareSize: number;
  private _tileDim: number;

  constructor(squareSize: number, tileDim: number) {
    this._squareSize = squareSize;
    this._tileDim = tileDim;
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

  createGridVertices(tile: THREE.Vector2): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y <= this._tileDim; ++y) {
      for (var x = 0; x <= this._tileDim; ++x) {
        vertices.push(this.createTopLeft(tile.x * this._tileDim + x, tile.y * this._tileDim + y));
      }
    }

    return vertices;
  }

  createGridLineIndices(): number[] {
    // TODO Do this calculation once only
    var indices = [];

    // All the horizontal lines:
    for (var i = 0; i <= this._tileDim; ++i) {
      indices.push(i * (this._tileDim + 1));
      indices.push(i * (this._tileDim + 1) + this._tileDim);
      indices.push(-1);
    }

    // All the vertical lines:
    for (i = 0; i <= this._tileDim; ++i) {
      indices.push(i);
      indices.push(i + this._tileDim * (this._tileDim + 1));
      indices.push(-1);
    }

    return indices;
  }
}

class HexCentre extends THREE.Vector2 {} // to help me not get muddled, as below

// A tile of hexes.
export class HexGridGeometry implements IGridGeometry {
  private _hexSize: number;
  private _tileDim: number;

  private _xStep: number;
  private _xOffLeft: number;
  private _xOffTop: number;
  private _yOffTop: number;

  constructor(hexSize: number, tileDim: number) {
    this._hexSize = hexSize;
    this._tileDim = tileDim;

    this._xStep = this._hexSize * Math.sin(Math.PI / 3.0);
    this._xOffLeft = this._xStep * 2.0 / 3.0;
    this._xOffTop = this._xStep / 3.0;
    this._yOffTop = this._hexSize * 0.5;
  }

  private createCentre(x: number, y: number): HexCentre {
    return new HexCentre(x * this._xStep, (y - (Math.abs(x % 2) === 1 ? 0.5 : 0.0)) * this._hexSize);
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

  private vertexIndexOf(x: number, y: number, v: number) {
    return (y + 1) * (this._tileDim + 1) * 2 + x * 2 + v;
  }

  createGridVertices(tile: THREE.Vector2): THREE.Vector3[] {
    var vertices = [];

    // For each hex, we need to add only two unique vertices out of six; we'll use
    // the left and top-left vertices.  We need to fill in enough points for createLineIndices()
    // below to have access to all it needs 
    for (var y = -1; y <= this._tileDim; ++y) {
      for (var x = 0; x <= this._tileDim; ++x) {
        var centre = this.createCentre(tile.x * this._tileDim + x, tile.y * this._tileDim + y);
        vertices.push(this.createLeft(centre));
        vertices.push(this.createTopLeft(centre));
      }
    }

    return vertices;
  }

  createGridLineIndices(): number[] {
    var indices = [];

    // We only need to draw the top part of each hex -- the bottom part will be taken care of.
    for (var y = 0; y < this._tileDim; ++y) {
      for (var x = 0; x < this._tileDim; ++x) {
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
}
