import { GridVertex, verticesEqual } from "./coord";
import { IId } from "./identified";

// Describes the images that a user has uploaded.

export interface IImage {
  // The user's name for the image.
  name: string;

  // The path in Cloud Storage where the image can be found.
  path: string;
}

// We'll have one of these for each user.
export interface IImages {
  images: IImage[];

  // The upload trigger will fill this out if something goes wrong so
  // we can show it to the user.
  lastError: string;
}

// How to position images on the map.
export type Anchor = VertexAnchor | PixelAnchor | NoAnchor;

export type VertexAnchor = {
  anchorType: 'vertex';
  position: GridVertex;
}

export type PixelAnchor = {
  anchorType: 'pixel';
  x: number;
  y: number;
}

export type NoAnchor = {
  anchorType: 'none';
};

export const defaultAnchor: NoAnchor = { anchorType: 'none' };

// This *is* an image positioned on the map.
export interface IMapImageProperties extends IId {
  image: IImage;
}

export interface IMapImage extends IMapImageProperties {
  start: Anchor;
  end: Anchor;
}

export const defaultMapImage: IMapImage = {
  id: "",
  image: { name: "", path: "" },
  start: defaultAnchor,
  end: defaultAnchor
};

export function anchorsEqual(a: Anchor, b: Anchor) {
  if (a.anchorType === 'vertex' && b.anchorType === 'vertex') {
    return verticesEqual(a.position, b.position);
  } else if (a.anchorType === 'pixel' && b.anchorType === 'pixel') {
    return a.x === b.x && a.y === b.y;
  } else {
    return false;
  }
}

export function createVertexAnchor(x: number, y: number, vertex: number): VertexAnchor {
  return {
    anchorType: 'vertex',
    position: { x: x, y: y, vertex: vertex }
  };
}

export function createPixelAnchor(x: number, y: number): PixelAnchor {
  return {
    anchorType: 'pixel',
    x: x,
    y: y
  };
}