import { FeatureColour } from "../../featureColour";
import { IGridGeometry } from "../../gridGeometry";
import { IDrawing, IGridBounds, ITokenDrawing } from "../../interfaces";
import { FeatureDictionary, IFeature, IIdFeature, IToken } from "../../../data/feature";
import { IGridCoord, coordString, IGridEdge, edgeString, IGridVertex, vertexString } from "../../../data/coord";
import { OutlinedRectangle } from "./overlayRectangle";

import { Subject } from 'rxjs';

jest.mock('../overlayRectangle');

// The mock drawings we create will be pushed here so that the test
// harness can access them and their mock functions.
export const __mockDrawings: any[] = [];

// A test harness could action this subject to emulate bounds changes
export const __mockBoundsChanged = new Subject<IGridBounds>();

function createTokenDrawing<F extends IFeature<IGridCoord>>(): ITokenDrawing<F> {
  return {
    faces: new FeatureDictionary<IGridCoord, F>(coordString),
    fillEdges: new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString),
    fillVertices: new FeatureDictionary<IGridVertex, IFeature<IGridVertex>>(vertexString),
    dispose: jest.fn()
  };
}

export function createDrawing(
  gridGeometry: IGridGeometry,
  colours: FeatureColour[],
  mount: HTMLDivElement,
  seeEverything: boolean
): IDrawing {
  let mockDrawing = {
    gridGeometry: gridGeometry,
    colours: colours,
    mount: mount,
    seeEverything: seeEverything,

    areas: new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),
    tokens: createTokenDrawing<IToken>(),
    walls: new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString),

    highlightedAreas: new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),
    highlightedVertices: new FeatureDictionary<IGridVertex, IFeature<IGridVertex>>(vertexString),
    highlightedWalls: new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString),

    selection: createTokenDrawing<IIdFeature<IGridCoord>>(),
    selectionDrag: createTokenDrawing<IIdFeature<IGridCoord>>(),
    selectionDragRed: createTokenDrawing<IIdFeature<IGridCoord>>(),

    boundsChanged: __mockBoundsChanged,
    outlinedRectangle: OutlinedRectangle(),

    animate: jest.fn(),
    checkLoS: jest.fn(),
    getGridCoordAt: jest.fn(),
    getGridVertexAt: jest.fn(),
    getViewportToWorld: jest.fn(),
    getWorldToViewport: jest.fn(),
    handleChangesApplied: jest.fn(),
    resize: jest.fn(),
    setLoSPositions: jest.fn(),
    setShowMapColourVisualisation: jest.fn(),
    dispose: jest.fn()
  };

  __mockDrawings.push(mockDrawing);
  return mockDrawing;
}