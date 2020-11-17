import { DrawingOrtho } from "./drawingOrtho";
import { IGridGeometry } from "../gridGeometry";
import { IDrawing } from "../interfaces";
import { FeatureColour } from "../featureColour";
import { ITokenGeometry } from "../../data/tokenGeometry";
import { ISpriteManager, IStorage } from "../../services/interfaces";

import * as THREE from 'three';

// Implementation choice and testability adapter -- mock this to replace
// the Three.js drawing implementations.
// Also wraps our WebGL renderer, which needs to be a singleton to avoid
// leaking resources.

let renderer: THREE.WebGLRenderer | undefined = undefined;
const v1RequiredExtensions = [
  'ANGLE_instanced_arrays'
];

function getRenderer() {
  // create the singleton renderer lazily
  if (renderer === undefined) {
    renderer = new THREE.WebGLRenderer({ alpha: true });

    // Check for functionality
    if (renderer.domElement.getContext('webgl2')) {
      // This should be enough for us, instancing support is implicit rather than
      // an extension
      console.log('This platform has WebGL 2');
      return renderer;
    }

    const supportedExtensions = renderer.getContext().getSupportedExtensions();
    console.log(
      `This platform's WebGL renderer supports:\n    ` +
      supportedExtensions?.join('\n    ')
    );

    for (const e of v1RequiredExtensions) {
      if (!supportedExtensions?.find(e2 => e2 === e)) {
        renderer = undefined;
        throw Error(`No ${e} support found.`);
      }
    }
  }

  return renderer;
}

export function createDrawing(
  gridGeometry: IGridGeometry,
  tokenGeometry: ITokenGeometry,
  colours: FeatureColour[],
  seeEverything: boolean,
  logError: (message: string, e: any) => void,
  spriteManager: ISpriteManager,
  storage: IStorage
): IDrawing {
  return new DrawingOrtho(
    getRenderer(), gridGeometry, tokenGeometry, colours, seeEverything, logError, spriteManager, storage
  );
}