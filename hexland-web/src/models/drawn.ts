import { IGridGeometry } from "./gridGeometry";

// A helpful basis for anything that we draw with Three, and
// sometimes needs a redraw.
export class Drawn {
  private _geometry: IGridGeometry;
  private _needsRedraw: boolean;

  constructor(geometry: IGridGeometry) {
    this._geometry = geometry;
    this._needsRedraw = true;
  }

  protected get geometry(): IGridGeometry { return this._geometry; }

  protected setNeedsRedraw() { this._needsRedraw = true; }

  needsRedraw(): boolean {
    var consumed = this._needsRedraw;
    this._needsRedraw = false;
    return consumed;
  }
}