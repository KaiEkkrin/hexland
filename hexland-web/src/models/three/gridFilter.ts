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
    "  texUv = position.xy + 0.25 * step;",
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
    "  if (above != here || left != here || right != here || below != here) {",
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
export class GridFilter {
  private readonly _bufferGeometry: THREE.BufferGeometry;
  private readonly _material: THREE.ShaderMaterial;
  
  private readonly _mesh: THREE.Mesh;

  private _isDisposed = false;

  constructor(scene: THREE.Scene, toSample: THREE.Texture, z: number) {
    // Our object is, very simply, a unit square that we will
    // stretch to fill the canvas (using the uniforms)
    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, z),
      new THREE.Vector3(1, 0, z),
      new THREE.Vector3(0, 1, z),
      new THREE.Vector3(1, 1, z),
      new THREE.Vector3(0, 1, z),
      new THREE.Vector3(1, 0, z)
    ]);

    var uniforms = THREE.UniformsUtils.clone(gridShader.uniforms);
    uniforms["gapColour"].value = new THREE.Vector4(0.0, 0.0, 0.0, 0.0);
    uniforms["lineColour"].value = new THREE.Vector4(0.4, 0.4, 0.4, 1.0);
    uniforms["step"].value = new THREE.Vector2();
    uniforms["tex"].value = toSample;
    this._material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: gridShader.vertexShader,
      fragmentShader: gridShader.fragmentShader,
      blending: THREE.NormalBlending,
      transparent: true
    });

    this._mesh = new THREE.Mesh(this._bufferGeometry, this._material);
    scene.add(this._mesh);
  }

  resize(width: number, height: number) {
    this._material.uniforms["step"].value = new THREE.Vector2(
      1.0 / width, 1.0 / height
    );

    this._mesh.position.set(0, 0, 0);
    this._mesh.scale.set(width, height, 1);
    this._mesh.updateMatrix();
    this._mesh.updateMatrixWorld();
  }

  dispose() {
    if (this._isDisposed === false) {
      this._bufferGeometry.dispose();
      this._material.dispose();

      this._isDisposed = true;
    }
  }
}