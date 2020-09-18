import { IGridCoord, IGridEdge, edgeString, coordsEqual } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { Drawn } from '../drawn';
import { IGridGeometry } from '../gridGeometry';
import { InstancedFeatureObject } from './instancedFeatureObject';
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from '../redrawFlag';
import { RenderTargetReader } from './renderTargetReader';

import * as THREE from 'three';
import fluent from 'fluent-iterable';

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

  private readonly _composeGeometry: THREE.BufferGeometry;
  private readonly _composeRenderTarget: THREE.WebGLRenderTarget;
  private readonly _composeScene: THREE.Scene;

  private readonly _composedTargetReader: RenderTargetReader;

  private _tokenPositions: IGridCoord[] = [];

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

    // Create the geometry we use to compose the LoS together
    this._composeGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1, -1, 0),
      new THREE.Vector3(1, -1, 0),
      new THREE.Vector3(-1, 1, 0),
      new THREE.Vector3(1, 1, 0)
    ]);
    this._composeGeometry.setIndex([
      0, 1, 2, 1, 2, 3
    ]);

    // Yes, having the UVs specified is mandatory :P
    this._composeGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
      0, 0, 1, 0, 0, 1, 1, 1
    ]), 2));
  }

  private composeOne(camera: THREE.Camera, renderer: THREE.WebGLRenderer, zOffset: number) {
    // Composes the contents of the current feature render onto the compose target.
    // TODO #52 To successfully down-scale the LoS, this here needs its own camera
    renderer.setRenderTarget(this._composeRenderTarget);
    const material = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      map: this._featureRenderTarget.texture,
      side: THREE.DoubleSide,
      transparent: true
    });

    const mesh = new THREE.Mesh(this._composeGeometry, material);
    this._composeScene.add(mesh);
    renderer.render(this._composeScene, camera);

    // Put settings back
    this._composeScene.remove(mesh);
    material.dispose();
  }

  private createRenderTarget(renderWidth: number, renderHeight: number) {
    return new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping
    });
  }

  // Accesses the LoS features themselves -- these should be sync'd with the walls,
  // but with only colour 0.
  get features() {
    return this._features;
  }

  // Accesses the composed LoS render target so that we can use it to draw.
  get target() {
    return this._composeRenderTarget;
  }

  // Checks the LoS for the given client position and returns true if the position
  // is visible, else false.
  checkLoS(cp: THREE.Vector3) {
    const x = Math.floor((cp.x + 1) * 0.5 * this._composeRenderTarget.width);
    const y = Math.floor((cp.y + 1) * 0.5 * this._composeRenderTarget.height);
    function *enumerateSamplePositions() {
      yield [x, y];
      yield [x - 2, y - 2];
      yield [x + 2, y - 2];
      yield [x - 2, y + 2];
      yield [x + 2, y + 2];
    }

    const visibleCount = fluent(enumerateSamplePositions())
      .map(p => this._composedTargetReader.sample(p[0], p[1], (buf, offset) => buf[offset] ?? 0))
      .sum();
    return visibleCount > 0;
  }

  // Renders the LoS frames.  Overwrites the render target and clear colours.
  // TODO Can I sometimes avoid re-rendering these?  Separate the `needsRedraw` flags?
  render(camera: THREE.Camera, fixedCamera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    let zOffset = 0;

    // Always clear the composed target to begin with (otherwise, with 0 token positions to
    // render, we'll end up returning the old composed target!)
    renderer.setRenderTarget(this._composeRenderTarget);
    renderer.setClearColor(this._composeClearColour);
    renderer.clear();

    // Render the LoS features for each token position
    this._tokenPositions.forEach(c => {
      this.geometry.createCoordCentre(
        this._featureUniforms[tokenCentre].value,
        c,
        this._featureUniforms[zValue].value
      );

      renderer.setRenderTarget(this._featureRenderTarget);
      renderer.setClearColor(this._featureClearColour);
      renderer.clear();
      renderer.render(this._featureScene, camera);

      // Compose these into the overall scene.
      // Each composition must go on top of the previous one, hence the z offset.
      // TODO This may turn out to be slow when there are large numbers of targets;
      // I could squash these steps together if I write a shader that samples 4 or so
      // textures simultaneously and combines them into an output.  However, I expect
      // that scenario to be rare, so I won't for now.
      this.composeOne(fixedCamera, renderer, zOffset);
      zOffset += 0.01;
    });

    renderer.setRenderTarget(null);
    this._composedTargetReader.refresh(renderer);
  }

  resize(width: number, height: number) {
    this._featureRenderTarget.setSize(width, height);
    this._composeRenderTarget.setSize(width, height);
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

      this._composeGeometry.dispose();
      this._composeRenderTarget.dispose();

      this._isDisposed = true;
    }
  }
}