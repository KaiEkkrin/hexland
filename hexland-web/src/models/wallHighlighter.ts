import { IChange } from "../data/change";
import { IGridVertex, IGridEdge, verticesEqual, IGridCoord, coordsEqual } from "../data/coord";
import { IFeature, IFeatureDictionary } from "../data/feature";
import { EdgeHighlighter, FaceHighlighter } from "./dragHighlighter";
import { IGridGeometry } from "./gridGeometry";
import { IDragRectangle } from "./interfaces";

import * as THREE from 'three';
import { MapColouring } from "./colouring";

// Given two vertices, plots a straight-line (more or less) wall between them including the
// intermediate vertices.
export function *drawWallBetween(geometry: IGridGeometry, a: IGridVertex, b: IGridVertex) {
  var bCentre = geometry.createVertexCentre(new THREE.Vector3(), b, 0);
  var [eCentre, vCentre, scratch1, scratch2] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  while (verticesEqual(a, b) === false) {
    // Out of all the adjacent edges, find the one closest to b, and yield it
    var closestEdge = geometry.getVertexEdgeAdjacency(a).map(e => {
      return { edge: e, dSq: geometry.createEdgeCentre(eCentre, scratch1, scratch2, e, 0).distanceToSquared(bCentre) };
    }).reduce((e, f) => {
      return e.dSq < f.dSq ? e : f;
    });

    yield closestEdge.edge;

    // Out of all the adjacent vertices, find the one closest to b and continue
    var closestVertex = geometry.getEdgeVertexAdjacency(closestEdge.edge).map(v => {
      return { vertex: v, dSq: geometry.createVertexCentre(vCentre, v, 0).distanceToSquared(bCentre) };
    }).reduce((v, w) => {
      return v.dSq < w.dSq ? v : w;
    });

    a = closestVertex.vertex;
  }
}

// Given a dictionary of faces, draws a wall around them by calling the function.
// (Duplicate calls may occur.)  This is the basic rectangular wall function.
// TODO #21 There's a potential optimisation here -- walk all around the edge of
// the shape rather than inspecting every face including the interior ones -- but it
// has subtleties (consider a 3-square thick L-shape in the square geometry)
export function drawWallAround(
  geometry: IGridGeometry,
  faceDictionary: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
  addWall: (position: IGridEdge) => void
) {
  for (var f of faceDictionary) {
    geometry.forEachAdjacentFace(f.position, (adj, edge) => {
      if (faceDictionary.get(adj) === undefined) {
        // This is an exterior face -- add the wall
        addWall(edge);
      }
    });
  }
}

// As `drawWallAround`.  This function attempts to join together all the spaces
// defined in the map colouring except those with the outside colour, along with
// the faces in the face dictionary, adding and removing walls as appropriate.
export function drawWallUnion(
  geometry: IGridGeometry,
  colouring: MapColouring,
  outerColour: number,
  faceDictionary: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
  addWall: (position: IGridEdge) => void,
  removeWall: (position: IGridEdge) => void
) {
  var changeCount = [0];
  for (var f of faceDictionary) {
    geometry.forEachAdjacentFace(f.position, (adj, edge) => {
      if (faceDictionary.get(adj) === undefined && colouring.colourOf(adj) === outerColour) {
        // This is an exterior face -- add the wall
        addWall(edge);
        ++changeCount[0];
      } else if (colouring.getWall(edge) !== undefined) {
        // This is an interior wall -- remove it
        removeWall(edge);
        ++changeCount[0];
      }
    });
  }
}

// As `drawWallAround`.  This function attempts to enlarge the space defined in the
// map colouring with colour `innerColour` through the inclusion of the faces in the
// face dictionary, adding and removing walls as appropriate.
export function drawWallDifference(
  geometry: IGridGeometry,
  colouring: MapColouring,
  innerColour: number,
  faceDictionary: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
  addWall: (position: IGridEdge) => void,
  removeWall: (position: IGridEdge) => void
) {
  var changeCount = [0];
  for (var f of faceDictionary) {
    geometry.forEachAdjacentFace(f.position, (adj, edge) => {
      if (faceDictionary.get(adj) === undefined && colouring.colourOf(adj) !== innerColour) {
        // This is an exterior face -- add the wall
        addWall(edge);
        ++changeCount[0];
      } else if (colouring.getWall(edge) !== undefined) {
        // This is an interior wall -- remove it
        removeWall(edge);
        ++changeCount[0];
      }
    });
  }

  if (changeCount[0] === 0) {
    drawWallAround(geometry, faceDictionary, addWall);
  }
}

// The wall highlighter highlights both the vertices dragged through and the edges
// between them, and commits changes to the edges on drag end.
export class WallHighlighter {
  private readonly _geometry: IGridGeometry;

  // We drive this edge highlighter to do that part of the work:
  private readonly _edgeHighlighter: EdgeHighlighter;
  private readonly _vertexHighlights: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>>;

  private _lastHoverPosition: IGridVertex | undefined = undefined;

  constructor(
    geometry: IGridGeometry,
    walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    wallHighlights: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    vertexHighlights: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>>
  ) {
    this._geometry = geometry;
    this._edgeHighlighter = new EdgeHighlighter(walls, wallHighlights);
    this._vertexHighlights = vertexHighlights;
  }

  get inDrag() { return this._edgeHighlighter.inDrag; }

  clear() {
    this._edgeHighlighter.clear();
    this._vertexHighlights.clear();
  }
  
  dragCancel(position: IGridVertex | undefined, colour: number) {
    this._edgeHighlighter.dragCancel(undefined, colour);
    this.moveHighlight(position, colour);
  }

  dragStart(position: IGridVertex | undefined, colour: number) {
    this.moveHighlight(position, colour);
    this._edgeHighlighter.dragStart(undefined, colour);
  }

  dragEnd(position: IGridVertex | undefined, colour: number): IChange[] {
    this.moveHighlight(position, colour);
    if (this._edgeHighlighter.inDrag === false) {
      return [];
    }

    return this._edgeHighlighter.dragEnd(undefined, colour);
  }

  moveHighlight(position: IGridVertex | undefined, colour: number) {
    if (position === undefined) {
      if (this._edgeHighlighter.inDrag !== true) {
        this._vertexHighlights.clear();
      }
    } else {
      if (
        this._edgeHighlighter.inDrag === true &&
        this._lastHoverPosition !== undefined &&
        !verticesEqual(position, this._lastHoverPosition)
      ) {
        for (var wall of drawWallBetween(this._geometry, this._lastHoverPosition, position)) {
          this._edgeHighlighter.moveHighlight(wall, colour);
        }
      }

      // Highlight the current vertex position
      this._vertexHighlights.clear();
      this._vertexHighlights.add({ position: position, colour: 0 });
      this._lastHoverPosition = position;
    }
  }
}

// The wall rectangle highlighter highlights the faces being dragged through and
// the edges around them, and commits changes to the edges on drag end.
export class WallRectangleHighlighter {
  private readonly _geometry: IGridGeometry;
  private readonly _faceHighlights: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

  // We drive this edge highlighter to do that part of the work:
  private readonly _edgeHighlighter: EdgeHighlighter;

  // ...and this face highlighter to show the faces
  private readonly _faceHighlighter: FaceHighlighter;

  private _lastHoverPosition: IGridCoord | undefined;

  constructor(
    geometry: IGridGeometry,
    faces: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    wallHighlights: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    faceHighlights: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    dragRectangle: IDragRectangle
  ) {
    this._geometry = geometry;
    this._faceHighlights = faceHighlights;
    this._edgeHighlighter = new EdgeHighlighter(walls, wallHighlights);
    this._faceHighlighter = new FaceHighlighter(faces, faceHighlights, dragRectangle);
  }

  protected get geometry() { return this._geometry; }
  protected get edgeHighlighter() { return this._edgeHighlighter; }
  protected get faceHighlighter() { return this._faceHighlighter; }
  protected get faceHighlights() { return this._faceHighlights; }

  protected drawWall(colour: number) {
    drawWallAround(this._geometry, this._faceHighlights, e => this._edgeHighlighter.moveHighlight(e, colour));
  }

  get inDrag() { return this._faceHighlighter.inDrag; }

  clear() {
    this._edgeHighlighter.clear();
    this._faceHighlighter.clear();
  }

  dragCancel(position: IGridCoord | undefined, colour: number) {
    this._edgeHighlighter.dragCancel(undefined, colour);
    this._faceHighlighter.dragCancel(position, colour);
  }

  dragEnd(position: IGridCoord | undefined, colour: number) {
    this.moveHighlight(position, colour);
    this._faceHighlighter.dragCancel(position, colour);
    return this._edgeHighlighter.dragEnd(undefined, colour);
  }

  dragStart(position: IGridCoord | undefined, colour: number) {
    this._faceHighlighter.dragStart(position, colour);
  }

  moveHighlight(position: IGridCoord | undefined, colour: number) {
    this._faceHighlighter.moveHighlight(position, colour);
    if (
      this.inDrag && position !== undefined &&
      !coordsEqual(position, this._lastHoverPosition)
    ) {
      // We treat each change in the position as a fresh edge drag:
      this._edgeHighlighter.dragCancel(undefined, colour);
      this._edgeHighlighter.clear();
      this._edgeHighlighter.dragStart(undefined, colour);
      this.drawWall(colour);
    }

    this._lastHoverPosition = position;
  }
}

// The room highlighter builds on the wall rectangle highlighter to create rectangular
// intersecting rooms.
// TODO Consider shapes other than rectangles, e.g. circles, standard splat shapes...?
export class RoomHighlighter extends WallRectangleHighlighter {
  private readonly _colouring: MapColouring;

  private _firstDragPosition: IGridCoord | undefined;
  private _difference = false;

  constructor(
    geometry: IGridGeometry,
    colouring: MapColouring,
    faces: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    wallHighlights: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    faceHighlights: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    dragRectangle: IDragRectangle
  ) {
    super(geometry, faces, walls, wallHighlights, faceHighlights, dragRectangle);
    this._colouring = colouring;
  }

  protected drawWall(colour: number) {
    if (this._firstDragPosition === undefined) {
      return;
    }

    if (this.difference) {
      drawWallDifference(
        this.geometry,
        this._colouring,
        this._colouring.colourOf(this._firstDragPosition),
        this.faceHighlights,
        e => this.edgeHighlighter.moveHighlight(e, colour),
        e => this.edgeHighlighter.moveHighlight(e, -1)
      );
    } else {
      drawWallUnion(
        this.geometry,
        this._colouring,
        this._colouring.getOuterColour(),
        this.faceHighlights,
        e => this.edgeHighlighter.moveHighlight(e, colour),
        e => this.edgeHighlighter.moveHighlight(e, -1)
      );
    }
  }

  private updateFirstDragPosition(position: IGridCoord | undefined) {
    if (this._firstDragPosition === undefined) {
      this._firstDragPosition = position;
    }
  }

  // Sets whether or not we're in difference mode.
  get difference() { return this._difference; }
  set difference(d: boolean) { this._difference = d; }

  dragCancel(position: IGridCoord | undefined, colour: number) {
    super.dragCancel(position, colour);
    this._firstDragPosition = undefined;
  }

  dragEnd(position: IGridCoord | undefined, colour: number) {
    // In the room highlighter, we want to paint the room areas too
    this.moveHighlight(position, colour);
    this._firstDragPosition = undefined;
    this.faceHighlighter.dragCancel(position, colour);
    return this.edgeHighlighter.dragEnd(undefined, colour);
  }

  dragStart(position: IGridCoord | undefined, colour: number) {
    super.dragStart(position, colour);
    this.updateFirstDragPosition(position);
  }

  moveHighlight(position: IGridCoord | undefined, colour: number) {
    if (this.inDrag) {
      this.updateFirstDragPosition(position);
    }

    super.moveHighlight(position, colour);
  }
}