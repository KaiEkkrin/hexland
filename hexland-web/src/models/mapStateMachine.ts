import { MapColouring } from './colouring';
import { FaceHighlighter } from './dragHighlighter';
import { IGridGeometry } from './gridGeometry';
import { HexGridGeometry } from './hexGridGeometry';
import { IDrawing } from './interfaces';
import * as LoS from './los';
import { MapChangeTracker } from './mapChangeTracker';
import { SquareGridGeometry } from './squareGridGeometry';
import { WallHighlighter } from './wallHighlighter';

import { IAnnotation, IPositionedAnnotation } from '../data/annotation';
import { IChange, ChangeType, ChangeCategory, ITokenRemove, ITokenAdd, INoteRemove, INoteAdd, ITokenMove } from '../data/change';
import { trackChanges } from '../data/changeTracking';
import { IGridCoord, coordString, coordsEqual, coordSub, coordAdd } from '../data/coord';
import { FeatureDictionary, IToken, ITokenProperties } from '../data/feature';
import { IMap, MapType } from '../data/map';

import { createDrawing } from './three/drawing';

import fluent from 'fluent-iterable';
import * as THREE from 'three';
import { FeatureColour } from './featureColour';

const noteAlpha = 0.9;
const tokenNoteAlpha = 0.6;

const spacing = 75.0;
const tileDim = 12;

const zoomStep = 1.001;
const zoomMin = 1;
const zoomMax = 4;
const rotationStep = 0.004;

// Manages the mutable state associated with a map, so that it can be
// hidden from the React component, Map.tsx.  Create a new one on reload.
// (Creating new instances of everything whenever a change happens would
// be far too slow, or very complicated.)
// In cases where the React component needs to know about the live state
// of an aspect of the map, the MapState shall be the source of truth and
// echo it to the React component on change via one of the setter methods
// that we construct it with.  We'll have a private update method here
// for each of those setter methods.
// TODO #40: Perhaps I could roll the whole state together into a single interface
// and maintain just one of those here, which I observe from the Map component?
// That would make things easier, right?  Or I could try to split this thing apart
// into separate helpers for each edit mode?  What I *don't* want is having a replica
// of state here in the Map component with the Map component calling its own `set`
// itself as well and trying to sync the two...
export class MapStateMachine {
  private readonly _map: IMap;
  private readonly _uid: string;

  private readonly _drawing: IDrawing;
  private readonly _gridGeometry: IGridGeometry;
  private readonly _mapColouring: MapColouring;
  private readonly _notes: FeatureDictionary<IGridCoord, IAnnotation>;

  private readonly _changeTracker: MapChangeTracker;

  private readonly _faceHighlighter: FaceHighlighter;
  private readonly _wallHighlighter: WallHighlighter;

  private readonly _setAnnotations: (a: IPositionedAnnotation[]) => void;
  private readonly _setCanSeeAnything: (value: boolean) => void;

  private _panX = 0;
  private _panY = 0;
  private _rotation = 0;
  private _zoom = 2;

  private _zoomRotateLast: THREE.Vector2 | undefined;
  private _isRotating = false;
  private _panLast: THREE.Vector2 | undefined;

  private _selectDragStart: IGridCoord | undefined;
  private _tokenMoveDragStart: IGridCoord | undefined;
  private _tokenMoveDragSelectionPosition: IGridCoord | undefined;

  constructor(
    map: IMap,
    uid: string,
    colours: FeatureColour[],
    mount: HTMLDivElement,
    setAnnotations: (a: IPositionedAnnotation[]) => void,
    setCanSeeAnything: (value: boolean) => void
  ) {
    this._map = map;
    this._uid = uid;
    this._setAnnotations = setAnnotations;
    this._setCanSeeAnything = setCanSeeAnything;

    this._gridGeometry = map.ty === MapType.Hex ?
      new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);
    this._drawing = createDrawing(this._gridGeometry, colours, mount, this.seeEverything);

    this._faceHighlighter = new FaceHighlighter(
      this._drawing.areas, this._drawing.highlightedAreas
    );
    this._wallHighlighter = new WallHighlighter(
      this._gridGeometry, this._drawing.walls, this._drawing.highlightedWalls, this._drawing.highlightedVertices
    );

    this._mapColouring = new MapColouring(this._gridGeometry);
    this._mapColouring.expandBounds(
      new THREE.Vector2(-tileDim, -tileDim),
      new THREE.Vector2(2 * tileDim - 1, 2 * tileDim - 1)
    );

    // The notes are rendered with React, not with Three.js
    this._notes = new FeatureDictionary<IGridCoord, IAnnotation>(coordString);

    this._changeTracker = new MapChangeTracker(
      this._drawing.areas,
      this._drawing.tokens,
      this._drawing.walls,
      this._notes,
      this._mapColouring,
      () => {
        this.buildLoS(); // updates annotations
        this._drawing.handleChangesApplied(this._mapColouring);
        this.updateCanSeeAnything();
      }
    );

    this.resize();
    this._drawing.animate();
  }

  private get seeEverything() { return this._uid === this._map.owner || this._map.ffa === true; }

  private canDropSelectionAt(position: IGridCoord) {
    if (this._tokenMoveDragStart === undefined) {
      return false;
    }

    // #27: As a non-enforced improvement (just like LoS as a whole), we stop non-owners from
    // dropping tokens outside of the current LoS.
    var delta = coordSub(position, this._tokenMoveDragStart);
    if (this.seeEverything === false) {
      var withinLoS = fluent(this._drawing.selection).map(f => {
        var los = this._drawing.los.get(coordAdd(f.position, delta));
        return los !== undefined && los.colour !== LoS.oNone;
      }).reduce((a, b) => a && b, true);

      if (withinLoS === false) {
        return false;
      }
    }

    // We want to answer false to this query if actually moving the tokens here would
    // be rejected by the change tracker, and so we create our own change tracker to do this.
    // It's safe for us to use our current areas, walls and map colouring because those won't
    // change, but we need to clone our tokens into a scratch dictionary.
    var changes = fluent(this._drawing.selection).map(f => {
      return {
        ty: ChangeType.Move,
        cat: ChangeCategory.Token,
        newPosition: coordAdd(f.position, delta),
        oldPosition: f.position
      };
    });

    var changeTracker = new MapChangeTracker(
      this._drawing.areas, this._drawing.tokens.clone(), this._drawing.walls, this._notes, this._mapColouring
    );
    return trackChanges(this._map, changeTracker, changes, this._uid);
  }

  private canSelectToken(t: IToken) {
    return this.seeEverything || t.players.find(p => this._uid === p) !== undefined;
  }

  private *enumerateAnnotations(): Iterable<IAnnotation> {
    // Here we enumerate all the relevant annotations that could be displayed --
    // which means both the map notes, and the token-attached notes.
    for (var n of this._notes) {
      yield n;
    }

    for (var t of this._drawing.tokens) {
      if (t.note?.length > 0) {
        yield {
          id: "Token " + t.text + " " + coordString(t.position),
          position: t.position,
          colour: 1, // TODO I'm being weird with note colouring, maybe do something about it
          text: t.note,
          visibleToPlayers: t.noteVisibleToPlayers === true
        };
      }
    }
  }

  private getLoSPositions() {
    // These are the positions we should be projecting line-of-sight from.
    var myTokens = Array.from(this._drawing.tokens).filter(t => this.canSelectToken(t));
    var selectedTokens = myTokens.filter(t => this._drawing.selection.get(t.position) !== undefined);
    if (selectedTokens.length === 0) {
      if (this.seeEverything) {
        // Render no LoS at all
        return undefined;
      } else {
        // Show the LoS of all my tokens
        return myTokens.map(t => t.position);
      }
    } else {
      // Show the LoS of only the selected tokens
      return selectedTokens.map(t => t.position);
    }
  }

  private updateAnnotations() {
    var positioned: IPositionedAnnotation[] = [];
    var [target, scratch1, scratch2] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    var worldToViewport = this._drawing.getWorldToViewport();
    for (var n of this.enumerateAnnotations()) {
      // Skip notes not marked as player-visible
      if (!this.seeEverything && n.visibleToPlayers === false) {
        continue;
      }

      // Skip notes outside of the current LoS
      var visibility = this._drawing.los.get(n.position);
      if (!this.seeEverything && (visibility === undefined || visibility.colour === LoS.oNone)) {
        continue;
      }

      if (n.id.startsWith("Token")) {
        this._gridGeometry.createTokenAnnotationPosition(target, scratch1, scratch2, n.position, 0, tokenNoteAlpha);
      } else {
        this._gridGeometry.createAnnotationPosition(target, scratch1, scratch2, n.position, 0, noteAlpha);
      }
      target.applyMatrix4(worldToViewport);
      positioned.push({ clientX: target.x, clientY: target.y, ...n });
    }

    this._setAnnotations(positioned);
  }

  private updateCanSeeAnything() {
    if (this.seeEverything) {
      this._setCanSeeAnything(true);
      return;
    }

    for (var t of this._drawing.tokens) {
      if (this.canSelectToken(t)) {
        this._setCanSeeAnything(true);
        return;
      }
    }

    this._setCanSeeAnything(false);
  }

  get changeTracker() { return this._changeTracker; }

  buildLoS() {
    // TODO can I do this incrementally, or do I need to rebuild on every change?
    // Rebuilding on every change makes it much simpler...
    var positions = this.getLoSPositions();
    console.log("LoS positions: " + positions?.length ?? -1);
    this._drawing.los.clear();
    if (positions?.length === 0) {
      // Show nothing
      var losHere = LoS.create(this._gridGeometry, this._mapColouring, undefined);
      LoS.combine(this._drawing.los, losHere);
    } else {
      // TODO deal with dynamic grid sizing and all that fun here, create a suitable
      // abstraction!
      positions?.forEach(p => {
        var losHere = LoS.create(this._gridGeometry, this._mapColouring, p);
        LoS.combine(this._drawing.los, losHere);
      });
    }

    // Annotations depend on the LoS.
    // TODO This mess of dependencies is getting hard to manage!  React Hooks
    // could do this for me...
    this.updateAnnotations();
  }

  clearHighlights() {
    this._faceHighlighter.dragCancel();
    this._wallHighlighter.dragCancel();
    this._faceHighlighter.clear();
    this._wallHighlighter.clear();
  }

  clearSelection() {
    this._drawing.selection.clear();
    this._drawing.selectionDrag.clear();
    this._drawing.selectionDragRed.clear();
  }

  // For editing
  getNote(cp: THREE.Vector2): IAnnotation | undefined {
    var position = this._drawing.getGridCoordAt(cp);
    if (position === undefined) {
      return undefined;
    }

    return this._notes.get(position);
  }

  faceDragEnd(cp: THREE.Vector2, colour: number): IChange[] {
    return this._faceHighlighter.dragEnd(this._drawing.getGridCoordAt(cp), colour);
  }

  faceDragStart(cp: THREE.Vector2) {
    this._faceHighlighter.dragStart(this._drawing.getGridCoordAt(cp));
  }

  // For editing
  getToken(cp: THREE.Vector2): IToken | undefined {
    var position = this._drawing.getGridCoordAt(cp);
    if (position === undefined) {
      return undefined;
    }

    return this._drawing.tokens.get(position);
  }

  moveFaceHighlightTo(cp: THREE.Vector2) {
    this._faceHighlighter.moveHighlight(this._drawing.getGridCoordAt(cp));
  }

  moveSelectionTo(cp: THREE.Vector2) {
    if (this._tokenMoveDragStart === undefined || this._tokenMoveDragSelectionPosition === undefined) {
      return;
    }

    // TODO: Support drag to create a multiple selection.
    var position = this._drawing.getGridCoordAt(cp);
    if (position !== undefined && !coordsEqual(position, this._tokenMoveDragSelectionPosition)) {
      var selectionDrag = this.canDropSelectionAt(position) ? this._drawing.selectionDrag :
        this._drawing.selectionDragRed;

      var delta = coordSub(position, this._tokenMoveDragStart);
      this._drawing.selectionDrag.clear();
      this._drawing.selectionDragRed.clear();
      console.log("Moving " + fluent(this._drawing.selection).count() + " selected positions");
      this._drawing.selection.forEach(f => {
        var dragged = { position: coordAdd(f.position, delta), colour: f.colour };
        console.log(coordString(f.position) + " -> " + coordString(dragged.position));
        selectionDrag.add(dragged);
      });

      this._tokenMoveDragSelectionPosition = position;
    }
  }

  moveWallHighlightTo(cp: THREE.Vector2) {
    this._wallHighlighter.moveHighlight(this._drawing.getGridVertexAt(cp));
  }

  panEnd() {
    this._panLast = undefined;
  }

  panStart(cp: THREE.Vector2) {
    this._panLast = cp;
  }

  panTo(cp: THREE.Vector2) {
    if (this._panLast === undefined) {
      return;
    }

    this._panX -= (cp.x - this._panLast.x);
    this._panY += (cp.y - this._panLast.y);
    this.resize();
    this._panLast = cp;
  }

  resetView() {
    this._zoom = 2;
    this._rotation = 0;
    this._panX = 0;
    this._panY = 0;
    this.resize();
  }

  resize() {
    this._drawing.resize(this._panX, this._panY, this._rotation, this._zoom);

    // Upon resize, the positions of annotations may have changed and
    // we should update the UI
    this.updateAnnotations();
  }

  selectionDragEnd(cp: THREE.Vector2, shiftKey: boolean): IChange[] {
    var position = this._drawing.getGridCoordAt(cp);
    var chs: IChange[] = [];
    if (position) {
      if (this._tokenMoveDragStart !== undefined) {
        var delta = coordSub(position, this._tokenMoveDragStart);
        this._drawing.selectionDrag.clear();
        this._drawing.selectionDragRed.clear();

        if (this.canDropSelectionAt(position)) {
          // Create commands that move all the tokens
          chs.push(...fluent(this._drawing.selection).map(t => {
            return {
              ty: ChangeType.Move,
              cat: ChangeCategory.Token,
              newPosition: coordAdd(t.position, delta),
              oldPosition: t.position
            } as ITokenMove;
          }));

          // Move the selection to the target positions
          fluent(this._drawing.selection).map(t => this._drawing.selection.remove(t.position))
            .forEach(f => {
              if (f !== undefined) {
                this._drawing.selection.add({ position: coordAdd(f.position, delta), colour: f.colour });
              }
            });
        }

        this._tokenMoveDragStart = undefined;
        this._tokenMoveDragSelectionPosition = undefined;
      }

      if (this._selectDragStart !== undefined) {
        if (!shiftKey) {
          this._drawing.selection.clear();
        }

        var token = this._drawing.tokens.get(position);
        if (token !== undefined && this.canSelectToken(token)) {
          this._drawing.selection.add({ position: position, colour: 0 });
        }

        this._selectDragStart = undefined;
        this.buildLoS();
      }
    }

    return chs;
  }

  selectionDragStart(cp: THREE.Vector2) {
    var position = this._drawing.getGridCoordAt(cp);
    if (position) {
      if (this._drawing.selection.get(position) !== undefined) {
        this._tokenMoveDragStart = position;
        this._tokenMoveDragSelectionPosition = position;
        this._drawing.selectionDrag.clear();
        this._drawing.selectionDragRed.clear();
        this._drawing.selection.forEach(f => this._drawing.selectionDrag.add(f));
      } else {
        this._selectDragStart = position;
      }
    }
  }

  setNote(cp: THREE.Vector2, id: string, colour: number, text: string, visibleToPlayers: boolean): IChange[] {
    var position = this._drawing.getGridCoordAt(cp);
    var chs: IChange[] = [];
    if (position !== undefined) {
      if (this._notes.get(position) !== undefined) {
        // Replace the existing note
        chs.push({
          ty: ChangeType.Remove,
          cat: ChangeCategory.Note,
          position: position
        } as INoteRemove);
      }

      if (id.length > 0 && colour >= 0 && text.length > 0) {
        chs.push({
          ty: ChangeType.Add,
          cat: ChangeCategory.Note,
          feature: {
            position: position,
            colour: colour,
            id: id,
            text: text,
            visibleToPlayers: visibleToPlayers
          }
        } as INoteAdd);
      }
    }

    return chs;
  }

  setShowMapColourVisualisation(show: boolean) {
    this._drawing.setShowMapColourVisualisation(show, this._mapColouring);
  }

  setToken(cp: THREE.Vector2, properties: ITokenProperties | undefined): IChange[] {
    var position = this._drawing.getGridCoordAt(cp);
    var chs: IChange[] = [];
    if (position !== undefined) {
      if (this._drawing.tokens.get(position) !== undefined) {
        // Replace the existing token
        chs.push({
          ty: ChangeType.Remove,
          cat: ChangeCategory.Token,
          position: position
        } as ITokenRemove);
      }

      if (properties !== undefined && properties.colour >= 0) {
        chs.push({
          ty: ChangeType.Add,
          cat: ChangeCategory.Token,
          feature: {
            position: position,
            ...properties
          }
        } as ITokenAdd);
      }
    }

    return chs;
  }

  wallDragEnd(cp: THREE.Vector2, colour: number): IChange[] {
    return this._wallHighlighter.dragEnd(this._drawing.getGridVertexAt(cp), colour);
  }

  wallDragStart(cp: THREE.Vector2) {
    this._wallHighlighter.dragStart(this._drawing.getGridVertexAt(cp));
  }

  zoomRotateEnd() {
    this._zoomRotateLast = undefined;
  }

  zoomRotateStart(cp: THREE.Vector2, rotate: boolean) {
    this._zoomRotateLast = cp;
    this._isRotating = rotate;
  }

  zoomRotateTo(cp: THREE.Vector2) {
    if (this._zoomRotateLast === undefined) {
      return;
    }

    if (this._isRotating === true) {
      this._rotation -= (cp.x - this._zoomRotateLast.x) * rotationStep;
    } else {
      this._zoom = Math.min(zoomMax, Math.max(zoomMin, this._zoom * Math.pow(zoomStep, cp.y - this._zoomRotateLast.y)));
    }

    this.resize();
    this._zoomRotateLast = cp;
  }

  dispose() {
    this._drawing.dispose();
  }
}