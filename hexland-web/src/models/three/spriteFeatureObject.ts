import { IGridCoord } from '../../data/coord';
import { IFeature, ITokenProperties } from '../../data/feature';
import { InstancedFeatureObject } from './instancedFeatureObject';
import { fromMatrix4Columns, InstanceMatrix3Column } from './instanceMatrix';
import { ITextureLease, TextureCache } from './textureCache';

import * as THREE from 'three';
import { fromSpriteGeometryString } from '../../data/sprite';

const spriteShader = {
  uniforms: {
    "spriteTex": { value: null }
  },
  vertexShader: [
    "attribute vec3 instanceUv0;",
    "attribute vec3 instanceUv1;",
    "attribute vec3 instanceUv2;",
    "varying vec2 myUv;", // calculated UV

    "void main() {",
    "  gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);",
    "  mat3 uvTransform = mat3(instanceUv0, instanceUv1, instanceUv2);",
    "  myUv = (uvTransform * vec3(position.xy, 1.0)).xy;",
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

export class SpriteFeatureObject<
  K extends IGridCoord,
  F extends (IFeature<K> & ITokenProperties & { basePosition: IGridCoord })
> extends InstancedFeatureObject<K, F> {
  private readonly _geometry: THREE.InstancedBufferGeometry;
  private readonly _getUvTransform: (feature: F) => THREE.Matrix4 | undefined;

  private readonly _instanceUvColumns: InstanceMatrix3Column[] = [];

  private readonly _texture: ITextureLease | undefined;
  private readonly _material: THREE.ShaderMaterial;
  private readonly _uniforms: any;

  private readonly _scratchMatrix1 = new THREE.Matrix4();
  private readonly _scratchMatrix2 = new THREE.Matrix4();

  constructor(
    textureCache: TextureCache,
    toIndex: (k: K) => string,
    transformTo: (m: THREE.Matrix4, position: K) => THREE.Matrix4,
    maxInstances: number,
    createGeometry: () => THREE.InstancedBufferGeometry,
    getUvTransform: (feature: F) => THREE.Matrix4 | undefined,
    spriteKey: string
  ) {
    super(toIndex, transformTo, maxInstances);
    this._geometry = createGeometry();
    this._getUvTransform = getUvTransform;

    for (let i = 0; i < 3; ++i) {
      const col = new InstanceMatrix3Column(maxInstances);
      this._geometry.setAttribute(`instanceUv${i}`, col.attr);
      this._instanceUvColumns.push(col);
    }

    this._uniforms = THREE.UniformsUtils.clone(spriteShader.uniforms);
    this._material = new THREE.ShaderMaterial({
      blending: THREE.NormalBlending,
      transparent: true,
      uniforms: this._uniforms,
      vertexShader: spriteShader.vertexShader,
      fragmentShader: spriteShader.fragmentShader
    });

    this._texture = textureCache.get(spriteKey);
    console.log(`resolved sprite feature ${spriteKey} as ${this._texture}`);
    this._uniforms['spriteTex'].value = this._texture?.tex;
  }

  protected createMesh(maxInstances: number): THREE.InstancedMesh {
    return new THREE.InstancedMesh(this._geometry, this._material, maxInstances);
  }

  protected addFeature(f: F, instanceIndex: number) {
    super.addFeature(f, instanceIndex);

    if (f.sprites[0] !== undefined && this._texture !== undefined) {
      const position = this._texture.ss.data.sprites.indexOf(f.sprites[0].source);
      if (position < 0) {
        return;
      }

      const { columns, rows } = fromSpriteGeometryString(this._texture.ss.data.geometry);
      const scaleX = 1.0 / columns;
      const scaleY = 1.0 / rows;

      const x = (position % columns);
      const y = Math.floor(position / columns);

      const baseTransform = this._getUvTransform(f);
      if (baseTransform === undefined) {
        return;
      }

      const translation = this._scratchMatrix1.makeTranslation(
        x * scaleX, 1 - (y * scaleY), 0
      );
      const scaling = this._scratchMatrix2.makeScale(scaleX, -scaleY, 1);
      const transform = translation.multiply(scaling).multiply(baseTransform);
      fromMatrix4Columns(this._instanceUvColumns, transform, instanceIndex);

      // const uvScaleX = scaleX * baseTransform.scale;
      // const uvScaleY = -scaleY * baseTransform.scale;
      // const uvTranslateX = x * scaleX + baseTransform.offset.x * scaleX;
      // const uvTranslateY = 1 - (y * scaleY + baseTransform.offset.y * scaleY);

      // baseTransform.testVertices?.forEach((v, i) => {
      //   if (baseTransform.testTransform === undefined || baseTransform.testBuvs === undefined) {
      //     return;
      //   }

      //   const xy = v.clone().applyMatrix4(baseTransform.testTransform);
      //   const uv = v.clone().applyMatrix4(transform);
      //   console.log(`sprite mat: ${xy.toArray()} -> ${uv.toArray()}`);
        
      //   const sc = new THREE.Vector2(baseTransform.testBuvs[2 * i], baseTransform.testBuvs[2 * i + 1])
      //     .multiply(new THREE.Vector2(
      //       uvScaleX,
      //       uvScaleY
      //     )).add(new THREE.Vector2(
      //       uvTranslateX,
      //       uvTranslateY
      //     ));
      //   console.log(`sprite sc : ${xy.toArray()} -> ${sc.toArray()}`);
      // });
    }
  }

  dispose() {
    super.dispose();
    this._geometry.dispose();
    this._material.dispose();
    this._texture?.release().then();
  }
}