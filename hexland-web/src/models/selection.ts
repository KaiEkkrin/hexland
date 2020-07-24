import { GridCoord } from '../data/coord';
import { IGridGeometry } from "./gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

const selectionAlpha = 0.75;
const selectionZ = 1;

// The selections outline one or more selected tokens.
// It assumes only the first material is in use.  (TODO do I want to
// support multiple different-colour selections?  Seems confusing to me...)
export class Selection extends InstancedFeatures<GridCoord> {
  private readonly _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag) {
    // TODO Use a lower maximum here to save memory!  I want to fix InstancedFeatures
    // so that it can expand into more meshes when the maximum is reached first,
    // however.
    super(geometry, redrawFlag, 1000);

    // TODO : For now, I'm going to draw the selection as a slightly larger token.
    // I'll probably want to change it to something prettier but I'm mostly concerned
    // about getting it working at all :)
    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertices(new THREE.Vector2(0, 0), selectionAlpha, selectionZ);
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