import { IGridCoord } from '../../data/coord';
import { FeatureDictionary, IFeature } from '../../data/feature';

import * as THREE from 'three';

// The interface of the instanced feature object, which describes a collection
// of features all drawn using the same instanced mesh added to a scene.
export interface IInstancedFeatureObject<K extends IGridCoord, F extends IFeature<K>> {
  addToScene(scene: THREE.Scene): void;
  removeFromScene(scene: THREE.Scene): void;

  add(f: F): boolean;
  clear(): void;
  remove(f: F): boolean;

  dispose(): void;
}

// A base class that manages a collection of features all drawn using the
// same instanced mesh added to a scene.
export abstract class InstancedFeatureObject<K extends IGridCoord, F extends IFeature<K>> implements IInstancedFeatureObject<K, F> {
  private readonly _transformTo: (m: THREE.Matrix4, position: K) => THREE.Matrix4;
  private readonly _maxInstances: number;

  private readonly _indexes: FeatureDictionary<K, IFeature<K>>; // colour as instance index number
  private _mesh: THREE.InstancedMesh | undefined; // created when required

  // This is a queue of indices that are currently drawing an off-screen
  // instance and could be re-used.
  private _clearIndices: number[] = [];

  constructor(
    toIndex: (k: K) => string,
    transformTo: (m: THREE.Matrix4, position: K) => THREE.Matrix4,
    maxInstances: number
  ) {
    this._transformTo = transformTo;
    this._maxInstances = maxInstances;
    this._indexes = new FeatureDictionary<K, IFeature<K>>(toIndex);
  }

  protected get mesh() {
    if (this._mesh === undefined) {
      this._mesh = this.createMesh(this._maxInstances);
      this._mesh.count = 0;
      this._mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    return this._mesh;
  }

  // Override this to describe how to create the mesh.
  protected abstract createMesh(maxInstances: number): THREE.InstancedMesh;

  // Override this to do the other things necessary when adding a feature, e.g.
  // filling in other instanced attributes.
  protected addFeature(f: F, instanceIndex: number) {
    // All features have a position, which we create now
    const o = new THREE.Object3D();
    this._transformTo(o.matrix, f.position);
    this.mesh.setMatrixAt(instanceIndex, o.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // You probably won't need to change how removals work.
  protected removeFeature(f: F, instanceIndex: number) {
    // We find the position of its matrix transform in the instance array.
    // Rather than trying to erase it (awkward), we instead set it to a matrix
    // that will make it appear off-screen, and add the index to the re-use list.
    let o = new THREE.Object3D();
    o.translateZ(-1000);
    o.updateMatrix();
    this.mesh.setMatrixAt(instanceIndex, o.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.mesh);
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this.mesh);
  }

  add(f: F) {
    // Re-use an existing index if we can.   Otherwise, extend the instance list.
    let instanceIndex = this._clearIndices.pop();
    if (instanceIndex === undefined) {
      if (this.mesh.count === this._maxInstances) {
        // We've run out.
        return false;
      }

      instanceIndex = this.mesh.count++;
    }

    // Add an instance for this feature in the right place
    this.addFeature(f, instanceIndex);
    this._indexes.add({ position: f.position, colour: instanceIndex });
    return true;
  }

  clear() {
    this._indexes.clear();
    this._clearIndices = [];
    this.mesh.count = 0;
  }

  remove(f: F) {
    const instanceIndex = this._indexes.remove(f.position);
    if (instanceIndex === undefined) {
      return false;
    }

    this.removeFeature(f, instanceIndex.colour);
    this._clearIndices.push(instanceIndex.colour);
    return true;
  }

  dispose() {
  }
}