import { IChange } from "../data/change";
import { IGridVertex, IGridEdge, verticesEqual, IGridCoord, coordString, coordsEqual } from "../data/coord";
import { IFeature, IFeatureDictionary, FeatureDictionary } from "../data/feature";
import { EdgeHighlighter, FaceHighlighter } from "./dragHighlighter";
import { IGridGeometry } from "./gridGeometry";
import { IDragRectangle } from "./interfaces";

import * as THREE from 'three';

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
// (Duplicate calls may occur.)
// TODO #21 After this is working nicely, try intersecting with existing walls.
// TODO #21 *2 There's a potential optimisation here -- walk all around the edge of
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
  
  dragCancel(position?: IGridVertex | undefined) {
    this._edgeHighlighter.dragCancel();
    this.moveHighlight(position);
  }

  dragStart(position?: IGridVertex | undefined) {
    this.moveHighlight(position);
    this._edgeHighlighter.dragStart();
  }

  dragEnd(position: IGridVertex | undefined, colour: number): IChange[] {
    this.moveHighlight(position);
    if (this._edgeHighlighter.inDrag === false) {
      return [];
    }

    return this._edgeHighlighter.dragEnd(undefined, colour);
  }

  moveHighlight(position?: IGridVertex | undefined) {
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
          this._edgeHighlighter.moveHighlight(wall);
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
  private readonly _faces: FeatureDictionary<IGridCoord, IFeature<IGridCoord>>;
  private readonly _faceHighlights: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

  // We drive this edge highlighter to do that part of the work:
  private readonly _edgeHighlighter: EdgeHighlighter;

  // ...and this face highlighter to show the faces
  private readonly _faceHighlighter: FaceHighlighter;

  private _lastHoverPosition: IGridCoord | undefined = undefined;

  constructor(
    geometry: IGridGeometry,
    walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    wallHighlights: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    faceHighlights: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    dragRectangle: IDragRectangle
  ) {
    this._geometry = geometry;
    this._faces = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
    this._faceHighlights = faceHighlights;
    this._edgeHighlighter = new EdgeHighlighter(walls, wallHighlights);
    this._faceHighlighter = new FaceHighlighter(this._faces, faceHighlights, dragRectangle);
  }

  get inDrag() { return this._faceHighlighter.inDrag; }

  clear() {
    this._edgeHighlighter.clear();
    this._faceHighlighter.clear();
  }

  dragCancel() {
    this._edgeHighlighter.dragCancel();
    this._faceHighlighter.dragCancel();
  }

  dragEnd(position: IGridCoord | undefined, colour: number) {
    this.moveHighlight(position);
    this._faceHighlighter.dragCancel();
    return this._edgeHighlighter.dragEnd(undefined, colour);
  }

  dragStart(position?: IGridCoord | undefined) {
    this._faceHighlighter.dragStart(position);
  }

  moveHighlight(position?: IGridCoord | undefined) {
    this._faceHighlighter.moveHighlight(position);
    if (position !== undefined && !coordsEqual(position, this._lastHoverPosition) && this.inDrag) {
      // We treat each change in the position as a fresh edge drag:
      this._edgeHighlighter.dragCancel();
      this._edgeHighlighter.clear();
      this._edgeHighlighter.dragStart();
      drawWallAround(this._geometry, this._faceHighlights, e => this._edgeHighlighter.moveHighlight(e));
    }

    this._lastHoverPosition = position;
  }
}