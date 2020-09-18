import chroma from 'chroma-js';
import * as THREE from 'three';

// Describes one of the standard colours we can select and use for
// walls and features.
export class FeatureColour {
  private readonly _dark: THREE.Color;
  private readonly _light: THREE.Color;

  constructor(hue: number) {
    // const [rDark, gDark, bDark] = chroma.hsl(hue * 360, 0.6, 0.2).rgb();
    // const [rLight, gLight, bLight] = chroma.hsl(hue * 360, 0.6, 0.5).rgb();
    const [rDark, gDark, bDark] = chroma.lch(20, 50, hue * 360).rgb();
    const [rLight, gLight, bLight] = chroma.lch(60, 50, hue * 360).rgb();

    this._dark = new THREE.Color(rDark / 255, gDark / 255, bDark / 255);
    this._light = new THREE.Color(rLight / 255, gLight / 255, bLight / 255);
  }

  get dark(): THREE.Color { return this._dark; }
  get light(): THREE.Color { return this._light; }

  get darkHexString(): string { return this._dark.getHexString(); }
  get lightHexString(): string { return this._light.getHexString(); }
}

function getStandardColours() {
  const colours: FeatureColour[] = [];
  for (let i = 0.5; i < 6; ++i) {
    // This twiddle repels our colours from the blue-green hues
    // because I find it hard to distinguish those.  Maybe this is a red herring?
    let shift = (4 - Math.abs(i - 4)) * 0.07 * Math.sign(i - 4);
    colours.push(new FeatureColour((i + shift) / 6.0));
  }

  return colours;
}

function getHexColours() {
  return getStandardColours().map(c => "#" + c.lightHexString);
}

export const standardColours = getStandardColours();
export const hexColours = getHexColours();