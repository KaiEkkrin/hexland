import { coordString, edgeString, IGridCoord, IGridEdge, IGridVertex, vertexString } from "../../data/coord";
import { IFeature, IToken, ITokenProperties } from "../../data/feature";
import { BaseTokenDrawing, ITokenFace, ITokenFillEdge, ITokenFillVertex } from "../../data/tokens";
import { BaseTokenDrawingWithText } from "../../data/tokenTexts";
import { ICacheLease } from "../../services/interfaces";

import { IGridGeometry } from "../gridGeometry";
import { RedrawFlag } from "../redrawFlag";

import { createPaletteColouredAreaObject, createSelectedAreas, createSpriteAreaObject } from "./areas";
import { IInstancedFeatureObject } from "./instancedFeatureObject";
import { InstancedFeatures } from "./instancedFeatures";
import { IColourParameters } from "./paletteColouredFeatureObject";
import { ISpriteProperties } from "./spriteFeatureObject";
import { TextureCache } from "./textureCache";
import { TokenTexts } from "./tokenTexts";
import { ITokenUvTransform } from "./uv";
import { createPaletteColouredVertexObject, createSpriteVertexObject, createTokenFillVertexGeometry } from "./vertices";
import { createPaletteColouredWallObject, createSpriteEdgeObject, createTokenFillEdgeGeometry } from "./walls";

import { Subscription } from 'rxjs';
import * as THREE from 'three';
import fluent from "fluent-iterable";

export interface ITokenDrawingParameters {
  alpha: number;
  spriteAlpha: number;
  z: number;
  spriteZ: number;
  textZ: number;
}

interface ITokenSpriteProperties extends ITokenProperties, ISpriteProperties {
  texture: ICacheLease<THREE.Texture>;
}

// This middle dictionary helps us create the palette-coloured token features immediately,
// and the sprite ones (if applicable) once we get a download URL.  So that we can cancel
// resolving the sprite, we include a subscription in the base dictionary.
class TokenFeatures<K extends IGridCoord, F extends (IFeature<K> & ITokenProperties & { basePosition: IGridCoord })>
  extends InstancedFeatures<K, F & { sub?: Subscription | undefined }>
{
  private readonly _spriteFeatures: InstancedFeatures<K, F & ITokenSpriteProperties>;
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
    this._spriteFeatures = new InstancedFeatures<K, F & ITokenSpriteProperties>(
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
    if (f.characterId.length === 0 && f.sprites.length === 0) {
      // There's clearly no sprite to add for this one, just add the palette feature
      return super.add(f);
    }

    // Lookup the sprite, adding the sprite feature when we've got it:
    const sub = this._textureCache.resolve(f).subscribe(e => {
      const removed = this._spriteFeatures.remove(f.position); // just in case
      if (removed !== undefined) {
        removed.texture.release().then(() => { /* nothing to do here */ });
      }

      if (this._spriteFeatures.add({ ...f, sheetEntry: e, texture: e.texture }) === false) {
        console.warn(`failed to add sprite feature with texture ${e.url}`);
      }
    });

    // Add the palette feature now:
    const added = super.add({ ...f, sub: sub });
    if (added === false) {
      // If we're not going to add the palette feature, we need to cancel the
      // sprite feature too :)
      sub.unsubscribe();
      const removed = this._spriteFeatures.remove(f.position);
      if (removed !== undefined) {
        removed.texture.release().then(() => { /* done */ });
      }

      return false;
    }

    return true;
  }

  clear() {
    // Unsubscribe first so no more pending sprite features will go in
    this.forEach(f => f.sub?.unsubscribe());
    super.clear();

    // Remember to release all the sprite resources before emptying the dictionary!
    const toRelease = [...fluent(this._spriteFeatures)];
    Promise.all(toRelease.map(f => f.texture.release()))
      .then(done => console.log(`${done.length} sprite features released`));
    this._spriteFeatures.clear();
  }

  remove(oldPosition: K) {
    const removed = super.remove(oldPosition);
    if (removed === undefined) {
      return undefined;
    }

    removed.sub?.unsubscribe();
    const removedSprite = this._spriteFeatures.remove(oldPosition);
    if (removedSprite !== undefined) {
      removedSprite.texture.release().then(() => { /* done */ });
    }

    return removed;
  }

  setTextureCache(textureCache: TextureCache) {
    // Changing the texture cache invalidates what we currently have,
    // so we do a clear first
    this.clear();
    this._textureCache = textureCache;
  }

  dispose() {
    this.clear(); // to ensure sprite resources are released
    super.dispose();
    this._spriteFeatures.dispose();
  }
}

// A handy wrapper for the various thingies that go into token drawing.
export class TokenDrawing extends BaseTokenDrawingWithText<
  TokenFeatures<IGridCoord, ITokenFace>,
  TokenFeatures<IGridEdge, ITokenFillEdge>,
  TokenFeatures<IGridVertex, ITokenFillVertex>,
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
        createSpriteAreaObject(gridGeometry, needsRedraw, textureCache, uvTransform, drawingParameters.spriteAlpha, drawingParameters.spriteZ),
        textureCache
      ),
      new TokenFeatures(
        gridGeometry, needsRedraw, edgeString,
        createPaletteColouredWallObject(
          createTokenFillEdgeGeometry(gridGeometry, drawingParameters.alpha, drawingParameters.z), gridGeometry, colourParameters
        ),
        createSpriteEdgeObject(gridGeometry, needsRedraw, textureCache, uvTransform, drawingParameters.spriteAlpha, drawingParameters.spriteZ),
        textureCache
      ),
      new TokenFeatures(
        gridGeometry, needsRedraw, vertexString,
        createPaletteColouredVertexObject(
          createTokenFillVertexGeometry(gridGeometry, drawingParameters.alpha, drawingParameters.z), gridGeometry, colourParameters
        ),
        createSpriteVertexObject(gridGeometry, needsRedraw, textureCache, uvTransform, drawingParameters.spriteAlpha, drawingParameters.spriteZ),
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

export class SelectionDrawing extends BaseTokenDrawing<
  InstancedFeatures<IGridCoord, ITokenFace>,
  InstancedFeatures<IGridEdge, ITokenFillEdge>,
  InstancedFeatures<IGridVertex, ITokenFillVertex>
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
      )
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