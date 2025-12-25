export class RedrawFlag {
  private _needsRedraw = true;

  setNeedsRedraw() {
    this._needsRedraw = true;
  }

  needsRedraw(): boolean {
    const value = this._needsRedraw;
    this._needsRedraw = false;
    return value;
  }
}