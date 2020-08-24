import { MapColouring } from "./colouring";
import { IVisibility } from "./los";
import { IGridCoord, IGridEdge, IGridVertex } from "../data/coord";
import { IFeature, IToken, IFeatureDictionary } from "../data/feature";

// Describes the interface to our drawing subsystem,
// which could be substituted out, won't exist in auto tests, etc.
// The drawing interface exposes instanced features dictionaries directly --
// editing these should update the drawing upon the next animation frame.
export interface IDrawing {
  areas: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>;
  tokens: IFeatureDictionary<IGridCoord, IToken>;
  walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>;

  highlightedAreas: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>;
  highlightedVertices: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>>;
  highlightedWalls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>;

  selection: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>;
  selectionDrag: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>;
  selectionDragRed: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

  los: IFeatureDictionary<IGridCoord, IVisibility>;

  // Draws if need be, and requests the next animation frame.
  // The callback is called at the start of every animate() call.
  animate(fn: () => void): void;

  // These functions turn viewport co-ordinates (0..windowWidth, 0..windowHeight)
  // into face, edge or vertex coords
  getGridCoordAt(cp: THREE.Vector2): IGridCoord | undefined;
  getGridEdgeAt(cp: THREE.Vector2): IGridEdge | undefined;
  getGridVertexAt(cp: THREE.Vector2): IGridVertex | undefined;

  // Gets a world-to-viewport transformation matrix, where the viewport visible
  // range is (-1..1).
  getWorldToViewport(target: THREE.Matrix4): THREE.Matrix4;

  // Handles the completion of a set of changes by the change tracker.
  handleChangesApplied(mapColouring: MapColouring): void;

  // Alters the view.
  resize(translation: THREE.Vector3, rotation: THREE.Quaternion, scaling: THREE.Vector3): void;

  // Sets whether or not to show the map colour visualisation.
  setShowMapColourVisualisation(show: boolean, mapColouring: MapColouring): void;

  // Cleans up and releases all resources.
  dispose(): void;
}