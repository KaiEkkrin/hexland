import { IGridCoord } from '../../data/coord';
import { IFeature, ITokenFaceProperties } from '../../data/feature';
import { InstancedFeatureObject } from './instancedFeatureObject';
import { RedrawFlag } from '../redrawFlag';
import { ITokenUvTransform } from './uv';

import * as THREE from 'three';

const spriteShader = {
  uniforms: {
    "spriteTex": { value: null }
  },
  vertexShader: [
    "attribute vec2 instanceUvScale;", // per-instance UV scaling
    "attribute vec2 instanceUvTranslate;", // per-instance UV translation
    "varying vec2 myUv;", // calculated UV

    "void main() {",
    "  gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);",
    "  myUv = uv * instanceUvScale + instanceUvTranslate;",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D spriteTex;",
    "varying vec2 myUv;",
    "void main() {",
    "  gl_FragColor = texture2D(spriteTex, myUv);",
    "}"
  ].join("\n")
};

const textureLoader = new THREE.TextureLoader();

export class SpriteFeatureObject<K extends IGridCoord, F extends (IFeature<K> & ITokenFaceProperties)> extends InstancedFeatureObject<K, F> {
  private readonly _geometry: THREE.InstancedBufferGeometry;
  private readonly _redrawFlag: RedrawFlag;
  private readonly _uvTransform: ITokenUvTransform;

  private readonly _instanceUvScale: Float32Array;
  private readonly _instanceUvTranslate: Float32Array;
  private readonly _instanceUvScaleAttr: THREE.InstancedBufferAttribute;
  private readonly _instanceUvTranslateAttr: THREE.InstancedBufferAttribute;

  private readonly _texture: THREE.Texture;
  private readonly _material: THREE.ShaderMaterial;
  private readonly _uniforms: any;

  constructor(
    toIndex: (k: K) => string,
    transformTo: (o: THREE.Object3D, position: K) => void,
    maxInstances: number,
    createGeometry: () => THREE.InstancedBufferGeometry,
    redrawFlag: RedrawFlag,
    spritesheetUrl: string,
    uvTransform: ITokenUvTransform
  ) {
    super(toIndex, transformTo, maxInstances);
    this._geometry = createGeometry();
    this._redrawFlag = redrawFlag;
    this._uvTransform = uvTransform;

    this._instanceUvScale = new Float32Array(maxInstances * 2);
    this._instanceUvTranslate = new Float32Array(maxInstances * 2);

    this._instanceUvScaleAttr = new THREE.InstancedBufferAttribute(this._instanceUvScale, 2);
    this._instanceUvScaleAttr.setUsage(THREE.DynamicDrawUsage);
    this._geometry.setAttribute('instanceUvScale', this._instanceUvScaleAttr);

    this._instanceUvTranslateAttr = new THREE.InstancedBufferAttribute(this._instanceUvTranslate, 2);
    this._instanceUvTranslateAttr.setUsage(THREE.DynamicDrawUsage);
    this._geometry.setAttribute('instanceUvTranslate', this._instanceUvTranslateAttr);

    // TODO #149 Pull this out into some form of texture cache?  (so that it can be shared with
    // other feature objects for token fill vertex and fill edge geometries?)  Will THREE.js do
    // that for me anyway (I hope so?)
    this._texture = textureLoader.load(spritesheetUrl,
      () => {
        console.log("texture loaded : " + spritesheetUrl);
        this._redrawFlag.setNeedsRedraw();
      },
      () => {},
      // TODO #149 Can I smuggle analytics in here, or move this elsewhere to get a better error?
      e => console.error(`failed to load texture from ${spritesheetUrl} : ${e}`));

    this._uniforms = THREE.UniformsUtils.clone(spriteShader.uniforms);
    this._material = new THREE.ShaderMaterial({
      blending: THREE.NormalBlending,
      transparent: true,
      uniforms: this._uniforms,
      vertexShader: spriteShader.vertexShader,
      fragmentShader: spriteShader.fragmentShader
    });

    this._uniforms['spriteTex'].value = this._texture;
  }

  protected createMesh(maxInstances: number): THREE.InstancedMesh {
    return new THREE.InstancedMesh(this._geometry, this._material, maxInstances);
  }

  protected addFeature(f: F, instanceIndex: number) {
    super.addFeature(f, instanceIndex);

    if (f.sprites.length > 0) { // likely :)
      const columns = f.sprites[0].columns;
      const rows = f.sprites[0].rows;

      const scaleX = 1.0 / columns;
      const scaleY = 1.0 / rows;

      const x = (f.sprites[0].position % columns);
      const y = Math.floor(f.sprites[0].position / columns);

      const faceTransform = this._uvTransform.getFaceTransform(f);
      if (faceTransform === undefined) {
        return;
      }

      // console.log(`received uv transform: offset ${faceTransform.offset.toArray()}, scale ${faceTransform.scale}`);

      this._instanceUvScale[2 * instanceIndex] = scaleX * faceTransform.scale;
      this._instanceUvScale[2 * instanceIndex + 1] = -scaleY * faceTransform.scale;
      this._instanceUvTranslate[2 * instanceIndex] = x * scaleX + faceTransform.offset.x * scaleX;
      this._instanceUvTranslate[2 * instanceIndex + 1] = 1 - (y * scaleY + faceTransform.offset.y * scaleY);

      this._instanceUvScaleAttr.needsUpdate = true;
      this._instanceUvTranslateAttr.needsUpdate = true;
    }
  }

  dispose() {
    super.dispose();
    this._geometry.dispose();
    this._material.dispose();
    this._texture.dispose();
  }
}