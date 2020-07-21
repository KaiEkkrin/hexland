import { IGridGeometry } from './gridGeometry';

import * as THREE from 'three';

export class Grid {
  private _geometry: IGridGeometry;
  private _lineIndices: number[];
  private _lineMaterial: THREE.LineBasicMaterial;

  constructor(geometry: IGridGeometry) {
    this._geometry = geometry;
    this._lineIndices = geometry.createGridLineIndices();
    this._lineMaterial = new THREE.LineBasicMaterial({ color: 0xb0b0b0 });
  }

  // Adds a grid to a scene.
  // `originX` and `originY` are tile co-ordinates of the central tile to create.
  // `radius` is the number of tiles away from the centre to draw in each direction.
  addToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    // TODO Keep these tiles?  Juggle them about?  Etc.
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var vertices = this._geometry.createGridVertices(new THREE.Vector2(x, y));
        var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
        bufferGeometry.setIndex(this._lineIndices);
        var lines = new THREE.Line(bufferGeometry, this._lineMaterial);
        scene.add(lines);
      }
    }
  }
}
