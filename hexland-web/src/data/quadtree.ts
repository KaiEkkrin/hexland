import { ENGINE_METHOD_DIGESTS } from 'constants';
import { runInThisContext } from 'vm';
import { coordString, IGridCoord } from './coord';
import { modFloor } from './extraMath';
import { FeatureDictionary, IFeature, IFeatureDictionary } from './feature';

// This module defines a quadtree of grid faces, which we use to handle map
// colouring in an efficient manner for large, sparsely walled maps (typical.)

export interface IQuadtreeCoord extends IGridCoord {
  size: number; // 1, 2, 4, ...
}

// Basic functions for manipulating quadtree coords.
export interface IQuadtree<K extends IQuadtreeCoord> {
  // Finds the larger quadtree face that contains this one.
  ascend: (q: K, bigger?: number | undefined) => K;

  // Finds the smaller quadtree faces inside this one.
  descend: (q: K) => Iterable<K>;

  // Checks two coords for equality.
  equals: (q: K, r: K) => boolean;

  // Gets the coord past the end of the given one at the same size.
  getEnd: (q: K) => K;

  // Checks for validity.
  isValid: (q: K) => boolean;

  // Tests two coords for overlap at any size.
  overlap: (q: K, r: K) => boolean;

  // Creates a string suitable as a dictionary key.
  toString: (q: K) => string;
}

// A simple implementation of the above.
export class Quadtree implements IQuadtree<IQuadtreeCoord> {
  constructor() {
    // JavaScript perverseness :P
    this.ascend = this.ascend.bind(this);
    this.descend = this.descend.bind(this);
    this.equals = this.equals.bind(this);
    this.getEnd = this.getEnd.bind(this);
    this.isValid = this.isValid.bind(this);
    this.overlap = this.overlap.bind(this);
    this.toString = this.toString.bind(this);
  }

  ascend(q: IQuadtreeCoord, bigger?: number | undefined) {
    if (bigger === undefined) {
      bigger = q.size * 2;
    } else if (bigger < q.size) {
      throw RangeError("bigger < q.size");
    } else if (bigger === q.size) {
      return q;
    }

    return {
      x: bigger * Math.floor(q.x / bigger),
      y: bigger * Math.floor(q.y / bigger),
      size: bigger
    };
  }

  *descend(q: IQuadtreeCoord) {
    if (q.size <= 1) {
      throw RangeError("q.size === 1");
    }

    const smaller = Math.round(q.size * 0.5);
    yield { x: q.x, y: q.y, size: smaller };
    yield { x: q.x + smaller, y: q.y, size: smaller };
    yield { x: q.x + smaller, y: q.y + smaller, size: smaller };
    yield { x: q.x, y: q.y + smaller, size: smaller };
  }

  equals(q: IQuadtreeCoord, r: IQuadtreeCoord) {
    return q.x === r.x && q.y === r.y && q.size === r.size;
  }

  getEnd(q: IQuadtreeCoord) {
    return { x: q.x + q.size, y: q.y + q.size, size: q.size };
  }

  isValid(q: IQuadtreeCoord) {
    const log2Size = Math.log2(q.size);
    return log2Size >= 0 && Math.floor(log2Size) === log2Size &&
      modFloor(q.x, q.size) === 0 && modFloor(q.y, q.size) === 0;
  }

  overlap(q: IQuadtreeCoord, r: IQuadtreeCoord): boolean {
    if (r.size > q.size) {
      return this.overlap(r, q);
    }

    const qEnd = this.getEnd(q);
    return r.x >= q.x && r.y >= q.y && r.x < qEnd.x && r.y < qEnd.y;
  }

  toString(q: IQuadtreeCoord) {
    return coordString(q) + " sz=" + q.size;
  }
}

// Stores a dictionary as a quadtree; a feature may be at any level,
// but if there is an entry at a particular level there will be none below it.
// We provide a suitable set of operations to support the map colouring functionality.
// To support expanding in any direction whilst not ending up with a root face
// straddling the origin, we have four roots (of the same size) surrounding the origin.
// The dictionary is always fully populated, using the defaultFeature if no explicit feature
// has been set.
export class QuadtreeColouringDictionary<F extends IFeature<IQuadtreeCoord>> {
  // Supplies our basic quadtree functions.
  private readonly _quadtree: IQuadtree<IQuadtreeCoord>;

  // Helps us fill with features.
  private readonly _featuresEqualIgnoringPosition: (a: F, b: F) => boolean;
  private readonly _defaultFeature: F;

  // Our real features go here.
  private readonly _features: IFeatureDictionary<IQuadtreeCoord, F>;

  // Any quadtree coord that has overlapping, smaller features stored in the dictionary
  // shall have an entry here to indicate it.
  private readonly _nodes: IFeatureDictionary<IQuadtreeCoord, IFeature<IQuadtreeCoord>>;

  private _rootSize: number;
  private _sizes: number[]; // in descending order starting with the root size

  constructor(
    quadtree: IQuadtree<IQuadtreeCoord>,
    featuresEqualIgnoringPosition: (a: F, b: F) => boolean,
    defaultFeature: F
  ) {
    this._quadtree = quadtree;
    this._featuresEqualIgnoringPosition = featuresEqualIgnoringPosition;
    this._defaultFeature = defaultFeature;
    this._features = new FeatureDictionary<IQuadtreeCoord, F>(quadtree.toString);
    this._nodes = new FeatureDictionary<IQuadtreeCoord, IFeature<IQuadtreeCoord>>(quadtree.toString);
    this._rootSize = 1;
    this._sizes = [1];
    this.clear();
  }

  private clearInternal() {
    // Reset:
    this._features.clear();
    this._nodes.clear();
    this._rootSize = 1;
    this._sizes = [1];

    // Fill in our starting features:
    this._features.add({ ...this._defaultFeature, position: { x: -1, y: -1, size: 1 }});
    this._features.add({ ...this._defaultFeature, position: { x: 0, y: -1, size: 1 }});
    this._features.add({ ...this._defaultFeature, position: { x: 0, y: 0, size: 1 }});
    this._features.add({ ...this._defaultFeature, position: { x: -1, y: 0, size: 1 }});
  }

  private expandBounds() {
    // Expands the bounds by one single step and fills in the default feature.
    // Call repeatedly if need be.
    const oldSize = this._rootSize;
    this._rootSize *= 2;
    this._sizes.splice(0, 0, this._rootSize);
    const bounds = this.bounds;

    // Bottom left
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x, y: bounds.min.y, size: oldSize }});
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x + oldSize, y: bounds.min.y, size: oldSize }});
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x, y: bounds.min.y + oldSize, size: oldSize }});
    this._nodes.add({ colour: 0, position: { x: bounds.min.x, y: bounds.min.y, size: this._rootSize }});
    this.mergeEqual({ ...this._defaultFeature, position: { x: bounds.min.x, y: bounds.min.y, size: oldSize }});

    // Bottom right
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x + this._rootSize, y: bounds.min.y, size: oldSize }});
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x + this._rootSize + oldSize, y: bounds.min.y, size: oldSize }});
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x + this._rootSize + oldSize, y: bounds.min.y + oldSize, size: oldSize }});
    this._nodes.add({ colour: 0, position: { x: bounds.min.x + this._rootSize, y: bounds.min.y, size: this._rootSize }});
    this.mergeEqual({ ...this._defaultFeature, position: { x: bounds.min.x + this._rootSize, y: bounds.min.y, size: oldSize }});

    // Top right
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x + this._rootSize, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }});
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x + this._rootSize + oldSize, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }});
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x + this._rootSize + oldSize, y: bounds.min.y + this._rootSize, size: oldSize }});
    this._nodes.add({ colour: 0, position: { x: bounds.min.x + this._rootSize, y: bounds.min.y + this._rootSize, size: this._rootSize }});
    this.mergeEqual({ ...this._defaultFeature, position: { x: bounds.min.x + this._rootSize, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }});

    // Top left
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x, y: bounds.min.y + this._rootSize, size: oldSize }});
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }});
    this._features.add({ ...this._defaultFeature, position: { x: bounds.min.x + oldSize, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }});
    this._nodes.add({ colour: 0, position: { x: bounds.min.x, y: bounds.min.y + this._rootSize, size: this._rootSize }});
    this.mergeEqual({ ...this._defaultFeature, position: { x: bounds.min.x, y: bounds.min.y + this._rootSize, size: oldSize }});
  }

  private isOutsideBounds(c: IQuadtreeCoord) {
    return c.x < this.bounds.min.x || c.y < this.bounds.min.y || c.x >= this.bounds.max.x || c.y >= this.bounds.max.y;
  }

  private mergeEqual(f: F) {
    while (true) {
      // Get the larger size
      var larger = this._quadtree.ascend(f.position);
      if (larger.size > this._rootSize) {
        return;
      }

      // Get all the samples at this larger size that aren't our target size.
      // If any of the sampled features are different, we can't merge.
      for (var d of this._quadtree.descend(larger)) {
        if (this._quadtree.equals(d, f.position)) {
          continue;
        }

        var sample = this._features.get(d);
        if (sample === undefined || !this._featuresEqualIgnoringPosition(sample, f)) {
          return;
        }
      }

      // If we got here, do the merge and continue upwards:
      for (var d of this._quadtree.descend(larger)) {
        this._features.remove(d);
      }

      this._nodes.remove(larger);
      f = { ...f, position: larger };
      this._features.add(f);
    }
  }

  // Gets our current bounds (always a square; inclusive, exclusive).
  get bounds() {
    return {
      min: { x: -this._rootSize, y: -this._rootSize, size: this._rootSize },
      max: { x: this._rootSize, y: this._rootSize, size: this._rootSize }
    };
  }

  // Clears the whole thing:
  clear() {
    this.clearInternal();
  }

  // Gets the feature at this coord, walking from lowest granularity to highest.
  sample(c: IGridCoord) {
    const bounds = this.bounds;
    if (
      c.x < bounds.min.x || c.y < bounds.min.y ||
      c.x >= bounds.max.x || c.y >= bounds.max.y
    ) {
      return undefined;
    }

    const baseQ = { x: c.x, y: c.y, size: 1 };
    for (var size of this._sizes) {
      var q = this._quadtree.ascend(baseQ, size);
      var here = this._features.get(q);
      if (here !== undefined) {
        return here;
      }
    }

    return undefined;
  }

  // Sets a feature here, at the given granularity or a lower if possible, merging equal
  // features where we can.
  // The external caller should probably always use size=1.
  // Note that this same feature object will not be stored -- it will be copied in.
  // Returns true if there was any change, else false.
  set(f: F) {
    if (!this._quadtree.isValid(f.position)) {
      throw RangeError("Invalid position: " + this._quadtree.toString(f.position));
    }

    while (this.isOutsideBounds(f.position)) {
      this.expandBounds();
    }

    var newFeature = { ...f };
    for (var size of this._sizes) {
      var q = this._quadtree.ascend(f.position, size);
      if (this._nodes.get(q) !== undefined) {
        // This is already split; try the higher granularity.
        continue;
      }

      // Pull out the existing feature so we can decide what to do with it
      var here = this._features.remove(q);
      if (here === undefined) {
        throw Error("Expected an existing node or feature");
      }

      newFeature.position = q;
      if (this._featuresEqualIgnoringPosition(here, newFeature)) {
        // Adding this feature at a higher granularity would cause no change -- just put it back and exit
        this._features.add(here);
        return false;
      }

      if (size === f.position.size) {
        // We can simply add ours in its place.
        const added = this._features.add(newFeature);
        if (added) {
          this.mergeEqual(newFeature);
        }

        return added;
      }

      // Split this leaf into a node, and continue to the next granularity
      this._nodes.add({ position: q, colour: 0 });
      for (var d of this._quadtree.descend(q)) {
        this._features.add({ ...here, position: d });
      }
    }

    // If we got here, the feature wasn't valid.
    throw RangeError("Failed to add feature (not valid?) at " + this._quadtree.toString(f.position));
  }
}