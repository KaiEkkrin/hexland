import { GridCoord } from '../data/coord';
import { IGridGeometry } from "./gridGeometry";
import { IFeature, InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

const alpha = 0.7;
const tokenZ = 0.6;

// The "tokens" are moveable objects that occupy a face of the map.
// This object also manages the selection of tokens.
export class Tokens extends InstancedFeatures<GridCoord, IFeature<GridCoord>> {
  private readonly _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag) {
    super(geometry, redrawFlag, 1000);

    // TODO Make them look more exciting than just a smaller, brighter face.
    // Maybe with a shader to draw in a ring highlight, text, an image, etc?
    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertices(new THREE.Vector2(0, 0), alpha, tokenZ);
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