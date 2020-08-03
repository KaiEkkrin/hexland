import { IChange, ChangeType, ChangeCategory, IWallAdd, IWallRemove, IAreaAdd, IAreaRemove } from "../data/change";
import { IGridCoord, IGridEdge, edgesEqual, coordsEqual } from "../data/coord";
import { IFeature } from '../data/feature';
import { InstancedFeatures } from "./instancedFeatures";

// Helps handling a hover highlight with drag to select many and release to commit
// them into new features.
abstract class DragHighlighter<K, F extends IFeature<K>> {
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
    this._highlights.all.forEach(f => {
      if (this._features.at(f.position) !== undefined) {
        changes.push(this.createFeatureRemove(f.position));
      }

      if (colour >= 0) {
        changes.push(this.createFeatureAdd(f.position, colour));
      }

      if (f.position !== position) {
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
        // Toggle the new position
        if (this._highlights.remove(position) === undefined) {
          this._highlights.add(this.createHighlight(position));
        }
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

  protected createFeatureAdd(position: IGridEdge, colour: number): IChange {
    return {
      ty: ChangeType.Add,
      cat: ChangeCategory.Wall,
      feature: {
        position: position,
        colour: colour
      }
    } as IWallAdd;
  }

  protected createFeatureRemove(position: IGridEdge): IChange {
    return {
      ty: ChangeType.Remove,
      cat: ChangeCategory.Wall,
      position: position
    } as IWallRemove;
  }

  protected createHighlight(position: IGridEdge): IFeature<IGridEdge> {
    return { position: position, colour: 0 };
  }
}

export class FaceHighlighter extends DragHighlighter<IGridCoord, IFeature<IGridCoord>> {
  protected keysEqual(a: IGridCoord, b: IGridCoord | undefined) {
    return coordsEqual(a, b);
  }

  protected createFeatureAdd(position: IGridCoord, colour: number): IChange {
    return {
      ty: ChangeType.Add,
      cat: ChangeCategory.Area,
      feature: {
        position: position,
        colour: colour
      }
    } as IAreaAdd;
  }

  protected createFeatureRemove(position: IGridCoord): IChange {
    return {
      ty: ChangeType.Remove,
      cat: ChangeCategory.Area,
      position: position
    } as IAreaRemove;
  }

  protected createHighlight(position: IGridCoord): IFeature<IGridCoord> {
    return { position: position, colour: 0 };
  }
}