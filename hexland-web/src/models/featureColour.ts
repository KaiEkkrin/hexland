import * as THREE from 'three';

// Describes one of the standard colours we can select and use for
// walls and features.
export class FeatureColour {
  private _dark: THREE.Color;
  private _light: THREE.Color;

  constructor(hue: number) {
    this._dark = new THREE.Color();
    this._dark.setHSL(hue, 0.5, 0.2);

    this._light = new THREE.Color();
    this._light.setHSL(hue, 0.8, 0.4);
  }

  get dark(): THREE.Color { return this._dark; }
  get light(): THREE.Color { return this._light; }

  get darkHexString(): string { return this._dark.getHexString(); }
  get lightHexString(): string { return this._light.getHexString(); }
}