import { MapColouring } from './colouring';
import { FaceHighlighter } from './dragHighlighter';
import { DragRectangle } from './dragRectangle';
import { FeatureColour } from './featureColour';
import { IGridGeometry } from './gridGeometry';
import { HexGridGeometry } from './hexGridGeometry';
import { IDrawing, IDragRectangle } from './interfaces';
import { MapChangeTracker } from './mapChangeTracker';
import { RedrawFlag } from './redrawFlag';
import { SquareGridGeometry } from './squareGridGeometry';
import { WallHighlighter, WallRectangleHighlighter, RoomHighlighter } from './wallHighlighter';

import { IAnnotation, IPositionedAnnotation } from '../data/annotation';
import { IChange, createTokenRemove, createTokenAdd, createNoteRemove, createNoteAdd, createTokenMove } from '../data/change';
import { netObjectCount, trackChanges } from '../data/changeTracking';
import { IGridCoord, coordString, coordsEqual, coordSub, coordAdd } from '../data/coord';
import { FeatureDictionary, flipToken, IToken, ITokenDictionary, ITokenProperties, TokenSize } from '../data/feature';
import { IAdventureIdentified } from '../data/identified';
import { IMap, MapType } from '../data/map';
import { IUserPolicy } from '../data/policy';
import { getTokenGeometry, ITokenGeometry } from '../data/tokenGeometry';
import { createTokenDictionary } from '../data/tokens';

import { IDataService, ISpritesheetCache, IStorage } from '../services/interfaces';
import { SpritesheetCache } from '../services/spritesheetCache';
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
export const zoomMin = 1;
const zoomDefault = 2;
export const zoomMax = 4;

const panningPosition = new THREE.Vector3(panMargin, panMargin, 0);
const zAxis = new THREE.Vector3(0, 0, 1);

// Describes the map state as managed by the state machine below and echoed
// to the Map component.
export interface IMapState {
  isOwner: boolean;
  seeEverything: boolean;
  annotations: IPositionedAnnotation[];
  tokens: (ITokenProperties & ISelectable)[];
  objectCount?: number | undefined; // undefined for irrelevant (no policy)
  zoom: number;
}

export interface ISelectable {
  selectable: boolean;
}

export function createDefaultState(): IMapState {
  return {
    isOwner: true,
    seeEverything: true,
    annotations: [],
    tokens: [],
    objectCount: undefined,
    zoom: zoomDefault
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
  private readonly _dataService: IDataService;
  private readonly _map: IAdventureIdentified<IMap>;
  private readonly _uid: string;
  private readonly _userPolicy: IUserPolicy | undefined;

  private readonly _drawing: IDrawing;
  private readonly _gridGeometry: IGridGeometry;
  private readonly _mapColouring: MapColouring;
  private readonly _notes: FeatureDictionary<IGridCoord, IAnnotation>;
  private readonly _notesNeedUpdate = new RedrawFlag();
  private readonly _spritesheetCache: ISpritesheetCache;
  private readonly _tokenGeometry: ITokenGeometry;

  private readonly _selection: ITokenDictionary;
  private readonly _selectionDrag: ITokenDictionary;
  private readonly _selectionDragRed: ITokenDictionary;
  private readonly _tokens: ITokenDictionary;

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

  private _tokenMoveDragStart: IGridCoord | undefined;
  private _tokenMoveJog: IGridCoord | undefined;
  private _tokenMoveDragSelectionPosition: IGridCoord | undefined;

  private _isDisposed = false;

  constructor(
    dataService: IDataService,
    storage: IStorage,
    map: IAdventureIdentified<IMap>,
    uid: string,
    colours: FeatureColour[],
    mount: HTMLDivElement,
    userPolicy: IUserPolicy | undefined,
    logError: (message: string, e: any) => void,
    setState: (state: IMapState) => void
  ) {
    this._dataService = dataService;
    this._map = map;
    this._uid = uid;
    this._userPolicy = userPolicy;
    this._setState = setState;

    this._state = {
      isOwner: this.isOwner,
      seeEverything: this.seeEverything,
      annotations: [],
      tokens: [],
      objectCount: undefined,
      zoom: zoomDefault
    };
    this._setState(this._state);

    this._gridGeometry = map.record.ty === MapType.Hex ?
      new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);

    this._spritesheetCache = new SpritesheetCache(dataService, map.adventureId, map.id, logError);
    this._tokenGeometry = getTokenGeometry(map.record.ty);
    this._drawing = createDrawing(
      this._gridGeometry, this._tokenGeometry, colours, mount, this.seeEverything, logError, this._spritesheetCache, storage
    );

    this._mapColouring = new MapColouring(this._gridGeometry);

    this._dragRectangle = new DragRectangle(
      this._drawing.outlinedRectangle, this._gridGeometry,
      cp => this._drawing.getGridCoordAt(cp),
      t => this._drawing.getViewportToWorld(t)
    );

    // The notes are rendered with React, not with Three.js
    this._notes = new FeatureDictionary<IGridCoord, IAnnotation>(coordString);

    // Here is our higher-level token tracking:
    this._selection = createTokenDictionary(map.record.ty, this._drawing.selection);
    this._selectionDrag = createTokenDictionary(map.record.ty, this._drawing.selectionDrag);
    this._selectionDragRed = createTokenDictionary(map.record.ty, this._drawing.selectionDragRed);
    this._tokens = createTokenDictionary(
      map.record.ty, this._drawing.tokens,
      // TODO #119 Provide a way to separately mark which face gets the text written on...?
    );

    this._changeTracker = new MapChangeTracker(
      this._drawing.areas,
      this._tokens,
      this._drawing.walls,
      this._notes,
      userPolicy,
      this._mapColouring,
      (haveTokensChanged: boolean, objectCount: number) => {
        this.withStateChange(getState => {
          const state = getState();
          if (haveTokensChanged) {
            this.cleanUpSelection();
          }

          this.buildLoS(state);
          this._drawing.handleChangesApplied(this._mapColouring);
          if (haveTokensChanged) {
            this.updateTokens(state);
          }
          state.objectCount = this._userPolicy === undefined ? undefined : objectCount;
          return true;
        });
      }
    );

    this._faceHighlighter = new FaceHighlighter(
      this._drawing.areas, this._drawing.highlightedAreas, this._dragRectangle
    );

    this.validateWallChanges = this.validateWallChanges.bind(this);
    this._wallHighlighter = new WallHighlighter(
      this._gridGeometry,
      this._drawing.walls,
      this._drawing.highlightedWalls,
      this._drawing.highlightedVertices,
      this.validateWallChanges
    );

    this._wallRectangleHighlighter = new WallRectangleHighlighter(
      this._gridGeometry, this._drawing.areas, this._drawing.walls, this._drawing.highlightedWalls,
      this._drawing.highlightedAreas, this.validateWallChanges, this._dragRectangle
    );

    this._roomHighlighter = new RoomHighlighter(
      this._gridGeometry, this._mapColouring, this._drawing.areas, this._drawing.walls, this._drawing.highlightedWalls,
      this._drawing.highlightedAreas, this.validateWallChanges, this._dragRectangle
    );

    this.resize();

    this.onPostAnimate = this.onPostAnimate.bind(this);
    this.onPreAnimate = this.onPreAnimate.bind(this);
    this._drawing.animate(this.onPreAnimate, this.onPostAnimate);
    console.log(`created new map state for ${map.adventureId}/${map.id}`);
  }

  private get isOwner() { return this._uid === this._map.record.owner; }
  private get seeEverything() { return this._uid === this._map.record.owner || this._map.record.ffa === true; }

  private addTokenWithProperties(target: IGridCoord, properties: ITokenProperties): IChange[] {
    // Work out a place around this target where the token will fit
    const newPosition = this.canResizeToken({ ...properties, position: target }, properties.size);
    if (newPosition === undefined) {
      throw Error("No space available to add this token");
    }

    return [createTokenAdd({ ...properties, position: newPosition })];
  }

  private buildLoS(state: IMapState) {
    this._drawing.setLoSPositions(this.getLoSPositions(), this.seeEverything);

    // Building the LoS implies that we will need to update annotations
    // (in the post-animate callback)
    this._notesNeedUpdate.setNeedsRedraw();
  }

  private canDropSelectionAt(position: IGridCoord) {
    const delta = this.getTokenMoveDelta(position);
    if (delta === undefined) {
      return false;
    }

    // #27: As a non-enforced improvement (just like LoS as a whole), we stop non-owners from
    // dropping tokens outside of the current LoS.
    const worldToViewport = this._drawing.getWorldToViewport(this._scratchMatrix1);
    if (this.seeEverything === false) {
      // We draw the LoS from the point of view of all selected faces, so that a large token
      // gets to see around small things
      const withinLoS = fluent(this._drawing.selection.faces).map(f => {
        this._gridGeometry.createCoordCentre(this._scratchVector1, coordAdd(f.position, delta), 0);
        this._scratchVector1.applyMatrix4(worldToViewport);
        return this._drawing.checkLoS(this._scratchVector1);
      }).reduce((a, b) => a && b, true);

      if (withinLoS === false) {
        return false;
      }
    }

    // We want to answer false to this query if actually moving the tokens here would
    // be rejected by the change tracker, and so we create our own change tracker to do this.
    // It's safe for us to use our current areas, walls and map colouring because those won't
    // change, but we need to clone our tokens into a scratch dictionary.
    const changes: IChange[] = [];
    for (const s of this._selection) {
      const tokenHere = this._tokens.get(s.position);
      if (tokenHere === undefined) {
        continue;
      }

      changes.push(createTokenMove(s.position, coordAdd(s.position, delta), tokenHere.id));
    }

    const changeTracker = new MapChangeTracker(
      this._drawing.areas, this._tokens.clone(), this._drawing.walls, this._notes, this._userPolicy, this._mapColouring
    );
    return trackChanges(this._map.record, changeTracker, changes, this._uid);
  }

  private canResizeToken(token: IToken, newSize: TokenSize): IGridCoord | undefined {
    // Checks whether we can resize this token to the given new size, returning the new position
    // that it would adopts, or, if the token doesn't exist already, whether we can place a new
    // token of the given size.
    // We'll try all possible positions that would retain some of the old token's position.
    const existingToken = this._tokens.get(token.position);
    if (newSize === existingToken?.size) {
      return token.position;
    }

    // I only need to clone the tokens for this experimental change tracker because the other
    // things definitely won't change
    const changeTracker = new MapChangeTracker(
      this._drawing.areas, this._tokens.clone(), this._drawing.walls, this._notes, this._userPolicy, this._mapColouring
    );

    const removeToken = existingToken === undefined ? [] : [createTokenRemove(token.position, token.id)];
    for (const face of this._tokenGeometry.enumerateFacePositions({ ...token, size: newSize })) {
      const addToken = createTokenAdd({ ...token, size: newSize, position: face });
      if (trackChanges(this._map.record, changeTracker, [...removeToken, addToken], this._uid) === true) {
        return face;
      }
    }

    return undefined;
  }

  private canSelectToken(t: ITokenProperties) {
    return this.seeEverything || t.players.find(p => this._uid === p) !== undefined;
  }

  private cleanUpSelection() {
    // This function makes sure that the selection doesn't contain anything we
    // couldn't have selected -- call this after changes are applied.
    const selectedTokenIds = [...fluent(this._selection).map(s => s.id)];
    this._selection.clear();
    for (const id of selectedTokenIds) {
      const token = this._tokens.ofId(id);
      if (token !== undefined) {
        this._selection.add(token);
      }
    }
  }

  private *enumerateAnnotations() {
    // Here we enumerate all the relevant annotations that could be displayed --
    // which means both the map notes, and the token-attached notes.
    for (let n of this._notes) {
      yield n;
    }

    for (const t of this._tokens) {
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
    // For large tokens, we project a separate LoS from every face and merge them together
    let myTokens = Array.from(this._drawing.tokens.faces).filter(t => this.canSelectToken(t));
    let selectedFaces = myTokens.filter(t => this._drawing.selection.faces.get(t.position) !== undefined);
    if (selectedFaces.length === 0) {
      if (this.seeEverything) {
        // Render no LoS at all
        return undefined;
      } else {
        // Show the LoS of all my tokens
        return myTokens.map(t => t.position);
      }
    } else {
      // Show the LoS of only the selected tokens
      return selectedFaces.map(t => t.position);
    }
  }

  private getTokenMoveDelta(position: IGridCoord) {
    if (this._tokenMoveDragStart === undefined || this._tokenMoveJog === undefined) {
      return undefined;
    }

    // #60: Having the jog in here as well allows us to apply an extra movement by arrow keys
    // without perturbing the overall drag process
    return coordAdd(this._tokenMoveJog, coordSub(position, this._tokenMoveDragStart));
  }

  private onPostAnimate() {
    // We update annotations after the render because they are dependent on the LoS
    if (this._notesNeedUpdate.needsRedraw()) {
      this.withStateChange(getState => {
        this.updateAnnotations(getState());
        return true;
      });
    }
  }

  private onPreAnimate() {
    let now = window.performance.now();

    // Do the drag-pan if applicable
    let panningX = this._panningX !== 0 ? this._panningX : this._marginPanningX;
    let panningY = this._panningY !== 0 ? this._panningY : this._marginPanningY;
    if ((panningX !== 0 || panningY !== 0) && this._lastAnimationTime !== undefined) {
      this._cameraTranslation.add(
        this._scratchTranslation.set(
          (now - this._lastAnimationTime) * panningX * panStep,
          (now - this._lastAnimationTime) * panningY * panStep,
          0
        )
      );

      // To correctly move the drag rectangle, we need to take into account it having
      // different ideas about what "top" and "bottom" are
      this._scratchTranslation.x = -this._scratchTranslation.x;
      this._dragRectangle.translate(this._scratchTranslation.multiply(this._cameraScaling).multiplyScalar(0.5));
      this.resize();
    }

    // If we have tokens selected, doing this will pan them along with the view
    // (we must make sure this is done only with deliberate panning and not with
    // margin panning, which can be triggered by the token move itself)
    if (this._panningX !== 0 || this._panningY !== 0) {
      this.moveSelectionTo(panningPosition);
    }

    this._lastAnimationTime = now;
  }

  private onPanningChange() {
    if (this._panningX === 0 && this._panningY === 0) {
      return this.onPanningEnded();
    } else {
      return this.onPanningStarted();
    }
  }

  private onPanningEnded() {
    let chs: IChange[] = [];
    if (fluent(this._selection).any()) {
      const position = this._drawing.getGridCoordAt(panningPosition);
      if (position !== undefined) {
        this.tokenMoveDragEnd(position, chs);
      }
    }

    return chs;
  }

  private onPanningStarted() {
    if (this._tokenMoveDragStart !== undefined) {
      // We've configured the token move already
      return undefined;
    }

    if (fluent(this._selection).any()) {
      // Start moving this selection along with the panning:
      const position = this._drawing.getGridCoordAt(panningPosition);
      if (position !== undefined) {
        this.tokenMoveDragStart(position);
      }
    }

    return undefined;
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
    this._selection.clear();
    const inDragRectangle = this._dragRectangle.createFilter();
    for (const token of this._tokens) {
      if (this.canSelectToken(token) === false) {
        continue;
      }

      // TODO Possible optimisation here rejecting tokens that are definitely too far away
      for (const facePosition of this._tokenGeometry.enumerateFacePositions(token)) {
        if (inDragRectangle(facePosition)) {
          this._selection.add({ ...token, position: token.position });
        }
      }
    }
  }

  private setTokenProperties(token: IToken, properties: ITokenProperties): IChange[] {
    if (properties.id !== token.id) {
      throw RangeError("Cannot change a token's id after creation");
    }

    const newPosition = properties.size === token.size ? token.position :
      this.canResizeToken(token, properties.size);
    if (newPosition === undefined) {
      throw Error("No space available for this change");
    }

    return [
      createTokenRemove(token.position, token.id),
      createTokenAdd({ ...properties, position: newPosition })
    ];
  }

  private tokenMoveDragEnd(position: IGridCoord, chs: IChange[]) {
    this._selectionDrag.clear();
    this._selectionDragRed.clear();
    const delta = this.getTokenMoveDelta(position);
    if (delta !== undefined && this.canDropSelectionAt(position)) {
      // Create commands that move all the tokens.
      if (!coordsEqual(delta, { x: 0, y: 0 })) {
        for (const token of this._selection) {
          chs.push(createTokenMove(token.position, coordAdd(token.position, delta), token.id));
        }
      }

      // Move the selection to the target positions.  (Even if they haven't moved, we need
      // to do this in order to activate the correct LoS for these tokens if different ones
      // were previously selected.)
      // Careful, we need to remove all old positions before adding the new ones, otherwise
      // we can end up not re-selecting some of the tokens
      const removed = [...fluent(this._selection).map(t => this._selection.remove(t.position))];
      removed.forEach(f => {
        if (f !== undefined) {
          this._selection.add({ ...f, position: coordAdd(f.position, delta) });
        }
      });
    }

    this._tokenMoveDragStart = undefined;
    this._tokenMoveJog = undefined;
    this._tokenMoveDragSelectionPosition = undefined;
  }

  private tokenMoveDragStart(position: IGridCoord) {
    this._tokenMoveDragStart = position;
    this._tokenMoveJog = { x: 0, y: 0 };
    this._tokenMoveDragSelectionPosition = position;
    this._selectionDrag.clear();
    this._selectionDragRed.clear();
    this._selection.forEach(f => this._selectionDrag.add(f));
  }

  private tokenMoveDragTo(position: IGridCoord | undefined) {
    if (position === undefined) {
      return;
    }

    const delta = this.getTokenMoveDelta(position);
    if (
      this._tokenMoveDragStart === undefined ||
      this._tokenMoveDragSelectionPosition === undefined ||
      delta === undefined
    ) {
      return;
    }

    const target = coordAdd(this._tokenMoveDragStart, delta);
    if (coordsEqual(target, this._tokenMoveDragSelectionPosition)) {
      return;
    }

    const selectionDrag = this.canDropSelectionAt(position) ? this._selectionDrag : this._selectionDragRed;
    this._selectionDrag.clear();
    this._selectionDragRed.clear();
    this._selection.forEach(f => {
      const dragged = { ...f, position: coordAdd(f.position, delta) };
      // console.log(coordString(f.position) + " -> " + coordString(dragged.position));
      selectionDrag.add(dragged);
    });

    this._tokenMoveDragSelectionPosition = position;
  }

  private updateAnnotations(state: IMapState) {
    let positioned: IPositionedAnnotation[] = [];
    let [target, scratch1, scratch2] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    let worldToViewport = this._drawing.getWorldToViewport(this._scratchMatrix1);
    for (let n of this.enumerateAnnotations()) {
      // Skip notes not marked as player-visible
      if (!this.seeEverything && n.visibleToPlayers === false) {
        continue;
      }

      // Skip notes outside of the current LoS
      this._gridGeometry.createCoordCentre(target, n.position, 0);
      target.applyMatrix4(worldToViewport);
      if (!this.seeEverything && !this._drawing.checkLoS(target)) {
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
    state.tokens = [...fluent(this._tokens).map(t => ({
      ...t, selectable: this.canSelectToken(t)
    }))];
  }

  private validateWallChanges(changes: IChange[]): boolean {
    // I need to clone the walls for this one.  The map colouring won't be relevant.
    const changeTracker = new MapChangeTracker(
      this._drawing.areas, this._tokens, this._drawing.walls.clone(), this._notes, this._userPolicy, undefined
    );
    return trackChanges(this._map.record, changeTracker, changes, this._uid);
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
    let initial = this._state;
    let updated: IMapState[] = [];
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
  get map() { return this._map; }
  get objectCount() { return this._state.objectCount; }
  get panningX() { return this._panningX; }
  get panningY() { return this._panningY; }
  get spritesheetCache() { return this._spritesheetCache; }

  async addChanges(changes: IChange[] | undefined, complain: (id: string, title: string, message: string) => void) {
    if (changes === undefined || changes.length === 0) {
      return;
    }

    if (this._state.objectCount !== undefined && this._userPolicy !== undefined) {
      const expectedCount = this._state.objectCount + netObjectCount(changes);
      if (expectedCount > this._userPolicy.objects) {
        // Refuse to attempt these changes -- this would cause the map to be pruned on
        // consolidate, with consequent desyncs
        complain(
          this._map.id + "_hard_object_cap",
          "Too many objects",
          "You have reached the object limit for this map."
        );
        return;
      } else if (expectedCount > this._userPolicy.objectsWarning) {
        // Still attempt these changes, but show the soft-cap warning.
        complain(
          this._map.id + "_soft_object_cap",
          "Too many objects",
          'You are approaching the object limit for this map.  Consider clearing some unused areas or moving to a new map.'
        );
      }
    }

    await this._dataService.addChanges(this._map.adventureId, this._uid, this._map.id, changes);
  }

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
    const wasAnythingSelected = fluent(this._selection).any();
    this._selection.clear();
    this._selectionDrag.clear();
    this._selectionDragRed.clear();
    this._dragRectangle.reset();

    this._tokenMoveDragStart = undefined;
    this._tokenMoveJog = undefined;
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
    let position = this._drawing.getGridCoordAt(cp);
    if (position === undefined) {
      return undefined;
    }

    return this._notes.get(position);
  }

  faceDragEnd(cp: THREE.Vector3, colour: number): IChange[] {
    this.panMarginReset();
    let result = this._faceHighlighter.dragEnd(this._drawing.getGridCoordAt(cp), colour);
    this._dragRectangle.reset();
    return result;
  }

  faceDragStart(cp: THREE.Vector3, shiftKey: boolean, colour: number) {
    if (shiftKey) {
      this._dragRectangle.start(cp);
    }
    this._faceHighlighter.dragStart(this._drawing.getGridCoordAt(cp), colour);
  }

  flipToken(token: ITokenProperties): IChange[] | undefined {
    const flipped = flipToken(token);
    if (flipped !== undefined) {
      return this.setTokenById(token.id, flipped);
    } else {
      return undefined;
    }
  }

  *getSelectedTokens(): Iterable<ITokenProperties> {
    for (const s of this._selection) {
      yield s;
    }
  }

  // For editing
  getToken(cp: THREE.Vector3): ITokenProperties | undefined {
    const position = this._drawing.getGridCoordAt(cp);
    if (position === undefined) {
      return undefined;
    }

    return this._tokens.at(position);
  }

  // Designed to work in tandem with the panning commands, if we have tokens selected,
  // we want to jog on a first press and pan on a repeat.
  // Thus, `jogSelection` starts a token move if we don't have one already, and returns
  // true if it started one, else false.
  jogSelection(delta: IGridCoord) {
    this.onPanningStarted();
    if (this._tokenMoveJog === undefined) {
      return false;
    }

    this._tokenMoveJog = coordAdd(this._tokenMoveJog, delta);
    return true;
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
      let position = this._drawing.getGridCoordAt(cp);
      this.tokenMoveDragTo(position);
    } else if (this._dragRectangle.isEnabled()) {
      this.panIfWithinMargin(cp);
      this.selectTokensInDragRectangle();
    }
  }

  moveRoomHighlightTo(cp: THREE.Vector3, shiftKey: boolean, colour: number) {
    if (this._roomHighlighter.inDrag) {
      this.panIfWithinMargin(cp);
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

      let angle = this._scratchVector1.angleTo(this._scratchVector2);

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
      // Because of the way round that the camera transform is applied, we need to
      // apply the current scaling to our translation delta
      this._cameraTranslation.add(
        this._scratchTranslation.set(
          zoomDefault * (this._panLast.x - cp.x),
          zoomDefault * (cp.y - this._panLast.y),
          0
        ).divide(this._cameraScaling)
      );
    }

    this.resize();
    this._panLast = cp;
  }

  // Resets the view, centreing on a token with the given id.
  resetView(tokenId?: string | undefined) {
    this._cameraTranslation.set(0, 0, 0);
    this._cameraRotation.copy(this._defaultRotation);
    this._cameraScaling.set(zoomDefault, zoomDefault, 1);
    this._drawing.resize(this._cameraTranslation, this._cameraRotation, this._cameraScaling);

    let centreOn = tokenId === undefined ? undefined : this._tokens.ofId(tokenId)?.position;

    // If we have LoS positions, it would be more helpful to centre on the first of
    // those than on the grid origin:
    if (centreOn === undefined) {
      const losPositions = this.getLoSPositions();
      if (losPositions !== undefined && losPositions.length > 0) {
        centreOn = losPositions[0];
      }
    }

    if (centreOn !== undefined) {
      console.log("resetView: centre on " + centreOn.x + ", " + centreOn.y);
      const worldToViewport = this._drawing.getWorldToViewport(this._scratchMatrix1);
      const viewportScaling = this._scratchVector1.set(
        0.5 * window.innerWidth,
        0.5 * window.innerHeight,
        1
      );
      const zeroCentre = this._gridGeometry.createCoordCentre(this._scratchVector2, { x: 0, y: 0 }, 0)
        .applyMatrix4(worldToViewport)
        .multiply(viewportScaling);
      const delta = this._gridGeometry.createCoordCentre(this._scratchVector3, centreOn, 0)
        .applyMatrix4(worldToViewport)
        .multiply(viewportScaling)
        .sub(zeroCentre);

      this._cameraTranslation.set(delta.x, -delta.y, 0);
    }

    // The zoom is echoed to the map state so remember to update that
    this.withStateChange(getState => {
      const state = getState();
      state.zoom = zoomDefault;
      return true;
    });

    this.resize();
  }

  resize() {
    this._drawing.resize(this._cameraTranslation, this._cameraRotation, this._cameraScaling);

    // Some annotations that were off-screen may now be visible, or vice versa
    this._notesNeedUpdate.setNeedsRedraw();
  }

  roomDragEnd(cp: THREE.Vector3, shiftKey: boolean, colour: number): IChange[] {
    this.panMarginReset();
    this._roomHighlighter.difference = shiftKey;
    let result = this._roomHighlighter.dragEnd(this._drawing.getGridCoordAt(cp), colour);
    this._dragRectangle.reset();
    return result;
  }

  roomDragStart(cp: THREE.Vector3, shiftKey: boolean, colour: number) {
    this._dragRectangle.start(cp);
    this._roomHighlighter.difference = shiftKey;
    this._roomHighlighter.dragStart(this._drawing.getGridCoordAt(cp), colour);
  }

  // Selects the token at the client position, if there is one,
  // and begins a drag move for it.
  // Returns true if it selected something, else false.
  selectToken(cp: THREE.Vector3) {
    const position = this._drawing.getGridCoordAt(cp);
    if (position === undefined) {
      return undefined;
    }

    const token = this._tokens.at(position);
    if (token === undefined || !this.canSelectToken(token)) {
      return false;
    }

    const selected = this._selection.at(token.position);
    if (selected === undefined) {
      this.clearSelection();
      this._selection.add(token);
      this.withStateChange(getState => {
        this.buildLoS(getState());
        return true;
      });
    }

    this.tokenMoveDragStart(position);
    return true;
  }

  selectionDragEnd(cp: THREE.Vector3): IChange[] {
    this.panMarginReset();
    const position = this._drawing.getGridCoordAt(cp);
    const chs: IChange[] = [];
    if (position) {
      if (this._tokenMoveDragStart !== undefined) {
        this.tokenMoveDragEnd(position, chs);
      } else {
        // Always add the token at this position
        // (This is needed if the drag rectangle is very small)
        const token = this._tokens.at(position);
        if (token !== undefined && this.canSelectToken(token)) {
          this._selection.add(token);
        }
      }

      // If there were no changes, we won't be prodded into rebuilding the LoS
      // when they come back via the watcher, and so we should do so now.
      // (Not always, because that can cause LoS flicker)
      if (chs.length === 0) {
        this.withStateChange(getState => {
          this.buildLoS(getState());
          return true;
        });
      }
    }

    this._dragRectangle.reset();
    return chs;
  }

  selectionDragStart(cp: THREE.Vector3) {
    let position = this._drawing.getGridCoordAt(cp);
    if (position) {
      if (this._selection.at(position) !== undefined) {
        this.tokenMoveDragStart(position);
      } else {
        this.clearSelection();
        this._dragRectangle.start(cp);
      }
    }
  }

  setNote(cp: THREE.Vector3, id: string, colour: number, text: string, visibleToPlayers: boolean): IChange[] {
    let position = this._drawing.getGridCoordAt(cp);
    let chs: IChange[] = [];
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

  setPanningX(value: number) {
    this._panningX = value;
    return this.onPanningChange();
  }

  setPanningY(value: number) {
    this._panningY = value;
    return this.onPanningChange();
  }

  setShowMapColourVisualisation(show: boolean) {
    this._drawing.setShowMapColourVisualisation(show, this._mapColouring);
  }

  setToken(cp: THREE.Vector3, properties: ITokenProperties | undefined) {
    const position = this._drawing.getGridCoordAt(cp);
    if (position !== undefined) {
      const token = this._tokens.at(position);
      if (token !== undefined && properties !== undefined) {
        return this.setTokenProperties(token, properties);
      } else if (token !== undefined) {
        return [createTokenRemove(token.position, token.id)];
      } else if (properties !== undefined) {
        return this.addTokenWithProperties(position, properties);
      }
    }

    return [];
  }

  setTokenById(tokenId: string, properties: ITokenProperties | undefined) {
    const token = this._tokens.ofId(tokenId);
    if (token !== undefined && properties !== undefined) {
      return this.setTokenProperties(token, properties);
    } else if (token !== undefined) {
      return [createTokenRemove(token.position, token.id)];
    } else {
      return [];
    }
  }

  wallDragEnd(cp: THREE.Vector3, colour: number): IChange[] {
    this.panMarginReset();
    let result = this._dragRectangle.isEnabled() ?
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

  zoomBy(amount: number, step?: number | undefined) {
    this.withStateChange(getState => {
      const state = getState();
      state.zoom = Math.min(zoomMax, Math.max(zoomMin, state.zoom * Math.pow(step ?? zoomStep, -amount)));
      this._cameraScaling.set(state.zoom, state.zoom, 1);
      return true;
    });
    this.resize();
  }

  dispose() {
    if (this._isDisposed === false) {
      this._drawing.dispose();
      this._spritesheetCache.dispose();
      this._isDisposed = true;
    }
  }
}