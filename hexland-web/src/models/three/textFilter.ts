import { IShader, ShaderFilter } from './shaderFilter';

import * as THREE from 'three';

// This filter samples the text texture and paints it on the canvas along with a
// drop-shadow.
const textFilterShader: IShader = {
  uniforms: {
    "shadowColour": { type: 'v4', value: null },
    "step": { type: 'v2', value: null },
    "tex": { value: null }
  },
  vertexShader: `
    varying vec2 texUv;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      texUv = position.xy * 0.5 + 0.5;
    }
  `,
  fragmentShader: `
    uniform vec4 shadowColour;
    uniform vec2 step;
    uniform sampler2D tex;
    varying vec2 texUv;
    void main() {
      vec4 realSample = texture2D(tex, texUv + 0.25 * step);
      if (realSample.w > 0.5) {
        gl_FragColor = realSample;
      } else {
        vec4 sample1 = texture2D(tex, texUv + vec2(1.25 * step.x, 0.25 * step.y));
        vec4 sample2 = texture2D(tex, texUv + 1.25 * step);
        vec4 sample3 = texture2D(tex, texUv + vec2(0.25 * step.x, 1.25 * step.y));
        if (sample1.w > 0.5 || sample2.w > 0.5 || sample3.w > 0.5) {
          gl_FragColor = shadowColour;
        } else {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      }
    }
  `
};

export class TextFilter extends ShaderFilter {
  private readonly _shadowColour = new THREE.Vector4();
  private readonly _step = new THREE.Vector2();

  constructor(z: number, shadowColour: THREE.Vector4) {
    super(z, {
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      transparent: true,
      ...textFilterShader
    });
    this._shadowColour.copy(shadowColour);
    this.uniforms['shadowColour'].value = this._shadowColour;
    this.uniforms['step'].value = this._step;
  }

  postRender() {
    this.uniforms['tex'].value = null;
  }

  preRender(textTarget: THREE.WebGLRenderTarget) {
    this._step.set(1.0 / textTarget.width, 1.0 / textTarget.height);
    this.uniforms['tex'].value = textTarget.texture;
  }
}