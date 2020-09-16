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
  private readonly _createDefaultFeature: (c: IQuadtreeCoord) => F;
  private readonly _featuresEqualIgnoringPosition: (a: F, b: F) => boolean;
  private readonly _isDefaultFeature: (f: F) => boolean;

  // Our real features go here.
  private readonly _features: IFeatureDictionary<IQuadtreeCoord, F>;

  // Any quadtree coord that has overlapping, smaller features stored in the dictionary
  // shall have an entry here to indicate it.
  private readonly _nodes: IFeatureDictionary<IQuadtreeCoord, IFeature<IQuadtreeCoord>>;

  private readonly _sparse: boolean;
  private _rootSize: number;
  private _sizes: number[]; // in descending order starting with the root size

  // Set `sparse` to true to not bother storing default features at all, which means they
  // will not appear in any `forEach` or enumeration.
  constructor(
    quadtree: IQuadtree<IQuadtreeCoord>,
    createDefaultFeature: (c: IQuadtreeCoord) => F,
    featuresEqualIgnoringPosition: (a: F, b: F) => boolean,
    isDefaultFeature: (f: F) => boolean,
    sparse?: boolean | undefined
  ) {
    this._quadtree = quadtree;
    this._createDefaultFeature = createDefaultFeature;
    this._featuresEqualIgnoringPosition = featuresEqualIgnoringPosition;
    this._isDefaultFeature = isDefaultFeature;
    this._features = new FeatureDictionary<IQuadtreeCoord, F>(quadtree.toString);
    this._nodes = new FeatureDictionary<IQuadtreeCoord, IFeature<IQuadtreeCoord>>(quadtree.toString);
    this._sparse = sparse ?? false;
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
    if (!this._sparse) {
      this._features.add(this._createDefaultFeature({ x: -1, y: -1, size: 1 }));
      this._features.add(this._createDefaultFeature({ x: 0, y: -1, size: 1 }));
      this._features.add(this._createDefaultFeature({ x: 0, y: 0, size: 1 }));
      this._features.add(this._createDefaultFeature({ x: -1, y: 0, size: 1 }));
    }
  }

  private clearSubtree(q: IQuadtreeCoord) {
    var stack = [q];
    while (true) {
      const q2 = stack.pop();
      if (q2 === undefined) {
        return;
      }

      this._features.remove(q2);
      const node = this._nodes.remove(q2);
      if (node !== undefined) {
        stack.push(...this._quadtree.descend(q2));
      }
    }
  }

  private expandBounds() {
    // Expands the bounds by one single step and fills in the default feature.
    // Call repeatedly if need be.
    const oldSize = this._rootSize;
    this._rootSize *= 2;
    this._sizes.splice(0, 0, this._rootSize);
    const bounds = this.bounds;

    // Bottom left
    if (!this._sparse) {
      this._features.add(this._createDefaultFeature({ x: bounds.min.x, y: bounds.min.y, size: oldSize }));
      this._features.add(this._createDefaultFeature({ x: bounds.min.x + oldSize, y: bounds.min.y, size: oldSize }));
      this._features.add(this._createDefaultFeature({ x: bounds.min.x, y: bounds.min.y + oldSize, size: oldSize }));
    }
    this._nodes.add({ colour: 0, position: { x: bounds.min.x, y: bounds.min.y, size: this._rootSize } });
    this.mergeEqual(this._createDefaultFeature({ x: bounds.min.x, y: bounds.min.y, size: oldSize }), this._sparse);

    // Bottom right
    if (!this._sparse) {
      this._features.add(this._createDefaultFeature({ x: bounds.min.x + this._rootSize, y: bounds.min.y, size: oldSize }));
      this._features.add(this._createDefaultFeature({ x: bounds.min.x + this._rootSize + oldSize, y: bounds.min.y, size: oldSize }));
      this._features.add(this._createDefaultFeature({ x: bounds.min.x + this._rootSize + oldSize, y: bounds.min.y + oldSize, size: oldSize }));
    }
    this._nodes.add({ colour: 0, position: { x: bounds.min.x + this._rootSize, y: bounds.min.y, size: this._rootSize } });
    this.mergeEqual(this._createDefaultFeature({ x: bounds.min.x + this._rootSize, y: bounds.min.y, size: oldSize }), this._sparse);

    // Top right
    if (!this._sparse) {
      this._features.add(this._createDefaultFeature({ x: bounds.min.x + this._rootSize, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }));
      this._features.add(this._createDefaultFeature({ x: bounds.min.x + this._rootSize + oldSize, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }));
      this._features.add(this._createDefaultFeature({ x: bounds.min.x + this._rootSize + oldSize, y: bounds.min.y + this._rootSize, size: oldSize }));
    }
    this._nodes.add({ colour: 0, position: { x: bounds.min.x + this._rootSize, y: bounds.min.y + this._rootSize, size: this._rootSize } });
    this.mergeEqual(this._createDefaultFeature({ x: bounds.min.x + this._rootSize, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }), this._sparse);

    // Top left
    if (!this._sparse) {
      this._features.add(this._createDefaultFeature({ x: bounds.min.x, y: bounds.min.y + this._rootSize, size: oldSize }));
      this._features.add(this._createDefaultFeature({ x: bounds.min.x, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }));
      this._features.add(this._createDefaultFeature({ x: bounds.min.x + oldSize, y: bounds.min.y + this._rootSize + oldSize, size: oldSize }));
    }
    this._nodes.add({ colour: 0, position: { x: bounds.min.x, y: bounds.min.y + this._rootSize, size: this._rootSize } });
    this.mergeEqual(this._createDefaultFeature({ x: bounds.min.x, y: bounds.min.y + this._rootSize, size: oldSize }), this._sparse);
  }

  private isOutsideBounds(c: IQuadtreeCoord) {
    return c.x < this.bounds.min.x || c.y < this.bounds.min.y ||
      (c.x + c.size) > this.bounds.max.x || (c.y + c.size) > this.bounds.max.y;
  }

  private mergeEqual(f: F, dontAdd: boolean) {
    while (true) {
      // Get the larger size
      var larger = this._quadtree.ascend(f.position);
      if (larger.size > this._rootSize) {
        return f;
      }

      // Get all the samples at this larger size that aren't our target size.
      // If any of the sampled features are different, we can't merge.
      for (var d of this._quadtree.descend(larger)) {
        if (this._quadtree.equals(d, f.position)) {
          continue;
        }

        var node = this._nodes.get(d);
        if (node !== undefined) {
          return f;
        }

        var sample = this._features.get(d) ?? this._createDefaultFeature(d);
        if (!this._featuresEqualIgnoringPosition(sample, f)) {
          return f;
        }
      }

      // If we got here, do the merge and continue upwards:
      for (d of this._quadtree.descend(larger)) {
        this._features.remove(d);
      }

      this._nodes.remove(larger);
      f = { ...f, position: larger };
      if (!dontAdd) {
        this._features.add(f);
      }
    }
  }

  // Gets our current bounds (always a square; inclusive, exclusive).
  get bounds() {
    return {
      min: { x: -this._rootSize, y: -this._rootSize, size: this._rootSize },
      max: { x: this._rootSize, y: this._rootSize, size: this._rootSize }
    };
  }

  // Returns true if this quadtree colouring is sparse (default features won't be enumerated.)
  get sparse() { return this._sparse; }

  [Symbol.iterator](): Iterator<F> {
    return this.iterate();
  }

  // Clears the whole thing:
  clear() {
    this.clearInternal();
  }

  // Changes the feature at the exact coord indicated by the parameter's position.
  // Doesn't change the topology of the quadtree.  The size must be 1.
  // Returns the changed feature, or undefined for no change.
  fill(f: F) {
    if (f.position.size !== 1 || this.isOutsideBounds(f.position)) {
      throw RangeError("Invalid fill position: " + this._quadtree.toString(f.position));
    }

    const sample = this.sample(f.position) ?? this._createDefaultFeature(f.position);
    if (this._featuresEqualIgnoringPosition(sample, f)) {
      return undefined;
    } else {
      this._features.remove(sample.position);
      const newFeature = { ...f, position: sample.position };
      if (!this._sparse || !this._isDefaultFeature(f)) {
        this._features.add(newFeature);
      }
      return newFeature;
    }
  }

  forEach(fn: (f: F) => void) {
    this._features.forEach(fn);
  }

  *iterate() {
    for (var f of this._features) {
      yield f;
    }
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
      var node = this._nodes.get(q);
      if (node !== undefined) {
        continue;
      }

      var here = this._features.get(q) ?? this._createDefaultFeature(q);
      return here;
    }

    return undefined;
  }

  // Sets a feature here, at the given granularity or a lower if possible, merging equal
  // features where we can.
  // TODO #58 No, make this firmly defined as "set at the *specified* granularity" and
  // create a new fill() function that replaces the colour, at whatever granularity
  // currently exists.
  // Note that setting a feature at size>1 will destroy any more granular features that
  // might have been present.
  // Returns the final feature after merging, or undefined for no change.
  set(f: F) {
    // TODO #58 I made this very slow, and I don't understand why.
    if (!this._quadtree.isValid(f.position)) {
      throw RangeError("Invalid position: " + this._quadtree.toString(f.position));
    }

    while (this.isOutsideBounds(f.position)) {
      this.expandBounds();
    }

    for (var size of this._sizes) {
      var q = this._quadtree.ascend(f.position, size);
      if (this._nodes.get(q) !== undefined) {
        if (size === f.position.size) {
          // We want to replace the subtree here: remove it.
          this.clearSubtree(f.position);
        } else {
          // This is already split; try the higher granularity.
          continue;
        }
      }

      var maybeHere = this._features.remove(q); // should only be undefined for a sparse tree
      if (size > f.position.size) {
        // Replicate what is here into a node
        if (!this._nodes.add({ position: q, colour: 0 })) {
          throw Error("Unexpected node at " + this._quadtree.toString(q));
        }

        if (maybeHere !== undefined) {
          for (var q2 of this._quadtree.descend(q)) {
            if (!this._features.add({ ...maybeHere, position: q2 })) {
              throw Error("Unexpected feature at " + this._quadtree.toString(q2));
            }
          }
        }
      } else {
        // Set the value here
        var here = maybeHere ?? this._createDefaultFeature(q);
        var dontAdd = this._sparse && this._isDefaultFeature(f);
        if (!dontAdd) {
          this._features.add(f);
        }

        var merged = this.mergeEqual(f, dontAdd);
        return this._featuresEqualIgnoringPosition(here, f) ? undefined : merged;
      }
    }

    // If we got here, the feature wasn't valid.
    throw RangeError("Failed to add feature (not valid?) at " + this._quadtree.toString(f.position));
  }
}