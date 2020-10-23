import { coordString, edgeString, IGridCoord, IGridEdge, IGridVertex, vertexString } from "../../data/coord";
import { IFeature, IToken, ITokenProperties } from "../../data/feature";
import { ITokenFace, ITokenFillEdge, ITokenFillVertex, SimpleTokenDrawing } from "../../data/tokens";
import { IGridGeometry } from "../gridGeometry";
import { RedrawFlag } from "../redrawFlag";

import { createPaletteColouredAreaObject, createSelectedAreas, createSpriteAreaObject } from "./areas";
import { IInstancedFeatureObject } from "./instancedFeatureObject";
import { InstancedFeatures } from "./instancedFeatures";
import { IColourParameters } from "./paletteColouredFeatureObject";
import { ITextureLease, TextureCache } from "./textureCache";
import { TokenTexts } from "./tokenTexts";
import { ITokenUvTransform } from "./uv";
import { createPaletteColouredVertexObject, createSpriteVertexObject, createTokenFillVertexGeometry } from "./vertices";
import { createPaletteColouredWallObject, createSpriteEdgeObject, createTokenFillEdgeGeometry } from "./walls";

import * as THREE from 'three';

export interface ITokenDrawingParameters {
  alpha: number;
  spriteAlpha: number;
  z: number;
  spriteZ: number;
  textZ: number;
}

// This middle dictionary helps us create the palette-coloured token features immediately,
// and the sprite ones (if applicable) once we get a download URL.
class TokenFeatures<K extends IGridCoord, F extends (IFeature<K> & ITokenProperties & { basePosition: IGridCoord })>
  extends InstancedFeatures<K, F>
{
  private readonly _spriteFeatures: InstancedFeatures<K, F & { spriteTexture: ITextureLease }>;
  private readonly _textureCache: TextureCache;

  constructor(
    gridGeometry: IGridGeometry,
    needsRedraw: RedrawFlag,
    toIndex: (k: K) => string,
    createPaletteColouredObject: (maxInstances: number) => IInstancedFeatureObject<K, F>,
    createSpriteObject: (maxInstances: number) => IInstancedFeatureObject<K, F>,
    textureCache: TextureCache
  ) {
    super(gridGeometry, needsRedraw, toIndex, createPaletteColouredObject);
    this._textureCache = textureCache;
    this._spriteFeatures = new InstancedFeatures<K, F & { spriteTexture: ITextureLease }>(
      gridGeometry, needsRedraw, toIndex, createSpriteObject
    );
  }

  addToScene(scene: THREE.Scene) {
    if (super.addToScene(scene) === false) {
      return false;
    }

    this._spriteFeatures.addToScene(scene);
    return true;
  }

  removeFromScene() {
    super.removeFromScene();
    this._spriteFeatures.removeFromScene();
  }

  add(f: F) {
    const added = super.add(f);
    if (added === false) {
      return false;
    }

    // To be able to add the sprite feature we need to lookup the sprite URL.
    // After finding it we should check again whether this was removed...
    if (f.sprites.length > 0) {
      this._textureCache.resolve(f.sprites[0])
        .then(t => {
          const f2 = super.get(f.position);
          if (f2?.id !== f.id) {
            return;
          }

          this._spriteFeatures.add({ ...f, spriteTexture: t });
        });
    }

    return true;
  }

  clear() {
    super.clear();

    // Remember to release all the sprite resources before emptying the dictionary!
    console.log(`releasing all sprite features`);
    this._spriteFeatures.forEach(f => f.spriteTexture.release().then());
    this._spriteFeatures.clear();
  }

  remove(oldPosition: K) {
    const removed = super.remove(oldPosition);
    if (removed === undefined) {
      return undefined;
    }

    const removedSprite = this._spriteFeatures.remove(oldPosition);
    if (removedSprite !== undefined) {
      removedSprite.spriteTexture.release().then();
    }

    return removed;
  }

  dispose() {
    this.clear(); // to ensure sprite resources are released
    super.dispose();
    this._spriteFeatures.dispose();
  }
}

// A handy wrapper for the various thingies that go into token drawing.
export class TokenDrawing extends SimpleTokenDrawing {
  constructor(
    gridGeometry: IGridGeometry,
    textureCache: TextureCache,
    uvTransform: ITokenUvTransform,
    needsRedraw: RedrawFlag,
    textMaterial: THREE.MeshBasicMaterial,
    drawingParameters: ITokenDrawingParameters,
    colourParameters: IColourParameters,
    scene: THREE.Scene,
  ) {
    super(
      new TokenFeatures(
        gridGeometry, needsRedraw, coordString,
        createPaletteColouredAreaObject(gridGeometry, drawingParameters.alpha, drawingParameters.z, colourParameters),
        createSpriteAreaObject(gridGeometry, textureCache, uvTransform, drawingParameters.spriteAlpha, drawingParameters.spriteZ),
        textureCache
      ),
      new TokenFeatures(
        gridGeometry, needsRedraw, edgeString,
        createPaletteColouredWallObject(
          createTokenFillEdgeGeometry(gridGeometry, drawingParameters.alpha, drawingParameters.z), gridGeometry, colourParameters
        ),
        createSpriteEdgeObject(gridGeometry, textureCache, uvTransform, drawingParameters.spriteAlpha, drawingParameters.spriteZ),
        textureCache
      ),
      new TokenFeatures(
        gridGeometry, needsRedraw, vertexString,
        createPaletteColouredVertexObject(
          createTokenFillVertexGeometry(gridGeometry, drawingParameters.alpha, drawingParameters.z), gridGeometry, colourParameters
        ),
        createSpriteVertexObject(gridGeometry, textureCache, uvTransform, drawingParameters.spriteAlpha, drawingParameters.spriteZ),
        textureCache
      ),
      new TokenTexts(gridGeometry, needsRedraw, textMaterial, scene, drawingParameters.textZ)
    );

    (this.faces as InstancedFeatures<IGridCoord, ITokenFace>).addToScene(scene);
    (this.fillEdges as InstancedFeatures<IGridEdge, ITokenFillEdge>).addToScene(scene);
    (this.fillVertices as InstancedFeatures<IGridVertex, ITokenFillVertex>).addToScene(scene);
  }

  dispose() {
    (this.faces as InstancedFeatures<IGridCoord, ITokenFace>).dispose();
    (this.fillEdges as InstancedFeatures<IGridEdge, ITokenFillEdge>).dispose();
    (this.fillVertices as InstancedFeatures<IGridVertex, ITokenFillVertex>).dispose();
    (this.texts as TokenTexts).dispose();
  }
}

export class SelectionDrawing extends SimpleTokenDrawing {
  constructor(
    gridGeometry: IGridGeometry,
    needsRedraw: RedrawFlag,
    createAreaObject: (maxInstances: number) => IInstancedFeatureObject<IGridCoord, IFeature<IGridCoord>>,
    createWallObject: (maxInstances: number) => IInstancedFeatureObject<IGridEdge, IFeature<IGridEdge>>,
    createVertexObject: (maxInstances: number) => IInstancedFeatureObject<IGridVertex, IFeature<IGridVertex>>,
    scene: THREE.Scene
  ) {
    super(
      createSelectedAreas<ITokenFace>(gridGeometry, needsRedraw, createAreaObject, 100),
      new InstancedFeatures<IGridEdge, ITokenFillEdge>(
        gridGeometry, needsRedraw, edgeString, createWallObject, 100
      ),
      new InstancedFeatures<IGridVertex, ITokenFillVertex>(
        gridGeometry, needsRedraw, vertexString, createVertexObject, 100
      )
    );

    (this.faces as InstancedFeatures<IGridCoord, ITokenFace>).addToScene(scene);
    (this.fillEdges as InstancedFeatures<IGridEdge, ITokenFillEdge>).addToScene(scene);
    (this.fillVertices as InstancedFeatures<IGridVertex, ITokenFillVertex>).addToScene(scene);
  }

  // We need to squash the colour for this one; selections have their own meaning of colour
  createFace(token: IToken, position: IGridCoord) {
    return { ...token, basePosition: token.position, position: position, colour: 0 };
  }

  createFillEdge(token: IToken, position: IGridEdge) {
    return { ...token, basePosition: token.position, position: position, colour: 0 };
  }

  createFillVertex(token: IToken, position: IGridVertex) {
    return { ...token, basePosition: token.position, position: position, colour: 0 };
  }

  dispose() {
    (this.faces as InstancedFeatures<IGridCoord, ITokenFace>).dispose();
    (this.fillEdges as InstancedFeatures<IGridEdge, ITokenFillEdge>).dispose();
    (this.fillVertices as InstancedFeatures<IGridVertex, ITokenFillVertex>).dispose();
  }
}