import { FeatureColour } from "../../featureColour";
import { IGridGeometry } from "../../gridGeometry";
import { IDrawing } from "../../interfaces";
import { IVisibility } from '../../los';
import { FeatureDictionary, IFeature, IToken } from "../../../data/feature";
import { IGridCoord, coordString, IGridEdge, edgeString, IGridVertex, vertexString } from "../../../data/coord";

// The mock drawings we create will be pushed here so that the test
// harness can access them and their mock functions.
export const __mockDrawings: any[] = [];

export function createDrawing(
  gridGeometry: IGridGeometry,
  colours: FeatureColour[],
  mount: HTMLDivElement,
  seeEverything: boolean
): IDrawing {
  var mockDrawing = {
    gridGeometry: gridGeometry,
    colours: colours,
    mount: mount,
    seeEverything: seeEverything,

    areas: new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),
    tokens: new FeatureDictionary<IGridCoord, IToken>(coordString),
    walls: new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString),

    highlightedAreas: new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),
    highlightedVertices: new FeatureDictionary<IGridVertex, IFeature<IGridVertex>>(vertexString),
    highlightedWalls: new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString),

    selection: new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),
    selectionDrag: new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),
    selectionDragRed: new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),

    los: new FeatureDictionary<IGridCoord, IVisibility>(coordString),

    animate: jest.fn(),
    getGridCoordAt: jest.fn(),
    getGridEdgeAt: jest.fn(),
    getGridVertexAt: jest.fn(),
    getWorldToViewport: jest.fn(),
    handleChangesApplied: jest.fn(),
    resize: jest.fn(),
    setShowMapColourVisualisation: jest.fn(),
    dispose: jest.fn()
  };

  __mockDrawings.push(mockDrawing);
  return mockDrawing;
}