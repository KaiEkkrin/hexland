import { IGridGeometry } from "../gridGeometry";
import { IShader, ShaderFilter } from "./shaderFilter";

import * as THREE from 'three';

// #160: This approach to the LoS rendering should avoid the gaps that are necessarily
// created when using the grid geometry.  We use the filter geometry to always render
// over the whole of the viewport, and a pixel shader to determine, for each pixel,
// which face it's in and thence where in the LoS texture we should sample.
// In theory this should be a lot slower than the old vertex shader implementation drawn
// with the grid geometry -- in practice it doesn't seem to be, presumably because
// the reduction in JavaScript work that needs to be done in geometry preparation overwhelms
// the extra work done by the (very fast) shaders...
function createLoSFilterShader(gridGeometry: IGridGeometry) {
  return {
    uniforms: {
      "fullyHidden": { type: 'f', value: null },
      "fullyVisible": { type: 'f', value: null },
      "losMatrix": { type: 'mat4', value: null },
      "losStep": { type: 'v2', value: null },
      "losTex": { value: null },
      ...gridGeometry.createShaderUniforms()
    },
    vertexShader: [
      "varying vec2 texUv;",
      "void main() {",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "  texUv = position.xy * 0.5 + 0.5;",
      "}"
    ].join("\n"),
    fragmentShader: [
      ...gridGeometry.createShaderDeclarations(),
      "uniform float fullyHidden;",
      "uniform float fullyVisible;",
      "uniform sampler2D gridTex;",
      "uniform mat4 losMatrix;",
      "uniform vec2 losStep;",
      "uniform sampler2D losTex;",
      "varying vec2 texUv;",

      ...gridGeometry.createShaderSnippet(),
      "void main() {",
      "  vec2 coord;",
      "  if (decodeCoordSample(texUv, coord) == false) {",
      "    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);",
      "    return;",
      "  }",
      "  vec2 worldCentre = createCoordCentre(coord);",
      "  vec4 centre = losMatrix * vec4(worldCentre, 0.0, 1.0);",
      "  vec2 uv = centre.xy * 0.5 + 0.5 + 0.25 * losStep;", // TODO #160 can I cram this into the losMatrix?
      "  float visibleCount =",
      "    texture2D(losTex, uv).x +",
      "    texture2D(losTex, uv - 2.0 * losStep).x +",
      "    texture2D(losTex, uv + 2.0 * vec2(-losStep.x, losStep.y)).x +",
      "    texture2D(losTex, uv + 2.0 * vec2(losStep.x, -losStep.y)).x +",
      "    texture2D(losTex, uv + 2.0 * losStep).x;",
      "  float result = visibleCount < 2.0 ? fullyHidden :",
      "    visibleCount > 4.0 ? fullyVisible : mix(fullyHidden, fullyVisible, 0.5);",
      "  gl_FragColor = vec4(result, result, result, 1.0);",
      "}"
    ].join("\n")
  };
}

// Before and after drawing the scene these have been added to, call preRender() and
// postRender() to acquire the texture and fill in the uniforms.  (The texture can't
// stay acquired all the time because the LoS module needs to be able to render into
// it.)
export interface ILoSPreRenderParameters {
  faceCoordTarget: THREE.WebGLRenderTarget;
  fullyHidden: number;
  fullyVisible: number;
  losTarget: THREE.WebGLRenderTarget;
  tileOrigin: THREE.Vector2;
}

export class LoSFilter extends ShaderFilter {
  private readonly _gridGeometry: IGridGeometry;
  private readonly _losMatrix = new THREE.Matrix4();
  private readonly _losStep = new THREE.Vector2();
  private readonly _tileOrigin = new THREE.Vector2();

  constructor(gridGeometry: IGridGeometry, z: number, shader: IShader) {
    super(z, {
      blending: THREE.MultiplyBlending,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: shader.uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });
    this._gridGeometry = gridGeometry;

    // We need to pre-populate the object value uniforms to avoid attempts
    // to dereference null inside THREE.js
    gridGeometry.populateShaderUniforms(this.uniforms, undefined, this._tileOrigin);
    this.uniforms['losMatrix'].value = this._losMatrix;
    this.uniforms['losStep'].value = this._losStep;
  }

  postRender() {
    this._gridGeometry.clearShaderUniforms(this.uniforms);
  }

  preRender(params: ILoSPreRenderParameters, losCamera: THREE.Camera) {
    this._tileOrigin.copy(params.tileOrigin);
    this._gridGeometry.populateShaderUniforms(
      this.uniforms, params.faceCoordTarget, this._tileOrigin
    );

    this.uniforms['fullyHidden'].value = params.fullyHidden;
    this.uniforms['fullyVisible'].value = params.fullyVisible;

    this._losMatrix.copy(losCamera.projectionMatrix).multiply(losCamera.matrixWorld);
    this._losStep.set(1.0 / params.losTarget.width, 1.0 / params.losTarget.height);

    this.uniforms['losTex'].value = params.losTarget.texture;
  }
}

export function createLoSFilter(gridGeometry: IGridGeometry, z: number) {
  const shader = createLoSFilterShader(gridGeometry);
  return new LoSFilter(gridGeometry, z, shader);
}