import { IGridCoord } from '../../data/coord';
import { IFeature, ITokenFaceProperties } from '../../data/feature';
import { InstancedFeatureObject } from './instancedFeatureObject';
import { fromMatrix4Columns, InstanceMatrix3Column } from './instanceMatrix';
import { RedrawFlag } from '../redrawFlag';
import { ITokenUvTransform } from './uv';

import * as THREE from 'three';

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

const textureLoader = new THREE.TextureLoader();

export class SpriteFeatureObject<K extends IGridCoord, F extends (IFeature<K> & ITokenFaceProperties)> extends InstancedFeatureObject<K, F> {
  private readonly _geometry: THREE.InstancedBufferGeometry;
  private readonly _redrawFlag: RedrawFlag;
  private readonly _uvTransform: ITokenUvTransform;

  private readonly _instanceUvColumns: InstanceMatrix3Column[] = [];

  private readonly _texture: THREE.Texture;
  private readonly _material: THREE.ShaderMaterial;
  private readonly _uniforms: any;

  private readonly _scratchMatrix1 = new THREE.Matrix4();
  private readonly _scratchMatrix2 = new THREE.Matrix4();

  constructor(
    toIndex: (k: K) => string,
    transformTo: (m: THREE.Matrix4, position: K) => THREE.Matrix4,
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

    for (let i = 0; i < 3; ++i) {
      const col = new InstanceMatrix3Column(maxInstances);
      this._geometry.setAttribute(`instanceUv${i}`, col.attr);
      this._instanceUvColumns.push(col);
    }

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

      // TODO #149 Debugging the matrix version.
      const translation = this._scratchMatrix1.makeTranslation(
        x * scaleX, 1 - (y * scaleY), 0
      );
      const scaling = this._scratchMatrix2.makeScale(scaleX, -scaleY, 1);
      const transform = translation.multiply(scaling).multiply(faceTransform.transform);

      fromMatrix4Columns(this._instanceUvColumns, transform, instanceIndex);

      const uvScaleX = scaleX * faceTransform.scale;
      const uvScaleY = -scaleY * faceTransform.scale;
      const uvTranslateX = x * scaleX + faceTransform.offset.x * scaleX;
      const uvTranslateY = 1 - (y * scaleY + faceTransform.offset.y * scaleY);

      faceTransform.testVertices.forEach((v, i) => {
        const xy = v.clone().applyMatrix4(faceTransform.testTransform);
        const uv = v.clone().applyMatrix4(transform);
        console.log(`sprite mat: ${xy.toArray()} -> ${uv.toArray()}`);
        
        const sc = new THREE.Vector2(faceTransform.testBuvs[2 * i], faceTransform.testBuvs[2 * i + 1])
          .multiply(new THREE.Vector2(
            uvScaleX,
            uvScaleY
          )).add(new THREE.Vector2(
            uvTranslateX,
            uvTranslateY
          ));
        console.log(`sprite sc : ${xy.toArray()} -> ${sc.toArray()}`);
      });

      // this._instanceUvScaleAttr.needsUpdate = true;
      // this._instanceUvTranslateAttr.needsUpdate = true;
    }
  }

  dispose() {
    super.dispose();
    this._geometry.dispose();
    this._material.dispose();
    this._texture.dispose();
  }
}