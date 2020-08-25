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

  // A drawing always exposes a single outlined rectangle that can be used
  // for drag-boxes etc.  This object will be drawn separately and will not
  // be subject to the world transform applied to everything else.
  outlinedRectangle: IOutlinedRectangle;

  // Draws if need be, and requests the next animation frame.
  // The callback is called at the start of every animate() call.
  animate(fn: () => void): void;

  // These functions turn viewport co-ordinates (0..windowWidth, 0..windowHeight)
  // into face, edge or vertex coords
  getGridCoordAt(cp: THREE.Vector3): IGridCoord | undefined;
  getGridEdgeAt(cp: THREE.Vector3): IGridEdge | undefined;
  getGridVertexAt(cp: THREE.Vector3): IGridVertex | undefined;

  // Gets a viewport-to-world transfomation matrix, where the viewport visible
  // range is (-1..1).
  getViewportToWorld(target: THREE.Matrix4): THREE.Matrix4;

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

// Describes if and where the user has dragged out a rectangle (whose drawing is
// implemented by an IOutlinedRectangle, below.)
export interface IDragRectangle {
  // Creates a filter function admitting features within the current drag rectangle.
  createFilter(): (c: IGridCoord) => boolean;

  // Enumerates all the grid coords within the current drag rectangle.
  enumerateCoords(): Iterable<IGridCoord>;

  // True if the drag rectangle is enabled and visible, else false.
  isEnabled(): boolean;

  // Moves a point of the drag rectangle to the target in client co-ordinates,
  // returning true if we have a drag rectangle visible, else false.
  moveTo(cp: THREE.Vector3): boolean;

  // Resets the drag rectangle and disables it until `start` is called again.
  reset(): void;

  // Starts a drag rectangle from the given target in client co-ordinates.
  start(cp: THREE.Vector3): void;
}

// Describes an outlined rectangle that can be used as a selection box.
export interface IOutlinedRectangle {
  // This object's position and scale.
  position: THREE.Vector3;
  scale: THREE.Vector3;

  // This object's visibility.
  visible: boolean;

  // Alters the drawn object, e.g. changing its transform.
  // The function should return true if a redraw is required, else false.
  alter(fn: (o: THREE.Object3D) => boolean): void;
}