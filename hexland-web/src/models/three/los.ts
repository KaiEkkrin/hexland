import { IGridCoord, IGridEdge, edgeString, coordsEqual } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { Drawn } from '../drawn';
import { IGridGeometry } from '../gridGeometry';
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from '../redrawFlag';
import { RenderTargetReader } from './renderTargetReader';

import * as THREE from 'three';
import { InstancedFeatureObject } from './instancedFeatureObject';
import { ShaderMaterial } from 'three';

// Shader-based LoS.
// Careful with this!  In order for it to work correctly, we need to not use the built-in
// attributes `modelMatrix` or `modelViewMatrix`, because they are not instanced.  Instead
// we refer to the built-in attribute `instanceMatrix` in place of `modelMatrix`.  `viewMatrix`
// is not instanced anyway and can be used as expected.
// To do this, I will supply a pair of triangles (forming a rectangle) for each wall
// to the shader, where the vertices are at (edgeA, z); (edgeB, z); (edgeA, q); (edgeB; q)
// The vertices at z=q will be transformed by the vertex shader to be at the point where the
// line from the token centre to the vertex intersects the closest one of the four bounds.
// (which can be fixed at the size 2 cube centred on 0, because we can do this stuff post-
// orthographic projection.)
// This will render the LoS from a single token; to compose multiple tokens together,
// repeat in batches (size 4?) and run a "merge" shader that adds together all the textures in the batches.
// When we've got a final LoS render, we can overlay it onto the screen one by multiply to create
// the drawn LoS layer, and also sample it for allowed/disallowed move purposes.
// We're going to need uniforms:
// - tokenCentre (vec3)
// - zValue (float) (for determining which edges to project; *not* q)
const tokenCentre = "tokenCentre";
const zValue = "zValue";

const featureShader = {
  uniforms: {
    tokenCentre: { type: 'v3', value: null },
    zValue: { type: 'f', value: null },
  },
  vertexShader: [
    "uniform vec3 tokenCentre;",
    "uniform float zValue;",

    "const float near = -10.0;",
    "const float far = 10.0;",
    "const float epsilon = 0.0000001;",

    "vec3 intersectHorizontalBounds(const in vec3 origin, const in vec3 dir) {",
    "  return dir.y > 0.0 ?",
    "    vec3(origin.x + (far - origin.y) * dir.x / dir.y, far, origin.z) :",
    "    vec3(origin.x + (near - origin.y) * dir.x / dir.y, near, origin.z);",
    "}",

    "vec3 intersectVerticalBounds(const in vec3 origin, const in vec3 dir) {",
    "  return dir.x > 0.0 ?",
    "    vec3(far, origin.y + (far - origin.x) * dir.y / dir.x, origin.z) :",
    "    vec3(near, origin.y + (near - origin.x) * dir.y / dir.x, origin.z);",
    "}",

    "vec4 project() {",
    "  if (position.z == zValue) {",
    "    return projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);",
    "  }",
    "  vec3 projected = (projectionMatrix * viewMatrix * instanceMatrix * vec4(position.xy, zValue, 1.0)).xyz;",
    "  vec3 token = (projectionMatrix * viewMatrix * vec4(tokenCentre, 1.0)).xyz;",
    "  vec3 dir = normalize(projected - token);",
    "  vec3 iHoriz = intersectHorizontalBounds(projected, dir);",
    "  vec3 iVert = intersectVerticalBounds(projected, dir);",
    "  vec3 intersection = abs(dir.x) < epsilon ? iHoriz : abs(dir.y) < epsilon ? iVert :",
    "    dot(iHoriz - projected, dir) < dot(iVert - projected, dir) ? iHoriz : iVert;",
    "  return vec4(intersection, 1.0);",
    "}",

    "void main() {",
    "  gl_Position = project();",
    "}"
  ].join("\n"),
  fragmentShader: [
    "void main() {",
    "  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);",
    "}"
  ].join("\n")
};

// This feature object draws the shadows cast by the walls using the above shader.
// (It doesn't own the material.)
// Edit the material before rendering this to draw LoS for different tokens
class LoSFeatureObject extends InstancedFeatureObject<IGridEdge, IFeature<IGridEdge>> {
  private readonly _geometry: THREE.InstancedBufferGeometry;
  private readonly _material: THREE.ShaderMaterial;

  constructor(gridGeometry: IGridGeometry, z: number, q: number, material: THREE.ShaderMaterial, maxInstances: number) {
    super(edgeString, (o, p) => gridGeometry.transformToEdge(o, p), maxInstances);
    const single = gridGeometry.toSingle();
    const vertices = [...single.createLoSVertices(z, q)];

    this._geometry = new THREE.InstancedBufferGeometry();
    this._geometry.setFromPoints(vertices);
    this._geometry.setIndex(gridGeometry.createLoSIndices());

    this._material = material;
  }

  protected createMesh(maxInstances: number) {
    return new THREE.InstancedMesh(this._geometry, this._material, maxInstances);
  }

  dispose() {
    super.dispose();
    this._geometry.dispose();
  }
}

class LoSFeatures extends InstancedFeatures<IGridEdge, IFeature<IGridEdge>> {
  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, z: number, q: number, material: THREE.ShaderMaterial, maxInstances?: number | undefined) {
    super(geometry, redrawFlag, edgeString, maxInstances => {
      return new LoSFeatureObject(geometry, z, q, material, maxInstances);
    }, maxInstances);
  }
}

// This class encapsulates the LoS drawing along with its intermediate surfaces.
export class LoS extends Drawn {
  private readonly _featureClearColour: THREE.Color;
  private readonly _features: LoSFeatures;

  private readonly _featureMaterial: THREE.ShaderMaterial;
  private readonly _featureRenderTarget: THREE.WebGLRenderTarget;
  private readonly _featureScene: THREE.Scene;
  private readonly _featureUniforms: any;

  private readonly _composeClearColour: THREE.Color;

  private readonly _composeRenderTarget: THREE.WebGLRenderTarget;
  private readonly _composeScene: THREE.Scene;

  private readonly _composedTargetReader: RenderTargetReader;

  private readonly _mapGeometry: THREE.BufferGeometry;
  private _mapMaterial: THREE.Material | undefined;
  private _mapMesh: THREE.Mesh | undefined;

  private _tokenPositions: IGridCoord[] = [];

  private _mapScene: THREE.Scene | undefined;
  private _isDisposed = false;

  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    z: number,
    q: number,
    renderWidth: number,
    renderHeight: number,
    maxInstances?: number | undefined
  ) {
    super(geometry, redrawFlag);

    this._featureClearColour = new THREE.Color(1, 1, 1); // visible by default; we draw the shadows

    this._featureUniforms = THREE.UniformsUtils.clone(featureShader.uniforms);
    this._featureUniforms[tokenCentre].value = new THREE.Vector3();
    this._featureUniforms[zValue].value = z;
    this._featureMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: this._featureUniforms,
      vertexShader: featureShader.vertexShader,
      fragmentShader: featureShader.fragmentShader
    });

    this._features = new LoSFeatures(geometry, redrawFlag, z, q, this._featureMaterial, maxInstances);
    this._featureRenderTarget = this.createRenderTarget(renderWidth, renderHeight);
    this._featureScene = new THREE.Scene();
    this._features.addToScene(this._featureScene);

    this._composeClearColour = new THREE.Color(0, 0, 0); // invisible unless seen by something

    this._composeRenderTarget = this.createRenderTarget(renderWidth, renderHeight);
    this._composeScene = new THREE.Scene();

    this._composedTargetReader = new RenderTargetReader(this._composeRenderTarget);

    // Create the geometry we use to draw the composed LoS onto the map
    // We'll simply stretch this to fill the canvas
    this._mapGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1, 1, 0)
    ]);
    this._mapGeometry.setIndex([
      0, 1, 2, -1, 1, 2, 3, -1
    ]);

    // Yes, having the UVs specified is mandatory :P
    this._mapGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
      0, 0, 1, 0, 0, 1, 1, 1
    ]), 2));
  }

  private composeOne(camera: THREE.Camera, renderer: THREE.WebGLRenderer, zOffset: number) {
    // Composes the contents of the current feature render onto the compose target.
    renderer.setRenderTarget(this._composeRenderTarget);
    const material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      map: this._featureRenderTarget.texture,
      side: THREE.DoubleSide,
      transparent: true
    });

    const mesh = new THREE.Mesh(this._mapGeometry, material);
    mesh.position.set(0, 0, zOffset);
    mesh.scale.set(this._composeRenderTarget.width, this._composeRenderTarget.height, 0);
    mesh.updateMatrix();
    mesh.updateMatrixWorld();

    this._composeScene.add(mesh);
    renderer.render(this._composeScene, camera);

    // Put settings back
    this._composeScene.remove(mesh);
    material.dispose();
  }

  private createMapMesh() {
    this._mapMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.MultiplyBlending,
      map: this._composeRenderTarget.texture,
      side: THREE.DoubleSide,
      transparent: true
    });

    this._mapMesh = new THREE.Mesh(this._mapGeometry, this._mapMaterial);
    this.setMapMeshSize();
    if (this._mapScene !== undefined) {
      this._mapScene.add(this._mapMesh);
    }
  }

  private createRenderTarget(renderWidth: number, renderHeight: number) {
    return new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping
    });
  }

  private deleteMapMesh() {
    if (this._mapScene !== undefined && this._mapMesh !== undefined) {
      this._mapScene.remove(this._mapMesh);
    }

    this._mapMesh = undefined;
    this._mapMaterial?.dispose();
    this._mapMaterial = undefined;
  }

  private setMapMeshSize() {
    this._mapMesh?.position.set(0, 0, 0);
    this._mapMesh?.scale.set(this._composeRenderTarget.width, this._composeRenderTarget.height, 0);
    this._mapMesh?.updateMatrix();
    this._mapMesh?.updateMatrixWorld();
  }

  private withAutoClearSetTo(renderer: THREE.WebGLRenderer, autoClear: boolean, fn: (r: THREE.WebGLRenderer) => void) {
    const previousValue = renderer.autoClear;
    renderer.autoClear = autoClear;
    fn(renderer);
    renderer.autoClear = previousValue;
  }

  // Accesses the LoS features themselves -- these should be sync'd with the walls,
  // but with only colour 0.
  get features() {
    return this._features;
  }

  // Adds an object to the scene that will draw the composed LoS over it.
  addToScene(scene: THREE.Scene): boolean {
    if (this._mapScene !== undefined) {
      return false;
    }

    if (this._mapMesh !== undefined) {
      scene.add(this._mapMesh);
    }

    this._mapScene = scene;
    return true;
  }

  // Checks the LoS for the given client position and returns true if the position
  // is visible, else false.
  checkLoS(cp: THREE.Vector3) {
    const x = Math.floor((cp.x + 1) * 0.5 * this._featureRenderTarget.width);
    const y = Math.floor((cp.y + 1) * 0.5 * this._featureRenderTarget.height);
    if (x < 0 || y < 0 || x >= this._featureRenderTarget.width || y >= this._featureRenderTarget.height) {
      return false;
    }

    return this._composedTargetReader.sample(x, y, (buf, offset) => {
      return buf[offset] !== 0 || buf[offset + 1] !== 0 || buf[offset + 2] !== 0;
    });
  }

  // Post-render step.
  postRender(renderer: THREE.WebGLRenderer) {
    this._composedTargetReader.refresh(renderer);
  }

  // Removes the compound LoS draw object from the current scene.
  removeFromScene() {
    if (this._mapScene !== undefined) {
      if (this._mapMesh !== undefined) {
        this._mapScene.remove(this._mapMesh);
      }

      this._mapScene = undefined;
    }
  }

  // Renders the LoS frames.  Overwrites the render target and clear colours.
  // TODO #52 Can I sometimes avoid re-rendering these?  Separate the `needsRedraw` flags?
  render(camera: THREE.Camera, fixedCamera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    // Remove the old map mesh so we can render a new texture
    this.deleteMapMesh();

    var composeCleared = false;
    var zOffset = 0;

    // Render the LoS features for each token position
    this._tokenPositions.forEach(c => {
      this.geometry.createCoordCentre(
        this._featureUniforms[tokenCentre].value,
        c,
        this._featureUniforms[zValue].value
      );

      renderer.setRenderTarget(this._featureRenderTarget);
      renderer.setClearColor(this._featureClearColour);
      renderer.render(this._featureScene, camera);

      // Compose these into the overall scene.
      // Each composition must go on top of the previous one, hence the z offset.
      // TODO This may turn out to be slow when there are large numbers of targets;
      // I could squash these steps together if I write a shader that samples 4 or so
      // textures simultaneously and combines them into an output.  However, I expect
      // that scenario to be rare, so I won't for now.
      renderer.setClearColor(this._composeClearColour);
      this.withAutoClearSetTo(renderer, composeCleared === false, r => {
        this.composeOne(fixedCamera, r, zOffset);
      });

      composeCleared = true;
      zOffset += 0.01;
    });

    // Add the map mesh with the newly rendered texture
    // Note that we must wait until we've un-bound the render target before we use it as a
    // texture by re-creating the map mesh!
    renderer.setRenderTarget(null);
    this.createMapMesh();
  }

  resize(width: number, height: number) {
    this._featureRenderTarget.setSize(width, height);
    this._composeRenderTarget.setSize(width, height);
    this.setMapMeshSize();
  }

  // Assigns the positions of the tokens to draw LoS for.
  setTokenPositions(positions: IGridCoord[]) {
    // If these are the same, we don't need to do anything:
    if (
      positions.length === this._tokenPositions.length &&
      positions.map((p, i) => coordsEqual(p, this._tokenPositions[i])).reduce((a, b) => a && b, true)
    ) {
      return;
    }

    this._tokenPositions = [...positions];
    this.setNeedsRedraw();
  }

  dispose() {
    if (this._isDisposed === false) {

      this._features.dispose();
      this._featureMaterial.dispose();
      this._featureRenderTarget.dispose();

      this._composeRenderTarget.dispose();

      this.deleteMapMesh();
      this._mapGeometry.dispose();

      this._isDisposed = true;
    }
  }
}