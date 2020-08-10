import { IGridCoord } from './coord';

// Describes an instanced feature:
// (Must be possible to copy this with Object.assign)
export interface IFeature<K> {
  position: K;
  colour: number;
}

// A token has some extra properties:
export interface IToken extends IFeature<IGridCoord> {
  players: string[]; // the uids of the players that can move this token
  text: string;
}

// The interface of a dictionary of these
export interface IFeatureDictionary<K extends IGridCoord, F extends IFeature<K>> {
  all: F[];

  // Returns true if the feature wasn't already present (we added it), else false
  // (we didn't replace it.)
  add(f: F): boolean;

  // Returns true if there's anything here, else false.
  any(): boolean;

  // Removes everything
  clear(): void;

  // Returns a shallow copy of this dictionary
  clone(): IFeatureDictionary<K, F>;

  // Iterates over everything
  forEach(fn: (f: F) => void): void;

  // Gets an entry by coord or undefined if it wasn't there
  get(k: K): F | undefined;

  // Removes an entry, returning what it was or undefined if there wasn't one
  remove(k: K): F | undefined;
}

// A basic feature dictionary that can be re-used or extended
export class FeatureDictionary<K extends IGridCoord, F extends IFeature<K>> implements IFeatureDictionary<K, F> {
  private readonly _toIndex: (coord: K) => string;
  private _values: { [index: string]: F };

  constructor(toIndex: (coord: K) => string, values?: { [index: string]: F } | undefined) {
    this._toIndex = toIndex;
    this._values = values ?? {};
  }

  get all(): F[] {
    const features: F[] = [];
    for (var i in this._values) {
      features.push(this._values[i]);
    }
    return features;
  }

  add(f: F) {
    const i = this._toIndex(f.position);
    if (i in this._values) {
      return false;
    }

    this._values[i] = f;
    return true;
  }

  any() {
    for (const i in this._values) {
      return true;
    }

    return false;
  }

  clear() {
    this._values = {};
  }

  clone() {
    var clonedValues: { [index: string]: F } = {};
    Object.assign(clonedValues, this._values);
    return new FeatureDictionary<K, F>(this._toIndex, clonedValues);
  }

  forEach(fn: (f: F) => void) {
    for (const i in this._values) {
      fn(this._values[i]);
    }
  }

  get(k: K): F | undefined {
    const i = this._toIndex(k);
    return (i in this._values) ? this._values[i] : undefined;
  }

  remove(k: K): F | undefined {
    const i = this._toIndex(k);
    if (i in this._values) {
      const f = this._values[i];
      delete this._values[i];
      return f;
    }

    return undefined;
  }
}