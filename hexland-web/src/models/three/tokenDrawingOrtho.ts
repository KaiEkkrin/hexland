import { coordString, edgeString, IGridCoord, IGridEdge, IGridVertex, vertexString } from "../../data/coord";
import { IFeature, IFeatureDictionary, IIdFeature, IResolvedToken, IToken, ITokenProperties } from "../../data/feature";
import { getSpritePath } from "../../data/sprite";
import { BaseTokenDrawing, SimpleTokenDrawing } from "../../data/tokens";
import { IGridGeometry } from "../gridGeometry";
import { RedrawFlag } from "../redrawFlag";
import { IDownloadUrlCache } from "../../services/interfaces";

import { createPaletteColouredAreaObject, createSelectedAreas, createSpriteAreaObject } from "./areas";
import { IInstancedFeatureObject } from "./instancedFeatureObject";
import { InstancedFeatures } from "./instancedFeatures";
import { IColourParameters } from "./paletteColouredFeatureObject";
import { TokenTexts } from "./tokenTexts";
import { createPaletteColouredVertexObject, createTokenFillVertexGeometry } from "./vertices";
import { createPaletteColouredWallObject, createTokenFillEdgeGeometry } from "./walls";

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
// TODO #149 Genericise it to do token fill edges and vertices too :)
class TokenFeatures extends InstancedFeatures<IGridCoord, IToken> {
  private readonly _urlCache: IDownloadUrlCache;
  private readonly _spriteFeatures: InstancedFeatures<IGridCoord, IResolvedToken>;

  constructor(
    gridGeometry: IGridGeometry,
    needsRedraw: RedrawFlag,
    drawingParameters: ITokenDrawingParameters,
    colourParameters: IColourParameters,
    urlCache: IDownloadUrlCache
  ) {
    super(
      gridGeometry, needsRedraw, coordString, createPaletteColouredAreaObject(
        gridGeometry, drawingParameters.alpha, drawingParameters.z, colourParameters
      )
    );

    this._urlCache = urlCache;
    this._spriteFeatures = new InstancedFeatures<IGridCoord, IResolvedToken>(
      gridGeometry, needsRedraw, coordString, createSpriteAreaObject(
        gridGeometry, needsRedraw, drawingParameters.spriteAlpha, drawingParameters.spriteZ
      )
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

  add(f: IToken) {
    const added = super.add(f);
    if (added === false) {
      return false;
    }

    // To be able to add the sprite feature we need to lookup the sprite URL.
    // After finding it we should check again whether this was removed...
    if (f.sprites.length > 0) {
      this._urlCache.resolve(getSpritePath(f.sprites[0]), url => {
        const f2 = super.get(f.position);
        if (f2?.id !== f.id) {
          return;
        }

        this._spriteFeatures.add({ ...f, spriteUrl: url });
      });
    }

    return true;
  }

  clear() {
    super.clear();
    this._spriteFeatures.clear();
  }

  remove(oldPosition: IGridCoord) {
    const removed = super.remove(oldPosition);
    if (removed === undefined) {
      return undefined;
    }

    this._spriteFeatures.remove(oldPosition);
    return removed;
  }

  dispose() {
    super.dispose();
    this._spriteFeatures.dispose();
  }
}

// A handy wrapper for the various thingies that go into token drawing.
export class TokenDrawing extends SimpleTokenDrawing {
  constructor(
    gridGeometry: IGridGeometry,
    needsRedraw: RedrawFlag,
    textMaterial: THREE.MeshBasicMaterial,
    drawingParameters: ITokenDrawingParameters,
    colourParameters: IColourParameters,
    scene: THREE.Scene,
    urlCache: IDownloadUrlCache
  ) {
    super(
      new TokenFeatures(gridGeometry, needsRedraw, drawingParameters, colourParameters, urlCache),
      new InstancedFeatures<IGridEdge, IFeature<IGridEdge>>(
        gridGeometry, needsRedraw, edgeString, createPaletteColouredWallObject(
          createTokenFillEdgeGeometry(gridGeometry, drawingParameters.alpha, drawingParameters.z), gridGeometry, colourParameters
        )
      ),
      new InstancedFeatures<IGridVertex, IFeature<IGridVertex>>(
        gridGeometry, needsRedraw, vertexString, createPaletteColouredVertexObject(
          createTokenFillVertexGeometry(gridGeometry, drawingParameters.alpha, drawingParameters.z), gridGeometry, colourParameters
        )
      ),
      new TokenTexts(gridGeometry, needsRedraw, textMaterial, scene, drawingParameters.textZ)
    );

    (this.faces as TokenFeatures).addToScene(scene);
    (this.fillEdges as InstancedFeatures<IGridEdge, IFeature<IGridEdge>>).addToScene(scene);
    (this.fillVertices as InstancedFeatures<IGridVertex, IFeature<IGridVertex>>).addToScene(scene);
  }

  dispose() {
    (this.faces as TokenFeatures).dispose();
    (this.fillEdges as InstancedFeatures<IGridEdge, IFeature<IGridEdge>>).dispose();
    (this.fillVertices as InstancedFeatures<IGridVertex, IFeature<IGridVertex>>).dispose();
    (this.texts as TokenTexts).dispose();
  }
}

// A similar one for a selection.
class SelectionDrawing extends BaseTokenDrawing<IIdFeature<IGridCoord>> {
  private readonly _dispose: (() => void) | undefined;

  constructor(
    faces: IFeatureDictionary<IGridCoord, IIdFeature<IGridCoord>>,
    fillEdges: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    fillVertices: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>>,
    dispose?: (() => void) | undefined
  ) {
    super(faces, fillEdges, fillVertices);
    this._dispose = dispose;
  }

  clone() {
    // These will be "fake" clones (no UI attached, so no disposal required)
    return new SelectionDrawing(
      this.faces.clone(), this.fillEdges.clone(), this.fillVertices.clone()
    );
  }

  createFace(token: ITokenProperties, position: IGridCoord) {
    return { position: position, colour: 0, id: token.id };
  }

  createFillEdge(token: ITokenProperties, position: IGridEdge): IFeature<IGridEdge> {
    return { position: position, colour: 0 };
  }

  createFillVertex(token: ITokenProperties, position: IGridVertex): IFeature<IGridVertex> {
    return { position: position, colour: 0 };
  }

  dispose() {
    this._dispose?.();
  }
}

export function createSelectionDrawing(
  gridGeometry: IGridGeometry,
  needsRedraw: RedrawFlag,
  createAreaObject: (maxInstances: number) => IInstancedFeatureObject<IGridCoord, IFeature<IGridCoord>>,
  createWallObject: (maxInstances: number) => IInstancedFeatureObject<IGridEdge, IFeature<IGridEdge>>,
  createVertexObject: (maxInstances: number) => IInstancedFeatureObject<IGridVertex, IFeature<IGridVertex>>,
  scene: THREE.Scene
) {
  const faces = createSelectedAreas(gridGeometry, needsRedraw, createAreaObject, 100);
  const fillEdges = new InstancedFeatures<IGridEdge, IFeature<IGridEdge>>(
    gridGeometry, needsRedraw, edgeString, createWallObject, 100
  );
  const fillVertices = new InstancedFeatures<IGridVertex, IFeature<IGridVertex>>(
    gridGeometry, needsRedraw, vertexString, createVertexObject, 100
  );

  faces.addToScene(scene);
  fillEdges.addToScene(scene);
  fillVertices.addToScene(scene);

  return new SelectionDrawing(faces, fillEdges, fillVertices, () => {
    faces.dispose();
    fillEdges.dispose();
    fillVertices.dispose();
  });
}
