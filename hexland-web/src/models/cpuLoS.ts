import { GridCoord, GridEdge } from "../data/coord";
import { BoundedFeatureDictionary, IBareFeature, IBoundedFeatureDictionary, IFeature, IFeatureDictionary } from "../data/feature";
import { rasterLoS } from "../data/rasterLoS";
import { Drawn } from "./drawn";
import { IGridGeometry } from "./gridGeometry";
import { IGridBounds } from "./interfaces";
import { RedrawFlag } from "./redrawFlag";
import * as THREE from 'three';

// TODO #207 : I know this is going to be too slow, but I want it running before optimising.
// Possibilities for speeding it up include
// - using the rust implementation
// - sending off the work to web workers, because it's okay to have a little delay on the LoS
// calculation (not needed every frame) before drawing it
export class CpuLoS extends Drawn {
  // This state tracking lets us work out when we need to recalculate.
  private _bounds?: IGridBounds;
  private readonly _positions: GridCoord[] = [];

  // We'll try not to re-allocate these unless necessary :)
  private readonly _singleLoSBuffers: IBoundedFeatureDictionary<GridCoord, IBareFeature>[] = [];

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag) {
    super(geometry, redrawFlag);
  }

  private positionsEqual(positions: GridCoord[]): boolean {
    if (positions.length !== this._positions.length) {
      return false;
    }

    for (let i = 0; i < positions.length; ++i) {
      if (
        positions[i].x !== this._positions[i].x
        || positions[i].y !== this._positions[i].y
      ) {
        return false;
      }
    }

    return true;
  }

  render(
    walls: IFeatureDictionary<GridEdge, IFeature<GridEdge>>,
    target: IFeatureDictionary<GridCoord, IFeature<GridCoord>>
  ) {
    if (this._bounds === undefined || this._positions.length === 0) {
      // We're not in a position to render anything
      return;
    }

    // Work out our grid min and max
    const gridMin: GridCoord = {
      x: this._bounds.minS * this.geometry.tileDim,
      y: this._bounds.minT * this.geometry.tileDim
    };

    const gridMax: GridCoord = {
      x: this._bounds.maxS * this.geometry.tileDim,
      y: this._bounds.maxT * this.geometry.tileDim
    };

    // Create enough buffers to calculate LoS from all those positions, if there aren't already
    for (let i = this._singleLoSBuffers.length; i < this._positions.length; ++i) {
      this._singleLoSBuffers.push(
        new BoundedFeatureDictionary<GridCoord, IBareFeature>(
          gridMin, gridMax, { colour: 0 }
        )
      );
    }

    // Calculate each position's LoS in turn
    const positionVec = new THREE.Vector3();
    for (let i = 0; i < this._positions.length; ++i) {
      positionVec.set(this._positions[i].x, this._positions[i].y, 0);
      this.geometry.drawLoSSingle(positionVec, walls, this._singleLoSBuffers[i]);
    }

    // Bake them all down into the first one
    rasterLoS.combine(
      this._singleLoSBuffers[0],
      ...this._singleLoSBuffers.slice(1, this._positions.length)
    );

    // Copy the result into the LoS target, which will be rendered.
    // TODO #207 This will definitely be slow. Optimise by creating a rendered
    // BoundedFeatureDictionary, to begin with?
    target.clear();
    for (const { position, feature } of this._singleLoSBuffers[0]) {
      target.add({ position, ...feature });
    }
  }

  setBounds(bounds: IGridBounds) {
    if (
      bounds.minS !== this._bounds?.minS
      || bounds.maxS !== this._bounds?.maxS
      || bounds.minT !== this._bounds?.minT
      || bounds.maxT !== this._bounds?.maxT
    ) {
      this._bounds = bounds;

      // Doing this invalidates my current set of LoS buffers.
      this._singleLoSBuffers.splice(0, this._singleLoSBuffers.length);

      this.setNeedsRedraw();
    }
  }

  setPositions(positions: GridCoord[]) {
    if (
      positions.length === this._positions.length
      && this.positionsEqual(positions)
    ) {
      return;
    }

    this._positions.splice(0, this._positions.length, ...positions);
    this.setNeedsRedraw();
  }

  dispose() {
  }
}