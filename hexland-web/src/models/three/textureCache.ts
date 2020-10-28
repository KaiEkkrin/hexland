import { ISprite } from '../../data/sprite';
import { ICacheLease, ISpriteManager, ISpritesheetEntry } from '../../services/interfaces';
import { ICacheItem, ObjectCache } from '../../services/objectCache';

import { from, Observable } from 'rxjs';
import { first, map, switchMap } from 'rxjs/operators';
import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

export class TextureCache {
  private readonly _spriteManager: ISpriteManager;
  private readonly _textureCache: ObjectCache<THREE.Texture>;

  constructor(
    spriteManager: ISpriteManager,
    logError: (message: string, e: any) => void
  ) {
    this._spriteManager = spriteManager;
    this._textureCache = new ObjectCache(logError);
    this.resolveTexture = this.resolveTexture.bind(this);
  }

  private async resolveTexture(url: string): Promise<ICacheItem<THREE.Texture>> {
    // Load the texture, waiting for it to be fully available before returning
    // (I get visual glitches if I don't)
    return await new Promise((resolve, reject) => {
      textureLoader.load(url, t => {
        console.log(`texture loaded from ${url}`);
        resolve({
          value: t,
          cleanup: () => {
            console.log(`disposing texture from ${url}`);
            t.dispose();
          }
        });
      }, () => {}, reject);
    });
  }

  get(url: string): ICacheLease<THREE.Texture> | undefined {
    return this._textureCache.get(url);
  }

  resolve(sprite: ISprite): Observable<ISpritesheetEntry & { texture: ICacheLease<THREE.Texture> }> {
    return this._spriteManager.lookup(sprite).pipe(switchMap(
      e => from(this._textureCache.resolve(e.url, this.resolveTexture)).pipe(
        map(t => ({ ...e, texture: t }))
      )
    ), first());
  }

  resolveUrl(url: string): Observable<ICacheLease<THREE.Texture>> {
    return from(this._textureCache.resolve(url, this.resolveTexture));
  }

  dispose() {
    this._textureCache.dispose();
  }
}