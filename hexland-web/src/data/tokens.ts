import { coordString, IGridCoord, IGridEdge, IGridVertex } from "./coord";
import { FeatureDictionary, IFeature, IFeatureDictionary, IToken, ITokenDictionary, ITokenProperties, ITokenText } from "./feature";
import { MapType } from "./map";
import { getTokenGeometry, ITokenGeometry } from "./tokenGeometry";

export interface ITokenFace extends IToken {
  basePosition: IGridCoord;
}

export interface ITokenFillEdge extends IFeature<IGridEdge>, ITokenProperties {
  basePosition: IGridCoord;
}

export interface ITokenFillVertex extends IFeature<IGridVertex>, ITokenProperties {
  basePosition: IGridCoord;
}

// Describes how to draw a collection of tokens, complete with fill-in edges and vertices
// for larger ones, and text positioning.
export interface ITokenDrawing {
  faces: IFeatureDictionary<IGridCoord, ITokenFace>;
  fillEdges: IFeatureDictionary<IGridEdge, ITokenFillEdge>;
  fillVertices: IFeatureDictionary<IGridVertex, ITokenFillVertex>;
  texts: IFeatureDictionary<IGridVertex, ITokenText>;

  // Clears all of this object.
  clear(): void;

  // Makes a clone of this object.
  clone(): ITokenDrawing;

  // How to create suitable features.
  createFace(token: IToken, position: IGridCoord): ITokenFace;
  createFillEdge(token: IToken, position: IGridEdge): ITokenFillEdge;
  createFillVertex(token: IToken, position: IGridVertex): ITokenFillVertex;
  createText(token: IToken, position: IGridVertex, atVertex: boolean): ITokenText;

  // Cleans up (may be unnecessary.)
  dispose(): void;
}

// A super basic one for non-displayed use
export class SimpleTokenDrawing<
  TFacesDict extends IFeatureDictionary<IGridCoord, ITokenFace>,
  TFillEdgesDict extends IFeatureDictionary<IGridEdge, ITokenFillEdge>,
  TFillVerticesDict extends IFeatureDictionary<IGridVertex, ITokenFillVertex>,
  TTextsDict extends IFeatureDictionary<IGridVertex, ITokenText>
> implements ITokenDrawing {
  private readonly _faces: TFacesDict;
  private readonly _fillEdges: TFillEdgesDict;
  private readonly _fillVertices: TFillVerticesDict;
  private readonly _texts: TTextsDict;

  constructor(
    faces: TFacesDict,
    fillEdges: TFillEdgesDict,
    fillVertices: TFillVerticesDict,
    texts: TTextsDict
  ) {
    this._faces = faces;
    this._fillEdges = fillEdges;
    this._fillVertices = fillVertices;
    this._texts = texts;
  }

  get faces() { return this._faces; }
  get fillEdges() { return this._fillEdges; }
  get fillVertices() { return this._fillVertices; }
  get texts() { return this._texts; }

  clear() {
    this._faces.clear();
    this._fillEdges.clear();
    this._fillVertices.clear();
    this._texts.clear();
  }

  clone() {
    return new SimpleTokenDrawing(
      this.faces.clone(), this.fillEdges.clone(), this.fillVertices.clone(), this.texts.clone()
    );
  }

  createFace(token: IToken, position: IGridCoord) {
    return { ...token, basePosition: token.position, position: position };
  }

  createFillEdge(token: IToken, position: IGridEdge) {
    return { ...token, basePosition: token.position, position: position };
  }

  createFillVertex(token: IToken, position: IGridVertex) {
    return { ...token, basePosition: token.position, position: position };
  }

  createText(token: ITokenProperties, position: IGridVertex, atVertex: boolean) {
    return { position: position, colour: 0, size: Number(token.size[0]), text: token.text, atVertex: atVertex };
  }

  dispose() {
    // nothing to do by default
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
  private readonly _drawing: ITokenDrawing;
  private readonly _byId: Map<string, IToken>;

  constructor(
    tokenGeometry: ITokenGeometry,
    drawing: ITokenDrawing,
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
        for (const face of this._tokenGeometry.enumerateFacePositions(token)) {
          const faceToken = this._drawing.createFace(token, face);
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
          const edgeToken = this._drawing.createFillEdge(token, edge);
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
          const vertexToken = this._drawing.createFillVertex(token, vertex);
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
        const text = this._drawing.createText(token, textPosition, this._tokenGeometry.getTextAtVertex(token));
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
  drawing: ITokenDrawing
) {
  return new Tokens(getTokenGeometry(mapType), drawing);
}