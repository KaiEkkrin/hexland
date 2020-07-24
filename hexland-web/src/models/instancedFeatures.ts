import { GridCoord, CoordDictionary } from '../data/coord';
import { Drawn } from './drawn';
import { IGridGeometry } from "./gridGeometry";
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

// A helpful base class for instanced features such as areas and walls.
// This class manages the underlying meshes and instances.
// (Argh, more inheritance!  I don't like it, but in this case as with the geometry
// it seems to fit the problem at hand...)
// TODO Handle spawning extra meshes and adding them to the scene if I exceed
// `maxInstances` instances in one mesh
export abstract class InstancedFeatures<K extends GridCoord> extends Drawn {
  private readonly _maxInstances: number;
  private readonly _colours: CoordDictionary<K, number>;
  private readonly _indexes: CoordDictionary<K, number>;
  private _meshes: THREE.InstancedMesh[]; // one per material.

  // This is a queue of re-usable matrix indices for each material in order --
  // re-use one of these to avoid having to expand the number of instances.
  private _clearIndices: number[][];

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, maxInstances: number) {
    super(geometry, redrawFlag);
    this._maxInstances = maxInstances;
    this._colours = new CoordDictionary<K, number>();
    this._indexes = new CoordDictionary<K, number>();
    this._meshes = [];
    this._clearIndices = [];
  }

  protected abstract createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh;
  protected abstract transformTo(o: THREE.Object3D, position: K): void;

  // The materials parameter here should be the known colour materials in order.
  addToScene(scene: THREE.Scene, materials: THREE.Material[]) {
    this._meshes = materials.map(m => this.createMesh(m, this._maxInstances));
    this._clearIndices = materials.map(_ => []);
    this._meshes.forEach(m => { scene.add(m); });
  }

  get all(): K[] {
    return this._colours.keys;
  }

  add(newPosition: K, colour: number) {
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
    this.transformTo(o, newPosition);
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

  at(position: K): number | undefined {
    return this._colours.get(position);
  }

  clear() {
    this._colours.clear();
    this._indexes.clear();
    this._clearIndices = this._meshes.map(_ => []);

    this._meshes.forEach(m => {
      m.count = 0;
    });

    this.setNeedsRedraw();
  }

  move(oldPosition: K, newPosition: K) {
    if (newPosition.equals(oldPosition)) {
      // No change
      return;
    }

    var colour = this.remove(oldPosition);
    if (colour === undefined) {
      // Nothing here -- nothing to add either
      return;
    }

    this.add(newPosition, colour);
  }

  remove(oldPosition: K): number | undefined { // returns the colour index of the removed thing
    var colourIndex = this._colours.get(oldPosition);
    var matrixIndex = this._indexes.get(oldPosition);
    if (colourIndex === undefined || matrixIndex === undefined) {
      return undefined;
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

    return colourIndex;
  }
}