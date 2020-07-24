import { GridCoord } from '../data/coord';
import { IGridGeometry } from "./gridGeometry";
import { IFeature, InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

const areaZ = 0.5;

// The "areas" are the faces of the map that are coloured in one of our
// known colours.
export class Areas extends InstancedFeatures<GridCoord, IFeature<GridCoord>> {
  private readonly _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag) {
    super(geometry, redrawFlag, 1000);

    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertices(new THREE.Vector2(0, 0), 1.0, areaZ);
    var indices = single.createSolidMeshIndices();

    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    this._bufferGeometry.setIndex(indices);
  }

  protected createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh {
    var mesh = new THREE.InstancedMesh(this._bufferGeometry, m, maxInstances);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  protected transformTo(o: THREE.Object3D, position: GridCoord) {
    this.geometry.transformToCoord(o, position);
  }
}