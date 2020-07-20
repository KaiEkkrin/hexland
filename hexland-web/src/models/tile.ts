import * as THREE from 'three';

// A tile is a square area of grid squares or hexes, which themselves
// can be tessellated to create a drawn grid.
export interface ITile {
  // Creates a buffer of vertex co-ordinates associated with this tile.
  createVertices(): THREE.Vector3[];

  // Creates a buffer of indices that will draw the grid line segments.
  createLineIndices(): number[];
}

// A tile of squares.
export class SquareTile implements ITile {
  private x: number;
  private y: number;
  private squareSize: number;
  private tileDim: number;

  constructor(x: number, y: number, squareSize: number, tileDim: number) {
    this.x = x;
    this.y = y;
    this.squareSize = squareSize;
    this.tileDim = tileDim;
  }

  createVertices(): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y <= this.tileDim; ++y) {
      for (var x = 0; x <= this.tileDim; ++x) {
        vertices.push(new THREE.Vector3(
          this.x * this.squareSize * this.tileDim + (x - 0.5) * this.squareSize,
          this.y * this.squareSize * this.tileDim + (y - 0.5) * this.squareSize,
          1
        ));
      }
    }

    return vertices;
  }

  createLineIndices(): number[] {
    var indices = [];

    // All the horizontal lines:
    for (var i = 0; i <= this.tileDim; ++i) {
      indices.push(i * (this.tileDim + 1));
      indices.push(i * (this.tileDim + 1) + this.tileDim);
    }

    // All the vertical lines:
    for (i = 0; i <= this.tileDim; ++i) {
      indices.push(i);
      indices.push(i + this.tileDim * (this.tileDim + 1));
    }

    return indices;
  }
}

// A tile of hexes.
export class HexTile implements ITile {
  private x: number;
  private y: number;
  private hexSize: number;
  private tileDim: number;

  constructor(x: number, y: number, hexSize: number, tileDim: number) {
    this.x = x;
    this.y = y;
    this.hexSize = hexSize;
    this.tileDim = tileDim;
  }

  private vertexIndexOf(x: number, y: number, v: number) {
    return (y + 1) * (this.tileDim + 1) * 2 + x * 2 + v;
  }

  createVertices(): THREE.Vector3[] {
    var vertices = [];

    // For each hex, we need to add only two unique vertices out of six; we'll use
    // the left and top-left vertices.  We need to fill in enough points for createLineIndices()
    // below to have access to all it needs 
    const xStep = this.hexSize * Math.sin(Math.PI / 3.0);
    const xOffLeft = xStep * 2.0 / 3.0;
    const xOffTop = xStep / 3.0;
    const yOffTop = this.hexSize * 0.5;
    for (var y = -1; y <= this.tileDim; ++y) {
      for (var x = 0; x <= this.tileDim; ++x) {
        var xCentre = this.x * xStep * this.tileDim + x * xStep;
        var yCentre = this.y * this.hexSize * this.tileDim + y * this.hexSize -
          ((x % 2) === 1 ? this.hexSize / 2.0 : 0.0);

        vertices.push(new THREE.Vector3(xCentre - xOffLeft, yCentre, 1));
        vertices.push(new THREE.Vector3(xCentre - xOffTop, yCentre - yOffTop, 1));
      }
    }

    return vertices;
  }

  createLineIndices(): number[] {
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
}
