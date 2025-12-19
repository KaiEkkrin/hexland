import * as THREE from 'three';
// Font moved to examples/jsm in Three.js 0.133+
import { Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader';

export class TextCreator {
  private _font: Font | undefined;

  constructor() {
    const loader = new FontLoader();
    loader.load('/fonts/helvetiker_bold.typeface.json', (f: Font) => this._font = f);
  }

  create(text: string, size: number): THREE.ShapeGeometry | undefined {
    if (this._font === undefined) {
      return undefined;
    }

    const shapes = this._font.generateShapes(text, size);
    const geometry = new THREE.ShapeGeometry(shapes);
    geometry.scale(1, -1, 1); // for some reason, the text is being created upside down!
    geometry.computeBoundingBox();
    return geometry;
  }
}

const textCreator = new TextCreator();
export default textCreator;