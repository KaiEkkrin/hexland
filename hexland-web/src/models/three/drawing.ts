import { DrawingOrtho } from "./drawingOrtho";
import { IGridGeometry } from "../gridGeometry";
import { IDrawing } from "../interfaces";
import { FeatureColour } from "../featureColour";

// Implementation choice and testability adapter -- mock this to replace
// the Three.js drawing implementations.

export function createDrawing(
  gridGeometry: IGridGeometry,
  colours: FeatureColour[],
  mount: HTMLDivElement,
  seeEverything: boolean
): IDrawing {
  return new DrawingOrtho(gridGeometry, colours, mount, seeEverything);
}