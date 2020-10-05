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
    // nothing to do by default
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

// A utility for the below
function removeAll<K extends IGridCoord, F extends IFeature<K>>(
  dict: IFeatureDictionary<K, F>,
  list: K[]
) {
  while (true) {
    const toRemove = list.pop();
    if (toRemove === undefined) {
      return;
    }
    dict.remove(toRemove);
  }
}

// Implements the tokens dictionary, using one or more token faces to
// draw each token.
// Note that cloning this creates an internal clone of the faces dictionary too,
// which won't be attached to anything else.  (Concrete subclasses must override
// the `clone` method.)
abstract class Tokens extends FeatureDictionary<IGridCoord, IToken> implements ITokenDictionary {
  private readonly _drawing: ITokenDrawing<IIdFeature<IGridCoord>>;
  private readonly _byId: Map<string, IToken>;

  constructor(
    drawing: ITokenDrawing<IIdFeature<IGridCoord>>,
    values?: Map<string, IToken> | undefined,
    byId?: Map<string, IToken> | undefined
  ) {
    super(coordString, values);
    this._drawing = drawing;
    this._byId = byId !== undefined ? new Map<string, IToken>(byId) : new Map<string, IToken>();
  }

  protected get drawing() { return this._drawing; }
  protected get byId() { return this._byId; }

  private revertAdd(token: IToken, addedFaces: IGridCoord[], addedEdges: IGridEdge[], addedVertices: IGridVertex[]) {
    removeAll(this._drawing.fillVertices, addedVertices);
    removeAll(this._drawing.fillEdges, addedEdges);
    removeAll(this._drawing.faces, addedFaces);
    this._byId.delete(token.id);
    super.remove(token.position);
  }

  add(token: IToken) {
    if (super.add(token) === true) {
      const addedFaces: IGridCoord[] = [];
      const addedEdges: IGridEdge[] = [];
      const addedVertices: IGridVertex[] = [];

      try { // paranoia ;) I'm not going to use exception driven logic on purpose, hopefully this won't cost
        // Make sure the token's id isn't already in use
        if (this._byId.has(token.id)) {
          this.revertAdd(token, addedFaces, addedEdges, addedVertices);
          return false;
        }
        this._byId.set(token.id, token);

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

        // Add the token's edges
        for (const edge of this.enumerateFillEdgePositions(token)) {
          const edgeToken = this._drawing.createFillEdge(token, edge);
          if (this._drawing.fillEdges.add(edgeToken) === false) {
            // This token doesn't fit here.  Roll back any changes we've already
            // made:
            this.revertAdd(token, addedFaces, addedEdges, addedVertices);
            return false;
          } else {
            addedEdges.push(edge);
          }
        }

        // Add the token's vertices
        for (const vertex of this.enumerateFillVertexPositions(token)) {
          const vertexToken = this._drawing.createFillVertex(token, vertex);
          if (this._drawing.fillVertices.add(vertexToken) === false) {
            // This token doesn't fit here.  Roll back any changes we've already
            // made:
            this.revertAdd(token, addedFaces, addedEdges, addedVertices);
            return false;
          } else {
            addedVertices.push(vertex);
          }
        }

        return true;
      } catch (e) {
        this.revertAdd(token, addedFaces, addedEdges, addedVertices);
        throw e;
      }
    } else {
      return false;
    }
  }

  at(face: IGridCoord) {
    const faceToken = this._drawing.faces.get(face);
    return faceToken !== undefined ? this._byId.get(faceToken.id) : undefined;
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

      for (const edge of this.enumerateFillEdgePositions(token)) {
        this._drawing.fillEdges.remove(edge);
      }

      for (const vertex of this.enumerateFillVertexPositions(token)) {
        this._drawing.fillVertices.remove(vertex);
      }
    }

    // Now we can clear the rest
    super.clear();
    this._byId.clear();
  }

  abstract enumerateFacePositions(token: IToken): Iterable<IGridCoord>;
  abstract enumerateFillEdgePositions(token: IToken): Iterable<IGridEdge>;
  abstract enumerateFillVertexPositions(token: IToken): Iterable<IGridVertex>;

  ofId(id: string) {
    return this._byId.get(id);
  }

  remove(k: IGridCoord): IToken | undefined {
    const removed = super.remove(k);
    if (removed !== undefined) {
      for (const vertex of this.enumerateFillVertexPositions(removed)) {
        this._drawing.fillVertices.remove(vertex);
      }

      for (const edge of this.enumerateFillEdgePositions(removed)) {
        this._drawing.fillEdges.remove(edge);
      }

      for (const face of this.enumerateFacePositions(removed)) {
        this._drawing.faces.remove(face);
      }

      this._byId.delete(removed.id);
      return removed;
    } else {
      return undefined;
    }
  }
}

// #119: We define concretes for face and vertex tokens for each of the map types.

class TokensHex extends Tokens {
  clone() {
    return new TokensHex(this.drawing.clone(), this.values, this.byId);
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
    if (token.size === '1') {
      return;
    }

    if (token.size.indexOf('l') >= 0) {
      // The crosshair in the middle
      yield { x: token.position.x - 1, y: token.position.y + 1, edge: 1 };
      yield { x: token.position.x - 1, y: token.position.y + 1, edge: 2 };
      yield { x: token.position.x, y: token.position.y, edge: 0 };
      if (token.size[0] === '2') {
        return;
      }

      // The rest of the 3
      yield { x: token.position.x - 1, y: token.position.y, edge: 2 };
      yield { x: token.position.x, y: token.position.y, edge: 1 };
      yield { x: token.position.x + 1, y: token.position.y - 1, edge: 0 };
      yield { x: token.position.x, y: token.position.y, edge: 2 };
      yield { x: token.position.x + 1, y: token.position.y, edge: 1 };
      yield { x: token.position.x + 1, y: token.position.y, edge: 0 };
      yield { x: token.position.x, y: token.position.y + 1, edge: 2 };
      yield { x: token.position.x, y: token.position.y + 1, edge: 1 };
      yield { x: token.position.x, y: token.position.y + 1, edge: 0 };
      if (token.size[0] === '3') {
        return;
      }

      // The left positions:
      yield { x: token.position.x, y: token.position.y - 1, edge: 0 };
      yield { x: token.position.x - 1, y: token.position.y, edge: 1 };
      yield { x: token.position.x - 2, y: token.position.y, edge: 2 };
      yield { x: token.position.x - 1, y: token.position.y, edge: 0 };
      yield { x: token.position.x - 2, y: token.position.y + 1, edge: 1 };
      yield { x: token.position.x - 2, y: token.position.y + 1, edge: 2 };
      yield { x: token.position.x - 1, y: token.position.y + 1, edge: 0 };
      yield { x: token.position.x - 2, y: token.position.y + 2, edge: 1 };
      yield { x: token.position.x - 2, y: token.position.y + 2, edge: 2 };
      yield { x: token.position.x - 1, y: token.position.y + 2, edge: 0 };
      yield { x: token.position.x - 1, y: token.position.y + 2, edge: 1 };
      yield { x: token.position.x - 1, y: token.position.y + 2, edge: 2 };
    } else {
      // The crosshair in the middle
      yield { x: token.position.x, y: token.position.y, edge: 1 };
      yield { x: token.position.x - 1, y: token.position.y, edge: 2 };
      yield { x: token.position.x, y: token.position.y, edge: 0 };
      if (token.size[0] === '2') {
        return;
      }

      // The rest of the 3
      yield { x: token.position.x - 1, y: token.position.y + 1, edge: 1 };
      yield { x: token.position.x - 1, y: token.position.y + 1, edge: 2 };
      yield { x: token.position.x, y: token.position.y + 1, edge: 0 };
      yield { x: token.position.x, y: token.position.y + 1, edge: 1 };
      yield { x: token.position.x, y: token.position.y + 1, edge: 2 };
      yield { x: token.position.x + 1, y: token.position.y, edge: 0 };
      yield { x: token.position.x + 1, y: token.position.y, edge: 1 };
      yield { x: token.position.x, y: token.position.y, edge: 2 };
      yield { x: token.position.x + 1, y: token.position.y - 1, edge: 0 };
      if (token.size[0] === '3') {
        return;
      }

      // The top-left positions:
      yield { x: token.position.x + 1, y: token.position.y - 1, edge: 1 };
      yield { x: token.position.x, y: token.position.y - 1, edge: 2 };
      yield { x: token.position.x + 1, y: token.position.y - 2, edge: 0 };
      yield { x: token.position.x, y: token.position.y - 1, edge: 1 };
      yield { x: token.position.x - 1, y: token.position.y - 1, edge: 2 };
      yield { x: token.position.x, y: token.position.y - 1, edge: 0 };
      yield { x: token.position.x - 1, y: token.position.y, edge: 1 };
      yield { x: token.position.x - 2, y: token.position.y, edge: 2 };
      yield { x: token.position.x - 1, y: token.position.y, edge: 0 };
      yield { x: token.position.x - 2, y: token.position.y + 1, edge: 1 };
      yield { x: token.position.x - 2, y: token.position.y + 1, edge: 2 };
      yield { x: token.position.x - 1, y: token.position.y + 1, edge: 0 };
    }
  }

  *enumerateFillVertexPositions(token: IToken): Iterable<IGridVertex> {
    if (token.size === '1') {
      return;
    }

    if (token.size.indexOf('l') >= 0) {
      // The crosshair in the middle
      yield { x: token.position.x, y: token.position.y, vertex: 0 };
      if (token.size[0] === '2') {
        return;
      }

      // The rest of the 3
      yield { x: token.position.x, y: token.position.y + 1, vertex: 1 };
      yield { x: token.position.x + 1, y: token.position.y, vertex: 0 };
      yield { x: token.position.x + 1, y: token.position.y, vertex: 1 };
      yield { x: token.position.x + 1, y: token.position.y - 1, vertex: 0 };
      yield { x: token.position.x, y: token.position.y, vertex: 1 };
      if (token.size[0] === '3') {
        return;
      }

      // The left positions:
      yield { x: token.position.x, y: token.position.y - 1, vertex: 0 };
      yield { x: token.position.x - 1, y: token.position.y, vertex: 1 };
      yield { x: token.position.x - 1, y: token.position.y, vertex: 0 };
      yield { x: token.position.x - 1, y: token.position.y + 1, vertex: 1 };
      yield { x: token.position.x - 1, y: token.position.y + 1, vertex: 0 };
      yield { x: token.position.x - 1, y: token.position.y + 2, vertex: 1 };
      yield { x: token.position.x, y: token.position.y + 1, vertex: 0 };
    } else {
      // The crosshair in the middle
      yield { x: token.position.x, y: token.position.y, vertex: 1 };
      if (token.size[0] === '2') {
        return;
      }

      // The rest of the 3
      yield { x: token.position.x, y: token.position.y + 1, vertex: 1 };
      yield { x: token.position.x + 1, y: token.position.y, vertex: 0 };
      yield { x: token.position.x + 1, y: token.position.y, vertex: 1 };
      yield { x: token.position.x + 1, y: token.position.y - 1, vertex: 0 };
      yield { x: token.position.x, y: token.position.y, vertex: 0 };
      if (token.size[0] === '3') {
        return;
      }

      // The top-left positions:
      yield { x: token.position.x + 1, y: token.position.y - 1, vertex: 1 };
      yield { x: token.position.x + 1, y: token.position.y - 2, vertex: 0 };
      yield { x: token.position.x, y: token.position.y - 1, vertex: 1 };
      yield { x: token.position.x, y: token.position.y - 1, vertex: 0 };
      yield { x: token.position.x - 1, y: token.position.y, vertex: 1 };
      yield { x: token.position.x - 1, y: token.position.y, vertex: 0 };
      yield { x: token.position.x - 1, y: token.position.y + 1, vertex: 1 };
    }
  }
}

class TokensSquare extends Tokens {
  clone() {
    return new TokensSquare(this.drawing.clone(), this.values, this.byId);
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
    yield { x: token.position.x + 1, y: token.position.y };
    yield { x: token.position.x + 1, y: token.position.y - 1 };
    if (token.size === '3') {
      yield { x: token.position.x + 1, y: token.position.y + 1 };
      return;
    }

    // The four further top-left positions:
    yield { x: token.position.x, y: token.position.y - 2 };
    yield { x: token.position.x - 1, y: token.position.y - 2 };
    yield { x: token.position.x - 2, y: token.position.y - 1 };
    yield { x: token.position.x - 2, y: token.position.y };
  }

  *enumerateFillEdgePositions(token: IToken): Iterable<IGridEdge> {
    if (token.size === '1') {
      return;
    }

    // The crosshair in the middle
    yield { x: token.position.x, y: token.position.y, edge: 0 };
    yield { x: token.position.x, y: token.position.y, edge: 1 };
    yield { x: token.position.x, y: token.position.y - 1, edge: 0 };
    yield { x: token.position.x - 1, y: token.position.y, edge: 1 };
    if (token.size[0] === '2') {
      return;
    }

    // Complete the 3:
    yield { x: token.position.x + 1, y: token.position.y - 1, edge: 0 };
    yield { x: token.position.x + 1, y: token.position.y, edge: 1 };
    yield { x: token.position.x + 1, y: token.position.y, edge: 0 };
    yield { x: token.position.x - 1, y: token.position.y + 1, edge: 1 };
    yield { x: token.position.x, y: token.position.y + 1, edge: 1 };
    yield { x: token.position.x, y: token.position.y + 1, edge: 0 };
    if (token.size === '3') {
      yield { x: token.position.x + 1, y: token.position.y + 1, edge: 0 };
      yield { x: token.position.x + 1, y: token.position.y + 1, edge: 1 };
      return;
    }

    // Complete the 4:
    yield { x: token.position.x, y: token.position.y - 2, edge: 0 };
    yield { x: token.position.x, y: token.position.y - 1, edge: 1 };
    yield { x: token.position.x - 1, y: token.position.y - 1, edge: 1 };
    yield { x: token.position.x - 2, y: token.position.y, edge: 1 };
    yield { x: token.position.x - 1, y: token.position.y, edge: 0 };
    yield { x: token.position.x - 1, y: token.position.y - 1, edge: 0 };
  }

  *enumerateFillVertexPositions(token: IToken): Iterable<IGridVertex> {
    if (token.size === '1') {
      return;
    }

    // The centre of the middle crosshair
    yield { x: token.position.x, y: token.position.y, vertex: 0 };
    if (token.size[0] === '2') {
      return;
    }

    // The three other vertices around the middle square
    yield { x: token.position.x + 1, y: token.position.y, vertex: 0 };
    yield { x: token.position.x, y: token.position.y + 1, vertex: 0 };
    if (token.size[0] === '3') {
      yield { x: token.position.x + 1, y: token.position.y + 1, vertex: 0 };
      return;
    }

    // The pair of top-left vertices
    yield { x: token.position.x - 1, y: token.position.y, vertex: 0 };
    yield { x: token.position.x, y: token.position.y - 1, vertex: 0 };
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