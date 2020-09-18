export class RedrawFlag {
  private _needsRedraw = true;

  setNeedsRedraw() {
    this._needsRedraw = true;
  }

  needsRedraw(): boolean {
    let value = this._needsRedraw;
    this._needsRedraw = false;
    return value;
  }
}