import { ITileFactory } from './tile';

import * as THREE from 'three';

export class Grid {
  private tileFactory: ITileFactory;
  private lineIndices: number[];
  private lineMaterial: THREE.LineBasicMaterial;

  constructor(tileFactory: ITileFactory) {
    this.tileFactory = tileFactory;

    // We can generate the line indices right away, because they never change:
    var zeroTile = tileFactory.createTile(0, 0);
    this.lineIndices = zeroTile.createLineIndices();

    this.lineMaterial = new THREE.LineBasicMaterial({ color: 0xb0b0b0 });
  }

  // Adds a grid to a scene.
  // `originX` and `originY` are tile co-ordinates of the central tile to create.
  // `radius` is the number of tiles away from the centre to draw in each direction.
  addToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    // TODO Keep these tiles?  Juggle them about?  Etc.
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var vertices = this.tileFactory.createTile(x, y).createVertices();
        var geometry = new THREE.BufferGeometry().setFromPoints(vertices);
        geometry.setIndex(this.lineIndices);

        var lines = new THREE.LineSegments(geometry, this.lineMaterial);
        scene.add(lines);
      }
    }
  }
}
