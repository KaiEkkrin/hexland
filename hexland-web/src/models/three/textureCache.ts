import { IStorage } from '../../services/interfaces';
import { ICacheItem, ICacheLease, ObjectCache } from '../../services/objectCache';

import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

export class TextureCache {
  private readonly _objectCache: ObjectCache<THREE.Texture>;
  private readonly _storage: IStorage;

  constructor(
    storage: IStorage,
    logError: (message: string, e: any) => void
  ) {
    this._storage = storage;
    this._objectCache = new ObjectCache(logError);
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

  get(path: string): ICacheLease<THREE.Texture> | undefined {
    return this._objectCache.get(path);
  }

  resolve(path: string): Promise<ICacheLease<THREE.Texture>> {
    return this._objectCache.resolve(path, this.resolveTexture);
  }

  dispose() {
    this._objectCache.dispose();
  }
}