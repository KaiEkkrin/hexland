import { IDownloadUrlCache } from '../../services/interfaces';

import { ReplaySubject } from 'rxjs';
import { first } from 'rxjs/operators';
import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

interface IReferencedTexture {
  texture: THREE.Texture;
  refCount: number;
}

// The texture cache provides itself as a download URL cache so that we can pre-load
// textures for sprites and only make the URL available when the sprite is really ready :)
export class TextureCache implements IDownloadUrlCache {
  private readonly _urlCache: IDownloadUrlCache;

  // In-flight texture requests by URL.  These only complete when the texture is fully loaded.
  private readonly _inFlight = new Map<string, ReplaySubject<IReferencedTexture>>();

  // We add the referenced textures to this map too so they can be looked up synchronously.
  private readonly _resolved = new Map<string, IReferencedTexture>();

  constructor(urlCache: IDownloadUrlCache) {
    this._urlCache = urlCache;
  }

  private requestTexture(url: string): Promise<IReferencedTexture> {
    // If we've got an in-flight query, return that
    const already = this._inFlight.get(url);
    if (already !== undefined) {
      return already.pipe(first()).toPromise();
    }

    // Otherwise, create and add a new query
    const fresh = new ReplaySubject<IReferencedTexture>(1);
    textureLoader.load(url,
      t => {
        console.log(`texture loaded : ${url}`);
        const rt = { texture: t, refCount: 0 };
        this._resolved.set(url, rt);
        fresh.next(rt);
      },
      () => {},
      (e: any) => this.logError(`failed to load texture from ${url}`, e)
    );
    this._inFlight.set(url, fresh);
    return fresh.pipe(first()).toPromise();
  }

  // Borrows the texture at this URL, assuming you referenced it already.
  borrow(url: string): THREE.Texture {
    const found = this._resolved.get(url);
    if (found === undefined) {
      throw RangeError(`${url} not found in resolved map`);
    }

    return found.texture;
  }

  logError(message: string, e: any) {
    this._urlCache.logError(message, e);
  }

  async resolve(path: string): Promise<string> {
    const url = await this._urlCache.resolve(path);

    // See if we've got a texture for this already
    const completed = this._resolved.get(url);
    if (completed !== undefined) {
      ++completed.refCount;
      return url;
    }

    // If not, query for it
    const r = await this.requestTexture(url);
    ++r.refCount;
    return url;
  }

  release(url: string) {
    this._urlCache.release(url);
    const r = this._resolved.get(url);
    if (r === undefined) {
      // This shouldn't happen, because `resolve` above won't release the URL until
      // it's in this map
      return;
    }

    if (--r.refCount === 0) {
      console.log(`texture unloaded: ${url}`);
      this._resolved.delete(url);
      r.texture.dispose();
    }
  }

  dispose() {
    this._resolved.forEach(r => r.texture.dispose());
    this._resolved.clear();
  }
}