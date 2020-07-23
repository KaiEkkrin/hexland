import { GridCoord, GridEdge } from '../data/coord';
import { Drawn } from './drawn';
import { IGridGeometry } from './gridGeometry';

import * as THREE from 'three';

const highlightZ = 2;

// The highlight shows up the current face, edge etc as relevant.
// TODO Disposal etc.
export class EdgeHighlight extends Drawn {
  private _position: GridEdge | undefined; 
  private _alpha: number;

  private _bufferGeometry: THREE.BufferGeometry;
  private _material: THREE.MeshBasicMaterial;

  constructor(geometry: IGridGeometry, alpha: number) {
    super(geometry);
    this._alpha = alpha;
    this._bufferGeometry = geometry.createEdgeHighlight();
    this._material = new THREE.MeshBasicMaterial({ color: 0xa0a0a0, flatShading: true });
  }

  addToScene(scene: THREE.Scene) {
    var mesh = new THREE.Mesh(this._bufferGeometry, this._material);
    scene.add(mesh);
  }

  move(newPosition: GridEdge | undefined) {
    if (!newPosition && !this._position) {
      // Highlight stays hidden
      return;
    }

    if (newPosition && newPosition.equals(this._position)) {
      // Highlight hasn't moved
      return;
    }

    this._position = newPosition;
    this.geometry.updateEdgeHighlight(this._bufferGeometry, newPosition, this._alpha, highlightZ);
    this.setNeedsRedraw();
  }
}

export class FaceHighlight extends Drawn {
  private _position: GridCoord | undefined; 

  private _bufferGeometry: THREE.BufferGeometry;
  private _material: THREE.MeshBasicMaterial;

  constructor(geometry: IGridGeometry) {
    super(geometry);
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
    this.geometry.updateFaceHighlight(this._bufferGeometry, newPosition, highlightZ);
    this.setNeedsRedraw();
  }
}