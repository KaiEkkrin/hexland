import { IChange } from "../data/change";
import { IGridVertex, IGridEdge, verticesEqual } from "../data/coord";
import { IFeature, IFeatureDictionary } from "../data/feature";
import { EdgeHighlighter } from "./dragHighlighter";
import { IGridGeometry } from "./gridGeometry";

import * as THREE from 'three';

// Given two vertices, plots a straight-line (more or less) wall between them including the
// intermediate vertices.
export function *drawWallBetween(geometry: IGridGeometry, a: IGridVertex, b: IGridVertex): Iterable<IGridEdge> {
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