import { IChange, ChangeType, ChangeCategory, IWallAdd, IWallRemove, IAreaAdd, IAreaRemove } from "../data/change";
import { IGridCoord, IGridEdge, edgesEqual, coordsEqual } from "../data/coord";
import { IFeature } from '../data/feature';
import { InstancedFeatures } from "./instancedFeatures";

// Helps handling a hover highlight with drag to select many and release to commit
// them into new features.
abstract class DragHighlighter<K extends IGridCoord, F extends IFeature<K>> {
  private readonly _features: InstancedFeatures<K, F>; // inspect, but do not edit directly!
  private readonly _highlights: InstancedFeatures<K, F>;

  private _inDrag: boolean = false;
  private _lastHoverPosition: K | undefined = undefined;

  constructor(features: InstancedFeatures<K, F>, highlights: InstancedFeatures<K, F>) {
    this._features = features;
    this._highlights = highlights;
  }

  protected abstract keysEqual(a: K, b: K | undefined): boolean;
  protected abstract createFeatureAdd(position: K, colour: number): IChange;
  protected abstract createFeatureRemove(position: K): IChange;
  protected abstract createHighlight(position: K): F;

  get inDrag(): boolean { return this._inDrag; }

  clear() {
    this._highlights.clear();
  }

  dragCancel(position?: K | undefined) {
    this._inDrag = false;
    this.moveHighlight(position);
  }

  dragStart(position?: K | undefined) {
    this.moveHighlight(position);
    this._inDrag = true;
  }

  // Returns a list of changes that would apply this edit to the map, so that it can be
  // synchronised with other clients.
  dragEnd(position: K | undefined, colour: number): IChange[] {
    this.moveHighlight(position);
    if (this._inDrag === false) {
      return [];
    }

    var changes: IChange[] = [];
    this._highlights.forEach(f => {
      if (this._features.get(f.position) !== undefined) {
        changes.push(this.createFeatureRemove(f.position));
      }

      if (colour >= 0) {
        changes.push(this.createFeatureAdd(f.position, colour));
      }

      if (!this.keysEqual(f.position, position)) {
        this._highlights.remove(f.position);
      }
    });

    this._inDrag = false;
    return changes;
  }

  moveHighlight(position?: K | undefined) {
    if (position === undefined) {
      if (this._inDrag !== true) {
        this._highlights.clear();
      }
    } else if (!this.keysEqual(position, this._lastHoverPosition)) {
      if (this._inDrag === true) {
        // Highlight the new position if it wasn't already
        this._highlights.add(this.createHighlight(position));
      } else {
        // Highlight only the current position
        this._highlights.clear();
        this._highlights.add(this.createHighlight(position));
      }

      this._lastHoverPosition = position;
    }
  }
}

export class EdgeHighlighter extends DragHighlighter<IGridEdge, IFeature<IGridEdge>> {
  protected keysEqual(a: IGridEdge, b: IGridEdge | undefined) {
    return edgesEqual(a, b);
  }

  protected createFeatureAdd(position: IGridEdge, colour: number): IWallAdd {
    return {
      ty: ChangeType.Add,
      cat: ChangeCategory.Wall,
      feature: {
        position: position,
        colour: colour
      }
    };
  }

  protected createFeatureRemove(position: IGridEdge): IWallRemove {
    return {
      ty: ChangeType.Remove,
      cat: ChangeCategory.Wall,
      position: position
    };
  }

  protected createHighlight(position: IGridEdge): IFeature<IGridEdge> {
    return { position: position, colour: 0 };
  }
}

export class FaceHighlighter extends DragHighlighter<IGridCoord, IFeature<IGridCoord>> {
  protected keysEqual(a: IGridCoord, b: IGridCoord | undefined) {
    return coordsEqual(a, b);
  }

  protected createFeatureAdd(position: IGridCoord, colour: number): IAreaAdd {
    return {
      ty: ChangeType.Add,
      cat: ChangeCategory.Area,
      feature: {
        position: position,
        colour: colour
      }
    };
  }

  protected createFeatureRemove(position: IGridCoord): IAreaRemove {
    return {
      ty: ChangeType.Remove,
      cat: ChangeCategory.Area,
      position: position
    };
  }

  protected createHighlight(position: IGridCoord): IFeature<IGridCoord> {
    return { position: position, colour: 0 };
  }
}