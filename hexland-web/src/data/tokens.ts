import { coordString, edgeString, IGridCoord, IGridEdge, IGridVertex, vertexString } from "./coord";
import { FeatureDictionary, IFeature, IFeatureDictionary, IIdFeature, IToken, ITokenDictionary, ITokenFace, ITokenFaceProperties, ITokenText } from "./feature";
import { MapType } from "./map";
import { getTokenGeometry, ITokenGeometry } from "./tokenGeometry";

// Describes how to draw a collection of tokens, complete with fill-in edges and vertices
// for larger ones, and text positioning.
export interface ITokenDrawing<F extends IFeature<IGridCoord>> {
  faces: IFeatureDictionary<IGridCoord, F>;
  fillEdges: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>;
  fillVertices: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>>;
  texts: IFeatureDictionary<IGridVertex, ITokenText>;

  // Makes a clone of this object.
  clone(): ITokenDrawing<F>;

  // How to create suitable features.
  createFace(token: ITokenFaceProperties, position: IGridCoord): F;
  createFillEdge(token: ITokenFaceProperties, position: IGridEdge): IFeature<IGridEdge>;
  createFillVertex(token: ITokenFaceProperties, position: IGridVertex): IFeature<IGridVertex>;
  createText(token: ITokenFaceProperties, position: IGridVertex, atVertex: boolean): ITokenText;

  // Cleans up (may be unnecessary.)
  dispose(): void;
}

// A super basic one for non-displayed use
export abstract class BaseTokenDrawing<F extends IFeature<IGridCoord>> implements ITokenDrawing<F> {
  private readonly _faces: IFeatureDictionary<IGridCoord, F>;
  private readonly _fillEdges: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>;
  private readonly _fillVertices: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>>;
  private readonly _texts: IFeatureDictionary<IGridVertex, ITokenText>;

  constructor(
    faces?: IFeatureDictionary<IGridCoord, F> | undefined,
    fillEdges?: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>> | undefined,
    fillVertices?: IFeatureDictionary<IGridVertex, IFeature<IGridVertex>> | undefined,
    texts?: IFeatureDictionary<IGridVertex, ITokenText> | undefined
  ) {
    this._faces = faces ?? new FeatureDictionary<IGridCoord, F>(coordString);
    this._fillEdges = fillEdges ?? new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
    this._fillVertices = fillVertices ?? new FeatureDictionary<IGridVertex, IFeature<IGridVertex>>(vertexString);
    this._texts = texts ?? new FeatureDictionary<IGridVertex, ITokenText>(vertexString);
  }

  get faces() { return this._faces; }
  get fillEdges() { return this._fillEdges; }
  get fillVertices() { return this._fillVertices; }
  get texts() { return this._texts; }

  abstract clone(): ITokenDrawing<F>;
  abstract createFace(token: ITokenFaceProperties, position: IGridCoord): F;

  createFillEdge(token: ITokenFaceProperties, position: IGridEdge): IFeature<IGridEdge> {
    return { position: position, colour: token.colour };
  }

  createFillVertex(token: ITokenFaceProperties, position: IGridVertex): IFeature<IGridVertex> {
    return { position: position, colour: token.colour };
  }

  createText(token: ITokenFaceProperties, position: IGridVertex, atVertex: boolean): ITokenText {
    return { position: position, colour: 0, size: Number(token.size[0]), text: token.text, atVertex: atVertex };
  }

  dispose() {
    // nothing to do by default
  }
}

export class SimpleTokenDrawing extends BaseTokenDrawing<ITokenFace> {
  clone() {
    return new SimpleTokenDrawing(this.faces.clone(), this.fillEdges.clone(), this.fillVertices.clone());
  }

  createFace(token: ITokenFaceProperties, position: IGridCoord) {
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
class Tokens extends FeatureDictionary<IGridCoord, IToken> implements ITokenDictionary {
  private readonly _tokenGeometry: ITokenGeometry;
  private readonly _drawing: ITokenDrawing<IIdFeature<IGridCoord>>;
  private readonly _byId: Map<string, IToken>;

  constructor(
    tokenGeometry: ITokenGeometry,
    drawing: ITokenDrawing<IIdFeature<IGridCoord>>,
    values?: Map<string, IToken> | undefined,
    byId?: Map<string, IToken> | undefined
  ) {
    super(coordString, values);
    this._tokenGeometry = tokenGeometry;
    this._drawing = drawing;
    this._byId = byId !== undefined ? new Map<string, IToken>(byId) : new Map<string, IToken>();
  }

  protected get drawing() { return this._drawing; }
  protected get byId() { return this._byId; }

  private revertAdd(
    token: IToken,
    addedFaces: IGridCoord[],
    addedEdges: IGridEdge[],
    addedVertices: IGridVertex[],
    addedTexts: IGridVertex[]
  ) {
    removeAll(this._drawing.texts, addedTexts);
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
      const addedTexts: IGridVertex[] = [];

      try { // paranoia ;) I'm not going to use exception driven logic on purpose, hopefully this won't cost
        // Make sure the token's id isn't already in use
        if (this._byId.has(token.id)) {
          this.revertAdd(token, addedFaces, addedEdges, addedVertices, addedTexts);
          return false;
        }
        this._byId.set(token.id, token);

        // Add the token's faces
        const baseTokenFace = { ...token, basePosition: token.position };
        for (const face of this._tokenGeometry.enumerateFacePositions(token)) {
          const faceToken = this._drawing.createFace(baseTokenFace, face);
          if (this._drawing.faces.add(faceToken) === false) {
            // This token doesn't fit here.  Roll back any changes we've already
            // made:
            this.revertAdd(token, addedFaces, addedEdges, addedVertices, addedTexts);
            return false;
          } else {
            // This token fits here -- note that we added this face and continue
            addedFaces.push(face);
          }
        }

        // Add the token's edges
        for (const edge of this._tokenGeometry.enumerateFillEdgePositions(token)) {
          const edgeToken = this._drawing.createFillEdge(baseTokenFace, edge);
          if (this._drawing.fillEdges.add(edgeToken) === false) {
            // This token doesn't fit here.  Roll back any changes we've already
            // made:
            this.revertAdd(token, addedFaces, addedEdges, addedVertices, addedTexts);
            return false;
          } else {
            addedEdges.push(edge);
          }
        }

        // Add the token's vertices
        for (const vertex of this._tokenGeometry.enumerateFillVertexPositions(token)) {
          const vertexToken = this._drawing.createFillVertex(baseTokenFace, vertex);
          if (this._drawing.fillVertices.add(vertexToken) === false) {
            // This token doesn't fit here.  Roll back any changes we've already
            // made:
            this.revertAdd(token, addedFaces, addedEdges, addedVertices, addedTexts);
            return false;
          } else {
            addedVertices.push(vertex);
          }
        }

        // Add the token text
        const textPosition = this._tokenGeometry.getTextPosition(token);
        const text = this._drawing.createText(baseTokenFace, textPosition, this._tokenGeometry.getTextAtVertex(token));
        if (this._drawing.texts.add(text) === false) {
          // This token doesn't fit here.  Roll back any changes we've already
          // made:
          this.revertAdd(token, addedFaces, addedEdges, addedVertices, addedTexts);
          return false;
        } else {
          addedTexts.push(textPosition);
        }

        return true;
      } catch (e) {
        this.revertAdd(token, addedFaces, addedEdges, addedVertices, addedTexts);
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
      for (const face of this._tokenGeometry.enumerateFacePositions(token)) {
        this._drawing.faces.remove(face);
      }

      for (const edge of this._tokenGeometry.enumerateFillEdgePositions(token)) {
        this._drawing.fillEdges.remove(edge);
      }

      for (const vertex of this._tokenGeometry.enumerateFillVertexPositions(token)) {
        this._drawing.fillVertices.remove(vertex);
      }

      const textPosition = this._tokenGeometry.getTextPosition(token);
      this._drawing.texts.remove(textPosition);
    }

    // Now we can clear the rest
    super.clear();
    this._byId.clear();
  }

  clone(): ITokenDictionary {
    return new Tokens(this._tokenGeometry, this._drawing.clone(), this.values, this.byId);
  }

  enumerateFacePositions(token: IToken): Iterable<IGridCoord> {
    return this._tokenGeometry.enumerateFacePositions(token);
  }

  enumerateFillEdgePositions(token: IToken): Iterable<IGridEdge> {
    return this._tokenGeometry.enumerateFillEdgePositions(token);
  }

  hasFillEdge(edge: IGridEdge) {
    return this._drawing.fillEdges.get(edge) !== undefined;
  }

  ofId(id: string) {
    return this._byId.get(id);
  }

  remove(k: IGridCoord): IToken | undefined {
    const removed = super.remove(k);
    if (removed !== undefined) {
      for (const vertex of this._tokenGeometry.enumerateFillVertexPositions(removed)) {
        this._drawing.fillVertices.remove(vertex);
      }

      for (const edge of this._tokenGeometry.enumerateFillEdgePositions(removed)) {
        this._drawing.fillEdges.remove(edge);
      }

      for (const face of this._tokenGeometry.enumerateFacePositions(removed)) {
        this._drawing.faces.remove(face);
      }

      const textPosition = this._tokenGeometry.getTextPosition(removed);
      this._drawing.texts.remove(textPosition);
      this._byId.delete(removed.id);
      return removed;
    } else {
      return undefined;
    }
  }
}

export function createTokenDictionary(
  mapType: MapType,
  drawing: ITokenDrawing<IIdFeature<IGridCoord>>
) {
  return new Tokens(getTokenGeometry(mapType), drawing);
}