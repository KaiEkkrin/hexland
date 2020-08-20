import { IGridVertex, vertexString } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

// These are highlighted grid vertices.
export class Vertices extends InstancedFeatures<IGridVertex, IFeature<IGridVertex>> {
  private readonly _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, alpha: number, z: number, maxInstances?: number | undefined) {
    super(geometry, redrawFlag, vertexString, maxInstances);

    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertexVertices(new THREE.Vector2(0, 0), alpha, z, 1);
    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    this._bufferGeometry.setIndex([...single.createSolidVertexIndices(1)]);
  }

  protected createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh {
    var mesh = new THREE.InstancedMesh(this._bufferGeometry, m, maxInstances);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  protected transformTo(o: THREE.Object3D, position: IGridVertex) {
    this.geometry.transformToVertex(o, position);
  }

  dispose() {
    super.dispose();
    this._bufferGeometry.dispose();
  }
}