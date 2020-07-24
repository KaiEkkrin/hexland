import { GridEdge } from '../data/coord';
import { IGridGeometry } from "./gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

const alpha = 0.15;
const wallZ = 0.6;

// The "walls" are the edges of the map that are coloured in one of our
// known colours.
export class Walls extends InstancedFeatures<GridEdge> {
  private _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag) {
    super(geometry, redrawFlag, 1000);

    var single = this.geometry.toSingle();
    var vertices = single.createWallVertices(alpha, wallZ);
    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
  }

  protected createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh {
    var mesh = new THREE.InstancedMesh(this._bufferGeometry, m, maxInstances);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  protected transformTo(o: THREE.Object3D, position: GridEdge) {
    this.geometry.transformToEdge(o, position);
  }
}