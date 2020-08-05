import * as THREE from 'three';

export class TextCreator {
  private _font: THREE.Font | undefined;

  constructor() {
    var loader = new THREE.FontLoader();
    loader.load('/fonts/helvetiker_bold.typeface.json', (f: THREE.Font) => this._font = f);
  }

  private createTargetPosition(position: THREE.Vector3, bb: THREE.Box3 | null): THREE.Vector3 | undefined {
    if (bb === null) { // shouldn't be
      return undefined;
    }

    return position.sub(bb.max.sub(bb.min).multiplyScalar(0.5));
  }

  create(text: string, size: number, material: THREE.Material, position: THREE.Vector3): THREE.Mesh | undefined {
    if (this._font === undefined) {
      return undefined;
    }

    var shapes = this._font.generateShapes(text, size);
    var geometry = new THREE.ShapeBufferGeometry(shapes);
    geometry.scale(1, -1, 1); // for some reason, the text is being created upside down!
    geometry.computeBoundingBox();

    var mesh = new THREE.Mesh(geometry, material);
    var target = this.createTargetPosition(position, geometry.boundingBox);
    if (target !== undefined) {
      mesh.translateX(target.x);
      mesh.translateY(-target.y);
      mesh.translateZ(target.z);
    }

    return mesh;
  }
}