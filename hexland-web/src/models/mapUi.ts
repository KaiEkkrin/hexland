import { IToast } from "../components/interfaces";
import { EditMode } from "../components/MapControls";
import { IAnnotation } from "../data/annotation";
import { IChange } from "../data/change";
import { ITokenProperties } from "../data/feature";
import { IAdventureIdentified, IIdentified } from "../data/identified";
import { IMap } from "../data/map";
import { isAMovementKeyDown, KeysDown, keysDownReducer } from "./keys";
import { MapStateMachine } from "./mapStateMachine";
import { IDataService, IFunctionsService } from "../services/interfaces";

import { Subject } from 'rxjs';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { editMap } from "../services/extensions";

// This class manages a variety of map UI related state changes with side effects
// that I don't trust React to do properly (React `useReducer` may dispatch actions
// twice sometimes, but it's important that `addChanges` in particular is only called
// once for any particular change set or a resync will occur, for example.)
// Having this feels kind of an inevitable symptom of interoperating between functional
// React and stateful THREE.js :/

export interface IMapUiState {
  editMode: EditMode;
  isDraggingView: boolean;
  keysDown: KeysDown;
  selectedColour: number;

  showContextMenu: boolean;
  contextMenuX: number;
  contextMenuY: number;
  contextMenuPageRight: number;
  contextMenuPageBottom: number;
  contextMenuToken?: ITokenProperties | undefined;
  contextMenuNote?: IAnnotation | undefined;

  mouseDown: boolean;
  touch?: number | undefined;

  showMapEditor: boolean;
  showTokenEditor: boolean;
  showNoteEditor: boolean;
  showTokenDeletion: boolean;

  tokenToEdit?: ITokenProperties | undefined;
  tokenToEditPosition?: THREE.Vector3 | undefined;
  noteToEdit?: IAnnotation | undefined;
  noteToEditPosition?: THREE.Vector3 | undefined;
  tokensToDelete: ITokenProperties[];
}

export function createDefaultUiState(): IMapUiState {
  return {
    editMode: EditMode.Select,
    isDraggingView: false,
    keysDown: {},
    selectedColour: 0,
    showContextMenu: false,
    contextMenuX: 0,
    contextMenuY: 0,
    contextMenuPageRight: 0,
    contextMenuPageBottom: 0,
    mouseDown: false,
    showMapEditor: false,
    showTokenEditor: false,
    showNoteEditor: false,
    showTokenDeletion: false,
    tokensToDelete: [],
  };
}

export function isAnEditorOpen(state: IMapUiState): boolean {
  return state.showMapEditor || state.showNoteEditor || state.showTokenEditor ||
    state.showTokenDeletion;
}

export class MapUi {
  private readonly _setState: (state: IMapUiState) => void;
  private readonly _stateMachine: MapStateMachine;
  private readonly _addChanges: (changes: IChange[] | undefined) => void;
  private readonly _getClientPosition: (x: number, y: number) => THREE.Vector3 | undefined;
  private readonly _toasts: Subject<IIdentified<IToast | undefined>>;

  private _state = createDefaultUiState();

  constructor(
    setState: (state: IMapUiState) => void,
    stateMachine: MapStateMachine,
    addChanges: (changes: IChange[] | undefined) => void,
    getClientPosition: (x: number, y: number) => THREE.Vector3 | undefined,
    toasts: Subject<IIdentified<IToast | undefined>>
  ) {
    this._setState = setState;
    this._stateMachine = stateMachine;
    this._addChanges = addChanges;
    this._getClientPosition = getClientPosition;
    this._toasts = toasts;
  }

  private addToast(title: string, message: string, id?: string | undefined) {
    this._toasts.next({
      id: id ?? uuidv4(),
      record: { title: title, message: message }
    });
  }

  private changeState(newState: IMapUiState) {
    // When the edit mode changes away from Select, we should clear any selection.
    // #36 When the edit mode changes at all, we should clear the highlights
    if (newState.editMode !== this._state.editMode) {
      if (newState.editMode !== EditMode.Select) {
        this._stateMachine.panMarginReset();
        this._stateMachine.clearSelection();
      }
      this._stateMachine.clearHighlights(newState.selectedColour);
    }

    this._state = newState;
    this._setState(newState);
  }

  private interactionEnd(cp: THREE.Vector3, shiftKey: boolean, startingState: IMapUiState) {
    const newState = { ...startingState };
    let changes: IChange[] | undefined;
    if (this._state.isDraggingView) {
      this._stateMachine?.panEnd();
      newState.isDraggingView = false;
    } else {
      switch (this._state.editMode) {
        case EditMode.Select:
          changes = this._stateMachine?.selectionDragEnd(cp);
          break;

        case EditMode.Token:
          newState.showTokenEditor = true;
          newState.tokenToEdit = this._stateMachine.getToken(cp);
          newState.tokenToEditPosition = cp;
          break;

        case EditMode.Notes:
          newState.showNoteEditor = true;
          newState.noteToEdit = this._stateMachine.getNote(cp);
          newState.noteToEditPosition = cp;
          break;

        case EditMode.Area:
          changes = this._stateMachine?.faceDragEnd(cp, this._state.selectedColour);
          break;

        case EditMode.Wall:
          changes = this._stateMachine?.wallDragEnd(cp, this._state.selectedColour);
          break;

        case EditMode.Room:
          changes = this._stateMachine?.roomDragEnd(cp, shiftKey, this._state.selectedColour);
          break;
      }
    }

    if (changes !== undefined && changes.length > 0) {
      // We've done something -- reset the edit mode
      newState.editMode = EditMode.Select;
    }

    this._addChanges(changes);
    this.changeState(newState);
  }

  private interactionMove(cp: THREE.Vector3, shiftKey: boolean): THREE.Vector3 {
    if (this._state.isDraggingView) {
      this._stateMachine.panTo(cp);
    } else {
      switch (this._state.editMode) {
        case EditMode.Select: this._stateMachine?.moveSelectionTo(cp); break;
        case EditMode.Area: this._stateMachine?.moveFaceHighlightTo(cp, this._state.selectedColour); break;
        case EditMode.Wall: this._stateMachine?.moveWallHighlightTo(cp, shiftKey, this._state.selectedColour); break;
        case EditMode.Room: this._stateMachine?.moveRoomHighlightTo(cp, shiftKey, this._state.selectedColour); break;
      }
    }

    return cp;
  }

  private interactionStart(cp: THREE.Vector3, shiftKey: boolean, ctrlKey: boolean, startingState: IMapUiState) {
    let isDraggingView = this._state.isDraggingView;
    switch (this._state.editMode) {
      case EditMode.Select:
        if (shiftKey) {
          this._stateMachine.selectionDragStart(cp);
        } else if (this._stateMachine.selectToken(cp) !== true) {
          // There's no token here -- pan or rotate the view instead.
          isDraggingView = true;
          this._stateMachine.clearSelection();
          this._stateMachine.panStart(cp, ctrlKey);
        }
        break;

      case EditMode.Area: this._stateMachine.faceDragStart(cp, shiftKey, this._state.selectedColour); break;
      case EditMode.Wall: this._stateMachine?.wallDragStart(cp, shiftKey, this._state.selectedColour); break;
      case EditMode.Room: this._stateMachine?.roomDragStart(cp, shiftKey, this._state.selectedColour); break;
    }

    if (isDraggingView !== this._state.isDraggingView) {
      this.changeState({ ...this._state, isDraggingView: isDraggingView });
    }
  }

  private isTrackingTouch(e: React.TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; ++i) {
      if (e.changedTouches[i].identifier === this._state.touch) {
        return e.changedTouches[i];
      }
    }

    return undefined;
  }

  contextMenu(e: MouseEvent, bounds: DOMRect) {
    const cp = this._getClientPosition(e.clientX, e.clientX);
    this.changeState({
      ...this._state,
      showContextMenu: true,
      contextMenuX: e.clientX,
      contextMenuY: e.clientY,
      contextMenuPageRight: bounds.right,
      contextMenuPageBottom: bounds.bottom,
      contextMenuToken: cp ? this._stateMachine.getToken(cp) : undefined,
      contextMenuNote: cp ? this._stateMachine.getNote(cp) : undefined
    });
  }

  editNote() {
    if (this._state.showNoteEditor) {
      return;
    }

    const cp = this._getClientPosition(this._state.contextMenuX, this._state.contextMenuY);
    if (!cp) {
      return;
    }

    const note = this._stateMachine.getNote(cp);
    if (!note) {
      return;
    }

    this.changeState({
      ...this._state,
      showNoteEditor: true,
      noteToEdit: note,
      noteToEditPosition: cp
    });
  }

  editToken() {
    if (this._state.showTokenEditor) {
      return;
    }

    const cp = this._getClientPosition(this._state.contextMenuX, this._state.contextMenuY);
    if (!cp) {
      return;
    }

    const token = this._stateMachine.getToken(cp);
    if (!token) {
      return;
    }

    this.changeState({
      ...this._state,
      showTokenEditor: true,
      tokenToEdit: token,
      tokenToEditPosition: cp
    });
  }

  hideContextMenu() {
    if (this._state.showContextMenu === true) {
      this.changeState({ ...this._state, showContextMenu: false });
    }
  }

  keyDown(e: KeyboardEvent) {
    if (this._state.mouseDown) {
      return;
    }

    const newKeysDown = keysDownReducer(this._state.keysDown, { key: e.key, down: true });
    if (e.key === 'ArrowLeft') {
      if (e.repeat || !this._stateMachine.jogSelection({ x: -1, y: 0 })) {
        this._addChanges(this._stateMachine.setPanningX(-1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      if (e.repeat || !this._stateMachine.jogSelection({ x: 1, y: 0 })) {
        this._addChanges(this._stateMachine.setPanningX(1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (e.repeat || !this._stateMachine.jogSelection({ x: 0, y: 1 })) {
        this._addChanges(this._stateMachine.setPanningY(1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      if (e.repeat || !this._stateMachine.jogSelection({ x: 0, y: -1 })) {
        this._addChanges(this._stateMachine.setPanningY(-1));
      }
      e.preventDefault();
    }

    this.changeState({ ...this._state, keysDown: newKeysDown });
  }

  keyUp(e: KeyboardEvent, canDoAnything: boolean) {
    const newState = {
      ...this._state,
      keysDown: keysDownReducer(this._state.keysDown, { key: e.key, down: false })
    };

    if (e.key === 'Escape') {
      // This should cancel any drag operation, and also return us to
      // select mode.  Unlike the other keys, it should operate even
      // during a mouse drag.
      this._stateMachine.clearHighlights(this._state.selectedColour);
      this._stateMachine.clearSelection();
      newState.editMode = EditMode.Select;
      newState.showContextMenu = false;
    }

    if (this._state.mouseDown) {
      return;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      this._addChanges(this._stateMachine.setPanningX(0));
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      this._addChanges(this._stateMachine.setPanningY(0));
      e.preventDefault();
    } else if (e.key === 'Delete') {
      // This invokes the token deletion if we've got tokens selected.
      const tokens = [...this._stateMachine.getSelectedTokens()];
      if (canDoAnything && tokens.length > 0) {
        newState.showTokenDeletion = true;
        newState.tokensToDelete = tokens;
      }
    } else if (e.key === 'a' || e.key === 'A') {
      if (canDoAnything) {
        newState.editMode = EditMode.Area;
      }
    } else if (e.key === 'o' || e.key === 'O') {
      this._stateMachine.resetView();
    } else if (e.key === 'r' || e.key === 'R') {
      if (canDoAnything) {
        newState.editMode = EditMode.Room;
      }
    } else if (e.key === 's' || e.key === 'S') {
      newState.editMode = EditMode.Select;
    } else if (e.key === 'w' || e.key === 'W') {
      if (canDoAnything) {
        newState.editMode = EditMode.Wall;
      }
    }

    this.changeState(newState);
  }

  async mapEditorSave(
    dataService: IDataService | undefined,
    functionsService: IFunctionsService | undefined,
    map: IAdventureIdentified<IMap> | undefined,
    updated: IMap,
    logError: (message: string, e: any) => void
  ) {
    if (!this._state.showMapEditor) {
      return;
    }

    this.changeState({ ...this._state, showMapEditor: false });
    if (dataService === undefined || functionsService === undefined || map === undefined) {
      return;
    }

    if (map.record.ffa === true && updated.ffa === false) {
      // We should do a consolidate first, otherwise we might be invalidating the
      // backlog of non-owner moves.
      try {
        await functionsService.consolidateMapChanges(map.adventureId, map.id, false);
      } catch (e) {
        logError(`Error consolidating map ${map.adventureId}/${map.id} changes`, e);
      }
    }

    try {
      await editMap(dataService, map.adventureId, map.id, updated);
    } catch (e) {
      logError('Failed to update map', e);
    }
  }

  modalClose() {
    if (
      this._state.showMapEditor === false &&
      this._state.showTokenDeletion === false &&
      this._state.showTokenEditor === false &&
      this._state.showNoteEditor === false &&
      this._state.editMode === EditMode.Select
    ) {
      return;
    }

    this.changeState({
      ...this._state,
      showMapEditor: false,
      showTokenDeletion: false,
      showTokenEditor: false,
      showNoteEditor: false,
      editMode: EditMode.Select
    });
  }

  mouseDown(e: React.MouseEvent, cp: THREE.Vector3 | undefined) {
    const newState = { ...this._state, showContextMenu: false };
    if (
      cp === undefined || isAnEditorOpen(this._state) ||
      e.button !== 0 || isAMovementKeyDown(this._state.keysDown)
    ) {
      if (this._state.showContextMenu) {
        this.changeState(newState);
      }

      return;
    }

    this.interactionStart(cp, e.shiftKey, e.ctrlKey, { ...this._state, mouseDown: true });
  }

  mouseMove(e: React.MouseEvent, cp: THREE.Vector3 | undefined) {
    if (
      cp === undefined || isAnEditorOpen(this._state) || isAMovementKeyDown(this._state.keysDown)
    ) {
      return;
    }

    this.interactionMove(cp, e.shiftKey);
    return cp;
  }

  mouseUp(e: React.MouseEvent, cp: THREE.Vector3 | undefined) {
    const newState = { ...this._state, mouseDown: false };
    if (
      cp === undefined || isAnEditorOpen(this._state) || isAMovementKeyDown(this._state.keysDown)
    ) {
      this.changeState(newState);
      return;
    }

    this.interactionEnd(cp, e.shiftKey, newState);
  }

  noteEditorDelete() {
    if (this._state.noteToEditPosition !== undefined) {
      this._addChanges(this._stateMachine.setNote(this._state.noteToEditPosition, "", -1, "", false));
    }

    this.modalClose();
  }

  noteEditorSave(id: string, colour: number, text: string, visibleToPlayers: boolean) {
    if (this._state.noteToEditPosition !== undefined) {
      this._addChanges(this._stateMachine.setNote(
        this._state.noteToEditPosition, id, colour, text, visibleToPlayers
      ));
    }

    this.modalClose();
  }

  setEditMode(editMode: EditMode) {
    if (editMode !== this._state.editMode) {
      this.changeState({ ...this._state, editMode: editMode });
    }
  }

  setSelectedColour(colour: number) {
    if (colour !== this._state.selectedColour) {
      this.changeState({ ...this._state, selectedColour: colour });
    }
  }

  showMapEditor() {
    if (this._state.showMapEditor === false) {
      this.changeState({ ...this._state, showMapEditor: true });
    }
  }

  tokenDeletion() {
    if (this._state.showTokenDeletion === false) {
      return;
    }

    const changes: IChange[] = [];
    for (const t of this._state.tokensToDelete) {
      const chs = this._stateMachine.setTokenById(t.id, undefined);
      if (chs !== undefined) {
        changes.push(...chs);
      }
    }

    this._addChanges(changes);
    this._stateMachine.clearSelection();
    this.modalClose();
  }

  tokenEditorDelete() {
    if (this._state.tokenToEditPosition !== undefined) {
      try {
        this._addChanges(this._stateMachine?.setToken(this._state.tokenToEditPosition, undefined));
      } catch (e) {
        this.addToast('Failed to delete token', String(e.message));
      }
    }

    this.modalClose();
  }

  tokenEditorSave(properties: ITokenProperties) {
    if (this._state.tokenToEditPosition !== undefined) {
      try {
        this._addChanges(this._stateMachine.setToken(this._state.tokenToEditPosition, properties));
      } catch (e) {
        this.addToast('Failed to save token', String(e.message));
      }
    }

    this.modalClose();
  }

  touchEnd(e: React.TouchEvent) {
    const t = this.touchMove(e);
    if (t === undefined || isAnEditorOpen(this._state) || isAMovementKeyDown(this._state.keysDown)) {
      return;
    }

    this.interactionEnd(t.cp, false, { ...this._state, touch: undefined });
  }

  touchMove(e: React.TouchEvent) {
    // This only takes effect if the touch we're tracking has changed
    const t = this.isTrackingTouch(e);
    if (t === undefined) {
      return undefined;
    }

    const cp = this._getClientPosition(t.clientX, t.clientY);
    if (cp === undefined || isAnEditorOpen(this._state) || isAMovementKeyDown(this._state.keysDown)) {
      return undefined;
    }

    return { touch: t, cp: this.interactionMove(cp, false) };
  }

  touchStart(e: React.TouchEvent) {
    if (this._state.touch !== undefined || e.changedTouches.length === 0) {
      return;
    }

    const t = e.changedTouches[0];
    const cp = this._getClientPosition(t.clientX, t.clientY);
    if (cp === undefined || isAnEditorOpen(this._state) || isAMovementKeyDown(this._state.keysDown)) {
      if (this._state.showContextMenu === true) {
        this.changeState({ ...this._state, showContextMenu: false });
      }

      return;
    }

    this.interactionStart(cp, false, false, { ...this._state, showContextMenu: false, touch: t.identifier });
  }
}