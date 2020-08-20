import { IGridCoord } from '../../data/coord';
import { FeatureDictionary, IFeature, IFeatureDictionary } from '../../data/feature';
import { Drawn } from '../drawn';
import { IGridGeometry } from "../gridGeometry";
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

// Encapsulates a mesh for each of the colour channels along with a dictionary
// of the indexes the features' instances have been placed at.
class InstancedMeshCollection<K extends IGridCoord> {
  private readonly _createMesh: (m: THREE.Material, maxInstances: number) => THREE.InstancedMesh;
  private readonly _transformTo: (o: THREE.Object3D, position: K) => void;
  private readonly _maxInstances: number;

  private readonly _indexes: FeatureDictionary<K, IFeature<K>>; // colour as index number
  private _meshes: THREE.InstancedMesh[]; // one per material.

  // This is a queue of re-usable matrix indices for each material in order --
  // re-use one of these to avoid having to expand the number of instances.
  private _clearIndices: number[][];

  constructor(
    toIndex: (k: K) => string,
    createMesh: (m: THREE.Material, maxInstances: number) => THREE.InstancedMesh,
    transformTo: (o: THREE.Object3D, position: K) => void,
    maxInstances: number
  ) {
    this._createMesh = createMesh;
    this._transformTo = transformTo;
    this._maxInstances = maxInstances;
    this._indexes = new FeatureDictionary<K, IFeature<K>>(toIndex);
    this._meshes = [];
    this._clearIndices = [];
  }

  setMaterials(materials: THREE.Material[]) {
    this._meshes = materials.map(m => this._createMesh(m, this._maxInstances));
    this._clearIndices = materials.map(_ => []);
  }

  addToScene(scene: THREE.Scene) {
    this._meshes.forEach(m => { scene.add(m); });
  }

  removeFromScene(scene: THREE.Scene) {
    this._meshes.forEach(m => { scene.remove(m); });
  }

  add<F extends IFeature<K>>(f: F): boolean {
    var mesh = this._meshes[f.colour];

    // Re-use an existing index if we can.   Otherwise, extend the instance list.
    var matrixIndex = this._clearIndices[f.colour].pop();
    if (matrixIndex === undefined) {
      if (mesh.count === this._maxInstances) {
        // We've run out.
        return false;
      }

      matrixIndex = mesh.count++;
    }

    // This is a new addition.  Add a suitable instance.
    var o = new THREE.Object3D();
    this._transformTo(o, f.position);
    o.updateMatrix();

    mesh.setMatrixAt(matrixIndex, o.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    this._indexes.add({ position: f.position, colour: matrixIndex });
    return true;
  }

  clear() {
    this._indexes.clear();
    this._clearIndices = this._meshes.map(_ => []);
    this._meshes.forEach(m => { m.count = 0; });
  }

  remove<F extends IFeature<K>>(f: F): boolean {
    var matrixIndex = this._indexes.remove(f.position);
    if (matrixIndex === undefined) {
      return false;
    }

    var mesh = this._meshes[f.colour];

    // We find the position of its matrix transform in the instance array.
    // Rather than trying to erase it (awkward), we instead set it to a matrix
    // that will make it appear off-screen, and add the index to the re-use list.
    var o = new THREE.Object3D();
    o.translateZ(-1000);
    o.updateMatrix();
    mesh.setMatrixAt(matrixIndex.colour, o.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    this._clearIndices[f.colour].push(matrixIndex.colour);
    return true;
  }
}

// A helpful base class for instanced features such as areas and walls.
// This class manages the underlying meshes and instances.
// (Argh, more inheritance!  I don't like it, but in this case as with the geometry
// it seems to fit the problem at hand...)
// TODO Handle spawning extra meshes and adding them to the scene if I exceed
// `maxInstances` instances in one mesh
export abstract class InstancedFeatures<K extends IGridCoord, F extends IFeature<K>> extends Drawn implements IFeatureDictionary<K, F> {
  private readonly _maxInstances: number;
  private readonly _features: FeatureDictionary<K, F>;

  private readonly _toIndex: (k: K) => string;
  private readonly _meshCollections: InstancedMeshCollection<K>[] = [];

  // We keep hold of the materials and scene so that things can be added and removed later:
  private _materials: THREE.Material[] | undefined;
  private _scene: THREE.Scene | undefined;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, toIndex: (k: K) => string, maxInstances?: number | undefined) {
    super(geometry, redrawFlag);
    this._maxInstances = maxInstances ?? 1000;
    this._features = new FeatureDictionary<K, F>(toIndex);
    this._toIndex = toIndex;
    this.pushMeshCollection();
  }

  private pushMeshCollection(): InstancedMeshCollection<K> {
    var c = new InstancedMeshCollection(
      this._toIndex,
      (m, i) => this.createMesh(m, i),
      (o, p) => this.transformTo(o, p),
      this._maxInstances
    );
    this._meshCollections.push(c);

    if (this._materials !== undefined) {
      c.setMaterials(this._materials);
    }

    if (this._scene !== undefined) {
      c.addToScene(this._scene);
    }

    return c;
  }

  protected get scene(): THREE.Scene | undefined { return this._scene; }

  protected abstract createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh;
  protected abstract transformTo(o: THREE.Object3D, position: K): void;

  // setMaterials implies a clear(), because it invalidates our current index tracking.
  // The materials parameter here should be the known colour materials in order.
  setMaterials(materials: THREE.Material[]) {
    this.clear();
    this._meshCollections.forEach(c => c.setMaterials(materials));
    this._materials = materials;
  }

  // Call addToScene() only after setMaterials().
  addToScene(scene: THREE.Scene): boolean {
    if (this._scene !== undefined) {
      return false;
    }

    this._meshCollections.forEach(c => c.addToScene(scene));
    this._scene = scene;
    this.setNeedsRedraw();
    return true;
  }

  removeFromScene() {
    if (this._scene !== undefined) {
      var scene = this._scene;
      this._meshCollections.forEach(c => c.removeFromScene(scene));
      this._scene = undefined;
      this.setNeedsRedraw();
    }
  }

  [Symbol.iterator](): Iterator<F> {
    return this.iterate();
  }

  add(f: F): boolean {
    var done = this._features.add(f);
    if (done === false) {
      // This position is already occupied.
      return false;
    }

    // Use the first mesh collection with a free space, or add a new one if we've
    // run out entirely
    var usedExistingCollection = false;
    for (var c of this._meshCollections) {
      if (c.add(f)) {
        usedExistingCollection = true;
        break;
      }
    }

    if (usedExistingCollection === false) {
      this.pushMeshCollection().add(f);
    }

    this.setNeedsRedraw();
    return true;
  }

  clear() {
    this._features.clear();
    this._meshCollections.forEach(c => c.clear());
    this.setNeedsRedraw();
  }

  clone() {
    // Cloning an InstancedFeatures gets you just a clone of the feature dictionary, no more
    return this._features.clone();
  }

  forEach(fn: (f: F) => void) {
    this._features.forEach(fn);
  }

  get(position: K): F | undefined {
    return this._features.get(position);
  }

  iterate() {
    return this._features.iterate();
  }

  remove(oldPosition: K): F | undefined {
    var feature = this._features.remove(oldPosition);
    if (feature === undefined) {
      return undefined;
    }

    for (var c of this._meshCollections) {
      if (c.remove(feature)) {
        break;
      }
    }

    this.setNeedsRedraw();
    return feature;
  }

  dispose() {
    // Not strictly necessary, but would stop us from accidentally trying to
    // render with disposed resources.
    this.removeFromScene();
  }
}