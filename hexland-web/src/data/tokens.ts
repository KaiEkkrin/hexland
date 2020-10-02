import { coordString, IGridCoord } from "./coord";
import { FeatureDictionary, IFeatureDictionary, IIdFeature, IToken, ITokenDictionary, ITokenProperties } from "./feature";
import { MapType } from "./map";

// Implements the tokens dictionary, using one or more token faces to
// draw each token.
// Note that cloning this creates an internal clone of the faces dictionary too,
// which won't be attached to anything else.  (Concrete subclasses must override
// the `clone` method.)
abstract class Tokens<K extends IGridCoord, F extends IIdFeature<IGridCoord>> extends FeatureDictionary<K, IToken<K>> implements ITokenDictionary<K> {
  private _faces: IFeatureDictionary<IGridCoord, F>;
  private readonly _createFace: (token: ITokenProperties, position: IGridCoord) => F;
  private _byId: { [id: string]: IToken<K> };

  constructor(
    toIndex: (coord: K) => string,
    faces: IFeatureDictionary<IGridCoord, F>,
    createFace: (token: ITokenProperties, position: IGridCoord) => F,
    values?: { [key: string]: IToken<K> } | undefined,
    byId?: { [id: string]: IToken<K> } | undefined
  ) {
    super(toIndex, values);
    this._faces = faces;
    this._createFace = createFace;
    this._byId = byId ?? {};
  }

  protected get faces() { return this._faces; }
  protected get createFace() { return this._createFace; }
  protected get byId() { return this._byId; }

  private revertAdd(token: IToken<K>, faces: IGridCoord[]) {
    for (const face of faces) {
      this._faces.remove(face);
    }

    super.remove(token.position);
  }

  add(token: IToken<K>) {
    if (super.add(token) === true) {
      // Record the token faces we added -- if we get a failure we want to be
      // able to roll this back
      const added: IGridCoord[] = [];

      // Add the token's faces
      for (const face of this.enumerateFacePositions(token)) {
        const faceToken = this._createFace(token, face);
        if (this._faces.add(faceToken) === false) {
          // This token doesn't fit here.  Roll back any changes we've already
          // made:
          this.revertAdd(token, added);
          return false;
        } else {
          // This token fits here -- note that we added this face and continue
          added.push(face);
        }
      }

      // If the token's ID is already in use that's also a rollback
      if (token.id in this._byId) {
        this.revertAdd(token, added);
        return false;
      }

      this._byId[token.id] = token;
      return true;
    } else {
      return false;
    }
  }

  at(face: IGridCoord) {
    const faceToken = this._faces.get(face);
    return faceToken !== undefined ? this._byId[faceToken.id] : undefined;
  }

  clear() {
    // We can't naively clear our token faces here -- because it might be in use
    // by more than one token dictionary.  Instead, we need to carefully remove
    // each one we're responsible for.
    // Don't worry, I doubt this method will ever be performance-critical...
    for (const token of this.iterate()) {
      for (const face of this.enumerateFacePositions(token)) {
        this._faces.remove(face);
      }
    }

    // Now we can clear the rest
    super.clear();
    this._byId = {};
  }

  abstract enumerateFacePositions(token: IToken<K>): Iterable<IGridCoord>;

  ofId(id: string) {
    return this._byId[id];
  }

  remove(k: K): IToken<K> | undefined {
    const removed = super.remove(k);
    if (removed !== undefined) {
      for (const face of this.enumerateFacePositions(removed)) {
        this._faces.remove(face);
      }

      delete this._byId[removed.id];
      return removed;
    } else {
      return undefined;
    }
  }
}

// #119: We define concretes for face and vertex tokens for each of the map types.

class TokensHex<F extends IIdFeature<IGridCoord>> extends Tokens<IGridCoord, F> {
  constructor(
    faces: IFeatureDictionary<IGridCoord, F>,
    createFace: (token: ITokenProperties, position: IGridCoord) => F,
    values?: { [index: string]: IToken<IGridCoord> } | undefined,
    byId?: { [id: string]: IToken<IGridCoord> } | undefined
  ) {
    super(coordString, faces, createFace, values, byId);
  }

  clone() {
    return new TokensHex<F>(
      this.faces.clone(),
      this.createFace,
      { ...this.values },
      { ...this.byId }
    );
  }

  *enumerateFacePositions(token: IToken<IGridCoord>) {
    // Always, the centre position:
    yield token.position;

    // At size=3, the six tokens around it too:
    if (token.size === 3) {
      yield { x: token.position.x - 1, y: token.position.y };
      yield { x: token.position.x - 1, y: token.position.y + 1 };
      yield { x: token.position.x, y: token.position.y + 1 };
      yield { x: token.position.x + 1, y: token.position.y };
      yield { x: token.position.x + 1, y: token.position.y - 1 };
      yield { x: token.position.x, y: token.position.y - 1 };
    }
  }
}

class TokensSquare<F extends IIdFeature<IGridCoord>> extends Tokens<IGridCoord, F> {
  constructor(
    faces: IFeatureDictionary<IGridCoord, F>,
    createFace: (token: ITokenProperties, position: IGridCoord) => F,
    values?: { [index: string]: IToken<IGridCoord> } | undefined,
    byId?: { [id: string]: IToken<IGridCoord> } | undefined
  ) {
    super(coordString, faces, createFace, values, byId);
  }

  clone() {
    return new TokensSquare<F>(
      this.faces.clone(),
      this.createFace,
      { ...this.values },
      { ...this.byId }
    );
  }

  *enumerateFacePositions(token: IToken<IGridCoord>) {
    // Always, the centre position:
    yield token.position;

    // At size=3, the six tokens around it too:
    if (token.size === 3) {
      yield { x: token.position.x - 1, y: token.position.y };
      yield { x: token.position.x, y: token.position.y + 1 };
      yield { x: token.position.x + 1, y: token.position.y };
      yield { x: token.position.x, y: token.position.y - 1 };
    }
  }
}

export function createTokenDictionary<F extends IIdFeature<IGridCoord>>(
  mapType: MapType,
  faces: IFeatureDictionary<IGridCoord, F>,
  createFace: (token: ITokenProperties, position: IGridCoord) => F
) {
  switch (mapType) {
    case MapType.Hex: return new TokensHex<F>(faces, createFace);
    case MapType.Square: return new TokensSquare<F>(faces, createFace);
    default: throw RangeError("Map type not recognised");
  }
}