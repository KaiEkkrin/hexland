import { IGridEdge, edgeString } from '../../data/coord';
import { IFeature, IFeatureDictionary } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

// The "walls" are the edges of the map that are coloured in one of our
// known colours.  To implement line-of-sight, we synchronise this object with
// the LoS features object.
export class Walls extends InstancedFeatures<IGridEdge, IFeature<IGridEdge>> {
  private readonly _bufferGeometry: THREE.BufferGeometry;
  private readonly _losFeatures: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>> | undefined;

  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    losFeatures: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>> | undefined,
    alpha: number,
    wallZ: number,
    maxInstances?: number | undefined
  ) {
    super(geometry, redrawFlag, edgeString, maxInstances);

    var single = this.geometry.toSingle();
    var vertices = single.createWallVertices(alpha, wallZ);
    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    this._losFeatures = losFeatures;
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

  add(f: IFeature<IGridEdge>) {
    if (super.add(f)) {
      this._losFeatures?.add({ position: f.position, colour: 0 });
      return true;
    }

    return false;
  }

  clear() {
    super.clear();
    this._losFeatures?.clear();
  }

  remove(oldPosition: IGridEdge) {
    var feature = super.remove(oldPosition);
    if (feature !== undefined) {
      this._losFeatures?.remove(oldPosition);
    }

    return feature;
  }

  dispose() {
    super.dispose();
    this._bufferGeometry.dispose();
  }
}