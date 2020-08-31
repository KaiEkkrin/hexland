import { IGridCoord } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { IInstancedFeatureObject } from './instancedFeatureObject';

import * as THREE from 'three';

// An instanced feature object that wraps several, complete with a numeric selector.
export class MultipleFeatureObject<K extends IGridCoord, F extends IFeature<K>> implements IInstancedFeatureObject<K, F> {
  private readonly _createFeatureObj: (index: number) => IInstancedFeatureObject<K, F>;
  private readonly _getIndex: (f: F) => number;
  private readonly _featureObjs: { [index: number]: IInstancedFeatureObject<K, F> } = {};

  private _scene: THREE.Scene | undefined;

  constructor(
    createFeatureObj: (index: number) => IInstancedFeatureObject<K, F>,
    getIndex: (f: F) => number
  ) {
    this._createFeatureObj = createFeatureObj;
    this._getIndex = getIndex;
  }

  private getFeatureObj(index: number) {
    if (index in this._featureObjs) {
      return this._featureObjs[index];
    }

    // When we create a new feature object, we should immediately add it to the
    // scene if we have one:
    const newFeatureObj = this._createFeatureObj(index);
    this._featureObjs[index] = newFeatureObj;
    if (this._scene !== undefined) {
      newFeatureObj.addToScene(this._scene);
    }

    return newFeatureObj;
  }

  addToScene(scene: THREE.Scene) {
    // We'll only support one scene here
    if (this._scene !== undefined) {
      throw Error("Already have a scene");
    }

    this._scene = scene;
    for (var i in this._featureObjs) {
      this._featureObjs[i].addToScene(scene);
    }
  }

  removeFromScene(scene: THREE.Scene) {
    if (this._scene !== scene) {
      throw Error("Not in this scene");
    }

    this._scene = undefined;
    for (var i in this._featureObjs) {
      this._featureObjs[i].removeFromScene(scene);
    }
  }

  add(f: F) {
    return this.getFeatureObj(this._getIndex(f)).add(f);
  }

  clear() {
    for (var i in this._featureObjs) {
      this._featureObjs[i].clear();
    }
  }

  remove(f: F) {
    return this.getFeatureObj(this._getIndex(f)).remove(f);
  }

  dispose() {
    for (var i in this._featureObjs) {
      this._featureObjs[i].dispose();
    }
  }
}