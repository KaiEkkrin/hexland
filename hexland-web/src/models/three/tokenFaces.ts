import { IGridCoord, coordString } from '../../data/coord';
import { IToken } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { createPaletteColouredAreaObject } from './areas';
import { InstancedFeatures } from './instancedFeatures';
import { IColourParameters } from './paletteColouredFeatureObject';
import { RedrawFlag } from '../redrawFlag';
import { TextCreator } from './textCreator';

import * as THREE from 'three';

// We store text meshes along with our tokens so that they can be propagated
// upon token move rather than re-created:
export interface IInstancedToken extends IToken {
  textMesh: THREE.Mesh | undefined; // so that a mesh already created can be re-used
}

// The "tokens" are moveable objects that occupy a face of the map.
// This object manages a collection of single grid faces that are drawn to represent
// whole small tokens or parts of large ones.  It will be used by the implementation
// of ITokenDictionary, which is aware of the whole tokens.
export class TokenFaces extends InstancedFeatures<IGridCoord, IInstancedToken> {
  private readonly _textCreator: TextCreator;
  private readonly _textMaterial: THREE.Material;
  private readonly _textZ: number;

  constructor(
    gridGeometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    textCreator: TextCreator,
    textMaterial: THREE.Material,
    alpha: number,
    tokenZ: number,
    textZ: number,
    colourParameters: IColourParameters,
    maxInstances?: number | undefined
  ) {
    super(
      gridGeometry, redrawFlag, coordString,
      createPaletteColouredAreaObject(gridGeometry, alpha, tokenZ, colourParameters),
      maxInstances
    );

    this._textCreator = textCreator;
    this._textMaterial = textMaterial;
    this._textZ = textZ;
  }

  addToScene(scene: THREE.Scene): boolean {
    if (!super.addToScene(scene)) {
      return false;
    }

    // Hopefully there's nothing here yet, but just in case addToScene is called late:
    this.forEach(f => {
      if (f.textMesh !== undefined) {
        this.scene?.add(f.textMesh);
      }
    });
    return true;
  }

  removeFromScene() {
    if (this.scene !== undefined) {
      this.forEach(f => {
        if (f.textMesh !== undefined) {
          this.scene?.remove(f.textMesh);
        }
      });
    }
    super.removeFromScene();
  }

  add(f: IInstancedToken): boolean {
    if (!super.add(f)) {
      return false;
    }

    if (f.textMesh === undefined) {
      // Create the text that goes with this token now:
      f.textMesh = this._textCreator.create(
        f.text,
        this.geometry.faceSize * 0.15,
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

  clear() {
    this.forEach(f => {
      if (f.textMesh !== undefined) {
        this.scene?.remove(f.textMesh);
      }
    });
    super.clear();
  }

  remove(oldPosition: IGridCoord): IInstancedToken | undefined {
    let f = super.remove(oldPosition);
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

  dispose() {
    super.dispose();
    this._textMaterial.dispose();
  }
}