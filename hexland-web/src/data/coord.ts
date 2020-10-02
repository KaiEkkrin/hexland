import { modFloor } from './extraMath';
import * as THREE from 'three';

// This is the co-ordinate of a face (hex or square) inside the grid.
export interface IGridCoord {
  x: number;
  y: number;
}

// This default should end up unseen -- for converters.
export const defaultGridCoord: IGridCoord = { x: -10000, y: -10000 };

export function getTile(coord: IGridCoord, tileDim: number): THREE.Vector2 {
  return new THREE.Vector2(Math.floor(coord.x / tileDim), Math.floor(coord.y / tileDim));
}

export function getFace(coord: IGridCoord, tileDim: number): THREE.Vector2 {
  return new THREE.Vector2(modFloor(coord.x, tileDim), modFloor(coord.y, tileDim));
}

export function coordAdd(a: IGridCoord, b: IGridCoord): IGridCoord {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function coordsEqual(a: IGridCoord, b: IGridCoord | undefined): boolean {
  return (b === undefined) ? false : (a.x === b.x && a.y === b.y);
}

export function coordMultiplyScalar(a: IGridCoord, b: number): IGridCoord {
  return { x: a.x * b, y: a.y * b };
}

export function coordString(coord: IGridCoord) {
  return "x=" + coord.x + " y=" + coord.y;
}

export function coordSub(a: IGridCoord, b: IGridCoord): IGridCoord {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function createGridCoord(tile: THREE.Vector2, face: THREE.Vector2, tileDim: number): IGridCoord {
  return { x: tile.x * tileDim + face.x, y: tile.y * tileDim + face.y };
}

// This is the co-ordinate of an edge.  Each face "owns" some number
// of the edges around it, which are identified by the `edge` number here.
export interface IGridEdge extends IGridCoord {
  edge: number;
}

// This default should end up unseen -- for converters.
export const defaultGridEdge: IGridEdge = { x: -10000, y: -10000, edge: 0 };

export function edgesEqual(a: IGridEdge, b: IGridEdge | undefined): boolean {
  return (b === undefined) ? false : (coordsEqual(a, b) && a.edge === b.edge);
}

export function edgeString(edge: IGridEdge) {
  return coordString(edge) + " e=" + edge.edge;
}

export function createGridEdge(tile: THREE.Vector2, face: THREE.Vector2, tileDim: number, edge: number): IGridEdge {
  return { x: tile.x * tileDim + face.x, y: tile.y * tileDim + face.y, edge: edge };
}

// This is the co-ordinate of a vertex, which works a bit like an edge.
export interface IGridVertex extends IGridCoord {
  vertex: number;
}

// This default should end up unseen -- for converters.
export const defaultGridVertex: IGridVertex = { x: -10000, y: -10000, vertex: 0 };

export function verticesEqual(a: IGridVertex, b: IGridVertex | undefined): boolean {
  return (b === undefined) ? false : (coordsEqual(a, b) && a.vertex === b.vertex);
}

export function vertexString(vertex: IGridVertex) {
  return coordString(vertex) + " v=" + vertex.vertex;
}

export function createGridVertex(tile: THREE.Vector2, face: THREE.Vector2, tileDim: number, vertex: number): IGridVertex {
  return { x: tile.x * tileDim + face.x, y: tile.y * tileDim + face.y, vertex: vertex };
}