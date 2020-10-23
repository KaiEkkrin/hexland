import { DrawingOrtho } from "./drawingOrtho";
import { IGridGeometry } from "../gridGeometry";
import { IDrawing } from "../interfaces";
import { FeatureColour } from "../featureColour";
import { ITokenGeometry } from "../../data/tokenGeometry";
import { ISpritesheetCache, IStorage } from "../../services/interfaces";

// Implementation choice and testability adapter -- mock this to replace
// the Three.js drawing implementations.

export function createDrawing(
  gridGeometry: IGridGeometry,
  tokenGeometry: ITokenGeometry,
  colours: FeatureColour[],
  mount: HTMLDivElement,
  seeEverything: boolean,
  logError: (message: string, e: any) => void,
  spritesheetCache: ISpritesheetCache,
  storage: IStorage
): IDrawing {
  return new DrawingOrtho(
    gridGeometry, tokenGeometry, colours, mount, seeEverything, logError, spritesheetCache, storage
  );
}