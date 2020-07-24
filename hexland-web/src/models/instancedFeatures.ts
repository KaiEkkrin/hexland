import { GridCoord, CoordDictionary } from '../data/coord';
import { Drawn } from './drawn';
import { IGridGeometry } from "./gridGeometry";
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

// Describes a feature:
export interface IFeature<K extends GridCoord> {
  position: K;
  colour: number;
}

// A helpful base class for instanced features such as areas and walls.
// This class manages the underlying meshes and instances.
// (Argh, more inheritance!  I don't like it, but in this case as with the geometry
// it seems to fit the problem at hand...)
// TODO Handle spawning extra meshes and adding them to the scene if I exceed
// `maxInstances` instances in one mesh
export abstract class InstancedFeatures<K extends GridCoord, F extends IFeature<K>> extends Drawn {
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

  get all(): F[] {
    // I can't use `map` and `filter` here, because Typescript's type checking doesn't
    // realise I've excluded undefined
    var all: F[] = [];
    this._colours.keys.forEach(k => {
      var here = this.at(k);
      if (here !== undefined) {
        all.push(here);
      }
    });

    return all;
  }

  add(f: F) {
    var oldColour = this._colours.get(f.position);
    if (oldColour === f.colour) {
      // This is already set.
      return;
    }

    if (oldColour !== undefined) {
      // A different colour was set -- remove it first.
      this.remove(f.position);
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

    this._colours.set(f.position, f.colour);
    this._indexes.set(f.position, matrixIndex);
    this.setNeedsRedraw();
  }

  at(position: K): F | undefined {
    var colour = this._colours.get(position);
    if (colour === undefined) {
      return undefined;
    }

    return { position: position, colour: colour } as F;
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

  remove(oldPosition: K): F | undefined {
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

    return { position: oldPosition, colour: colourIndex } as F;
  }
}