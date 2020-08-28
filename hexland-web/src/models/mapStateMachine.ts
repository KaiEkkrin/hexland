import { MapColouring } from './colouring';
import { FaceHighlighter } from './dragHighlighter';
import { DragRectangle } from './dragRectangle';
import { FeatureColour } from './featureColour';
import { IGridGeometry } from './gridGeometry';
import { HexGridGeometry } from './hexGridGeometry';
import { IDrawing, IDragRectangle } from './interfaces';
import * as LoS from './los';
import { MapChangeTracker } from './mapChangeTracker';
import { SquareGridGeometry } from './squareGridGeometry';
import { WallHighlighter, WallRectangleHighlighter, RoomHighlighter } from './wallHighlighter';

import { IAnnotation, IPositionedAnnotation } from '../data/annotation';
import { IChange, createTokenRemove, createTokenAdd, createNoteRemove, createNoteAdd, createTokenMove } from '../data/change';
import { trackChanges } from '../data/changeTracking';
import { IGridCoord, coordString, coordsEqual, coordSub, coordAdd } from '../data/coord';
import { FeatureDictionary, IToken, ITokenProperties } from '../data/feature';
import { IMap, MapType } from '../data/map';

import { createDrawing } from './three/drawing';

import fluent from 'fluent-iterable';
import * as THREE from 'three';

const noteAlpha = 0.9;
const tokenNoteAlpha = 0.6;

const spacing = 75.0;
const tileDim = 12;

const panMargin = 100;
const panStep = 0.2; // per millisecond.  Try proportion of screen size instead?
const zoomStep = 1.001;
const zoomMin = 1;
const zoomDefault = 2;
const zoomMax = 4;

const zAxis = new THREE.Vector3(0, 0, 1);

// Describes the map state as managed by the state machine below and echoed
// to the Map component.
export interface IMapState {
  seeEverything: boolean;
  annotations: IPositionedAnnotation[];
  tokens: (IToken & ISelectable)[];
}

export interface ISelectable {
  selectable: boolean;
}

export function createDefaultState(): IMapState {
  return {
    seeEverything: true,
    annotations: [],
    tokens: [],
  };
}

// Manages the mutable state associated with a map, so that it can be
// hidden from the React component, Map.tsx.  Create a new one on reload.
// (Creating new instances of everything whenever a change happens would
// be far too slow, or very complicated.)
// In cases where the React component needs to know about the live state
// of an aspect of the map, the MapState shall be the source of truth and
// echo it to the React component on change.  The React component needs to
// call into this in order to make changes.
// Any other mutable fields in here are state that the owning component should
// never find out about.
export class MapStateMachine {
  private readonly _map: IMap;
  private readonly _uid: string;

  private readonly _drawing: IDrawing;
  private readonly _gridGeometry: IGridGeometry;
  private readonly _mapColouring: MapColouring;
  private readonly _notes: FeatureDictionary<IGridCoord, IAnnotation>;

  private readonly _changeTracker: MapChangeTracker;

  private readonly _dragRectangle: IDragRectangle;
  private readonly _faceHighlighter: FaceHighlighter;
  private readonly _wallHighlighter: WallHighlighter;
  private readonly _wallRectangleHighlighter: WallRectangleHighlighter;
  private readonly _roomHighlighter: RoomHighlighter;

  private readonly _setState: (state: IMapState) => void;

  private readonly _cameraTranslation = new THREE.Vector3();
  private readonly _cameraRotation = new THREE.Quaternion();
  private readonly _cameraScaling = new THREE.Vector3(zoomDefault, zoomDefault, 1);

  private readonly _defaultRotation = new THREE.Quaternion();
  private readonly _scratchRotation = new THREE.Quaternion();
  private readonly _scratchTranslation = new THREE.Vector3();

  private readonly _scratchMatrix1 = new THREE.Matrix4();

  private readonly _scratchVector1 = new THREE.Vector3();
  private readonly _scratchVector2 = new THREE.Vector3();
  private readonly _scratchVector3 = new THREE.Vector3();

  private _state: IMapState;

  private _lastAnimationTime: number | undefined;

  private _panningX = 0; // -1, 0 or 1 for which direction we're panning in
  private _panningY = 0; // likewise

  private _marginPanningX = 0; // the same, but when dragging to the margin rather than using keys
  private _marginPanningY = 0;

  private _isRotating = false;
  private _panLast: THREE.Vector3 | undefined;

  private _dragCumulative = false;

  private _tokenMoveDragStart: IGridCoord | undefined;
  private _tokenMoveDragSelectionPosition: IGridCoord | undefined;

  private _isDisposed = false;

  constructor(
    map: IMap,
    uid: string,
    colours: FeatureColour[],
    mount: HTMLDivElement,
    setState: (state: IMapState) => void
  ) {
    this._map = map;
    this._uid = uid;
    this._setState = setState;

    this._state = {
      seeEverything: this.seeEverything,
      annotations: [],
      tokens: []
    };
    this._setState(this._state);

    this._gridGeometry = map.ty === MapType.Hex ?
      new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);

    this._drawing = createDrawing(this._gridGeometry, colours, mount, this.seeEverything);

    this._mapColouring = new MapColouring(this._gridGeometry);

    this._dragRectangle = new DragRectangle(
      this._drawing.outlinedRectangle, this._gridGeometry,
      cp => this._drawing.getGridCoordAt(cp),
      t => this._drawing.getViewportToWorld(t)
    );

    this._faceHighlighter = new FaceHighlighter(
      this._drawing.areas, this._drawing.highlightedAreas, this._dragRectangle
    );

    this._wallHighlighter = new WallHighlighter(
      this._gridGeometry, this._drawing.walls, this._drawing.highlightedWalls, this._drawing.highlightedVertices
    );

    this._wallRectangleHighlighter = new WallRectangleHighlighter(
      this._gridGeometry, this._drawing.areas, this._drawing.walls, this._drawing.highlightedWalls,
      this._drawing.highlightedAreas, this._dragRectangle
    );

    this._roomHighlighter = new RoomHighlighter(
      this._gridGeometry, this._mapColouring, this._drawing.areas, this._drawing.walls, this._drawing.highlightedWalls,
      this._drawing.highlightedAreas, this._dragRectangle
    );

    // The notes are rendered with React, not with Three.js
    this._notes = new FeatureDictionary<IGridCoord, IAnnotation>(coordString);

    this._changeTracker = new MapChangeTracker(
      this._drawing.areas,
      this._drawing.tokens,
      this._drawing.walls,
      this._notes,
      this._mapColouring,
      (haveTokensChanged: boolean) => {
        this.withStateChange(getState => {
          var state = getState();
          this.buildLoS(state); // updates annotations
          this._drawing.handleChangesApplied(this._mapColouring);
          if (haveTokensChanged) {
            this.updateTokens(state);
          }
          return true;
        });
      }
    );

    this.resize();
    this._drawing.animate(() => this.onAnimate());
  }

  private get seeEverything() { return this._uid === this._map.owner || this._map.ffa === true; }

  private buildLoS(state: IMapState) {
    // TODO can I do this incrementally, or do I need to rebuild on every change?
    // Rebuilding on every change makes it much simpler...
    var positions = this.getLoSPositions();
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
    this.updateAnnotations(state);
  }

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
    var changes: IChange[] = [];
    for (var s of this._drawing.selection) {
      var tokenHere = this._drawing.tokens.get(s.position);
      if (tokenHere === undefined) {
        continue;
      }

      changes.push(createTokenMove(s.position, coordAdd(s.position, delta), tokenHere.id));
    }

    var changeTracker = new MapChangeTracker(
      this._drawing.areas, this._drawing.tokens.clone(), this._drawing.walls, this._notes, this._mapColouring
    );
    return trackChanges(this._map, changeTracker, changes, this._uid);
  }

  private canSelectToken(t: IToken) {
    return this.seeEverything || t.players.find(p => this._uid === p) !== undefined;
  }

  private *enumerateAnnotations() {
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

  private onAnimate() {
    var now = window.performance.now();

    // Do the drag-pan if applicable
    var panningX = this._panningX !== 0 ? this._panningX : this._marginPanningX;
    var panningY = this._panningY !== 0 ? this._panningY : this._marginPanningY;
    if ((panningX !== 0 || panningY !== 0) && this._lastAnimationTime !== undefined) {
      this._cameraTranslation.add(
        this._scratchTranslation.set(
          (now - this._lastAnimationTime) * panningX * panStep,
          (now - this._lastAnimationTime) * panningY * panStep,
          0
        )
      );
      this.resize();
    }

    this._lastAnimationTime = now;
  }

  private panIfWithinMargin(cp: THREE.Vector3) {
    if (cp.x < panMargin) {
      this._marginPanningX = -1;
    } else if (cp.x < (window.innerWidth - panMargin)) {
      this._marginPanningX = 0;
    } else {
      this._marginPanningX = 1;
    }

    if (cp.y < panMargin) {
      this._marginPanningY = 1;
    } else if (cp.y < (window.innerHeight - panMargin)) {
      this._marginPanningY = 0;
    } else {
      this._marginPanningY = -1;
    }
  }

  private selectTokensInDragRectangle() {
    if (this._dragCumulative === false) {
      this._drawing.selection.clear();
    }

    const inDragRectangle = this._dragRectangle.createFilter();
    fluent(this._drawing.tokens)
      .filter(t => this.canSelectToken(t) && inDragRectangle(t.position))
      .forEach(t => this._drawing.selection.add({ position: t.position, colour: 0 }));
  }

  private updateAnnotations(state: IMapState) {
    var positioned: IPositionedAnnotation[] = [];
    var [target, scratch1, scratch2] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    var worldToViewport = this._drawing.getWorldToViewport(this._scratchMatrix1);
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

    state.annotations = positioned;
  }

  private updateTokens(state: IMapState) {
    state.tokens = [...fluent(this._drawing.tokens).map(t => ({
      ...t, selectable: this.canSelectToken(t)
    }))];
  }

  // Helps create a new map state that might be a combination of more than
  // one change, and publish it once when we're done.
  // The supplied function should call `getState` to fetch a state object only when
  // it means to change it, and then mutate that object.  This ensures there will be
  // only one copy and not many.
  // Careful: the output of `getState` is a shallow copy of the state, the caller
  // is responsible for copying anything within as required.
  private withStateChange(
    fn: (getState: () => IMapState) => boolean
  ) {
    var initial = this._state;
    var updated: IMapState[] = [];
    function getState() {
      if (updated.length === 0) {
        updated.push({ ...initial });
      }

      return updated[0];
    }

    if (fn(getState) && updated.length > 0) {
      this._state = updated[0];
      this._setState(updated[0]);
      return true;
    }

    return false;
  }

  get changeTracker() { return this._changeTracker; }

  get panningX() { return this._panningX; }
  set panningX(value: number) { this._panningX = value; }

  get panningY() { return this._panningY; }
  set panningY(value: number) { this._panningY = value; }

  clearHighlights(colour: number) {
    this._faceHighlighter.dragCancel(undefined, colour);
    this._wallHighlighter.dragCancel(undefined, colour);
    this._wallRectangleHighlighter.dragCancel(undefined, colour);
    this._roomHighlighter.dragCancel(undefined, colour);
    this._faceHighlighter.clear();
    this._wallHighlighter.clear();
    this._wallRectangleHighlighter.clear();
    this._roomHighlighter.clear();
    this._dragRectangle.reset();
  }

  clearSelection() {
    const wasAnythingSelected = fluent(this._drawing.selection).any();
    this._drawing.selection.clear();
    this._drawing.selectionDrag.clear();
    this._drawing.selectionDragRed.clear();
    this._dragRectangle.reset();

    this._tokenMoveDragStart = undefined;
    this._tokenMoveDragSelectionPosition = undefined;

    // The LoS may change as a result of no longer having a specific
    // token selected
    if (wasAnythingSelected) {
      this.withStateChange(getState => {
        this.buildLoS(getState());
        return true;
      });
    }
  }

  // For editing
  getNote(cp: THREE.Vector3): IAnnotation | undefined {
    var position = this._drawing.getGridCoordAt(cp);
    if (position === undefined) {
      return undefined;
    }

    return this._notes.get(position);
  }

  faceDragEnd(cp: THREE.Vector3, colour: number): IChange[] {
    this.panMarginReset();
    var result = this._faceHighlighter.dragEnd(this._drawing.getGridCoordAt(cp), colour);
    this._dragRectangle.reset();
    return result;
  }

  faceDragStart(cp: THREE.Vector3, shiftKey: boolean, colour: number) {
    if (shiftKey) {
      this._dragRectangle.start(cp);
    }
    this._faceHighlighter.dragStart(this._drawing.getGridCoordAt(cp), colour);
  }

  // For editing
  getToken(cp: THREE.Vector3): IToken | undefined {
    var position = this._drawing.getGridCoordAt(cp);
    if (position === undefined) {
      return undefined;
    }

    return this._drawing.tokens.get(position);
  }

  moveFaceHighlightTo(cp: THREE.Vector3, colour: number) {
    if (this._faceHighlighter.inDrag) {
      this.panIfWithinMargin(cp);
    }

    this._dragRectangle.moveTo(cp);
    this._faceHighlighter.moveHighlight(this._drawing.getGridCoordAt(cp), colour);
  }

  moveSelectionTo(cp: THREE.Vector3) {
    this._dragRectangle.moveTo(cp);

    if (this._tokenMoveDragStart !== undefined && this._tokenMoveDragSelectionPosition !== undefined) {
      this.panIfWithinMargin(cp);
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
    } else if (this._dragRectangle.isEnabled()) {
      this.panIfWithinMargin(cp);
      this.selectTokensInDragRectangle();
    }
  }

  moveRoomHighlightTo(cp: THREE.Vector3, shiftKey: boolean, colour: number) {
    if (this._roomHighlighter.inDrag) {
      this.panIfWithinMargin(cp);
    } else {
      this._roomHighlighter.clear();
    }

    this._dragRectangle.moveTo(cp);
    this._roomHighlighter.difference = shiftKey;
    this._roomHighlighter.moveHighlight(this._drawing.getGridCoordAt(cp), colour);
  }

  moveWallHighlightTo(cp: THREE.Vector3, shiftKey: boolean, colour: number) {
    if (this._wallHighlighter.inDrag || this._wallRectangleHighlighter.inDrag) {
      this.panIfWithinMargin(cp);
    }

    if (this._dragRectangle.isEnabled() || shiftKey) {
      // We're in rectangle highlight mode.
      if (this._dragRectangle.isEnabled()) {
        this._dragRectangle.moveTo(cp);
      }

      if (!this._wallRectangleHighlighter.inDrag) {
        this._wallHighlighter.clear();
      }

      this._wallRectangleHighlighter.moveHighlight(this._drawing.getGridCoordAt(cp), colour);
    } else {
      this._wallHighlighter.moveHighlight(this._drawing.getGridVertexAt(cp), colour);
      if (!this._wallHighlighter.inDrag) {
        this._wallRectangleHighlighter.clear();
      }
    }
  }

  panEnd() {
    this._panLast = undefined;
  }

  panMarginReset() {
    this._marginPanningX = 0;
    this._marginPanningY = 0;
  }

  panStart(cp: THREE.Vector3, rotate: boolean) {
    this._panLast = cp;
    this._isRotating = rotate;
  }

  panTo(cp: THREE.Vector3) {
    if (this._panLast === undefined) {
      return;
    }

    if (this._isRotating) {
      // We rotate by the angle around the current centre point
      this._scratchVector3.set(window.innerWidth / 2, window.innerHeight / 2, 0);
      this._scratchVector1.set(this._panLast.x, this._panLast.y, 0)
        .sub(this._scratchVector3);
      this._scratchVector2.set(cp.x, cp.y, 0).sub(this._scratchVector3);

      var angle = this._scratchVector1.angleTo(this._scratchVector2);

      // deal with THREE being weird about angle direction :/
      if (this._scratchVector1.cross(this._scratchVector2).z < 0) {
        angle = -angle;
      }

      this._cameraRotation.multiply(
        this._scratchRotation.setFromAxisAngle(zAxis, angle)
      );

      // We want to effectively rotate around the centre of the window, which means
      // we also need to rotate our camera translation point to match
      this._cameraTranslation.applyQuaternion(this._scratchRotation.inverse());
    } else {
      this._cameraTranslation.add(
        this._scratchTranslation.set(
          this._panLast.x - cp.x,
          cp.y - this._panLast.y,
          0
        )
      );
    }

    this.resize();
    this._panLast = cp;
  }

  resetView() {
    this._cameraTranslation.set(0, 0, 0);
    this._cameraRotation.copy(this._defaultRotation);
    this._cameraScaling.set(zoomDefault, zoomDefault, 1);
    this.resize();
  }

  resize() {
    this._drawing.resize(this._cameraTranslation, this._cameraRotation, this._cameraScaling);

    // Upon resize, the positions of annotations may have changed and
    // we should update the UI
    this.withStateChange(getState => {
      this.updateAnnotations(getState());
      return true;
    });
  }

  roomDragEnd(cp: THREE.Vector3, shiftKey: boolean, colour: number): IChange[] {
    this.panMarginReset();
    this._roomHighlighter.difference = shiftKey;
    var result = this._roomHighlighter.dragEnd(this._drawing.getGridCoordAt(cp), colour);
    this._dragRectangle.reset();
    return result;
  }

  roomDragStart(cp: THREE.Vector3, shiftKey: boolean, colour: number) {
    this._dragRectangle.start(cp);
    this._roomHighlighter.difference = shiftKey;
    this._roomHighlighter.dragStart(this._drawing.getGridCoordAt(cp), colour);
  }

  selectionDragEnd(cp: THREE.Vector3): IChange[] {
    this.panMarginReset();
    var position = this._drawing.getGridCoordAt(cp);
    var chs: IChange[] = [];
    if (position) {
      if (this._tokenMoveDragStart !== undefined) {
        var delta = coordSub(position, this._tokenMoveDragStart);
        this._drawing.selectionDrag.clear();
        this._drawing.selectionDragRed.clear();

        if (this.canDropSelectionAt(position)) {
          // Create commands that move all the tokens
          for (var s of this._drawing.selection) {
            var tokenHere = this._drawing.tokens.get(s.position);
            if (tokenHere === undefined) {
              continue;
            }

            chs.push(createTokenMove(s.position, coordAdd(s.position, delta), tokenHere.id));
          }

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
      } else {
        // Always add the token at this position
        // (This is needed if the drag rectangle is very small)
        var token = this._drawing.tokens.get(position);
        if (token !== undefined && this.canSelectToken(token)) {
          this._drawing.selection.add({ position: position, colour: 0 });
        }

        this.withStateChange(getState => {
          this.buildLoS(getState());
          return true;
        });
      }
    }

    this._dragRectangle.reset();
    return chs;
  }

  selectionDragStart(cp: THREE.Vector3, shiftKey: boolean) {
    var position = this._drawing.getGridCoordAt(cp);
    if (position) {
      if (this._drawing.selection.get(position) !== undefined) {
        this._tokenMoveDragStart = position;
        this._tokenMoveDragSelectionPosition = position;
        this._drawing.selectionDrag.clear();
        this._drawing.selectionDragRed.clear();
        this._drawing.selection.forEach(f => this._drawing.selectionDrag.add(f));
      } else {
        if (!shiftKey) {
          this._drawing.selection.clear();
        }

        this._dragRectangle.start(cp);
        this._dragCumulative = shiftKey;
      }
    }
  }

  setNote(cp: THREE.Vector3, id: string, colour: number, text: string, visibleToPlayers: boolean): IChange[] {
    var position = this._drawing.getGridCoordAt(cp);
    var chs: IChange[] = [];
    if (position !== undefined) {
      if (this._notes.get(position) !== undefined) {
        // Replace the existing note
        chs.push(createNoteRemove(position));
      }

      if (id.length > 0 && colour >= 0 && text.length > 0) {
        chs.push(createNoteAdd({
          position: position,
          colour: colour,
          id: id,
          text: text,
          visibleToPlayers: visibleToPlayers
        }));
      }
    }

    return chs;
  }

  setShowMapColourVisualisation(show: boolean) {
    this._drawing.setShowMapColourVisualisation(show, this._mapColouring);
  }

  setToken(cp: THREE.Vector3, properties: ITokenProperties | undefined): IChange[] {
    var position = this._drawing.getGridCoordAt(cp);
    var chs: IChange[] = [];
    if (position !== undefined) {
      var existingToken = this._drawing.tokens.get(position);
      if (existingToken !== undefined) {
        // Replace the existing token
        chs.push(createTokenRemove(position, existingToken.id));
      }

      if (properties !== undefined && properties.colour >= 0) {
        chs.push(createTokenAdd({ position: position, ...properties }));
      }
    }

    return chs;
  }

  wallDragEnd(cp: THREE.Vector3, colour: number): IChange[] {
    this.panMarginReset();
    var result = this._dragRectangle.isEnabled() ?
      this._wallRectangleHighlighter.dragEnd(this._drawing.getGridCoordAt(cp), colour) :
      this._wallHighlighter.dragEnd(this._drawing.getGridVertexAt(cp), colour);
    this._dragRectangle.reset();
    return result;
  }

  wallDragStart(cp: THREE.Vector3, shiftKey: boolean, colour: number) {
    if (shiftKey) {
      this._dragRectangle.start(cp);
      this._wallRectangleHighlighter.dragStart(this._drawing.getGridCoordAt(cp), colour);
    } else {
      this._wallHighlighter.dragStart(this._drawing.getGridVertexAt(cp), colour);
    }
  }

  zoomBy(amount: number) {
    this._cameraScaling.set(
      Math.min(zoomMax, Math.max(zoomMin, this._cameraScaling.x * Math.pow(zoomStep, -amount))),
      Math.min(zoomMax, Math.max(zoomMin, this._cameraScaling.y * Math.pow(zoomStep, -amount))),
      1
    );
    this.resize();
  }

  dispose() {
    if (this._isDisposed === false) {
      this._drawing.dispose();
      this._isDisposed = true;
    }
  }
}