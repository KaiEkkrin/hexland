import { DrawingOrtho } from "./drawingOrtho";
import { IGridGeometry } from "../gridGeometry";
import { IDrawing } from "../interfaces";
import { FeatureColour } from "../featureColour";
import { ITokenGeometry } from "../../data/tokenGeometry";
import { ISpritesheetCache, IStorage } from "../../services/interfaces";

import * as THREE from 'three';

// Implementation choice and testability adapter -- mock this to replace
// the Three.js drawing implementations.
// Also wraps our WebGL renderer, which needs to be a singleton to avoid
// leaking resources.

let renderer: THREE.WebGLRenderer | undefined = undefined;

export function createDrawing(
  gridGeometry: IGridGeometry,
  tokenGeometry: ITokenGeometry,
  colours: FeatureColour[],
  seeEverything: boolean,
  logError: (message: string, e: any) => void,
  spritesheetCache: ISpritesheetCache,
  storage: IStorage
): IDrawing {
  // create the singleton renderer lazily
  if (renderer === undefined) {
    renderer = new THREE.WebGLRenderer();
  }

  return new DrawingOrtho(
    renderer, gridGeometry, tokenGeometry, colours, seeEverything, logError, spritesheetCache, storage
  );
}