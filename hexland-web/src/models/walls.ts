import { IGridEdge, edgeString } from '../data/coord';
import { IFeature } from '../data/feature';
import { IGridGeometry } from "./gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

// The "walls" are the edges of the map that are coloured in one of our
// known colours.
export class Walls extends InstancedFeatures<IGridEdge, IFeature<IGridEdge>> {
  private readonly _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, alpha: number, wallZ: number, maxInstances?: number | undefined) {
    super(geometry, redrawFlag, edgeString, maxInstances);

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

  protected transformTo(o: THREE.Object3D, position: IGridEdge) {
    this.geometry.transformToEdge(o, position);
  }

  dispose() {
    super.dispose();
    this._bufferGeometry.dispose();
  }
}