import { IGridCoord, defaultGridCoord, IGridEdge, IGridVertex, defaultGridEdge } from './coord';
import { ISprite } from './sprite';
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
// (Remember to keep `parseTokenSize` below in sync with this definition if it changes)
export type TokenSize = "1" | "2" | "2 (left)" | "2 (right)" | "3" | "4" | "4 (left)" | "4 (right)";
export interface ITokenProperties {
  id: string; // a UUID for this token, that follows it around
  colour: number;
  players: string[]; // the uids of the players that can move this token
  size: TokenSize;
  text: string; // maximum of three characters
  note: string; // shown in the annotations UI
  noteVisibleToPlayers: boolean; // as you'd expect
  sprites: ISprite[]; // should be only 0 or 1, but this format makes it easy for Firestore
}

export const defaultTokenProperties: ITokenProperties = {
  colour: 0,
  id: uuidv4(),
  players: [],
  size: "1",
  text: "",
  note: "",
  noteVisibleToPlayers: false,
  sprites: []
};

export function flipToken(token: ITokenProperties): ITokenProperties | undefined {
  if (token.size === '2 (left)') {
    return { ...token, size: '2 (right)' };
  } else if (token.size === '2 (right)') {
    return { ...token, size: '2 (left)' };
  } else if (token.size === '4 (left)') {
    return { ...token, size: '4 (right)' };
  } else if (token.size === '4 (right)') {
    return { ...token, size: '4 (left)' };
  } else {
    return undefined;
  }
}

export function parseTokenSize(s: string): TokenSize {
  if (/^[1-4]$/.test(s) || /^[24] \((left|right)\)$/.test(s)) {
    return s as TokenSize;
  } else {
    // fall back to the default value
    return "1";
  }
}

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

// We use this internally to provide the sprite URL after having gone through the (asynchronous)
// method of resolving it from the path.

export interface IResolvedTokenProperties extends ITokenProperties {
  spriteUrl: string;
}

export interface IResolvedToken extends IToken, IResolvedTokenProperties {}

// Token text is positioned either at a coord or a vertex.  We can cheat slightly
// and use the vertex structure for the coord too, complete with the `atVertex` flag.
// This one is used only internally, derived from the token, and never added as part
// of a change.
export interface ITokenText extends IFeature<IGridVertex> {
  atVertex: boolean
  size: number,
  text: string,
}

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
  private readonly _values: Map<string, F>;

  // This constructor copies the given values if defined.
  constructor(toIndex: (coord: K) => string, values?: Map<string, F> | undefined) {
    this._toIndex = toIndex;
    this._values = values !== undefined ? new Map<string, F>(values) : new Map<string, F>();
  }

  protected get values() { return this._values; }

  [Symbol.iterator](): Iterator<F> {
    return this.iterate();
  }

  add(f: F) {
    const i = this._toIndex(f.position);
    if (this._values.has(i)) {
      return false;
    }

    this._values.set(i, f);
    return true;
  }

  clear() {
    this._values.clear();
  }

  clone(): IFeatureDictionary<K, F> {
    return new FeatureDictionary<K, F>(this._toIndex, this._values);
  }

  forEach(fn: (f: F) => void) {
    this._values.forEach(fn);
  }

  get(k: K): F | undefined {
    const i = this._toIndex(k);
    return this._values.get(i);
  }

  *iterate() {
    for (const v of this._values) {
      yield v[1];
    }
  }

  remove(k: K): F | undefined {
    const i = this._toIndex(k);
    const value = this._values.get(i);
    if (value !== undefined) {
      this._values.delete(i);
      return value;
    }

    return undefined;
  }

  // This is deliberately not in the interface, because implementations that do other
  // things e.g. track drawn objects would need to do an add/remove operation to
  // update themselves
  set(f: F) {
    const i = this._toIndex(f.position);
    this._values.set(i, f);
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

  // The clone should produce a token dictionary
  clone(): ITokenDictionary;

  // Returns all the face positions of a given token.
  enumerateFacePositions(token: IToken): Iterable<IGridCoord>;

  // Returns all the fill edge positions of a given token.
  // (Probably won't need calling externally.)
  enumerateFillEdgePositions(token: IToken): Iterable<IGridEdge>;

  // Returns all the fill vertex positions of a given token.
  // (Probably won't need calling externally.)
  enumerateFillVertexPositions(token: IToken): Iterable<IGridVertex>;

  // Gets the text position of a given token.
  getTextPosition(token: IToken): IGridVertex;

  // Returns true if the text should be positioned at the vertex or false for the
  // face centre.
  getTextAtVertex(token: IToken): boolean;

  // Returns true if we have a fill edge here, else false.  (For checking for
  // conflicts with walls.)
  hasFillEdge(edge: IGridEdge): boolean;

  // Returns the token with the given id, or undefined for none.
  ofId(id: string): IToken | undefined;
}