import { GridCoord } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { InstancedFeatureObject } from './instancedFeatureObject';

import * as THREE from 'three';

const instanceColouredShader = {
  vertexShader: [
    "attribute vec3 instanceColour;",
    "varying vec3 vertexColour;",
    "void main() {",
    "  vertexColour = instanceColour;",
    "  gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n"),
  fragmentShader: [
    "varying vec3 vertexColour;",
    "void main() {",
    "  gl_FragColor = vec4(vertexColour, 1.0);",
    "}"
  ].join("\n")
};

export interface IColourParameters {
  palette: THREE.Color[],
  defaultColour?: THREE.Color | undefined,
  blending?: THREE.Blending | undefined,
  transparent?: boolean | undefined
}

const defaultColour = new THREE.Color(0, 0, 0);

// This instanced feature object chooses a numbered colour from a palette.
export class PaletteColouredFeatureObject<K extends GridCoord, F extends IFeature<K>> extends InstancedFeatureObject<K, F> {
  private readonly _colourAttr: THREE.InstancedBufferAttribute;
  private readonly _geometry: THREE.InstancedBufferGeometry;
  private readonly _colours: number[]; // not instanced, but lets us change the palette
  private readonly _instanceColours: Float32Array;
  private readonly _material: THREE.ShaderMaterial;

  private _palette: THREE.Color[];
  private _defaultColour: THREE.Color;

  // The constructor will add the colour attribute to the geometry automatically.
  constructor(
    toIndex: (k: K) => string,
    transformTo: (m: THREE.Matrix4, position: K) => THREE.Matrix4,
    maxInstances: number,
    createGeometry: () => THREE.InstancedBufferGeometry,
    colourParameters: IColourParameters
  ) {
    super(toIndex, transformTo, maxInstances);
    this._geometry = createGeometry();
    this._colours = new Array(maxInstances).fill(-1);
    this._instanceColours = new Float32Array(maxInstances * 3);
    this._palette = colourParameters.palette;
    this._defaultColour = colourParameters.defaultColour ?? defaultColour;

    this._colourAttr = new THREE.InstancedBufferAttribute(this._instanceColours, 3);
    this._colourAttr.setUsage(THREE.DynamicDrawUsage);
    this._geometry.setAttribute('instanceColour', this._colourAttr);

    this._material = new THREE.ShaderMaterial({
      blending: colourParameters.blending ?? THREE.NoBlending,
      transparent: colourParameters.transparent ?? false,
      vertexShader: instanceColouredShader.vertexShader,
      fragmentShader: instanceColouredShader.fragmentShader
    });
  }

  private applyColour(c: number, instanceIndex: number) {
    const colour = (c >= 0 && c < this._palette.length) ? this._palette[c] : this._defaultColour;
    this._instanceColours[instanceIndex * 3] = colour.r;
    this._instanceColours[instanceIndex * 3 + 1] = colour.g;
    this._instanceColours[instanceIndex * 3 + 2] = colour.b;
    this._colourAttr.needsUpdate = true;
  }

  protected createMesh(maxInstances: number) {
    return new THREE.InstancedMesh(this._geometry, this._material, maxInstances);
  }

  protected addFeature(f: F) {
    const instanceIndex = super.addFeature(f);
    if (instanceIndex === undefined) {
      return undefined;
    }

    this._colours[instanceIndex] = f.colour;
    this.applyColour(f.colour, instanceIndex);
    return instanceIndex;
  }

  setPalette(newPalette: THREE.Color[], defaultColour?: THREE.Color | undefined) {
    this._palette = newPalette;
    if (defaultColour !== undefined) {
      this._defaultColour = defaultColour;
    }

    for (let i = 0; i < this._colours.length; ++i) {
      this.applyColour(this._colours[i], i);
    }
  }

  dispose() {
    super.dispose();
    this._geometry.dispose();
    this._material.dispose();
  }
}

// Defines the selection colour parameters, which helps us (along with a multiple
// feature object) draw positive selection as an additive and negative selection
// as a subtractive, based on the feature colour.
// The feature colours are:
// - 0 (add, valid)
// - 1 (remove, valid)
// - 2 (add, not valid)
// - 3 (remove, not valid)
const selectionColourPalette = [
  new THREE.Color(0x606060),
  new THREE.Color(0x606060),
  new THREE.Color(0x600000),
  new THREE.Color(0x006060)
];

function getSelectionColourBlending(i: string) {
  if (i === '0' || i === '2') {
    return THREE.AdditiveBlending;
  } else if (i === '1' || i === '3') {
    return THREE.MultiplyBlending;
  } else {
    throw RangeError("Invalid selection colour value: " + i);
  }
}

export function createSelectionColourParameters(i: string) {
  return {
    palette: selectionColourPalette,
    blending: getSelectionColourBlending(i)
  };
}