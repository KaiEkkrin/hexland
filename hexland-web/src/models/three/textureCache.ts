import { ITokenProperties } from '../../data/feature';
import { IImage } from '../../data/image';
import { ICacheLease, ISpriteManager, ISpritesheetEntry, IStorage } from '../../services/interfaces';
import { ICacheItem, ObjectCache } from '../../services/objectCache';

import { from, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

export class TextureCache {
  private readonly _spriteManager: ISpriteManager;
  private readonly _storage: IStorage;
  private readonly _textureCache: ObjectCache<THREE.Texture>;

  constructor(
    spriteManager: ISpriteManager,
    storage: IStorage,
    logError: (message: string, e: any) => void
  ) {
    this._spriteManager = spriteManager;
    this._storage = storage;
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

  resolve(token: ITokenProperties): Observable<ISpritesheetEntry & { texture: ICacheLease<THREE.Texture> }> {
    return this._spriteManager.lookupToken(token).pipe(switchMap(
      e => from(this._textureCache.resolve(e.url, this.resolveTexture)).pipe(
        map(t => ({ ...e, texture: t }))
      )
    ));
  }

  resolveImage(image: IImage): Observable<ICacheLease<THREE.Texture>> {
    return from(this._storage.ref(image.path).getDownloadURL()).pipe(switchMap(
      u => from(this._textureCache.resolve(u, this.resolveTexture))
    ));
  }

  resolveUrl(url: string): Observable<ICacheLease<THREE.Texture>> {
    return from(this._textureCache.resolve(url, this.resolveTexture));
  }

  dispose() {
    this._textureCache.dispose();
  }
}