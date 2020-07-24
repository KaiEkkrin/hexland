import { IGridGeometry } from "./gridGeometry";
import { RedrawFlag } from "./redrawFlag";

// A helpful basis for anything that we draw with Three, and
// sometimes needs a redraw.
export class Drawn {
  private _geometry: IGridGeometry;
  private _redrawFlag: RedrawFlag;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag) {
    this._geometry = geometry;
    this._redrawFlag = redrawFlag;
  }

  protected get geometry() { return this._geometry; }

  protected setNeedsRedraw() { this._redrawFlag.setNeedsRedraw(); }
}