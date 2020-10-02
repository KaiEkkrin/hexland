import { coordString, IGridCoord } from "./coord";
import { FeatureDictionary, IFeatureDictionary, IIdFeature, IToken, ITokenDictionary, ITokenProperties } from "./feature";
import { MapType } from "./map";

// Implements the tokens dictionary, using one or more token faces to
// draw each token.
// Note that cloning this creates an internal clone of the faces dictionary too,
// which won't be attached to anything else.  (Concrete subclasses must override
// the `clone` method.)
abstract class Tokens extends FeatureDictionary<IGridCoord, IToken> implements ITokenDictionary {
  private _faces: IFeatureDictionary<IGridCoord, IIdFeature<IGridCoord>>;
  private readonly _createFace: (token: ITokenProperties, position: IGridCoord) => IIdFeature<IGridCoord>;
  private _byId: { [id: string]: IToken };

  constructor(
    faces: IFeatureDictionary<IGridCoord, IIdFeature<IGridCoord>>,
    createFace: (token: ITokenProperties, position: IGridCoord) => IIdFeature<IGridCoord>,
    values?: { [key: string]: IToken } | undefined,
    byId?: { [id: string]: IToken } | undefined
  ) {
    super(coordString, values);
    this._faces = faces;
    this._createFace = createFace;
    this._byId = byId ?? {};
  }

  protected get faces() { return this._faces; }
  protected get createFace() { return this._createFace; }
  protected get byId() { return this._byId; }

  private revertAdd(token: IToken, faces: IGridCoord[]) {
    for (const face of faces) {
      this._faces.remove(face);
    }

    super.remove(token.position);
  }

  add(token: IToken) {
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

  abstract enumerateFacePositions(token: IToken): Iterable<IGridCoord>;

  ofId(id: string) {
    return this._byId[id];
  }

  remove(k: IGridCoord): IToken | undefined {
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

class TokensHex extends Tokens {
  clone() {
    return new TokensHex(
      this.faces.clone(),
      this.createFace,
      { ...this.values },
      { ...this.byId }
    );
  }

  *enumerateFacePositions(token: IToken) {
    // Always, the centre position:
    yield token.position;
    if (token.size === "1") {
      return;
    }

    if (token.size.indexOf('l') >= 0) {
      // The two left positions:
      yield { x: token.position.x - 1, y: token.position.y };
      yield { x: token.position.x - 1, y: token.position.y + 1 };
      if (token.size[0] === '2') {
        return;
      }

      // The rest of the 3
      yield { x: token.position.x, y: token.position.y + 1 };
      yield { x: token.position.x + 1, y: token.position.y };
      yield { x: token.position.x + 1, y: token.position.y - 1 };
      yield { x: token.position.x, y: token.position.y - 1 };
      if (token.size === '3') {
        return;
      }

      // The five further left positions:
      yield { x: token.position.x - 1, y: token.position.y - 1 };
      yield { x: token.position.x - 2, y: token.position.y };
      yield { x: token.position.x - 2, y: token.position.y + 1 };
      yield { x: token.position.x - 2, y: token.position.y + 2 };
      yield { x: token.position.x - 1, y: token.position.y + 2 };
    } else {
      // The two top-left positions:
      yield { x: token.position.x, y: token.position.y - 1 };
      yield { x: token.position.x - 1, y: token.position.y };
      if (token.size[0] === '2') {
        return;
      }

      // The rest of the 3
      yield { x: token.position.x - 1, y: token.position.y + 1 };
      yield { x: token.position.x, y: token.position.y + 1 };
      yield { x: token.position.x + 1, y: token.position.y };
      yield { x: token.position.x + 1, y: token.position.y - 1 };
      if (token.size === '3') {
        return;
      }

      // The five further top-left positions:
      yield { x: token.position.x + 1, y: token.position.y - 2 };
      yield { x: token.position.x, y: token.position.y - 2 };
      yield { x: token.position.x - 1, y: token.position.y - 1 };
      yield { x: token.position.x - 2, y: token.position.y };
      yield { x: token.position.x - 2, y: token.position.y + 1 };
    }
  }
}

class TokensSquare extends Tokens {
  clone() {
    return new TokensSquare(
      this.faces.clone(),
      this.createFace,
      { ...this.values },
      { ...this.byId }
    );
  }

  *enumerateFacePositions(token: IToken) {
    // Always, the centre position:
    yield token.position;
    if (token.size === '1') {
      return;
    }

    // The three top-left positions:
    yield { x: token.position.x, y: token.position.y - 1 };
    yield { x: token.position.x - 1, y: token.position.y - 1 };
    yield { x: token.position.x - 1, y: token.position.y };
    if (token.size[0] === '2') {
      return;
    }

    // Complete the 3:
    yield { x: token.position.x - 1, y: token.position.y + 1 };
    yield { x: token.position.x, y: token.position.y + 1 };
    yield { x: token.position.x + 1, y: token.position.y + 1 };
    yield { x: token.position.x + 1, y: token.position.y };
    yield { x: token.position.x + 1, y: token.position.y - 1 };
    if (token.size === '3') {
      return;
    }

    // The seven further top-left positions:
    yield { x: token.position.x + 1, y: token.position.y - 2 };
    yield { x: token.position.x, y: token.position.y - 2 };
    yield { x: token.position.x - 1, y: token.position.y - 2 };
    yield { x: token.position.x - 2, y: token.position.y - 2 };
    yield { x: token.position.x - 2, y: token.position.y - 1 };
    yield { x: token.position.x - 2, y: token.position.y };
    yield { x: token.position.x - 2, y: token.position.y + 1 };
  }
}

export function createTokenDictionary(
  mapType: MapType,
  faces: IFeatureDictionary<IGridCoord, IIdFeature<IGridCoord>>,
  createFace: (token: ITokenProperties, position: IGridCoord) => IIdFeature<IGridCoord>
) {
  switch (mapType) {
    case MapType.Hex: return new TokensHex(faces, createFace);
    case MapType.Square: return new TokensSquare(faces, createFace);
    default: throw RangeError("Map type not recognised");
  }
}