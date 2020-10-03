import { IGridCoord, defaultGridCoord, IGridEdge, IGridVertex, defaultGridEdge } from './coord';
import { v4 as uuidv4 } from 'uuid';

// Describes an instanced feature:
// (Must be possible to copy this with Object.assign)
export interface IFeature<K> {
  position: K;
  colour: number;
}

// Some features have a string id
export interface IIdFeature<K> extends IFeature<K> {
  id: string;
}

// A token has some extra properties:
export type TokenSize = "1" | "2" | "2 (left)" | "2 (right)" | "3" | "4" | "4 (left)" | "4 (right)";
export interface ITokenProperties {
  id: string; // a UUID for this token, that follows it around
  colour: number;
  players: string[]; // the uids of the players that can move this token
  size: TokenSize;
  text: string; // maximum of three characters
  note: string; // shown in the annotations UI
  noteVisibleToPlayers: boolean; // as you'd expect
}

export const defaultTokenProperties: ITokenProperties = {
  colour: 0,
  id: uuidv4(),
  players: [],
  size: "1",
  text: "",
  note: "",
  noteVisibleToPlayers: false
};

export interface IToken extends IIdFeature<IGridCoord>, ITokenProperties {}

export const defaultArea: IFeature<IGridCoord> = {
  position: defaultGridCoord,
  colour: 0
};

export const defaultToken: IToken = {
  position: defaultGridCoord,
  ...defaultTokenProperties
};

export const defaultWall: IFeature<IGridEdge> = {
  position: defaultGridEdge,
  colour: 0
};

// The interface of a dictionary of these
export interface IFeatureDictionary<K extends IGridCoord, F extends IFeature<K>> extends Iterable<F> {
  // Returns true if the feature wasn't already present (we added it), else false
  // (we didn't replace it.)
  add(f: F): boolean;

  // Removes everything
  clear(): void;

  // Returns a shallow copy of this dictionary
  clone(): IFeatureDictionary<K, F>;

  // Iterates over everything
  forEach(fn: (f: F) => void): void;

  // Gets an entry by coord or undefined if it wasn't there
  get(k: K): F | undefined;

  // Iterates over the contents.
  iterate(): Iterable<F>;

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

  protected get values() { return this._values; }

  [Symbol.iterator](): Iterator<F> {
    return this.iterate();
  }

  add(f: F) {
    const i = this._toIndex(f.position);
    if (i in this._values) {
      return false;
    }

    this._values[i] = f;
    return true;
  }

  clear() {
    this._values = {};
  }

  clone() {
    const clonedValues: { [index: string]: F } = {};
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

  *iterate() {
    for (const i in this._values) {
      yield this._values[i];
    }
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

  // This is deliberately not in the interface, because implementations that do other
  // things e.g. track drawn objects would need to do an add/remove operation to
  // update themselves
  set(f: F) {
    const i = this._toIndex(f.position);
    this._values[i] = f;
  }
}

// #119: A token dictionary provides a distinction between:
// - The coords that tokens are homed at, and
// - The coords that are *occupied* by tokens, which is more in the case of larger tokens.
// Here we provide the latter in the form of the `at` method.  We also make it possible to
// look up tokens by id, which allows us to decouple a lot of the UI from token positioning.
export interface ITokenDictionary extends IFeatureDictionary<IGridCoord, IToken> {
  // Returns the token that occupies this grid face, or undefined if none.
  // (Distinct from `get` which will only return a token if its native
  // position is the given one.)
  at(face: IGridCoord): IToken | undefined;

  // Returns all the face positions of a given token.
  enumerateFacePositions(token: IToken): Iterable<IGridCoord>;

  // Returns all the fill edge positions of a given token.
  // (Probably won't need calling externally.)
  enumerateFillEdgePositions(token: IToken): Iterable<IGridEdge>;

  // Returns all the fill vertex positions of a given token.
  // (Probably won't need calling externally.)
  enumerateFillVertexPositions(token: IToken): Iterable<IGridVertex>;

  // Returns the token with the given id, or undefined for none.
  ofId(id: string): IToken | undefined;
}