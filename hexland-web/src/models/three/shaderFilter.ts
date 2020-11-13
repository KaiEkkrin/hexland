import * as THREE from 'three';

export interface IShader {
  uniforms: any;
  vertexShader: string;
  fragmentShader: string;
}

// A hopefully-convenient base class for filtering the whole screen,
// expecting a shader that does only the basics in the vertex shader
// (because we'll always draw it with a screen-covering rectangle.)
// Assumes the fixed filter camera from drawingOrtho.
export class ShaderFilter {
  private readonly _bufferGeometry: THREE.BufferGeometry;
  private readonly _material: THREE.ShaderMaterial;
  private readonly _mesh: THREE.Mesh;

  private _uniforms: any;
  private _isDisposed = false;

  constructor(z: number, shaderParameters?: THREE.ShaderMaterialParameters) {
    // Our object is, very simply, a unit square that we will
    // stretch to fill the canvas (using the uniforms)
    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1, -1, z),
      new THREE.Vector3(1, -1, z),
      new THREE.Vector3(-1, 1, z),
      new THREE.Vector3(1, 1, z),
      new THREE.Vector3(-1, 1, z),
      new THREE.Vector3(1, -1, z)
    ]);
    
    this._uniforms = THREE.UniformsUtils.clone(shaderParameters?.uniforms);
    this._material = new THREE.ShaderMaterial({ ...shaderParameters, side: THREE.DoubleSide, uniforms: this._uniforms });

    this._mesh = new THREE.Mesh(this._bufferGeometry, this._material);
  }
  
  get uniforms() { return this._uniforms; }

  addToScene(scene: THREE.Scene) {
    scene.add(this._mesh);
  }

  removeFromScene(scene: THREE.Scene) {
    scene.remove(this._mesh);
  }

  dispose() {
    if (this._isDisposed === false) {
      this._bufferGeometry.dispose();
      this._material.dispose();

      this._isDisposed = true;
    }
  }
}