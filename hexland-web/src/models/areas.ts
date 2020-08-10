import { IGridCoord, coordString } from '../data/coord';
import { IFeature } from '../data/feature';
import { IGridGeometry } from "./gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

// The "areas" are the faces of the map that are coloured in one of our
// known colours.
export class Areas extends InstancedFeatures<IGridCoord, IFeature<IGridCoord>> {
  private readonly _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, alpha: number, areaZ: number, maxInstances?: number | undefined) {
    super(geometry, redrawFlag, coordString, maxInstances);

    var single = this.geometry.toSingle();
    var vertices = [...single.createSolidVertices(new THREE.Vector2(0, 0), alpha, areaZ)];
    var indices = [...single.createSolidMeshIndices()];

    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    this._bufferGeometry.setIndex(indices);
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