import { GridVertex } from "./coord";
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
export interface IMapImage extends IId {
  imagePath: string;
  start: Anchor;
  end: Anchor;
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