import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

interface IReferencedTexture {
  texture: THREE.Texture;
  refCount: number;
}

export class TextureCache {
  private readonly _textures = new Map<string, IReferencedTexture>();
  private readonly _redrawFlag: RedrawFlag;
  private readonly _logError: (message: string, e: any, fatal?: boolean | undefined) => void;

  constructor(
    redrawFlag: RedrawFlag,
    logError: (message: string, e: any, fatal?: boolean | undefined) => void
  ) {
    this._redrawFlag = redrawFlag;
    this._logError = logError;
  }

  private deref(url: string) {
    const r = this._textures.get(url);
    if (r === undefined) {
      return;
    }

    if (--r.refCount === 0) {
      this._textures.delete(url);
      r.texture.dispose();
    }
  }

  // This function returns the texture and the function to call to dereference it
  // when done.
  get(url: string): { texture: THREE.Texture, deref: () => void } {
    const already = this._textures.get(url);
    if (already !== undefined) {
      ++already.refCount;
      return { texture: already.texture, deref: () => this.deref(url) };
    }

    // TODO #149 Should I delay this texture until the load event has fired?
    const t = textureLoader.load(url,
      () => {
        this._redrawFlag.setNeedsRedraw();
        console.log(`texture loaded : ${url}`);
      },
      () => {},
      e => this._logError(`failed to load texture from ${url}`, e)
    );
    this._textures.set(url, { texture: t, refCount: 1 });
    return { texture: t, deref: () => this.deref(url) };
  }

  dispose() {
    this._textures.forEach(r => r.texture.dispose());
    this._textures.clear();
  }
}