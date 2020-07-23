import { GridCoord, CoordDictionary } from '../data/coord';
import { Drawn } from './drawn';
import { IGridGeometry } from "./gridGeometry";

import * as THREE from 'three';

const areaZ = 0.5;
const maxInstances = 1000; // TODO handle spawning more meshes if there are more...

// The "areas" are the faces of the map that are coloured in one of our
// known colours.
export class Areas extends Drawn {
  private _colours: CoordDictionary<GridCoord, number>;
  private _indexes: CoordDictionary<GridCoord, number>;
  private _meshes: THREE.InstancedMesh[]; // one per material

  // This is a queue of re-usable matrix indices for each material in order --
  // re-use one of these to avoid having to expand the number of instances.
  private _clearIndices: number[][];

  constructor(geometry: IGridGeometry, materials: THREE.MeshBasicMaterial[]) {
    super(geometry);
    this._colours = new CoordDictionary<GridCoord, number>();
    this._indexes = new CoordDictionary<GridCoord, number>();

    // To begin with, I'm always going to draw just a single filled-in face at (0, 0) in
    // the relevant colour.  After that works, I shall try making it into an instanced
    // draw with separate instance transformations for each filled area.

    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertices(new THREE.Vector2(0, 0), areaZ);
    var indices = single.createSolidMeshIndices();

    var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    bufferGeometry.setIndex(indices);

    this._meshes = materials.map(m => {
      var mesh = new THREE.InstancedMesh(bufferGeometry, m, maxInstances);
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      return mesh;
    })

    this._clearIndices = materials.map(_ => []);
  }

  // The materials parameter here should be the known colour materials in order.
  addToScene(scene: THREE.Scene) {
    this._meshes.forEach(m => { scene.add(m); });
  }

  add(newPosition: GridCoord, colour: number) {
    var oldColour = this._colours.get(newPosition);
    if (oldColour === colour) {
      // This is already set.
      return;
    }

    if (oldColour !== undefined) {
      // A different colour was set -- remove it first.
      this.remove(newPosition);
    }

    var mesh = this._meshes[colour];

    // This is a new addition.  Add a suitable instance.
    var o = new THREE.Object3D();
    this.geometry.transformToCoord(o, newPosition);
    o.updateMatrix();

    // Re-use an existing index if we can.   Otherwise, extend the instance list.
    var matrixIndex = this._clearIndices[colour].pop();
    if (!matrixIndex) {
      matrixIndex = mesh.count++;
    }

    mesh.setMatrixAt(matrixIndex, o.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    this._colours.set(newPosition, colour);
    this._indexes.set(newPosition, matrixIndex);
    this.setNeedsRedraw();
  }

  remove(oldPosition: GridCoord) {
    var colourIndex = this._colours.get(oldPosition);
    var matrixIndex = this._indexes.get(oldPosition);
    if (colourIndex === undefined || matrixIndex === undefined) {
      return;
    }

    var mesh = this._meshes[colourIndex];

    // We find the position of its matrix transform in the instance array.
    // Rather than trying to erase it (awkward), we instead set it to a matrix
    // that will make it appear off-screen, and add the index to the re-use list.
    var o = new THREE.Object3D();
    o.translateZ(-1000);
    o.updateMatrix();
    mesh.setMatrixAt(matrixIndex, o.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    this._colours.remove(oldPosition);
    this._indexes.remove(oldPosition);
    this._clearIndices[colourIndex].push(matrixIndex);
    this.setNeedsRedraw();
  }
}