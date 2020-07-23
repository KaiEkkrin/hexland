import { GridCoord, CoordDictionary } from '../data/coord';
import { Drawn } from './drawn';
import { IGridGeometry } from "./gridGeometry";

import * as THREE from 'three';
import { Mesh } from 'three';

const areaZ = 0.5;
const maxInstances = 1000; // TODO handle spawning more meshes if there are more...

// The "areas" are the faces of the map that are coloured in one of our
// known colours.
export class Areas extends Drawn {
  private _d: CoordDictionary<GridCoord, number>;
  private _mesh: THREE.InstancedMesh;

  constructor(geometry: IGridGeometry, materials: THREE.MeshBasicMaterial[]) {
    super(geometry);
    this._d = new CoordDictionary<GridCoord, number>();

    // To begin with, I'm always going to draw just a single filled-in face at (0, 0) in
    // the relevant colour.  After that works, I shall try making it into an instanced
    // draw with separate instance transformations for each filled area.

    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertices(new THREE.Vector2(0, 0), areaZ);
    var indices = single.createSolidMeshIndices();

    var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    bufferGeometry.setIndex(indices);

    this._mesh = new THREE.InstancedMesh(bufferGeometry, materials[0], maxInstances);
    this._mesh.count = 0;
    this._mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  // The materials parameter here should be the known colour materials in order.
  addToScene(scene: THREE.Scene) {
    scene.add(this._mesh);
  }

  add(newPosition: GridCoord) {
    // TODO selected colour :)
    const colourIndex = 0;
    
    if (!this._d.get(newPosition)) {
      this._d.set(newPosition, colourIndex);

      // This is a new addition.  Add a suitable instance.
      var o = new THREE.Object3D();
      this.geometry.transformToCoord(o, newPosition);
      o.updateMatrix();

      var index = this._mesh.count;
      this._mesh.count = index + 1;
      this._mesh.setMatrixAt(index, o.matrix);
      this._mesh.instanceMatrix.needsUpdate = true;
      this.setNeedsRedraw();
    }
  }
}