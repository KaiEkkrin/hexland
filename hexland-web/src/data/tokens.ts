import { coordString, edgeString, IGridCoord, IGridEdge, IGridVertex, vertexString } from "./coord";
import { FeatureDictionary, IFeature, IFeatureDictionary, IIdFeature, IToken, ITokenDictionary, ITokenProperties } from "./feature";
import { MapType } from "./map";

// Describes how to draw a collection of tokens, complete with fill-in edges and vertices
// for larger ones.
export interface ITokenDrawing<F extends IFeature<IGridCoord>> {
  faces: IFeatureDictionary<IGridCoord, F>;
  fillEdges: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>;
  fillVertices: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>>;

  // Makes a clone of this object.
  clone(): ITokenDrawing<F>;

  // How to create suitable faces, fill edges and fill vertices.
  createFace(token: ITokenProperties, position: IGridCoord): F;
  createFillEdge(token: ITokenProperties, position: IGridEdge): IFeature<IGridEdge>;
  createFillVertex(token: ITokenProperties, position: IGridVertex): IFeature<IGridVertex>;

  // Cleans up (may be unnecessary.)
  dispose(): void;
}

// A super basic one for non-displayed use
export abstract class BaseTokenDrawing<F extends IFeature<IGridCoord>> implements ITokenDrawing<F> {
  private readonly _faces: IFeatureDictionary<IGridCoord, F>;
  private readonly _fillEdges: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>;
  private readonly _fillVertices: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>>;

  constructor(
    faces?: IFeatureDictionary<IGridCoord, F> | undefined,
    fillEdges?: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>> | undefined,
    fillVertices?: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>> | undefined
  ) {
    this._faces = faces ?? new FeatureDictionary<IGridCoord, F>(coordString);
    this._fillEdges = fillEdges ?? new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
    this._fillVertices = fillVertices ?? new FeatureDictionary<IGridVertex, IFeature<IGridVertex>>(vertexString);
  }

  get faces() { return this._faces; }
  get fillEdges() { return this._fillEdges; }
  get fillVertices() { return this._fillVertices; }

  abstract clone(): ITokenDrawing<F>;
  abstract createFace(token: ITokenProperties, position: IGridCoord): F;

  createFillEdge(token: ITokenProperties, position: IGridEdge): IFeature<IGridEdge> {
    return { position: position, colour: token.colour };
  }

  createFillVertex(token: ITokenProperties, position: IGridVertex): IFeature<IGridVertex> {
    return { position: position, colour: token.colour };
  }

  dispose() {
  }
}

export class SimpleTokenDrawing extends BaseTokenDrawing<IToken> {
  clone() {
    return new SimpleTokenDrawing(this.faces.clone(), this.fillEdges.clone(), this.fillVertices.clone());
  }

  createFace(token: ITokenProperties, position: IGridCoord) {
    return { ...token, position: position };
  }
}

// Implements the tokens dictionary, using one or more token faces to
// draw each token.
// Note that cloning this creates an internal clone of the faces dictionary too,
// which won't be attached to anything else.  (Concrete subclasses must override
// the `clone` method.)
abstract class Tokens extends FeatureDictionary<IGridCoord, IToken> implements ITokenDictionary {
  private readonly _drawing: ITokenDrawing<IIdFeature<IGridCoord>>;
  private _byId: { [id: string]: IToken };

  constructor(
    drawing: ITokenDrawing<IIdFeature<IGridCoord>>,
    values?: { [key: string]: IToken } | undefined,
    byId?: { [id: string]: IToken } | undefined
  ) {
    super(coordString, values);
    this._drawing = drawing;
    this._byId = byId ?? {};
  }

  protected get drawing() { return this._drawing; }
  protected get byId() { return this._byId; }

  private revertAdd(token: IToken, faces: IGridCoord[], edges: IGridEdge[], vertices: IGridVertex[]) {
    for (const face of faces) {
      this._drawing.faces.remove(face);
    }

    super.remove(token.position);
  }

  add(token: IToken) {
    if (super.add(token) === true) {
      // Record the things we added -- if we get a failure we want to be
      // able to roll this back
      const addedFaces: IGridCoord[] = [];
      const addedEdges: IGridEdge[] = [];
      const addedVertices: IGridVertex[] = [];

      // Add the token's faces
      for (const face of this.enumerateFacePositions(token)) {
        const faceToken = this._drawing.createFace(token, face);
        if (this._drawing.faces.add(faceToken) === false) {
          // This token doesn't fit here.  Roll back any changes we've already
          // made:
          this.revertAdd(token, addedFaces, addedEdges, addedVertices);
          return false;
        } else {
          // This token fits here -- note that we added this face and continue
          addedFaces.push(face);
        }
      }

      // If the token's ID is already in use that's also a rollback
      if (token.id in this._byId) {
        this.revertAdd(token, addedFaces, addedEdges, addedVertices);
        return false;
      }

      this._byId[token.id] = token;
      return true;
    } else {
      return false;
    }
  }

  at(face: IGridCoord) {
    const faceToken = this._drawing.faces.get(face);
    return faceToken !== undefined ? this._byId[faceToken.id] : undefined;
  }

  clear() {
    // We can't naively clear our token faces here -- because it might be in use
    // by more than one token dictionary.  Instead, we need to carefully remove
    // each one we're responsible for.
    // Don't worry, I doubt this method will ever be performance-critical...
    for (const token of this.iterate()) {
      for (const face of this.enumerateFacePositions(token)) {
        this._drawing.faces.remove(face);
      }
    }

    // Now we can clear the rest
    super.clear();
    this._byId = {};
  }

  abstract enumerateFacePositions(token: IToken): Iterable<IGridCoord>;
  abstract enumerateFillEdgePositions(token: IToken): Iterable<IGridEdge>;
  abstract enumerateFillVertexPositions(token: IToken): Iterable<IGridVertex>;

  ofId(id: string) {
    return this._byId[id];
  }

  remove(k: IGridCoord): IToken | undefined {
    const removed = super.remove(k);
    if (removed !== undefined) {
      for (const face of this.enumerateFacePositions(removed)) {
        this._drawing.faces.remove(face);
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
      this.drawing.clone(),
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

  *enumerateFillEdgePositions(token: IToken): Iterable<IGridEdge> {
    // TODO #119
  }

  *enumerateFillVertexPositions(token: IToken): Iterable<IGridVertex> {
    // TODO #119
  }
}

class TokensSquare extends Tokens {
  clone() {
    return new TokensSquare(
      this.drawing.clone(),
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

  *enumerateFillEdgePositions(token: IToken): Iterable<IGridEdge> {
    // TODO #119
  }

  *enumerateFillVertexPositions(token: IToken): Iterable<IGridVertex> {
    // TODO #119
  }
}

export function createTokenDictionary(
  mapType: MapType,
  drawing: ITokenDrawing<IIdFeature<IGridCoord>>
) {
  switch (mapType) {
    case MapType.Hex: return new TokensHex(drawing);
    case MapType.Square: return new TokensSquare(drawing);
    default: throw RangeError("Map type not recognised");
  }
}