import { IGridCoord, coordString, IGridVertex, vertexString } from '../../data/coord';
import { IFeature, FeatureDictionary } from '../../data/feature';
import { createAreaGeometry, Areas, createAreas } from './areas';
import { Drawn } from '../drawn';
import { IGridGeometry } from '../gridGeometry';
import { InstancedFeatureObject } from './instancedFeatureObject';
import { InstancedFeatures } from './instancedFeatures';
import { IGridBounds } from '../interfaces';
import { RedrawFlag } from '../redrawFlag';
import { RenderTargetReader } from './renderTargetReader';
import { createVertexGeometry, Vertices, createVertices } from './vertices';

import * as THREE from 'three';
import fluent from 'fluent-iterable';
// import fluent from 'fluent-iterable';

// This shading provides the colouring for the coord and vertex colour textures, which
// aren't shown to the user (they look rainbow...) but let us look up a client position
// and get grid co-ordinates.
// Each instance is a whole tile (otherwise we would have to prepare too many vertices...)
// The code in the vertex shader should create the same format as `toPackedXYAbs` and
// `toPackedXYEdge` in GridGeometry.
const epsilon = "epsilon";
const maxEdge = "maxEdge";
const tileDim = "tileDim";
const tileOrigin = "tileOrigin";
const gridColouredShader = {
  uniforms: {
    epsilon: { type: 'f', value: null },
    maxEdge: { type: 'f', value: null },
    tileDim: { type: 'f', value: null },
    tileOrigin: { type: 'v2', value: null },
  },
  vertexShader: [
    "uniform float epsilon;",
    "uniform float maxEdge;",
    "uniform float tileDim;",
    "uniform vec2 tileOrigin;",
    "attribute vec3 face;", // per-vertex; z is the edge or vertex number
    "attribute vec2 tile;", // per-instance
    "varying vec3 vertexColour;", // packed colour

    "float packXYAbs(const in vec2 c) {",
    "  return epsilon + (abs(c.y) * tileDim + abs(c.x)) / (tileDim * tileDim);",
    "}",

    "float packXYSignAndEdge(const in vec2 c, const in float edge) {",
    "  float packedValue = (",
    "    (c.x < 0.0 ? 1.0 : 0.0) +",
    "    (c.y < 0.0 ? 2.0 : 0.0) +",
    "    4.0 * edge +",
    "    4.0 * maxEdge",
    "  );",
    "  return epsilon + packedValue / (8.0 * maxEdge);",
    "}",

    "void main() {",
    "  vertexColour = vec3(",
    "    packXYAbs(tile - tileOrigin),",
    "    packXYSignAndEdge(tile - tileOrigin, face.z),",
    "    packXYAbs(face.xy)",
    "  );",
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

class GridColouredFeatureObject<K extends IGridCoord, F extends IFeature<K>> extends InstancedFeatureObject<K, F> {
  private readonly _gridGeometry: IGridGeometry;
  private readonly _geometry: THREE.InstancedBufferGeometry;
  private readonly _tileAttr: THREE.InstancedBufferAttribute;
  private readonly _instanceTiles: Float32Array;
  private readonly _tileOrigin: THREE.Vector2;

  private _uniforms: any = null;
  private _material: THREE.ShaderMaterial | undefined; // created when required

  constructor(
    toIndex: (k: K) => string,
    transformTo: (m: THREE.Matrix4, position: K) => THREE.Matrix4,
    gridGeometry: IGridGeometry,
    maxInstances: number,
    createGeometry: () => THREE.InstancedBufferGeometry,
    tileOrigin: THREE.Vector2
  ) {
    super(toIndex, transformTo, maxInstances);
    this._gridGeometry = gridGeometry;
    this._geometry = createGeometry();
    this._tileOrigin = tileOrigin;

    this._instanceTiles = new Float32Array(maxInstances * 2);
    this._tileAttr = new THREE.InstancedBufferAttribute(this._instanceTiles, 2);
    this._tileAttr.setUsage(THREE.DynamicDrawUsage);
    this._geometry.setAttribute('tile', this._tileAttr);
  }

  protected get gridGeometry() { return this._gridGeometry; }
  protected get geometry() { return this._geometry; }

  protected get material(): THREE.ShaderMaterial {
    if (this._material === undefined) {
      const [material, uniforms] = this.createMaterial();
      this._material = material;
      this._uniforms = uniforms;
      return material;
    }

    return this._material;
  }

  protected get uniforms() {
    if (this._uniforms === null) {
      [this._material, this._uniforms] = this.createMaterial();
    }

    return this._uniforms;
  }

  protected createMaterial() {
    const uniforms = THREE.UniformsUtils.clone(gridColouredShader.uniforms);
    uniforms[epsilon].value = this._gridGeometry.epsilon;
    uniforms[maxEdge].value = this._gridGeometry.maxEdge;
    uniforms[tileDim].value = this._gridGeometry.tileDim;
    uniforms[tileOrigin].value = this._tileOrigin;

    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: gridColouredShader.vertexShader,
      fragmentShader: gridColouredShader.fragmentShader
    });

    return [material, uniforms];
  }

  protected createMesh(maxInstances: number) {
    return new THREE.InstancedMesh(this._geometry, this.material, maxInstances);
  }

  protected addFeature(f: F, instanceIndex: number) {
    super.addFeature(f, instanceIndex);

    // The positions are in grid coords, of course, not tile coords -- convert them here
    this._instanceTiles[2 * instanceIndex] = Math.floor(f.position.x / this.gridGeometry.tileDim);
    this._instanceTiles[2 * instanceIndex + 1] = Math.floor(f.position.y / this.gridGeometry.tileDim);
    this._tileAttr.needsUpdate = true;
  }

  dispose() {
    super.dispose();
    this._geometry.dispose();
    this._material?.dispose();
  }
}

// Using the same mesh as the grid coord shader, this samples the LoS texture to draw the
// LoS of each face of the grid.
// TODO Are there performance improvements to be had via using extra functionality?  Could
// we do this with a stencil buffer, for example?
function createLoSShader(gridGeometry: IGridGeometry) {
  return {
    uniforms: {
      "fullyHidden": { type: 'f', value: null },
      "fullyVisible": { type: 'f', value: null },
      "losStep": { type: 'v2', value: null },
      "losTex": { value: null },
      ...gridGeometry.createShaderUniforms()
    },
    vertexShader: [
      ...gridGeometry.createShaderDeclarations(),
      "uniform float fullyHidden;",
      "uniform float fullyVisible;",
      "uniform vec2 losStep;",
      "uniform sampler2D losTex;",
      "attribute vec3 face;", // per-vertex; z is the edge or vertex number
      "attribute vec2 tile;",
      "varying vec3 vertexColour;", // packed colour

      ...gridGeometry.createShaderSnippet(),

      // The LoS texture is monochrome so we can ignore the other channels
      "void sampleLoS(const in vec2 uv, inout int visibleCount) {",
      "  vec4 los = texture2D(losTex, uv);",
      "  if (los.x > 0.5) {",
      "    visibleCount += 1;",
      "  }",
      "}",

      "void main() {",
      "  vec2 worldCentre = createCoordCentre(face.xy);",
      "  vec4 centre = projectionMatrix * viewMatrix * instanceMatrix * vec4(worldCentre, 0.0, 1.0);",
      "  vec2 uv = centre.xy * 0.5 + 0.5 + 0.25 * losStep;",
      "  int visibleCount = 0;",
      "  sampleLoS(uv, visibleCount);",
      "  sampleLoS(uv - 2.0 * losStep, visibleCount);",
      "  sampleLoS(uv + 2.0 * vec2(-losStep.x, losStep.y), visibleCount);",
      "  sampleLoS(uv + 2.0 * vec2(losStep.x, -losStep.y), visibleCount);",
      "  sampleLoS(uv + 2.0 * losStep, visibleCount);",
      "  float result = visibleCount == 0 ? fullyHidden :",
      "    visibleCount == 5 ? fullyVisible : mix(fullyHidden, fullyVisible, 0.5);",
      "  vertexColour = vec3(result, result, result);",
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
}

// Before and after drawing the scene these have been added to, call preRender() and
// postRender() to acquire the texture and fill in the uniforms.  (The texture can't
// stay acquired all the time because the LoS module needs to be able to render into
// it.)
export interface IGridLoSPreRenderParameters {
  fullyHidden: number;
  fullyVisible: number;
  losTarget: THREE.WebGLRenderTarget;
}

class GridLoSFeatureObject extends GridColouredFeatureObject<IGridCoord, IFeature<IGridCoord>> {
  private readonly _losStep = new THREE.Vector2();

  constructor(
    gridGeometry: IGridGeometry,
    maxInstances: number,
    createGeometry: () => THREE.InstancedBufferGeometry,
    tileOrigin: THREE.Vector2
  ) {
    super(
      coordString, (o, p) => gridGeometry.transformToCoord(o, p),
      gridGeometry, maxInstances, createGeometry, tileOrigin
    );
  }

  protected createMaterial() {
    const shader = createLoSShader(this.gridGeometry);
    const uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    const material = new THREE.ShaderMaterial({
      blending: THREE.MultiplyBlending,
      uniforms: uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });

    return [material, uniforms];
  }

  postRender() {
    this.uniforms['losTex'].value = null;
  }

  preRender(params: IGridLoSPreRenderParameters) {
    this.gridGeometry.populateShaderUniforms(this.uniforms);
    this.uniforms['fullyHidden'].value = params.fullyHidden;
    this.uniforms['fullyVisible'].value = params.fullyVisible;

    this._losStep.set(1.0 / params.losTarget.width, 1.0 / params.losTarget.height);
    this.uniforms['losStep'].value = this._losStep;
    this.uniforms['losTex'].value = params.losTarget.texture;
  }
}

class GridLoS extends InstancedFeatures<IGridCoord, IFeature<IGridCoord>> {
  postRender() {
    for (let o of this.featureObjects) {
      if (o instanceof GridLoSFeatureObject) {
        o.postRender();
      }
    }
  }

  preRender(params: IGridLoSPreRenderParameters) {
    for (let o of this.featureObjects) {
      if (o instanceof GridLoSFeatureObject) {
        o.preRender(params);
      }
    }
  }
}

function createGridAreaGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const createGeometry = createAreaGeometry(gridGeometry, alpha, z);
  const faceAttrs = gridGeometry.createFaceAttributes();
  return () => {
    const geometry = createGeometry();
    geometry.setAttribute('face', new THREE.BufferAttribute(faceAttrs, 3));
    return geometry;
  }
}

function createGridVertexGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const createGeometry = createVertexGeometry(gridGeometry, alpha, z);
  const vertexAttrs = gridGeometry.createVertexAttributes();
  return () => {
    const geometry = createGeometry();
    geometry.setAttribute('face', new THREE.BufferAttribute(vertexAttrs, 3));
    return geometry;
  }
}

function createGridColouredAreaObject(gridGeometry: IGridGeometry, z: number, tileOrigin: THREE.Vector2) {
  return (maxInstances: number) => new GridColouredFeatureObject<IGridCoord, IFeature<IGridCoord>>(
    coordString,
    (o, p) => gridGeometry.transformToCoord(o, p),
    gridGeometry,
    maxInstances,
    createGridAreaGeometry(gridGeometry, 1.0, z),
    tileOrigin
  );
}

function createGridColouredVertexObject(gridGeometry: IGridGeometry, alpha: number, z: number, tileOrigin: THREE.Vector2) {
  return (maxInstances: number) => new GridColouredFeatureObject<IGridVertex, IFeature<IGridVertex>>(
    vertexString,
    (o, p) => gridGeometry.transformToVertex(o, p),
    gridGeometry,
    maxInstances,
    createGridVertexGeometry(gridGeometry, alpha, z),
    tileOrigin
  );
}

function createGridLoSAreaObject(gridGeometry: IGridGeometry, z: number, tileOrigin: THREE.Vector2) {
  return (maxInstances: number) => new GridLoSFeatureObject(
    gridGeometry,
    maxInstances,
    createGridAreaGeometry(gridGeometry, 1.0, z),
    tileOrigin
  );
}

export class Grid extends Drawn {
  private readonly _textureClearColour = new THREE.Color(0, 0, 0);

  private readonly _faces: Areas;
  private readonly _vertices: Vertices;
  private readonly _losFaces: GridLoS;

  private readonly _tileOrigin = new THREE.Vector2(0, 0);

  private readonly _faceCoordScene: THREE.Scene;
  private readonly _vertexCoordScene: THREE.Scene;

  private readonly _faceCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _vertexCoordRenderTarget: THREE.WebGLRenderTarget;

  private readonly _faceCoordTargetReader: RenderTargetReader;
  private readonly _texelReadBuf = new Uint8Array(4);

  private readonly _temp: FeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

  private _isDisposed = false;

  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    gridZ: number,
    losZ: number,
    vertexAlpha: number,
    renderWidth: number,
    renderHeight: number
  ) {
    super(geometry, redrawFlag);

    this._faceCoordScene = new THREE.Scene();
    this._faceCoordRenderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping
    });

    // Texture of vertex co-ordinates within the tile.
    this._vertexCoordScene = new THREE.Scene();
    this._vertexCoordRenderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping
    });

    this._faces = createAreas(
      geometry,
      redrawFlag,
      createGridColouredAreaObject(geometry, gridZ, this._tileOrigin),
      100
    );
    this._faces.addToScene(this._faceCoordScene);

    this._vertices = createVertices(
      geometry,
      redrawFlag,
      createGridColouredVertexObject(geometry, vertexAlpha, gridZ, this._tileOrigin),
      100
    );
    this._vertices.addToScene(this._vertexCoordScene);

    // The LoS object may or may not be in a scene, so we'll expose separate methods
    // to add and remove it.
    this._losFaces = new GridLoS(
      geometry,
      redrawFlag,
      coordString,
      createGridLoSAreaObject(geometry, losZ, this._tileOrigin),
      100
    );

    this._temp = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);

    // We'll be wanting to sample the coord render target a lot in order to detect what grid to draw,
    // so we'll set up a reader
    this._faceCoordTargetReader = new RenderTargetReader(this._faceCoordRenderTarget);

    // We always start up with the middle of the grid by default:
    this.extendAcrossRange({ minS: -1, minT: -1, maxS: 1, maxT: 1 });
  }

  // We need to access this to feed it to the grid filter
  get faceCoordRenderTarget() { return this._faceCoordRenderTarget; }

  // Extends the grid across the given range of tiles.
  // Returns the number of new tiles added.
  private extendAcrossRange(bounds: IGridBounds) {
    let count = 0;
    for (let t = bounds.minT; t <= bounds.maxT; ++t) {
      for (let s = bounds.minS; s <= bounds.maxS; ++s) {
        let position = { x: s * this.geometry.tileDim, y: t * this.geometry.tileDim };
        if (this._faces.get(position) === undefined) {
          this._faces.add({ position: position, colour: 0 });
          ++count;
        }

        if (this._losFaces.get(position) === undefined) {
          this._losFaces.add({ position: position, colour: 0 });
        }

        let vertexPosition = { x: position.x, y: position.y, vertex: 0 };
        if (this._vertices.get(vertexPosition) === undefined) {
          this._vertices.add({ position: vertexPosition, colour: 0 });
        }
      }
    }

    // if (count > 0) {
    //   console.log("extended grid to " + fluent(this._faces).count() + " tiles");
    // }

    return count;
  }

  private extendGridAround(s: number, t: number) {
    // We extend the grid around the given tile until we added something,
    // effectively making it at most 1 tile bigger than it previously was.
    let countAdded = 0;
    for (let expand = 1; countAdded === 0; ++expand) {
      countAdded = this.extendAcrossRange({
        minS: s - expand,
        minT: t - expand,
        maxS: s + expand,
        maxT: t + expand
      });
    }

    return countAdded;
  }

  private *getGridSamples(width: number, height: number) {
    let cp = new THREE.Vector3(Math.floor(width * 0.5), Math.floor(height * 0.5), 0);
    yield this.getGridCoordAt(cp);

    cp.set(0, 0, 0);
    yield this.getGridCoordAt(cp);

    cp.set(width - 1, 0, 0);
    yield this.getGridCoordAt(cp);

    cp.set(width - 1, height - 1, 0);
    yield this.getGridCoordAt(cp);

    cp.set(0, height - 1, 0);
    yield this.getGridCoordAt(cp);
  }

  // Makes sure this range is filled and removes all tiles outside it.
  private shrinkToRange(bounds: IGridBounds) {
    const added = this.extendAcrossRange(bounds);

    // Fill the temp dictionary with entries for every tile we want to keep
    this._temp.clear();
    for (let t = bounds.minT; t <= bounds.maxT; ++t) {
      for (let s = bounds.minS; s <= bounds.maxS; ++s) {
        let position = { x: s * this.geometry.tileDim, y: t * this.geometry.tileDim };
        this._temp.add({ position: position, colour: 0 });
      }
    }

    // Remove everything outside the range.  Assume the faces and vertices are matching
    // (they should be!)
    const toDelete: IGridCoord[] = [];
    for (let face of this._faces) {
      if (this._temp.get(face.position) === undefined) {
        toDelete.push(face.position);
      }
    }

    toDelete.forEach(face => {
      this._faces.remove(face);
      this._losFaces.remove(face);
      this._vertices.remove({ x: face.x, y: face.y, vertex: 0 });
      this.setNeedsRedraw();
    });

    if (added !== 0 || toDelete.length !== 0) {
    //   console.log("shrunk grid to " + fluent(this._faces).count() + " tiles");
    }

    return added + toDelete.length;
  }

  private updateTileOrigin() {
    // We pick a tile origin in the middle of the tiles we're rendering to
    // maximise the limited amount of precision available to us in the
    // texture colours:
    let [tileCount, tileXSum, tileYSum] = [0, 0, 0];
    for (let t of this._faces) {
      ++tileCount;
      tileXSum += Math.floor(t.position.x / this.geometry.tileDim);
      tileYSum += Math.floor(t.position.y / this.geometry.tileDim);
    }

    if (tileCount !== 0) {
      this._tileOrigin.set(Math.round(tileXSum / tileCount), Math.round(tileYSum / tileCount));
      // console.log("Set tile origin to " + this._tileOrigin.toArray());
    }
  }

  addLoSToScene(scene: THREE.Scene) {
    return this._losFaces.addToScene(scene);
  }

  fitGridToFrame() {
    const width = this._faceCoordRenderTarget.width;
    const height = this._faceCoordRenderTarget.height;

    // Take our control samples, which will be in grid coords, and map them
    // back into tile coords
    const samples = [...fluent(this.getGridSamples(width, height)).map(c => c === undefined ? undefined : {
      x: Math.floor(c.x / this.geometry.tileDim),
      y: Math.floor(c.y / this.geometry.tileDim)
    })];

    const undefinedCount = fluent(samples).count(s => s === undefined);
    let countChanged = 0;
    if (undefinedCount === samples.length) {
      // This shouldn't happen unless we only just loaded the map.  Extend the grid around the origin.
      countChanged = this.extendGridAround(0, 0);
    } else if (undefinedCount > 0) {
      // We're missing grid in part of the view.  Extend the grid by one around the first
      // tile that we found in view -- this should, over the course of a couple of frames,
      // fill the whole view
      const coreTile = samples.find(s => s !== undefined);
      if (coreTile !== undefined) { // clearly :)
        countChanged = this.extendGridAround(coreTile.x, coreTile.y);
      }
    } else {
      // Reduce the amount of stuff we need to consider by removing any tiles outside this range.
      // (The 0 fallbacks here will never be used because of the if clause, and are here to
      // appease TypeScript)
      countChanged = this.shrinkToRange({
        minS: Math.min(...samples.map(s => s?.x ?? 0)),
        minT: Math.min(...samples.map(s => s?.y ?? 0)),
        maxS: Math.max(...samples.map(s => s?.x ?? 0)),
        maxT: Math.max(...samples.map(s => s?.y ?? 0))
      });
    }

    if (countChanged !== 0) {
      this.updateTileOrigin();
    }
  }

  getGridCoordAt(cp: THREE.Vector3): IGridCoord | undefined {
    return this._faceCoordTargetReader.sample(
      cp.x, cp.y,
      (buf, offset) => this.geometry.decodeCoordSample(buf, offset, this._tileOrigin)
    );
  }

  getGridVertexAt(renderer: THREE.WebGLRenderer, cp: THREE.Vector3): IGridVertex | undefined {
    // This is not done very often and only for one texel at a time, so we forego
    // pre-reading everything
    renderer.readRenderTargetPixels(this._vertexCoordRenderTarget, cp.x, cp.y, 1, 1, this._texelReadBuf);
    return this.geometry.decodeVertexSample(this._texelReadBuf, 0, this._tileOrigin);
  }

  // Call this after rendering the scene containing the LoS.
  postLoSRender() {
    this._losFaces.postRender();
  }

  // Call this before rendering the scene containing the LoS.
  preLoSRender(params: IGridLoSPreRenderParameters) {
    this._losFaces.preRender(params);
  }

  removeLoSFromScene() {
    this._losFaces.removeFromScene();
  }

  // Renders the face and vertex coords to their respective targets.
  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    renderer.setRenderTarget(this._faceCoordRenderTarget);
    renderer.setClearColor(this._textureClearColour);
    renderer.clear();
    renderer.render(this._faceCoordScene, camera);

    renderer.setRenderTarget(this._vertexCoordRenderTarget);
    renderer.clear();
    renderer.render(this._vertexCoordScene, camera);

    renderer.setRenderTarget(null);
    this._faceCoordTargetReader.refresh(renderer);
  }

  resize(width: number, height: number) {
    this._faceCoordRenderTarget.setSize(width, height);
    this._vertexCoordRenderTarget.setSize(width, height);
  }

  dispose() {
    if (this._isDisposed === false) {
      this._faceCoordRenderTarget.dispose();
      this._vertexCoordRenderTarget.dispose();

      this._faces.dispose();
      this._vertices.dispose();
      this._losFaces.dispose();
      this._isDisposed = true;
    }
  }
}