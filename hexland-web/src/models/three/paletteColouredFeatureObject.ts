import { IGridCoord } from '../../data/coord';
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
export class PaletteColouredFeatureObject<K extends IGridCoord, F extends IFeature<K>> extends InstancedFeatureObject<K, F> {
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
    transformTo: (o: THREE.Object3D, position: K) => void,
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

  protected addFeature(f: F, instanceIndex: number) {
    super.addFeature(f, instanceIndex);

    this._colours[instanceIndex] = f.colour;
    this.applyColour(f.colour, instanceIndex);
  }

  setPalette(newPalette: THREE.Color[], defaultColour?: THREE.Color | undefined) {
    this._palette = newPalette;
    if (defaultColour !== undefined) {
      this._defaultColour = defaultColour;
    }

    for (var i = 0; i < this._colours.length; ++i) {
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
// as a subtractive, based on the feature colour 0 or 1.
export function createSelectionColourParameters(i: number) {
  if (i !== 0 && i !== 1) {
    throw RangeError("Selection palette object must have colour 0 or 1");
  }

  return i === 0 ? {
    palette: [new THREE.Color(0x606060)],
    blending: THREE.AdditiveBlending
  } : {
    // We need two entries here because we'll always be accessing the second colour
    palette: [new THREE.Color(0x606060), new THREE.Color(0x606060)],
    blending: THREE.SubtractiveBlending
  };
}