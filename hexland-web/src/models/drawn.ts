// A helpful basis for anything that we draw with Three, and
// sometimes needs a redraw.
export class Drawn {
  private _needsRedraw: boolean;

  constructor() {
    this._needsRedraw = true;
  }

  protected setNeedsRedraw() { this._needsRedraw = true; }

  needsRedraw(): boolean {
    var consumed = this._needsRedraw;
    this._needsRedraw = false;
    return consumed;
  }
}