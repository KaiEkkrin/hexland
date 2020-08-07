import { IGridCoord } from '../data/coord';
import { FeatureDictionary, IFeature, IFeatureDictionary } from '../data/feature';
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
export abstract class InstancedFeatures<K extends IGridCoord, F extends IFeature<K>> extends Drawn implements IFeatureDictionary<K, F> {
  private readonly _maxInstances: number;
  private readonly _features: FeatureDictionary<K, F>;
  private readonly _indexes: FeatureDictionary<K, IFeature<K>>; // colour as index number
  private _meshes: THREE.InstancedMesh[]; // one per material.

  // This is a queue of re-usable matrix indices for each material in order --
  // re-use one of these to avoid having to expand the number of instances.
  private _clearIndices: number[][];

  // We keep hold of the scene so that things can be added and removed later:
  private _scene: THREE.Scene | undefined;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, toIndex: (k: K) => string, maxInstances?: number | undefined) {
    super(geometry, redrawFlag);
    this._maxInstances = maxInstances ?? 1000;
    this._features = new FeatureDictionary<K, F>(toIndex);
    this._indexes = new FeatureDictionary<K, IFeature<K>>(toIndex);
    this._meshes = [];
    this._clearIndices = [];
  }

  protected get scene(): THREE.Scene | undefined { return this._scene; }

  protected abstract createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh;
  protected abstract transformTo(o: THREE.Object3D, position: K): void;

  // setMaterials implies a clear(), because it invalidates our current index tracking.
  // The materials parameter here should be the known colour materials in order.
  setMaterials(materials: THREE.Material[]) {
    this.clear();
    this._meshes = materials.map(m => this.createMesh(m, this._maxInstances));
    this._clearIndices = materials.map(_ => []);
  }

  // Call addToScene() only after setMaterials().
  addToScene(scene: THREE.Scene): boolean {
    if (this._scene !== undefined) {
      return false;
    }

    this._meshes.forEach(m => { scene.add(m); });
    this._scene = scene;
    this.setNeedsRedraw();
    return true;
  }

  removeFromScene() {
    if (this._scene !== undefined) {
      this._meshes.forEach(m => { this.scene?.remove(m); });
      this._scene = undefined;
      this.setNeedsRedraw();
    }
  }

  get all(): F[] {
    return this._features.all;
  }

  add(f: F): boolean {
    var done = this._features.add(f);
    if (done === false) {
      // This position is already occupied.
      return false;
    }

    var mesh = this._meshes[f.colour];

    // This is a new addition.  Add a suitable instance.
    var o = new THREE.Object3D();
    this.transformTo(o, f.position);
    o.updateMatrix();

    // Re-use an existing index if we can.   Otherwise, extend the instance list.
    var matrixIndex = this._clearIndices[f.colour].pop();
    if (!matrixIndex) {
      matrixIndex = mesh.count++;
    }

    mesh.setMatrixAt(matrixIndex, o.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    this._indexes.add({ position: f.position, colour: matrixIndex });
    this.setNeedsRedraw();
    return true;
  }

  clear() {
    this._features.clear();
    this._indexes.clear();
    this._clearIndices = this._meshes.map(_ => []);

    this._meshes.forEach(m => {
      m.count = 0;
    });

    this.setNeedsRedraw();
  }

  forEach(fn: (f: F) => void) {
    this._features.forEach(fn);
  }

  get(position: K): F | undefined {
    return this._features.get(position);
  }

  remove(oldPosition: K): F | undefined {
    var feature = this._features.remove(oldPosition);
    var matrixIndex = this._indexes.remove(oldPosition);
    if (feature === undefined || matrixIndex === undefined) {
      return undefined;
    }

    var mesh = this._meshes[feature.colour];

    // We find the position of its matrix transform in the instance array.
    // Rather than trying to erase it (awkward), we instead set it to a matrix
    // that will make it appear off-screen, and add the index to the re-use list.
    var o = new THREE.Object3D();
    o.translateZ(-1000);
    o.updateMatrix();
    mesh.setMatrixAt(matrixIndex.colour, o.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    this._clearIndices[feature.colour].push(matrixIndex.colour);
    this.setNeedsRedraw();

    return feature;
  }

  dispose() {
    // Not strictly necessary, but would stop us from accidentally trying to
    // render with disposed resources.
    this.removeFromScene();
  }
}