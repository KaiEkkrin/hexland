import { GridCoord, GridEdge } from "../data/coord";
import { IFeature, InstancedFeatures } from "./instancedFeatures";

// Helps handling a hover highlight with drag to select many and release to commit
// them into new features.
abstract class DragHighlighter<K extends GridCoord, F extends IFeature<K>> {
  private readonly _features: InstancedFeatures<K, F>;
  private readonly _highlights: InstancedFeatures<K, F>;

  private _inDrag: boolean = false;
  private _lastHoverPosition: K | undefined = undefined;

  constructor(features: InstancedFeatures<K, F>, highlights: InstancedFeatures<K, F>) {
    this._features = features;
    this._highlights = highlights;
  }

  protected abstract createFeature(position: K, colour: number): F;
  protected abstract createHighlight(position: K): F;

  dragStart(position?: K | undefined) {
    this.moveHighlight(position);
    this._inDrag = true;
  }

  dragEnd(position: K | undefined, colour: number) {
    this.moveHighlight(position);
    if (this._inDrag === false) {
      return;
    }

    this._highlights.all.forEach(f => {
      this._features.remove(f.position);
      if (colour >= 0) {
        this._features.add(this.createFeature(f.position, colour));
      }

      if (f.position !== position) {
        this._highlights.remove(f.position);
      }
    });

    this._inDrag = false;
  }

  moveHighlight(position?: K | undefined) {
    if (position === undefined) {
      if (this._inDrag !== true) {
        this._highlights.clear();
      }
    } else if (!position.equals(this._lastHoverPosition)) {
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

export class EdgeHighlighter extends DragHighlighter<GridEdge, IFeature<GridEdge>> {
  protected createFeature(position: GridEdge, colour: number): IFeature<GridEdge> {
    return { position: position, colour: colour };
  }

  protected createHighlight(position: GridEdge): IFeature<GridEdge> {
    return { position: position, colour: 0 };
  }
}

export class FaceHighlighter extends DragHighlighter<GridCoord, IFeature<GridCoord>> {
  protected createFeature(position: GridCoord, colour: number): IFeature<GridCoord> {
    return { position: position, colour: colour };
  }

  protected createHighlight(position: GridCoord): IFeature<GridCoord> {
    return { position: position, colour: 0 };
  }
}