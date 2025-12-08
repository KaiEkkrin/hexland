import * as THREE from 'three';
// TODO #235 :
// @ts-ignore - FontLoader types not available in @types/three for examples/jsm (Phase 0 workaround)
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';

export class TextCreator {
  private _font: THREE.Font | undefined;

  constructor() {
    let loader = new FontLoader();
    loader.load('/fonts/helvetiker_bold.typeface.json', (f: THREE.Font) => this._font = f);
  }

  create(text: string, size: number): THREE.ShapeBufferGeometry | undefined {
    if (this._font === undefined) {
      return undefined;
    }

    const shapes = this._font.generateShapes(text, size);
    const geometry = new THREE.ShapeBufferGeometry(shapes);
    geometry.scale(1, -1, 1); // for some reason, the text is being created upside down!
    geometry.computeBoundingBox();
    return geometry;
  }
}

const textCreator = new TextCreator();
export default textCreator;