import * as THREE from 'three';

// This helper can read the contents of a render target and provide samples,
// while encapsulating the required buffer management.
export class RenderTargetReader {
  private readonly _renderTarget: THREE.WebGLRenderTarget;

  private _buf: Uint8Array;
  private _bufWidth: number;
  private _bufHeight: number;

  constructor(renderTarget: THREE.WebGLRenderTarget) {
    this._renderTarget = renderTarget;
    this._bufWidth = renderTarget.width;
    this._bufHeight = renderTarget.height;
    this._buf = new Uint8Array(this._bufWidth * this._bufHeight * 4);
  }

  // Reads the contents of the render target into the buffer.
  refresh(renderer: THREE.WebGLRenderer) {
    if (this._renderTarget.width !== this._bufWidth || this._renderTarget.height !== this._bufHeight) {
      const newLength = this._renderTarget.width * this._renderTarget.height * 4;
      if (newLength > this._buf.length) {
        this._buf = new Uint8Array(newLength);
      }

      this._bufWidth = this._renderTarget.width;
      this._bufHeight = this._renderTarget.height;
    }

    renderer.readRenderTargetPixels(this._renderTarget, 0, 0, this._bufWidth, this._bufHeight, this._buf);
  }

  // Provides a texel from the buffer to a decoder.
  sample<T>(x: number, y: number, decoder: (buf: Uint8Array, offset: number) => T | undefined) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this._bufWidth || y >= this._bufHeight) {
      return undefined;
    }

    return decoder(this._buf, y * this._bufWidth * 4 + x * 4);
  }
}