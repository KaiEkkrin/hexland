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

export interface ITileFactory {
  // Creates a tile at the given tile co-ordinates.
  createTile(x: number, y: number): ITile;
}

export class SquareTileFactory implements ITileFactory {
  private squareSize: number;
  private tileDim: number;

  constructor(squareSize: number, tileDim: number) {
    this.squareSize = squareSize;
    this.tileDim = tileDim;
  }

  createTile(x: number, y: number): ITile {
    return new SquareTile(x, y, this.squareSize, this.tileDim);
  }
}
