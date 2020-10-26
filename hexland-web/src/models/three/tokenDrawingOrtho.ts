import { coordString, edgeString, IGridCoord, IGridEdge, IGridVertex, vertexString } from "../../data/coord";
import { FeatureDictionary, IFeature, IFeatureDictionary, IToken, ITokenProperties, ITokenText } from "../../data/feature";
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
import fluent from "fluent-iterable";

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
  private _textureCache: TextureCache;

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
    const toRelease = [...fluent(this._spriteFeatures)];
    Promise.all(toRelease.map(f => f.spriteTexture.release()))
      .then(done => console.log(`${done.length} sprite features released`));
    this._spriteFeatures.clear();
  }

  remove(oldPosition: K) {
    const removed = super.remove(oldPosition);
    if (removed === undefined) {
      return undefined;
    }

    const removedSprite = this._spriteFeatures.remove(oldPosition);
    if (removedSprite !== undefined) {
      removedSprite.spriteTexture.release().then(() => { /* done */ });
    }

    return removed;
  }

  setTextureCache(textureCache: TextureCache) {
    this._textureCache = textureCache;
  }

  dispose() {
    this.clear(); // to ensure sprite resources are released
    super.dispose();
    this._spriteFeatures.dispose();
  }
}

// A handy wrapper for the various thingies that go into token drawing.
export class TokenDrawing extends SimpleTokenDrawing<
  TokenFeatures<IGridCoord, IFeature<IGridCoord> & ITokenProperties & { basePosition: IGridCoord }>,
  TokenFeatures<IGridEdge, IFeature<IGridEdge> & ITokenProperties & { basePosition: IGridCoord }>,
  TokenFeatures<IGridVertex, IFeature<IGridVertex> & ITokenProperties & { basePosition: IGridCoord }>,
  TokenTexts
> {
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

    this.faces.addToScene(scene);
    this.fillEdges.addToScene(scene);
    this.fillVertices.addToScene(scene);
  }

  setTextureCache(textureCache: TextureCache) {
    this.faces.setTextureCache(textureCache);
    this.fillEdges.setTextureCache(textureCache);
    this.fillVertices.setTextureCache(textureCache);
  }

  dispose() {
    super.dispose();
    this.faces.dispose();
    this.fillEdges.dispose();
    this.fillVertices.dispose();
    this.texts.dispose();
  }
}

export class SelectionDrawing extends SimpleTokenDrawing<
  InstancedFeatures<IGridCoord, IFeature<IGridCoord> & ITokenProperties & { basePosition: IGridCoord }>,
  InstancedFeatures<IGridEdge, IFeature<IGridEdge> & ITokenProperties & { basePosition: IGridCoord }>,
  InstancedFeatures<IGridVertex, IFeature<IGridVertex> & ITokenProperties & { basePosition: IGridCoord }>,
  IFeatureDictionary<IGridCoord, ITokenText>
> {
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
      ),
      new FeatureDictionary<IGridCoord, ITokenText>(coordString) // not rendered
    );

    this.faces.addToScene(scene);
    this.fillEdges.addToScene(scene);
    this.fillVertices.addToScene(scene);
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
    super.dispose();
    this.faces.dispose();
    this.fillEdges.dispose();
    this.fillVertices.dispose();
  }
}