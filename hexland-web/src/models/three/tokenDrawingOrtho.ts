import { coordString, edgeString, IGridCoord, IGridEdge, IGridVertex, vertexString } from "../../data/coord";
import { IFeature, IFeatureDictionary, IIdFeature, IToken, ITokenProperties } from "../../data/feature";
import { BaseTokenDrawing, SimpleTokenDrawing } from "../../data/tokens";
import { IGridGeometry } from "../gridGeometry";
import { RedrawFlag } from "../redrawFlag";

import { createPaletteColouredAreaObject, createSelectedAreas } from "./areas";
import { IInstancedFeatureObject } from "./instancedFeatureObject";
import { InstancedFeatures } from "./instancedFeatures";
import { IColourParameters } from "./paletteColouredFeatureObject";
import { createPaletteColouredVertexObject, createTokenFillVertexGeometry } from "./vertices";
import { createPaletteColouredWallObject, createTokenFillEdgeGeometry } from "./walls";

import * as THREE from 'three';
import { TokenTexts } from "./tokenTexts";

// A handy wrapper for the various thingies that go into token drawing.
export class TokenDrawing extends SimpleTokenDrawing {
  constructor(
    gridGeometry: IGridGeometry,
    needsRedraw: RedrawFlag,
    textMaterial: THREE.MeshBasicMaterial,
    alpha: number,
    z: number,
    textZ: number,
    colourParameters: IColourParameters,
    scene: THREE.Scene
  ) {
    super(
      new InstancedFeatures<IGridCoord, IToken>(
        gridGeometry, needsRedraw, coordString, createPaletteColouredAreaObject(
          gridGeometry, alpha, z, colourParameters
        )
      ),
      new InstancedFeatures<IGridEdge, IFeature<IGridEdge>>(
        gridGeometry, needsRedraw, edgeString, createPaletteColouredWallObject(
          createTokenFillEdgeGeometry(gridGeometry, alpha, z), gridGeometry, colourParameters
        )
      ),
      new InstancedFeatures<IGridVertex, IFeature<IGridVertex>>(
        gridGeometry, needsRedraw, vertexString, createPaletteColouredVertexObject(
          createTokenFillVertexGeometry(gridGeometry, alpha, z), gridGeometry, colourParameters
        )
      ),
      new TokenTexts(gridGeometry, needsRedraw, textMaterial, scene, textZ)
    );

    (this.faces as InstancedFeatures<IGridCoord, IToken>).addToScene(scene);
    (this.fillEdges as InstancedFeatures<IGridEdge, IFeature<IGridEdge>>).addToScene(scene);
    (this.fillVertices as InstancedFeatures<IGridVertex, IFeature<IGridVertex>>).addToScene(scene);
  }

  dispose() {
    (this.faces as InstancedFeatures<IGridCoord, IToken>).dispose();
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