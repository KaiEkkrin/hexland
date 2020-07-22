import { Drawn } from './drawn';
import { GridCoord, IGridGeometry } from './gridGeometry';

import * as THREE from 'three';

// The highlight shows up the current face, edge etc as relevant.
// TODO Disposal etc.
export class FaceHighlight extends Drawn {
  private _geometry: IGridGeometry;
  private _position: GridCoord | undefined; 

  private _bufferGeometry: THREE.BufferGeometry;
  private _material: THREE.MeshBasicMaterial;

  constructor(geometry: IGridGeometry) {
    super();
    this._geometry = geometry;
    this._bufferGeometry = geometry.createFaceHighlight();
    this._material = new THREE.MeshBasicMaterial({ color: 0xa0a0a0, flatShading: true });
  }

  addToScene(scene: THREE.Scene) {
    var mesh = new THREE.Mesh(this._bufferGeometry, this._material);
    scene.add(mesh);
  }

  move(newPosition: GridCoord | undefined) {
    if (!newPosition && !this._position) {
      // Highlight stays hidden
      return;
    }

    if (newPosition && newPosition.equals(this._position)) {
      // Highlight hasn't moved
      return;
    }

    this._position = newPosition;
    this._geometry.updateFaceHighlight(this._bufferGeometry, newPosition);
    this.setNeedsRedraw();
  }
}