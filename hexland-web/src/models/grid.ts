import { HexTile, ITile, SquareTile } from './tile';

import * as THREE from 'three';

abstract class Grid {
  private lineIndices: number[] | undefined;
  private lineMat: THREE.LineBasicMaterial;

  constructor() {
    this.lineMat = new THREE.LineBasicMaterial({ color: 0xb0b0b0 });
  }

  protected setUp() {
    // We can generate the line indices right away, because they never change:
    var zeroTile = this.createTile(0, 0);
    this.lineIndices = zeroTile.createLineIndices();
  }

  protected get lineMaterial() { return this.lineMat; }

  protected abstract createTile(x: number, y: number): ITile;
  protected abstract drawTileGeometry(scene: THREE.Scene, geometry: THREE.BufferGeometry): void;

  // Adds a grid to a scene.
  // `originX` and `originY` are tile co-ordinates of the central tile to create.
  // `radius` is the number of tiles away from the centre to draw in each direction.
  addToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    if (!this.lineIndices) {
      return;
    }

    // TODO Keep these tiles?  Juggle them about?  Etc.
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var vertices = this.createTile(x, y).createVertices();
        var geometry = new THREE.BufferGeometry().setFromPoints(vertices);
        geometry.setIndex(this.lineIndices);
        this.drawTileGeometry(scene, geometry);
      }
    }
  }
}

export class SquareGrid extends Grid {
  private squareSize: number;
  private tileDim: number;

  constructor(squareSize: number, tileDim: number) {
    super();
    this.squareSize = squareSize;
    this.tileDim = tileDim;
    this.setUp();
  }

  protected createTile(x: number, y: number): ITile {
    return new SquareTile(x, y, this.squareSize, this.tileDim);
  }

  protected drawTileGeometry(scene: THREE.Scene, geometry: THREE.BufferGeometry): void {
    var lines = new THREE.LineSegments(geometry, this.lineMaterial);
    scene.add(lines);
  }
}

export class HexGrid extends Grid {
  private hexSize: number;
  private tileDim: number;

  constructor(hexSize: number, tileDim: number) {
    super();
    this.hexSize = hexSize;
    this.tileDim = tileDim;
    this.setUp();
  }

  protected createTile(x: number, y: number): ITile {
    return new HexTile(x, y, this.hexSize, this.tileDim);
  }

  protected drawTileGeometry(scene: THREE.Scene, geometry: THREE.BufferGeometry): void {
    var lines = new THREE.Line(geometry, this.lineMaterial);
    scene.add(lines);
  }
}
