import { GridCoord } from '../data/coord';
import { IGridGeometry } from "./gridGeometry";
import { InstancedFeatures } from './instancedFeatures';

import * as THREE from 'three';

const alpha = 0.7;
const tokenZ = 0.6;

// The "tokens" are moveable objects that occupy a face of the map.
export class Tokens extends InstancedFeatures<GridCoord> {
  private _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry) {
    super(geometry, 1000);

    // TODO Make them look more exciting than just a smaller, brighter face.
    // Maybe with a shader to draw in a ring highlight, text, an image, etc?
    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertices(new THREE.Vector2(0, 0), alpha, tokenZ);
    var indices = single.createSolidMeshIndices();

    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    this._bufferGeometry.setIndex(indices);
  }

  protected createMesh(m: THREE.MeshBasicMaterial, maxInstances: number): THREE.InstancedMesh {
    var mesh = new THREE.InstancedMesh(this._bufferGeometry, m, maxInstances);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  protected transformTo(o: THREE.Object3D, position: GridCoord) {
    this.geometry.transformToCoord(o, position);
  }

  move(oldPosition: GridCoord, newPosition: GridCoord) {
    if (newPosition.equals(oldPosition)) {
      // No change
      return;
    }

    var colour = this.remove(oldPosition);
    if (colour === undefined) {
      // Nothing here -- nothing to add either
      return;
    }

    this.add(newPosition, colour);
  }
}