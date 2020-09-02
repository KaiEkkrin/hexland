import { IGridCoord, coordString, IGridVertex, vertexString } from '../../data/coord';
import { IFeature, FeatureDictionary } from '../../data/feature';
import { createAreaGeometry, Areas, createAreas } from './areas';
import { Drawn } from '../drawn';
import { IGridGeometry } from '../gridGeometry';
import { InstancedFeatureObject } from './instancedFeatureObject';
import { InstancedFeatures } from './instancedFeatures';
import { IGridBounds } from '../interfaces';
import { RedrawFlag } from '../redrawFlag';
import { createVertexGeometry, Vertices, createVertices } from './vertices';

import * as THREE from 'three';
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
const gridColouredShader = {
  uniforms: {
    epsilon: { type: 'f', value: null },
    maxEdge: { type: 'f', value: null },
    tileDim: { type: 'f', value: null },
  },
  vertexShader: [
    "uniform float epsilon;",
    "uniform float maxEdge;",
    "uniform float tileDim;",
    "attribute vec3 face;", // per-vertex; z is the edge or vertex number
    "attribute vec2 tile;", // per-instance
    "varying vec3 vertexColour;", // packed colour

    "float packXYAbs(const in vec2 c) {",
    "  return epsilon + (abs(c.y) * tileDim + abs(c.x)) / (tileDim * tileDim);",
    "}",

    "float packXYSignAndEdge(const in vec2 c, const in float edge) {",
    "  float packed = (",
    "    (c.x < 0.0 ? 1.0 : 0.0) +",
    "    (c.y < 0.0 ? 2.0 : 0.0) +",
    "    4.0 * edge +",
    "    4.0 * maxEdge",
    "  );",
    "  return epsilon + packed / (8.0 * maxEdge);",
    "}",

    "void main() {",
    "  vertexColour = vec3(",
    "    packXYAbs(tile),",
    "    packXYSignAndEdge(tile, face.z),",
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

  private _uniforms: any = null;
  private _material: THREE.ShaderMaterial | undefined; // created when required

  constructor(
    toIndex: (k: K) => string,
    transformTo: (o: THREE.Object3D, position: K) => void,
    gridGeometry: IGridGeometry,
    maxInstances: number,
    createGeometry: () => THREE.InstancedBufferGeometry
  ) {
    super(toIndex, transformTo, maxInstances);
    this._gridGeometry = gridGeometry;
    this._geometry = createGeometry();

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
  ) {
    super(
      coordString, (o, p) => gridGeometry.transformToCoord(o, p),
      gridGeometry, maxInstances, createGeometry
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
    for (var o of this.featureObjects) {
      if (o instanceof GridLoSFeatureObject) {
        o.postRender();
      }
    }
  }

  preRender(params: IGridLoSPreRenderParameters) {
    for (var o of this.featureObjects) {
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

function createGridColouredAreaObject(gridGeometry: IGridGeometry, z: number) {
  return (maxInstances: number) => new GridColouredFeatureObject<IGridCoord, IFeature<IGridCoord>>(
    coordString,
    (o, p) => gridGeometry.transformToCoord(o, p),
    gridGeometry,
    maxInstances,
    createGridAreaGeometry(gridGeometry, 1.0, z)
  );
}

function createGridColouredVertexObject(gridGeometry: IGridGeometry, alpha: number, z: number) {
  return (maxInstances: number) => new GridColouredFeatureObject<IGridVertex, IFeature<IGridVertex>>(
    vertexString,
    (o, p) => gridGeometry.transformToVertex(o, p),
    gridGeometry,
    maxInstances,
    createGridVertexGeometry(gridGeometry, alpha, z)
  );
}

function createGridLoSAreaObject(gridGeometry: IGridGeometry, z: number) {
  return (maxInstances: number) => new GridLoSFeatureObject(
    gridGeometry,
    maxInstances,
    createGridAreaGeometry(gridGeometry, 1.0, z)
  );
}

export class Grid extends Drawn {
  private readonly _faces: Areas;
  private readonly _vertices: Vertices;
  private readonly _losFaces: GridLoS;

  private readonly _temp: FeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

  private _isDisposed = false;

  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    gridZ: number,
    losZ: number,
    vertexAlpha: number,
    coordScene: THREE.Scene,
    vertexScene: THREE.Scene
  ) {
    super(geometry, redrawFlag);

    this._faces = createAreas(
      geometry,
      redrawFlag,
      createGridColouredAreaObject(geometry, gridZ),
      100
    );
    this._faces.addToScene(coordScene);

    this._vertices = createVertices(
      geometry,
      redrawFlag,
      createGridColouredVertexObject(geometry, vertexAlpha, gridZ),
      100
    );
    this._vertices.addToScene(vertexScene);

    // The LoS object may or may not be in a scene, so we'll expose separate methods
    // to add and remove it.
    this._losFaces = new GridLoS(
      geometry,
      redrawFlag,
      coordString,
      createGridLoSAreaObject(geometry, losZ),
      100
    );

    this._temp = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  }

  addLoSToScene(scene: THREE.Scene) {
    return this._losFaces.addToScene(scene);
  }

  // Extends the grid across the given range of tiles.
  // Returns the number of new tiles added.
  extendAcrossRange(bounds: IGridBounds) {
    var count = 0;
    for (var t = bounds.minT; t <= bounds.maxT; ++t) {
      for (var s = bounds.minS; s <= bounds.maxS; ++s) {
        var position = { x: s * this.geometry.tileDim, y: t * this.geometry.tileDim };
        if (this._faces.get(position) === undefined) {
          this._faces.add({ position: position, colour: 0 });
          ++count;
        }

        if (this._losFaces.get(position) === undefined) {
          this._losFaces.add({ position: position, colour: 0 });
        }

        var vertexPosition = { x: position.x, y: position.y, vertex: 0 };
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

  // Makes sure this range is filled and removes all tiles outside it.
  shrinkToRange(bounds: IGridBounds) {
    const added = this.extendAcrossRange(bounds);

    // Fill the temp dictionary with entries for every tile we want to keep
    this._temp.clear();
    for (var t = bounds.minT; t <= bounds.maxT; ++t) {
      for (var s = bounds.minS; s <= bounds.maxS; ++s) {
        var position = { x: s * this.geometry.tileDim, y: t * this.geometry.tileDim };
        this._temp.add({ position: position, colour: 0 });
      }
    }

    // Remove everything outside the range.  Assume the faces and vertices are matching
    // (they should be!)
    const toDelete: IGridCoord[] = [];
    for (var face of this._faces) {
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
  }

  dispose() {
    if (this._isDisposed === false) {
      this._faces.dispose();
      this._vertices.dispose();
      this._losFaces.dispose();
      this._isDisposed = true;
    }
  }
}