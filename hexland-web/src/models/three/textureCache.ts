import { getSpritePathFromId, ISprite, ISpritesheet } from '../../data/sprite';
import { ICacheLease, IDataAndReference, ISpritesheetCache, IStorage } from '../../services/interfaces';
import { ICacheItem, ObjectCache } from '../../services/objectCache';

import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

export interface ITextureLease {
  ss: IDataAndReference<ISpritesheet>;
  tex: THREE.Texture;
  release: () => Promise<void>;
}

function combineLeases(
  ssLease: ICacheLease<IDataAndReference<ISpritesheet>>,
  texLease: ICacheLease<THREE.Texture>
): ITextureLease {
  return {
    ss: ssLease.value,
    tex: texLease.value,
    release: async () => {
      await texLease.release();
      await ssLease.release();
    }
  };
}

export class TextureCache {
  private readonly _spritesheetCache: ISpritesheetCache;
  private readonly _textureCache: ObjectCache<THREE.Texture>;

  private readonly _storage: IStorage;
  private readonly _logError: (message: string, e: any) => void;

  constructor(
    spritesheetCache: ISpritesheetCache,
    storage: IStorage,
    logError: (message: string, e: any) => void
  ) {
    this._spritesheetCache = spritesheetCache;
    this._storage = storage;
    this._logError = logError;

    this._textureCache = new ObjectCache(logError);
    this.resolveTexture = this.resolveTexture.bind(this);
  }

  private async resolveTexture(path: string): Promise<ICacheItem<THREE.Texture>> {
    // Get the path's URL
    const url = await this._storage.ref(path).getDownloadURL();

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

  get(spriteKey: string): ITextureLease | undefined {
    try {
      const ss = this._spritesheetCache.get(spriteKey);
      if (ss === undefined) {
        return undefined;
      }

      const tex = this._textureCache.get(getSpritePathFromId(ss.value.id));
      if (tex === undefined) {
        return undefined;
      }

      return combineLeases(ss, tex);
    } catch (e) {
      this._logError("Failed to get sprite", e);
      return undefined;
    }
  }

  async resolve(sprite: ISprite): Promise<ITextureLease> {
    try {
      const ss = await this._spritesheetCache.resolve(sprite);
      const tex = await this._textureCache.resolve(getSpritePathFromId(ss.value.id), this.resolveTexture);
      return combineLeases(ss, tex);
    } catch (e) {
      this._logError("Failed to resolve sprite", e);
      throw e;
    }
  }

  dispose() {
    this._textureCache.dispose();
    this._spritesheetCache.dispose();
  }
}