import { IGridVertex, vertexString } from '../../data/coord';
import { FeatureDictionary, IFeatureDictionary, ITokenText } from '../../data/feature';

import { Drawn } from '../drawn';
import { IGridGeometry } from '../gridGeometry';
import { RedrawFlag } from '../redrawFlag';
import textCreator from './textCreator';

import * as THREE from 'three';

interface ITokenTextWithMesh extends ITokenText {
  mesh: THREE.Mesh;
}

const offsetMultiplicand = new THREE.Vector3(-0.5, 0.5, 0.0);

export class TokenTexts extends Drawn implements IFeatureDictionary<IGridVertex, ITokenText> {
  private readonly _dict = new FeatureDictionary<IGridVertex, ITokenTextWithMesh>(vertexString);

  // We cache text geometries here to avoid repeated re-creation
  private readonly _geometries = new Map<string, THREE.ShapeBufferGeometry>();

  private readonly _material: THREE.Material;
  private readonly _scene: THREE.Scene;
  private readonly _z: number;

  // excessive allocation of these is expensive
  private readonly _scratchMatrix1 = new THREE.Matrix4();
  private readonly _scratchMatrix2 = new THREE.Matrix4();
  private readonly _scratchVector1 = new THREE.Vector3();
  private readonly _targetPosition = new THREE.Vector3();
  private readonly _transform = new THREE.Matrix4();

  constructor(
    gridGeometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    material: THREE.Material,
    scene: THREE.Scene,
    z: number
  ) {
    super(gridGeometry, redrawFlag);
    this._material = material;
    this._scene = scene;
    this._z = z;
  }

  private createMesh(f: ITokenText, geometry: THREE.ShapeBufferGeometry, bb: THREE.Box3): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this._material);

    const offset = this._scratchVector1.copy(bb.max).sub(bb.min).multiply(offsetMultiplicand);
    const targetPosition = (f.atVertex ? this.geometry.createVertexCentre(
      this._targetPosition, f.position, this._z
    ) : this.geometry.createCoordCentre(
      this._targetPosition, f.position, this._z
    ));

    const targetSize = 0.15 * Math.pow(f.size, 0.5);
    const transform = this._transform.makeTranslation(targetPosition.x, targetPosition.y, targetPosition.z)
      .multiply(this._scratchMatrix1.makeScale(targetSize, targetSize, targetSize))
      .multiply(this._scratchMatrix2.makeTranslation(offset.x, offset.y, 0));
    mesh.applyMatrix4(transform);
    return mesh;
  }

  private getGeometry(text: string): THREE.ShapeBufferGeometry | undefined {
    let geometry = this._geometries.get(text);
    if (geometry !== undefined) {
      return geometry;
    }

    geometry = textCreator.create(text, this.geometry.faceSize);
    if (geometry !== undefined) {
      this._geometries.set(text, geometry);
    }

    return geometry;
  }

  [Symbol.iterator](): Iterator<ITokenText> {
    return this.iterate();
  }

  add(f: ITokenText): boolean {
    const geometry = this.getGeometry(f.text);
    if (geometry === undefined || geometry.boundingBox === null) {
      return false;
    }

    const mesh = this.createMesh(f, geometry, geometry.boundingBox);
    if (this._dict.add({ ...f, mesh: mesh }) === false) {
      return false;
    }

    this._scene.add(mesh);
    this.setNeedsRedraw();
    return true;
  }

  clear() {
    this._dict.forEach(t => this._scene.remove(t.mesh));
    this._dict.clear();
    this.setNeedsRedraw();
  }

  clone() {
    // This gets you an incomplete clone, good for testing possible changes, but not for display
    return this._dict.clone();
  }

  forEach(fn: (f: ITokenText) => void) {
    this._dict.forEach(fn);
  }

  get(position: IGridVertex): ITokenText | undefined {
    return this._dict.get(position);
  }

  iterate() {
    return this._dict.iterate();
  }

  remove(oldPosition: IGridVertex): ITokenText | undefined {
    const removed = this._dict.remove(oldPosition);
    if (removed === undefined) {
      return undefined;
    }

    this._scene.remove(removed.mesh);
    this.setNeedsRedraw();
    return removed;
  }

  dispose() {
    // Nothing to do here
  }
}