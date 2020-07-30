import { IGridCoord, coordString } from '../data/coord';
import { IToken } from '../data/feature';
import { IGridGeometry } from "./gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from './redrawFlag';
import { TextCreator } from './textCreator';

import * as THREE from 'three';

// We store text meshes along with our tokens so that they can be propagated
// upon token move rather than re-created:
export interface IInstancedToken extends IToken {
  textMesh: THREE.Mesh | undefined; // so that a mesh already created can be re-used
}

// The "tokens" are moveable objects that occupy a face of the map.
// This object also manages the selection of tokens.
export class Tokens extends InstancedFeatures<IGridCoord, IInstancedToken> {
  private readonly _bufferGeometry: THREE.BufferGeometry;
  private readonly _textCreator: TextCreator;
  private readonly _textMaterial: THREE.Material;
  private readonly _textZ: number;

  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    textCreator: TextCreator,
    textMaterial: THREE.Material,
    alpha: number,
    tokenZ: number,
    textZ: number
  ) {
    super(geometry, redrawFlag, coordString, 1000);

    // TODO Make them look more exciting than just a smaller, brighter face.
    // Maybe with a shader to draw in a ring highlight, text, an image, etc?
    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertices(new THREE.Vector2(0, 0), alpha, tokenZ);
    var indices = single.createSolidMeshIndices();

    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    this._bufferGeometry.setIndex(indices);

    this._textCreator = textCreator;
    this._textMaterial = textMaterial;
    this._textZ = textZ;
  }

  protected createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh {
    var mesh = new THREE.InstancedMesh(this._bufferGeometry, m, maxInstances);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  protected transformTo(o: THREE.Object3D, position: IGridCoord) {
    this.geometry.transformToCoord(o, position);
  }

  addToScene(scene: THREE.Scene, materials: THREE.Material[]): boolean {
    if (!super.addToScene(scene, materials)) {
      return false;
    }

    // Hopefully there's nothing here yet, but just in case addToScene is called late:
    this.all.forEach(f => {
      if (f.textMesh !== undefined) {
        this.scene?.add(f.textMesh);
      }
    });
    return true;
  }

  add(f: IInstancedToken): boolean {
    if (!super.add(f)) {
      return false;
    }

    if (f.textMesh === undefined) {
      // Create the text that goes with this token now:
      f.textMesh = this._textCreator.create(
        f.text,
        this.geometry.faceSize() * 0.15,
        this._textMaterial,
        new THREE.Vector3(0, 0, this._textZ)
      );
    }

    if (f.textMesh !== undefined) {
      // We assume it is always given to us at the origin position
      this.geometry.transformToCoord(f.textMesh, f.position);
      f.textMesh.updateMatrix();
      this.scene?.add(f.textMesh);
    }

    return true;
  }

  remove(oldPosition: IGridCoord): IInstancedToken | undefined {
    var f = super.remove(oldPosition);
    if (f === undefined) {
      return undefined;
    }

    if (f.textMesh !== undefined) {
      this.scene?.remove(f.textMesh);

      // When removing a token from the scene, update its mesh to be at the
      // origin again so that I can easily transform it to a new position if
      // I re-add it:
      this.geometry.transformToOrigin(f.textMesh, f.position);
      f.textMesh.updateMatrix();
    }

    return f;
  }
}