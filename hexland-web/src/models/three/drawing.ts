import { DrawingOrtho } from "./drawingOrtho";
import { IGridGeometry } from "../gridGeometry";
import { IDrawing } from "../interfaces";
import { FeatureColour } from "../featureColour";
import { ITokenGeometry } from "../../data/tokenGeometry";
import { IDownloadUrlCache } from "../../services/interfaces";

// Implementation choice and testability adapter -- mock this to replace
// the Three.js drawing implementations.

export function createDrawing(
  gridGeometry: IGridGeometry,
  tokenGeometry: ITokenGeometry,
  colours: FeatureColour[],
  mount: HTMLDivElement,
  seeEverything: boolean,
  urlCache: IDownloadUrlCache
): IDrawing {
  return new DrawingOrtho(gridGeometry, tokenGeometry, colours, mount, seeEverything, urlCache);
}