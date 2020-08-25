import { IChange, IWallAdd, IWallRemove, IAreaAdd, IAreaRemove, createAreaAdd, createWallAdd, createWallRemove, createAreaRemove } from "../data/change";
import { IGridCoord, IGridEdge, edgesEqual, coordsEqual, edgeString, coordString } from "../data/coord";
import { IFeature, IFeatureDictionary } from '../data/feature';
import { IDragRectangle } from "./interfaces";

// Helps handling a hover highlight with drag to select many and release to commit
// them into new features.
// We assume two colours in the highlights: 0 for add, 1 for remove.
abstract class DragHighlighter<K extends IGridCoord, F extends IFeature<K>> {
  private readonly _features: IFeatureDictionary<K, F>; // inspect, but do not edit directly!
  private readonly _highlights: IFeatureDictionary<K, F>;

  private _inDrag: boolean = false;
  private _lastHoverPosition: K | undefined = undefined;

  constructor(features: IFeatureDictionary<K, F>, highlights: IFeatureDictionary<K, F>) {
    this._features = features;
    this._highlights = highlights;
  }

  protected abstract keysEqual(a: K, b: K | undefined): boolean;
  protected abstract keyString(a: K | undefined): string;
  protected abstract createFeatureAdd(position: K, colour: number): IChange;
  protected abstract createFeatureRemove(position: K): IChange;
  protected abstract createHighlight(position: K, subtract: boolean): F;

  protected addHighlightAt(position: K, subtract: boolean) {
    return this._highlights.add(this.createHighlight(position, subtract));
  }

  protected clearHighlights() {
    this._highlights.clear();
  }

  protected removeHighlightAt(position: K) {
    return this._highlights.remove(position);
  }

  // Override this to change the drag behaviour, e.g. to implement rectangular highlighting.
  protected dragTo(position: K, subtract: boolean) {
    // By default we highlight the new position if it wasn't already
    this.addHighlightAt(position, subtract);
  }

  get inDrag(): boolean { return this._inDrag; }

  clear() {
    this.clearHighlights();
  }

  dragCancel(position: K | undefined, colour: number) {
    this._inDrag = false;
    this.moveHighlight(position, colour);
  }

  dragStart(position: K | undefined, colour: number) {
    this.moveHighlight(position, colour);
    this._inDrag = true;
  }

  // Returns a list of changes that would apply this edit to the map, so that it can be
  // synchronised with other clients.
  dragEnd(position: K | undefined, colour: number): IChange[] {
    this.moveHighlight(position, colour);
    if (this._inDrag === false) {
      return [];
    }

    var changes: IChange[] = [];
    this._highlights.forEach(h => {
      if (this._features.get(h.position) !== undefined) {
        changes.push(this.createFeatureRemove(h.position));
      }

      if (colour >= 0 && h.colour === 0) {
        changes.push(this.createFeatureAdd(h.position, colour));
      }

      if (!this.keysEqual(h.position, position)) {
        this.removeHighlightAt(h.position);
      }
    });

    this._inDrag = false;
    return changes;
  }

  moveHighlight(position: K | undefined, colour: number) {
    if (position === undefined) {
      if (this._inDrag !== true) {
        this.clearHighlights();
      }
    } else if (!this.keysEqual(position, this._lastHoverPosition)) {
      if (this._inDrag === true) {
        this.dragTo(position, colour < 0);
      } else {
        // Highlight only the current position
        this.clearHighlights();
        this.addHighlightAt(position, colour < 0);
      }
    }

    this._lastHoverPosition = position;
  }
}

export class EdgeHighlighter extends DragHighlighter<IGridEdge, IFeature<IGridEdge>> {
  protected keysEqual(a: IGridEdge, b: IGridEdge | undefined) {
    return edgesEqual(a, b);
  }

  protected keyString(a: IGridEdge | undefined) {
    return a === undefined ? "undefined" : edgeString(a);
  }

  protected createFeatureAdd(position: IGridEdge, colour: number): IWallAdd {
    return createWallAdd({ position: position, colour: colour });
  }

  protected createFeatureRemove(position: IGridEdge): IWallRemove {
    return createWallRemove(position);
  }

  protected createHighlight(position: IGridEdge, subtract: boolean): IFeature<IGridEdge> {
    return { position: position, colour: subtract ? 1 : 0 };
  }
}

// This face highlighter is extended to support rectangle highlighting.
export class FaceHighlighter extends DragHighlighter<IGridCoord, IFeature<IGridCoord>> {
  private readonly _dragRectangle: IDragRectangle;

  private _startPosition: IGridCoord | undefined;

  constructor(
    features: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    highlights: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    dragRectangle: IDragRectangle
  ) {
    super(features, highlights);
    this._dragRectangle = dragRectangle;
  }

  private *enumerateCoordsBetween(a: IGridCoord, b: IGridCoord) {
    const minCoord = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) };
    const maxCoord = { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) };
    for (var y = minCoord.y; y <= maxCoord.y; ++y) {
      for (var x = minCoord.x; x <= maxCoord.x; ++x) {
        yield { x: x, y: y };
      }
    }
  }

  protected keysEqual(a: IGridCoord, b: IGridCoord | undefined) {
    return coordsEqual(a, b);
  }

  protected keyString(a: IGridCoord | undefined) {
    return a === undefined ? "undefined" : coordString(a);
  }

  protected createFeatureAdd(position: IGridCoord, colour: number): IAreaAdd {
    return createAreaAdd({ position: position, colour: colour });
  }

  protected createFeatureRemove(position: IGridCoord): IAreaRemove {
    return createAreaRemove(position);
  }

  protected createHighlight(position: IGridCoord, subtract: boolean): IFeature<IGridCoord> {
    return { position: position, colour: subtract ? 1 : 0 };
  }

  protected dragTo(position: IGridCoord, subtract: boolean) {
    if (this._dragRectangle.isEnabled() && this._startPosition !== undefined) {
      // We highlight the contents of the rectangle between our start position
      // and this one, replacing anything we might have had; the filtering is
      // required because the drag rectangle might not be axis-aligned and the
      // grid might have non-orthogonal axes
      this.clearHighlights();
      for (var c of this._dragRectangle.enumerateCoords()) {
        this.addHighlightAt(c, subtract);
      }
    } else {
      super.dragTo(position, subtract);
    }
  }

  clear() {
    super.clear();
    this._startPosition = undefined;
  }

  dragCancel(position: IGridCoord | undefined, colour: number) {
    super.dragCancel(position, colour);
    this._startPosition = undefined;
  }

  dragEnd(position: IGridCoord | undefined, colour: number) {
    var result = super.dragEnd(position, colour);
    this._startPosition = undefined;
    return result;
  }

  dragStart(position: IGridCoord | undefined, colour: number) {
    super.dragStart(position, colour);
    this._startPosition = position;
  }
}