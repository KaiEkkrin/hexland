import { edgeString, IGridCoord, IGridEdge, IGridVertex, vertexString } from "../../data/coord";
import { IFeature, IIdFeature, IToken } from "../../data/feature";
import { IGridGeometry } from "../gridGeometry";
import { ITokenDrawing } from "../interfaces";
import { RedrawFlag } from "../redrawFlag";

import { createSelectedAreas, SelectedAreas } from "./areas";
import { IInstancedFeatureObject } from "./instancedFeatureObject";
import { InstancedFeatures } from "./instancedFeatures";
import { IColourParameters } from "./paletteColouredFeatureObject";
import textCreator from "./textCreator";
import { TokenFaces } from "./tokenFaces";
import { createPaletteColouredVertexObject, createTokenFillVertexGeometry, Vertices } from "./vertices";
import { createPaletteColouredWallObject, createTokenFillEdgeGeometry, Edges } from "./walls";

import * as THREE from 'three';

// A handy wrapper for the various thingies that go into token drawing.
export class TokenDrawing implements ITokenDrawing<IToken> {
  private readonly _faces: TokenFaces;
  private readonly _fillEdges: Edges;
  private readonly _fillVertices: Vertices;

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
    this._faces = new TokenFaces(gridGeometry, needsRedraw, textCreator, textMaterial, alpha, z, textZ, colourParameters);
    this._fillEdges = new InstancedFeatures<IGridEdge, IFeature<IGridEdge>>(
      gridGeometry, needsRedraw, edgeString, createPaletteColouredWallObject(
        createTokenFillEdgeGeometry(gridGeometry, alpha, z), gridGeometry, colourParameters
      )
    );
    this._fillVertices = new InstancedFeatures<IGridVertex, IFeature<IGridVertex>>(
      gridGeometry, needsRedraw, vertexString, createPaletteColouredVertexObject(
        createTokenFillVertexGeometry(gridGeometry, alpha, z), gridGeometry, colourParameters
      )
    );

    this._faces.addToScene(scene);
    this._fillEdges.addToScene(scene);
    this._fillVertices.addToScene(scene);
  }

  get faces() { return this._faces; }
  get fillEdges() { return this._fillEdges; }
  get fillVertices() { return this._fillVertices; }

  dispose() {
    this._faces.dispose();
    this._fillEdges.dispose();
    this._fillVertices.dispose();
  }
}

// A similar one for a selection.
export class SelectionDrawing implements ITokenDrawing<IIdFeature<IGridCoord>> {
  private readonly _faces: SelectedAreas;
  private readonly _fillEdges: Edges;
  private readonly _fillVertices: Vertices;

  constructor(
    gridGeometry: IGridGeometry,
    needsRedraw: RedrawFlag,
    createAreaObject: (maxInstances: number) => IInstancedFeatureObject<IGridCoord, IFeature<IGridCoord>>,
    createWallObject: (maxInstances: number) => IInstancedFeatureObject<IGridEdge, IFeature<IGridEdge>>,
    createVertexObject: (maxInstances: number) => IInstancedFeatureObject<IGridVertex, IFeature<IGridVertex>>,
    scene: THREE.Scene
  ) {
    this._faces = createSelectedAreas(gridGeometry, needsRedraw, createAreaObject, 100);
    this._fillEdges = new InstancedFeatures<IGridEdge, IFeature<IGridEdge>>(
      gridGeometry, needsRedraw, edgeString, createWallObject, 100
    );
    this._fillVertices = new InstancedFeatures<IGridVertex, IFeature<IGridVertex>>(
      gridGeometry, needsRedraw, vertexString, createVertexObject, 100
    );

    this._faces.addToScene(scene);
    this._fillEdges.addToScene(scene);
    this._fillVertices.addToScene(scene);
  }

  get faces() { return this._faces; }
  get fillEdges() { return this._fillEdges; }
  get fillVertices() { return this._fillVertices; }

  dispose() {
    this._faces.dispose();
    this._fillEdges.dispose();
    this._fillVertices.dispose();
  }
}