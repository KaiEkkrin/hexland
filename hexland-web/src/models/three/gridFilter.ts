import { ShaderFilter } from './shaderFilter';
import * as THREE from 'three';

const gridShader = {
  uniforms: {
    "gapColour": { value: null },
    "lineColour": { value: null },
    "step": { value: null },
    "tex": { value: null },
  },
  vertexShader: [
    "uniform vec2 step;",
    "varying vec2 texUv;",
    "void main() {",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
    "  texUv = position.xy * 0.5 + 0.5 + 0.25 * step;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform vec4 gapColour;",
    "uniform vec4 lineColour;",
    "uniform vec2 step;",
    "uniform sampler2D tex;",
    "varying vec2 texUv;",
    "void main() {",
    "  vec4 here = texture2D(tex, texUv);",
    "  vec4 above = texture2D(tex, texUv - vec2(0.0, step.y));",
    "  vec4 left = texture2D(tex, texUv - vec2(step.x, 0.0));",
    "  vec4 right = texture2D(tex, texUv + vec2(step.x, 0.0));",
    "  vec4 below = texture2D(tex, texUv + vec2(0.0, step.y));",
    // We test only the z values (the faces) to avoid drawing lines around token faces too
    "  if (above.z != here.z || left.z != here.z || right.z != here.z || below.z != here.z) {",
    "    gl_FragColor = lineColour;",
    "  } else {",
    "    gl_FragColor = gapColour;",
    "  }",
    "}"
  ].join("\n")
};

// Provides a new way of drawing the grid, by edge detecting the face coord texture
// (primarily used to identify what client pixel corresponds to what face.)
// This lets me draw a grid without relying on lines, which can't be instanced in
// Three.js unless they are a wireframe (blegh!)
export class GridFilter extends ShaderFilter {
  constructor(toSample: THREE.Texture, z: number) {
    super(z, {
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: gridShader.uniforms,
      vertexShader: gridShader.vertexShader,
      fragmentShader: gridShader.fragmentShader,
    });

    this.uniforms["gapColour"].value = new THREE.Vector4(0.0, 0.0, 0.0, 0.0);
    this.uniforms["lineColour"].value = new THREE.Vector4(0.4, 0.4, 0.4, 1.0);
    this.uniforms["step"].value = new THREE.Vector2();
    this.uniforms["tex"].value = toSample;
  }

  resize(width: number, height: number) {
    this.uniforms["step"].value = new THREE.Vector2(
      1.0 / width, 1.0 / height
    );
  }
}