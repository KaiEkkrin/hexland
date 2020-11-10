import { Change, WallAdd, WallRemove, AreaAdd, AreaRemove, createAreaAdd, createWallAdd, createWallRemove, createAreaRemove } from "../data/change";
import { GridCoord, GridEdge, edgesEqual, coordsEqual, edgeString, coordString, GridVertex, verticesEqual, vertexString } from "../data/coord";
import { IFeature, IFeatureDictionary } from '../data/feature';
import { IDragRectangle } from "./interfaces";

import fluent from "fluent-iterable";

// Helps handling a hover highlight with drag to select many and release to commit
// them into new features.
// We assume two colours in the highlights: 0 for add, 1 for remove.
abstract class DragHighlighter<K extends GridCoord, F extends IFeature<K>> {
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
  protected abstract createFeatureAdd(position: K, colour: number): Change | undefined;
  protected abstract createFeatureRemove(position: K): Change | undefined;
  protected abstract createHighlight(position: K, subtract: boolean): F;

  protected addHighlightAt(position: K, subtract: boolean) {
    return this._highlights.add(this.createHighlight(position, subtract));
  }

  protected clearHighlights() {
    this._highlights.clear();
  }

  // Override this to change the drag behaviour, e.g. to implement rectangular highlighting.
  protected dragTo(position: K, subtract: boolean) {
    // By default we highlight the new position if it wasn't already
    this.addHighlightAt(position, subtract);
  }

  // Pushes the changes into the array (if defined) and returns it, or undefined
  // if the changes are marked as not valid.
  protected pushFeatureChanges(changes: Change[] | undefined, colour: number, h: IFeature<K>): Change[] | undefined {
    if (this._features.get(h.position) !== undefined) {
      const remove = this.createFeatureRemove(h.position);
      if (remove !== undefined) {
        changes?.push(remove);
      }
    }

    if (colour >= 0 && (h.colour === 0 || h.colour === 2)) {
      const add = this.createFeatureAdd(h.position, colour);
      if (add !== undefined) {
        changes?.push(add);
      }
    }

    return h.colour < 2 ? changes : undefined;
  }

  protected removeHighlightAt(position: K) {
    return this._highlights.remove(position);
  }

  get inDrag(): boolean { return this._inDrag; }

  clear() {
    this.clearHighlights();
  }

  createChanges(colour: number, onlyIfValid: boolean): Change[] {
    if (this._inDrag === false) {
      return [];
    }

    let changes: Change[] | undefined = [];
    for (const h of this._highlights) {
      const newChanges = this.pushFeatureChanges(changes, colour, h);
      if (onlyIfValid) {
        changes = newChanges;
      }
    }

    console.log("created " + (changes?.length ?? 0) + " changes");
    return changes ?? [];
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
  dragEnd(position: K | undefined, colour: number): Change[] {
    this.moveHighlight(position, colour);
    if (this._inDrag === false) {
      return [];
    }

    const changes = this.createChanges(colour, true);
    this._inDrag = false;
    this.clearHighlights();
    if (position !== undefined) {
      this.addHighlightAt(position, colour < 0);
    }
    return changes;
  }

  // Returns true if something changed, else false.
  moveHighlight(position: K | undefined, colour: number) {
    let changed = false;
    if (position === undefined) {
      if (this._inDrag !== true) {
        if (fluent(this._highlights).any()) {
          changed = true;
        }
        this.clearHighlights();
      }
    } else if (!this.keysEqual(position, this._lastHoverPosition)) {
      changed = true;
      if (this._inDrag === true) {
        this.dragTo(position, colour < 0);
      } else {
        // Highlight only the current position
        this.clearHighlights();
        this.addHighlightAt(position, colour < 0);
      }
    }

    this._lastHoverPosition = position;
    return changed;
  }

  // Sets whether or not the highlights are marked as valid -- this swaps
  // the colours between (0, 1) and (2, 3).  (This is the only place where we'll
  // assign the highlight colours 2 and 3.)
  setHighlightValidity(valid: boolean) {
    console.log("setting highlight validity to " + valid);
    function needsChange(h: IFeature<K>) {
      return valid ? (h.colour >= 2) : (h.colour < 2);
    }

    const toChange = [...fluent(this._highlights).filter(needsChange)];
    for (const h of toChange) {
      this._highlights.remove(h.position);
      h.colour = valid ? h.colour - 2 : h.colour + 2;
      this._highlights.add(h);
    }
  }
}

export class EdgeHighlighter extends DragHighlighter<GridEdge, IFeature<GridEdge>> {
  protected keysEqual(a: GridEdge, b: GridEdge | undefined) {
    return edgesEqual(a, b);
  }

  protected keyString(a: GridEdge | undefined) {
    return a === undefined ? "undefined" : edgeString(a);
  }

  protected createFeatureAdd(position: GridEdge, colour: number): WallAdd {
    return createWallAdd({ position: position, colour: colour });
  }

  protected createFeatureRemove(position: GridEdge): WallRemove {
    return createWallRemove(position);
  }

  protected createHighlight(position: GridEdge, subtract: boolean): IFeature<GridEdge> {
    return { position: position, colour: subtract ? 1 : 0 };
  }
}

// This face highlighter is extended to support rectangle highlighting.
export class FaceHighlighter extends DragHighlighter<GridCoord, IFeature<GridCoord>> {
  private readonly _dragRectangle: IDragRectangle;

  private _startPosition: GridCoord | undefined;

  constructor(
    features: IFeatureDictionary<GridCoord, IFeature<GridCoord>>,
    highlights: IFeatureDictionary<GridCoord, IFeature<GridCoord>>,
    dragRectangle: IDragRectangle
  ) {
    super(features, highlights);
    this._dragRectangle = dragRectangle;
  }

  protected keysEqual(a: GridCoord, b: GridCoord | undefined) {
    return coordsEqual(a, b);
  }

  protected keyString(a: GridCoord | undefined) {
    return a === undefined ? "undefined" : coordString(a);
  }

  protected createFeatureAdd(position: GridCoord, colour: number): AreaAdd {
    return createAreaAdd({ position: position, colour: colour });
  }

  protected createFeatureRemove(position: GridCoord): AreaRemove {
    return createAreaRemove(position);
  }

  protected createHighlight(position: GridCoord, subtract: boolean): IFeature<GridCoord> {
    return { position: position, colour: subtract ? 1 : 0 };
  }

  protected dragTo(position: GridCoord, subtract: boolean) {
    if (this._dragRectangle.isEnabled() && this._startPosition !== undefined) {
      // We highlight the contents of the rectangle between our start position
      // and this one, replacing anything we might have had; the filtering is
      // required because the drag rectangle might not be axis-aligned and the
      // grid might have non-orthogonal axes
      this.clearHighlights();
      for (let c of this._dragRectangle.enumerateCoords()) {
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

  dragCancel(position: GridCoord | undefined, colour: number) {
    super.dragCancel(position, colour);
    this._startPosition = undefined;
  }

  dragEnd(position: GridCoord | undefined, colour: number) {
    let result = super.dragEnd(position, colour);
    this._startPosition = undefined;
    return result;
  }

  dragStart(position: GridCoord | undefined, colour: number) {
    super.dragStart(position, colour);
    this._startPosition = position;
  }
}

// The vertex highlighter doesn't actually support making changes (none are relevant right now)
export class VertexHighlighter extends DragHighlighter<GridVertex, IFeature<GridVertex>> {
  protected keysEqual(a: GridVertex, b: GridVertex | undefined) {
    return verticesEqual(a, b);
  }

  protected keyString(a: GridVertex | undefined) {
    return a === undefined ? "undefined" : vertexString(a);
  }

  protected createFeatureAdd(position: GridVertex, colour: number) {
    return undefined;
  }

  protected createFeatureRemove(position: GridVertex) {
    return undefined;
  }

  protected createHighlight(position: GridVertex, subtract: boolean): IFeature<GridVertex> {
    return { position: position, colour: subtract ? 1 : 0 };
  }
}