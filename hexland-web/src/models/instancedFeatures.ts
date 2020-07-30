import { CoordDictionary } from '../data/coord';
import { IFeature } from '../data/feature';
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
export abstract class InstancedFeatures<K, F extends IFeature<K>> extends Drawn {
  private readonly _maxInstances: number;
  private readonly _features: CoordDictionary<K, F>;
  private readonly _indexes: CoordDictionary<K, number>;
  private _meshes: THREE.InstancedMesh[]; // one per material.

  // This is a queue of re-usable matrix indices for each material in order --
  // re-use one of these to avoid having to expand the number of instances.
  private _clearIndices: number[][];

  // We keep hold of the scene so that things can be added and removed later:
  private _scene: THREE.Scene | undefined;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, toIndex: (k: K) => string, maxInstances?: number | undefined) {
    super(geometry, redrawFlag);
    this._maxInstances = maxInstances ?? 1000;
    this._features = new CoordDictionary<K, F>(toIndex);
    this._indexes = new CoordDictionary<K, number>(toIndex);
    this._meshes = [];
    this._clearIndices = [];
  }

  protected get scene(): THREE.Scene | undefined { return this._scene; }

  protected abstract createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh;
  protected abstract transformTo(o: THREE.Object3D, position: K): void;

  // The materials parameter here should be the known colour materials in order.
  addToScene(scene: THREE.Scene, materials: THREE.Material[]): boolean {
    if (this._scene !== undefined) {
      return false;
    }

    this._meshes = materials.map(m => this.createMesh(m, this._maxInstances));
    this._clearIndices = materials.map(_ => []);
    this._meshes.forEach(m => { scene.add(m); });
    this._scene = scene;
    return true;
  }

  get all(): F[] {
    // I can't use `map` and `filter` here, because Typescript's type checking doesn't
    // realise I've excluded undefined
    var all: F[] = [];
    this._features.keys.forEach(k => {
      var here = this._features.get(k);
      if (here !== undefined) {
        all.push(here);
      }
    });

    return all;
  }

  add(f: F): boolean {
    var oldFeature = this._features.get(f.position);
    if (oldFeature !== undefined) {
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

    this._features.set(f.position, f);
    this._indexes.set(f.position, matrixIndex);
    this.setNeedsRedraw();
    return true;
  }

  at(position: K): F | undefined {
    return this._features.get(position);
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

  remove(oldPosition: K): F | undefined {
    var feature = this._features.get(oldPosition);
    if (feature === undefined) {
      return undefined;
    }

    var matrixIndex = this._indexes.get(oldPosition);
    if (matrixIndex === undefined) {
      return undefined;
    }

    var mesh = this._meshes[feature.colour];

    // We find the position of its matrix transform in the instance array.
    // Rather than trying to erase it (awkward), we instead set it to a matrix
    // that will make it appear off-screen, and add the index to the re-use list.
    var o = new THREE.Object3D();
    o.translateZ(-1000);
    o.updateMatrix();
    mesh.setMatrixAt(matrixIndex, o.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    this._features.remove(oldPosition);
    this._indexes.remove(oldPosition);
    this._clearIndices[feature.colour].push(matrixIndex);
    this.setNeedsRedraw();

    return feature;
  }
}