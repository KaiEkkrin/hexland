import { GridEdge, edgeString } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { LoSPosition, losPositionsEqual } from '../../data/losPosition';
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
  vertexShader: `
    uniform vec3 tokenCentre;
    uniform float zValue;

    const float near = -10.0;
    const float far = 10.0;
    const float epsilon = 0.00001;

    vec3 intersectHorizontalBounds(const in vec3 origin, const in vec3 dir) {
      return dir.y > 0.0 ?
        vec3(origin.x + (far - origin.y) * dir.x / dir.y, far, origin.z) :
        vec3(origin.x + (near - origin.y) * dir.x / dir.y, near, origin.z);
    }

    vec3 intersectVerticalBounds(const in vec3 origin, const in vec3 dir) {
      return dir.x > 0.0 ?
        vec3(far, origin.y + (far - origin.x) * dir.y / dir.x, origin.z) :
        vec3(near, origin.y + (near - origin.x) * dir.y / dir.x, origin.z);
    }

    vec4 project() {
      if (abs(position.z - zValue) < epsilon) {
        return projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);
      }
      vec3 projected = (projectionMatrix * viewMatrix * instanceMatrix * vec4(position.xy, zValue, 1.0)).xyz;
      vec3 token = (projectionMatrix * viewMatrix * vec4(tokenCentre, 1.0)).xyz;
      vec3 dir = normalize(projected - token);
      vec3 iHoriz = intersectHorizontalBounds(projected, dir);
      vec3 iVert = intersectVerticalBounds(projected, dir);
      vec3 intersection = abs(dir.x) < epsilon ? iHoriz : abs(dir.y) < epsilon ? iVert :
        dot(iHoriz - projected, dir) < dot(iVert - projected, dir) ? iHoriz : iVert;
      return vec4(intersection, 1.0);
    }

    void main() {
      gl_Position = project();
    }
  `,
  fragmentShader: `
    void main() {
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `
};

// This feature object draws the shadows cast by the walls using the above shader.
// (It doesn't own the material.)
// Edit the material before rendering this to draw LoS for different tokens
class LoSFeatureObject extends InstancedFeatureObject<GridEdge, IFeature<GridEdge>> {
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

class LoSFeatures extends InstancedFeatures<GridEdge, IFeature<GridEdge>> {
  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, z: number, q: number, material: THREE.ShaderMaterial, maxInstances?: number | undefined) {
    super(geometry, redrawFlag, edgeString, maxInstances => {
      return new LoSFeatureObject(geometry, z, q, material, maxInstances);
    }, maxInstances);
  }
}

// This class encapsulates the LoS drawing along with its intermediate surfaces.
const maxComposeCount = 8;
const losResolutionDivisor = 2; // Render LoS at 1/2 resolution in each dimension

export class LoS extends Drawn {
  private readonly _featureClearColour: THREE.Color;
  private readonly _features: LoSFeatures;

  private readonly _featureMaterial: THREE.ShaderMaterial;
  private readonly _featureRenderTargets: THREE.WebGLRenderTarget[];
  private readonly _featureScene: THREE.Scene;
  private readonly _featureUniforms: Record<string, THREE.IUniform>;

  private readonly _composeClearColour: THREE.Color;

  private readonly _composeGeometry: THREE.BufferGeometry;
  private readonly _composeRenderTarget: THREE.WebGLRenderTarget;
  private readonly _composeScene: THREE.Scene;

  private readonly _composedTargetReader: RenderTargetReader;

  private _tokenPositions: LoSPosition[] = [];

  // Track both full viewport and reduced LoS render target dimensions
  private _losWidth: number;
  private _losHeight: number;

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

    // Calculate reduced LoS render target dimensions (1/4 in each dimension)
    this._losWidth = Math.max(1, Math.floor(renderWidth / losResolutionDivisor));
    this._losHeight = Math.max(1, Math.floor(renderHeight / losResolutionDivisor));

    this._featureClearColour = new THREE.Color(0, 0, 0); // visible (black) by default; we draw shadows as white

    this._featureUniforms = THREE.UniformsUtils.clone(featureShader.uniforms);
    this._featureUniforms[tokenCentre].value = new THREE.Vector3();
    this._featureUniforms[zValue].value = z;
    this._featureMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: this._featureUniforms,
      vertexShader: featureShader.vertexShader,
      fragmentShader: featureShader.fragmentShader,
      // Use MAX blending to retain the maximum (brightest/shadow) color value when
      // multiple shadow fragments overlap the same pixel (white = shadow)
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });

    this._features = new LoSFeatures(geometry, redrawFlag, z, q, this._featureMaterial, maxInstances);
    this._featureRenderTargets = [];
    for (let i = 0; i < maxComposeCount; ++i) {
      this._featureRenderTargets.push(this.createRenderTarget(this._losWidth, this._losHeight));
    }

    this._featureScene = new THREE.Scene();
    this._features.addToScene(this._featureScene);

    this._composeClearColour = new THREE.Color(1, 1, 1); // shadowed (white) unless seen by something
    this._composeRenderTarget = this.createRenderTarget(this._losWidth, this._losHeight);
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

  private compose(camera: THREE.Camera, renderer: THREE.WebGLRenderer, count: number) {
    // Composes the contents of the given number of feature renders onto the compose target.
    // TODO #52 To successfully down-scale the LoS, this here needs its own camera
    renderer.setRenderTarget(this._composeRenderTarget);
    const materials: THREE.MeshBasicMaterial[] = [];
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < count; ++i) {
      const material = new THREE.MeshBasicMaterial({
        // Use MIN blending to combine LoS from multiple tokens:
        // a pixel is visible (black) if ANY token can see it (lowest shadow value wins)
        blending: THREE.CustomBlending,
        blendEquation: THREE.MinEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        map: this._featureRenderTargets[i].texture,
        side: THREE.DoubleSide,
        transparent: true,
      });
      materials.push(material);

      const mesh = new THREE.Mesh(this._composeGeometry, material);
      meshes.push(mesh);
      this._composeScene.add(mesh);
    }

    renderer.render(this._composeScene, camera);

    // Put settings back
    meshes.forEach(m => this._composeScene.remove(m));
    materials.forEach(m => m.dispose());
  }

  private createRenderTarget(renderWidth: number, renderHeight: number) {
    return new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      depthBuffer: false,
      // Using linear filtering here, though counter-intuitive, will reduce our vulnerability
      // to hairline 'cracks' forming in between shadows that ought to line up but don't quite
      // because of float inaccuracies/quirks of the rasterizer
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
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
    // Use the tracked LoS dimensions (reduced resolution)
    const x = Math.floor((cp.x + 1) * 0.5 * this._losWidth);
    const y = Math.floor((cp.y + 1) * 0.5 * this._losHeight);
    // Sample offset reduced to 1 since we're at 1/4 resolution (1 pixel = 4 original pixels)
    function *enumerateSamplePositions() {
      yield [x, y];
      yield [x - 1, y - 1];
      yield [x + 1, y - 1];
      yield [x - 1, y + 1];
      yield [x + 1, y + 1];
    }

    // Invert sample values since black (0) = visible, white (255) = shadow
    const visibleCount = fluent(enumerateSamplePositions())
      .map(p => this._composedTargetReader.sample(p[0], p[1], (buf, offset) => 255 - (buf[offset] ?? 255)))
      .sum();
    return visibleCount > 0.1;
  }

  // Renders the LoS frames.  Overwrites the render target and clear colours.
  // TODO Can I sometimes avoid re-rendering these?  Separate the `needsRedraw` flags?
  render(camera: THREE.Camera, fixedCamera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    // Always clear the composed target to begin with (otherwise, with 0 token positions to
    // render, we'll end up returning the old composed target!)
    renderer.setRenderTarget(this._composeRenderTarget);
    renderer.setClearColor(this._composeClearColour);
    renderer.clear();

    // Render the LoS features for each token position
    let lastRenderedIndex = maxComposeCount;
    this._tokenPositions.forEach((pos, i) => {
      const targetIndex = (i % maxComposeCount);
      // Use the pre-calculated world centre directly
      this._featureUniforms[tokenCentre].value.copy(pos.centre);

      renderer.setRenderTarget(this._featureRenderTargets[targetIndex]);
      renderer.setClearColor(this._featureClearColour);
      renderer.clear();
      renderer.render(this._featureScene, camera);
      lastRenderedIndex = targetIndex;

      if (targetIndex === (maxComposeCount - 1)) {
        // We've filled all our feature render targets; we must compose these down
        // before we can continue.
        this.compose(fixedCamera, renderer, maxComposeCount);
        lastRenderedIndex = maxComposeCount;
      }
    });

    // Complete any composition we might need to do
    if (lastRenderedIndex < maxComposeCount) {
      this.compose(fixedCamera, renderer, lastRenderedIndex + 1);
    }

    renderer.setRenderTarget(null);
    this._composedTargetReader.refresh(renderer);
  }

  resize(width: number, height: number) {
    // Calculate reduced LoS render target dimensions (1/4 in each dimension)
    this._losWidth = Math.max(1, Math.floor(width / losResolutionDivisor));
    this._losHeight = Math.max(1, Math.floor(height / losResolutionDivisor));
    this._featureRenderTargets.forEach(t => t.setSize(this._losWidth, this._losHeight));
    this._composeRenderTarget.setSize(this._losWidth, this._losHeight);
  }

  // Assigns the positions of the tokens to draw LoS for.
  setTokenPositions(positions: LoSPosition[]) {
    // If these are the same, we don't need to do anything:
    if (losPositionsEqual(positions, this._tokenPositions)) {
      return;
    }

    this._tokenPositions = [...positions];
    this.setNeedsRedraw();
  }

  dispose() {
    if (this._isDisposed === false) {
      this._features.dispose();
      this._featureMaterial.dispose();
      this._featureRenderTargets.forEach(t => t.dispose());

      this._composeGeometry.dispose();
      this._composeRenderTarget.dispose();

      this._isDisposed = true;
    }
  }
}