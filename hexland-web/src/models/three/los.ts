import { IGridCoord, coordString } from '../../data/coord';
import { IGridGeometry } from '../gridGeometry';
import { IVisibility } from '../los';
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

// TODO #40 This Three.js implementation will need to be split out -- perhaps I should move
// all the modules that draw with Three.js into their own namespace, for example?
export class LoS extends InstancedFeatures<IGridCoord, IVisibility> {
  private readonly _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, alpha: number, areaZ: number, maxInstances?: number | undefined) {
    super(geometry, redrawFlag, coordString, maxInstances);

    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertices(new THREE.Vector2(0, 0), alpha, areaZ);
    var indices = single.createSolidMeshIndices();

    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints([...vertices]);
    this._bufferGeometry.setIndex([...indices]);
  }

  protected createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh {
    var mesh = new THREE.InstancedMesh(this._bufferGeometry, m, maxInstances);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  protected transformTo(o: THREE.Object3D, position: IGridCoord) {
    this.geometry.transformToCoord(o, position);
  }

  dispose() {
    super.dispose();
    this._bufferGeometry.dispose();
  }
}