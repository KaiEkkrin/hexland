import { coordString, GridCoord } from '../../data/coord';
import { IFeature, IPlayerAreaDictionary, PlayerArea, Striped } from '../../data/feature';
import { IGridGeometry } from '../gridGeometry';
import { RedrawFlag } from '../redrawFlag';
import { createAreaGeometry } from './areas';
import { InstancedFeatures } from './instancedFeatures';
import { IColourParameters, PaletteColouredFeatureObject } from './paletteColouredFeatureObject';
import { IShader, ShaderFilter } from './shaderFilter';

import fluent from 'fluent-iterable';
import * as THREE from 'three';

// This is like the paletteColouredFeatureObject but implements a stripey pattern.
// To stack correctly with other things (especially other areas) the striped feature
// objects should be rendered to a texture which is then painted on translucently
// after the areas have been done...

const instanceStripedShader = {
  uniforms: {
    "patternSize": { type: 'f', value: null }
  },
  vertexShader: `
    attribute vec3 instanceColour;
    varying vec3 vertexColour;
    void main() {
      vertexColour = instanceColour;
      gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    attribute vec2 patternContrib;
    varying vec3 vertexColour;
    uniform float patternSize;
    void main() {
      float pat = gl_FragCoord.x * patternContrib.x + gl_FragCoord.y * patternContrib.y;
      gl_FragColor = fmod(pat, patternSize) < 0.0 ?
        vec4(vertexColour, 1.0) : vec4(0.0, 0.0, 0.0, 0.0);
    }
  `
};

export interface IStripedParameters extends IColourParameters {
  alpha: number;
  patternSize: number;
  z: number;
}

export class PaletteStripedFeatureObject<K extends GridCoord, F extends IFeature<K> & Striped> extends PaletteColouredFeatureObject<K, F> {
  private readonly _patternContrib: Float32Array;
  private readonly _patternContribAttr: THREE.InstancedBufferAttribute;

  constructor(
    toIndex: (k: K) => string,
    transformTo: (m: THREE.Matrix4, position: K) => THREE.Matrix4,
    maxInstances: number,
    createGeometry: () => THREE.InstancedBufferGeometry,
    stripedParameters: IStripedParameters
  ) {
    super(toIndex, transformTo, maxInstances, createGeometry, stripedParameters, instanceStripedShader);
    
    this._patternContrib = new Float32Array(maxInstances * 2);
    this._patternContribAttr = new THREE.InstancedBufferAttribute(this._patternContrib, 2);
    this._patternContribAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('patternContrib', this._patternContribAttr);

    this.uniforms['patternSize'].value = stripedParameters.patternSize;
  }

  protected addFeature(f: F) {
    const instanceIndex = super.addFeature(f);
    if (instanceIndex === undefined) {
      return undefined;
    }

    // TODO #197 Will I need to multiply these by factors of the viewport resolution?
    switch (f.stripe) {
      case 0: // horizontal
        this._patternContrib[2 * instanceIndex] = 0;
        this._patternContrib[2 * instanceIndex + 1] = 1;
        break;

      case 1: // diagonal A
        this._patternContrib[2 * instanceIndex] = 1;
        this._patternContrib[2 * instanceIndex + 1] = 1;
        break;

      case 2: // vertical
        this._patternContrib[2 * instanceIndex] = 1;
        this._patternContrib[2 * instanceIndex + 1] = 0;
        break;

      default: // diagonal B
        this._patternContrib[2 * instanceIndex] = 1;
        this._patternContrib[2 * instanceIndex + 1] = -1;
        break;
    }

    this._patternContribAttr.needsUpdate = true;
    return instanceIndex;
  }
}

// This filter paints areas from an area texture (drawn with the above), multiplying by
// a supplied alpha
const areaFilterShader: IShader = {
  uniforms: {
    "alpha": { type: 'float', value: null },
    "step": { type: 'v2', value: null },
    "tex": { value: null }
  },
  vertexShader: `
    uniform vec2 step;
    varying vec2 texUv;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      texUv = position.xy * 0.5 + 0.5 + 0.25 * step;
    }
  `,
  fragmentShader: `
    uniform float alpha;
    uniform sampler2D tex;
    varying vec2 texUv;

    void main() {
      vec4 here = texture2D(tex, texUv);
      gl_FragColor = vec4(here.xyz, min(here.w, alpha));
    }
  `
};

export class AreaFilter extends ShaderFilter {
  private readonly _step = new THREE.Vector2();

  constructor(z: number, alpha: number) {
    super(z, {
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      transparent: true,
      ...areaFilterShader
    });
    this.uniforms['alpha'].value = alpha;
    this.uniforms['step'].value = this._step;
  }

  postRender() {
    this.uniforms['tex'].value = null;
  }

  preRender(target: THREE.WebGLRenderTarget) {
    this._step.set(1.0 / target.width, 1.0 / target.height);
    this.uniforms['tex'].value = target.texture;
  }
}

// This dictionary maintains a render target for the stripiness (above) and adds the
// filter to the given scene.
export class StripedAreas implements IPlayerAreaDictionary {
  private readonly _clearColour = new THREE.Color(0, 0, 0);

  // The features go here
  private readonly _features: InstancedFeatures<GridCoord, PlayerArea>;

  // We maintain our own scene for rendering into the texture
  private readonly _featureScene: THREE.Scene;
  private readonly _featureTarget: THREE.WebGLRenderTarget;
  private readonly _areaFilter: AreaFilter;

  private _doRender = false; // we set this to true if there's anything to show :)

  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    renderWidth: number,
    renderHeight: number,
    scene: THREE.Scene,
    stripedParameters: IStripedParameters,
    maxInstances?: number | undefined
  ) {
    this._features = new InstancedFeatures<GridCoord, PlayerArea>(
      geometry,
      redrawFlag,
      coordString,
      (maxInstances: number) => new PaletteStripedFeatureObject(
        coordString,
        (o, p) => geometry.transformToCoord(o, p),
        maxInstances,
        createAreaGeometry(geometry.toSingle(), 1.0, stripedParameters.z),
        stripedParameters
      ),
      maxInstances
    );

    this._featureScene = new THREE.Scene();
    this._featureTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      depthBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping
    });
    this._features.addToScene(this._featureScene);

    this._areaFilter = new AreaFilter(stripedParameters.z, stripedParameters.alpha);
    this._areaFilter.addToScene(scene);
  }

  // Renders the areas to the texture (if need be.)
  render(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this._areaFilter.postRender();

    renderer.setRenderTarget(this._featureTarget);
    renderer.setClearColor(this._clearColour, 0.0);
    renderer.clear();
    if (this._doRender) {
      renderer.render(this._featureScene, camera);
    }

    renderer.setRenderTarget(null);
    this._areaFilter.preRender(this._featureTarget);
  }

  resize(width: number, height: number) {
    this._featureTarget.setSize(width, height);
  }

  [Symbol.iterator](): Iterator<IFeature<GridCoord> & Striped> {
    return this.iterate();
  }

  add(f: IFeature<GridCoord> & Striped): boolean {
    const done = this._features.add(f);
    if (done) {
      this._doRender = true;
    }

    return done;
  }

  clear() {
    this._features.clear();
    this._doRender = false;
  }

  clone() {
    return this._features.clone();
  }
  
  forEach(fn: (f: IFeature<GridCoord> & Striped) => void) {
    this._features.forEach(fn);
  }

  get(position: GridCoord) {
    return this._features.get(position);
  }

  iterate() {
    return this._features.iterate();
  }

  remove(oldPosition: GridCoord) {
    const feature = this._features.remove(oldPosition);
    if (!fluent(this._features).any()) {
      this._doRender = false;
    }

    return feature;
  }

  dispose() {
    this._areaFilter.dispose();
    this._features.dispose();
    this._featureScene.dispose();
    this._featureTarget.dispose();
  }
}