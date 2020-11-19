import { IToast } from "../components/interfaces";
import { EditMode } from "../components/MapControls";
import { IAnnotation } from "../data/annotation";
import { Change, ChangeCategory, ChangeType } from "../data/change";
import { ITokenProperties } from "../data/feature";
import { IAdventureIdentified, IIdentified } from "../data/identified";
import { IImage, IMapImageProperties } from "../data/image";
import { IMap } from "../data/map";
import { isAMovementKeyDown, KeysDown, keysDownReducer } from "./keys";
import { MapStateMachine } from "./mapStateMachine";
import { editMap } from "../services/extensions";
import { IDataService, IFunctionsService } from "../services/interfaces";

import { Subject } from 'rxjs';
import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';

// This class manages a variety of map UI related state changes with side effects
// that I don't trust React to do properly (React `useReducer` may dispatch actions
// twice sometimes, but it's important that `addChanges` in particular is only called
// once for any particular change set or a resync will occur, for example.)
// Having this feels kind of an inevitable symptom of interoperating between functional
// React and stateful THREE.js :/

export type MapUiState = {
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
  contextMenuImage?: IMapImageProperties | undefined;

  mouseDown: boolean;
  touch?: number | undefined;

  showMapEditor: boolean;
  showTokenEditor: boolean;
  showCharacterTokenEditor: boolean;
  showNoteEditor: boolean;
  showTokenDeletion: boolean;
  showTokenImageDeletion: boolean;
  showMapImageEditor: boolean;

  tokenToEdit?: ITokenProperties | undefined;
  tokenToEditPosition?: THREE.Vector3 | undefined;
  noteToEdit?: IAnnotation | undefined;
  noteToEditPosition?: THREE.Vector3 | undefined;
  tokensToDelete: ITokenProperties[];
  tokenImageToDelete?: IImage | undefined;

  mapImageToEdit?: IMapImageProperties | undefined;
  mapImageToEditPosition?: THREE.Vector3 | undefined;
};

export function createDefaultUiState(): MapUiState {
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
    showCharacterTokenEditor: false,
    showNoteEditor: false,
    showTokenDeletion: false,
    showTokenImageDeletion: false,
    showMapImageEditor: false,
    tokensToDelete: [],
  };
}

export function isAnEditorOpen(state: MapUiState): boolean {
  return state.showMapEditor || state.showNoteEditor || state.showTokenEditor ||
    state.showTokenDeletion;
}

export class MapUi {
  private readonly _stateMachine: MapStateMachine | undefined;
  private readonly _setState: (state: MapUiState) => void;
  private readonly _getClientPosition: (x: number, y: number) => THREE.Vector3 | undefined;
  private readonly _logError: (message: string, e: any, fatal?: boolean | undefined) => void;
  private readonly _toasts: Subject<IIdentified<IToast | undefined>>;

  private _state = createDefaultUiState();

  constructor(
    stateMachine: MapStateMachine | undefined,
    setState: (state: MapUiState) => void,
    getClientPosition: (x: number, y: number) => THREE.Vector3 | undefined,
    logError: (message: string, e: any, fatal?: boolean | undefined) => void,
    toasts: Subject<IIdentified<IToast | undefined>>
  ) {
    this._stateMachine = stateMachine;
    this._setState = setState;
    this._getClientPosition = getClientPosition;
    this._logError = logError;
    this._toasts = toasts;
    console.log("created new UI state");
  }

  private addToast(title: string, message: string, id?: string | undefined) {
    this._toasts.next({
      id: id ?? uuidv4(),
      record: { title: title, message: message }
    });
  }

  private changeState(newState: MapUiState) {
    // When the edit mode changes away from Select, we should clear any selection.
    // #36 When the edit mode changes at all, we should clear the highlights
    if (newState.editMode !== this._state.editMode) {
      if (newState.editMode !== EditMode.Select) {
        this._stateMachine?.panMarginReset();
        this._stateMachine?.clearSelection();
      }
      this._stateMachine?.clearHighlights(newState.selectedColour);
    }

    this._state = newState;
    this._setState(newState);
  }

  private decideHowToEditToken(token: ITokenProperties | undefined, defaultToCharacter?: boolean | undefined) {
    switch (token?.characterId) {
      case undefined:
        if (this._state.editMode === EditMode.CharacterToken || defaultToCharacter === true) {
          return { showCharacterTokenEditor: true, showTokenEditor: false };
        } else {
          return { showCharacterTokenEditor: false, showTokenEditor: true };
        }

      case "":
        return { showCharacterTokenEditor: false, showTokenEditor: true };

      default:
        return { showCharacterTokenEditor: true, showTokenEditor: false };
    }
  }

  private interactionEnd(cp: THREE.Vector3, shiftKey: boolean, startingState: MapUiState) {
    const newState = { ...startingState };
    let changes: Change[] | undefined;
    if (this._state.isDraggingView) {
      this._stateMachine?.panEnd();
      newState.isDraggingView = false;
    } else {
      switch (this._state.editMode) {
        case EditMode.Select:
          changes = this._stateMachine?.selectionDragEnd(cp);
          break;

        case EditMode.Token:
        case EditMode.CharacterToken:
          newState.tokenToEdit = this._stateMachine?.getToken(cp);
          newState.tokenToEditPosition = cp;

          // Try to be clever about contextually editing the token in the right way
          const { showCharacterTokenEditor, showTokenEditor } = this.decideHowToEditToken(newState.tokenToEdit);
          newState.showCharacterTokenEditor = showCharacterTokenEditor;
          newState.showTokenEditor = showTokenEditor;
          break;

        case EditMode.Notes:
          newState.showNoteEditor = true;
          newState.noteToEdit = this._stateMachine?.getNote(cp);
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

        case EditMode.Image:
          // TODO #135 distinguish between a click and the end of a drag?
          newState.showMapImageEditor = true;
          newState.mapImageToEdit = this._stateMachine?.getImage(cp);
          newState.mapImageToEditPosition = cp;
          break;
      }
    }

    if (changes !== undefined && changes.length > 0) {
      // We've done something -- reset the edit mode
      newState.editMode = EditMode.Select;
    }

    this.addChanges(changes);
    this.changeState(newState);
  }

  private interactionMove(cp: THREE.Vector3, shiftKey: boolean): THREE.Vector3 {
    if (this._state.isDraggingView) {
      this._stateMachine?.panTo(cp);
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

  private interactionStart(cp: THREE.Vector3, shiftKey: boolean, ctrlKey: boolean, startingState: MapUiState) {
    const newState = { ...startingState, showContextMenu: false };
    switch (this._state.editMode) {
      case EditMode.Select:
        if (shiftKey) {
          this._stateMachine?.selectionDragStart(cp);
        } else if (this._stateMachine?.selectToken(cp) !== true) {
          // There's no token here -- pan or rotate the view instead.
          newState.isDraggingView = true;
          this._stateMachine?.clearSelection();
          this._stateMachine?.panStart(cp, ctrlKey);
        }
        break;

      case EditMode.Area: this._stateMachine?.faceDragStart(cp, shiftKey, this._state.selectedColour); break;
      case EditMode.Wall: this._stateMachine?.wallDragStart(cp, shiftKey, this._state.selectedColour); break;
      case EditMode.Room: this._stateMachine?.roomDragStart(cp, shiftKey, this._state.selectedColour); break;
    }

    this.changeState(newState);
  }

  private isTrackingTouch(e: React.TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; ++i) {
      if (e.changedTouches[i].identifier === this._state.touch) {
        return e.changedTouches[i];
      }
    }

    return undefined;
  }

  addChanges(changes: Change[] | undefined) {
    if (this._stateMachine === undefined) {
      return;
    }

    this._stateMachine.addChanges(changes, (id, title, message) => {
      this._toasts.next({ id: id, record: { title: title, message: message }});
    }).then(() => console.log(`Added ${changes?.length} changes to map ${this._stateMachine?.map.id}`))
      .catch(e => this._logError(`Error adding ${changes?.length} changes to map ${this._stateMachine?.map.id}`, e));
  }

  contextMenu(e: MouseEvent, bounds: DOMRect) {
    const cp = this._getClientPosition(e.clientX, e.clientY);
    console.log(`from ${e.clientX}, ${e.clientY} : got cp ${cp?.toArray()}`);
    this.changeState({
      ...this._state,
      showContextMenu: true,
      contextMenuX: e.clientX,
      contextMenuY: e.clientY,
      contextMenuPageRight: bounds.right,
      contextMenuPageBottom: bounds.bottom,
      contextMenuToken: cp ? this._stateMachine?.getToken(cp) : undefined,
      contextMenuNote: cp ? this._stateMachine?.getNote(cp) : undefined,
      contextMenuImage: cp ? this._stateMachine?.getImage(cp) : undefined
    });
  }

  editImage() {
    if (this._state.showMapImageEditor) {
      return;
    }

    const cp = this._getClientPosition(this._state.contextMenuX, this._state.contextMenuY);
    if (!cp) {
      return;
    }

    const image = this._stateMachine?.getImage(cp);
    this.changeState({
      ...this._state,
      showMapImageEditor: true,
      mapImageToEdit: image,
      mapImageToEditPosition: cp
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

    const note = this._stateMachine?.getNote(cp);
    this.changeState({
      ...this._state,
      showNoteEditor: true,
      noteToEdit: note,
      noteToEditPosition: cp
    });
  }

  editToken(defaultToCharacter?: boolean | undefined) {
    if (this._state.showTokenEditor || this._state.showCharacterTokenEditor) {
      return;
    }

    const cp = this._getClientPosition(this._state.contextMenuX, this._state.contextMenuY);
    if (!cp) {
      return;
    }

    console.log(`from menu position ${this._state.contextMenuX}, ${this._state.contextMenuY} : got token position ${cp}`);
    const token = this._stateMachine?.getToken(cp);
    this.changeState({
      ...this._state,
      ...this.decideHowToEditToken(token, defaultToCharacter),
      tokenToEdit: token,
      tokenToEditPosition: cp
    });
  }

  hideContextMenu() {
    if (this._state.showContextMenu === true) {
      this.changeState({ ...this._state, showContextMenu: false });
    }
  }

  imageDeletionClose() {
    this.changeState({
      ...this._state,
      showTokenImageDeletion: false,
      showTokenEditor: true, // hopefully the rest of its settings will be preserved :)
      tokenImageToDelete: undefined
    });
  }

  keyDown(e: KeyboardEvent) {
    if (this._state.mouseDown) {
      return;
    }

    const newKeysDown = keysDownReducer(this._state.keysDown, { key: e.key, down: true });
    if (e.key === 'ArrowLeft') {
      if (e.repeat || !this._stateMachine?.jogSelection({ x: -1, y: 0 })) {
        this.addChanges(this._stateMachine?.setPanningX(-1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      if (e.repeat || !this._stateMachine?.jogSelection({ x: 1, y: 0 })) {
        this.addChanges(this._stateMachine?.setPanningX(1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (e.repeat || !this._stateMachine?.jogSelection({ x: 0, y: 1 })) {
        this.addChanges(this._stateMachine?.setPanningY(1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      if (e.repeat || !this._stateMachine?.jogSelection({ x: 0, y: -1 })) {
        this.addChanges(this._stateMachine?.setPanningY(-1));
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
      this._stateMachine?.clearHighlights(this._state.selectedColour);
      this._stateMachine?.clearSelection();
      newState.editMode = EditMode.Select;
      newState.showContextMenu = false;
    }

    if (this._state.mouseDown) {
      return;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      this.addChanges(this._stateMachine?.setPanningX(0));
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      this.addChanges(this._stateMachine?.setPanningY(0));
      e.preventDefault();
    } else if (e.key === 'Delete') {
      // This invokes the token deletion if we've got tokens selected.
      const tokens = [...this._stateMachine?.getSelectedTokens() ?? []];
      if (canDoAnything && tokens.length > 0) {
        newState.showTokenDeletion = true;
        newState.tokensToDelete = tokens;
      }
    } else if (e.key === 'a' || e.key === 'A') {
      if (canDoAnything) {
        newState.editMode = EditMode.Area;
      }
    } else if (e.key === 'i' || e.key === 'I') {
      if (canDoAnything) {
        newState.editMode = EditMode.Image;
      }
    } else if (e.key === 'o' || e.key === 'O') {
      this._stateMachine?.resetView();
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

  mapImageEditorDelete(id: string) {
    this.addChanges([{
      ty: ChangeType.Remove,
      cat: ChangeCategory.Image,
      id: id
    }]);
    this.modalClose();
  }

  mapImageEditorDeleteImage(image: IImage | undefined) {
    if (image === undefined) {
      return;
    }

    // TODO #135 implement this
  }

  mapImageEditorSave(properties: IMapImageProperties) {
    if (this._state.mapImageToEditPosition !== undefined) {
      try {
        this.addChanges(this._stateMachine?.setMapImage(this._state.mapImageToEditPosition, properties));
      } catch (e) {
        this.addToast('Failed to save map image', String(e.message));
      }
    }
    
    this.modalClose();
  }

  modalClose() {
    if (
      this._state.showMapEditor === false &&
      this._state.showTokenDeletion === false &&
      this._state.showTokenEditor === false &&
      this._state.showCharacterTokenEditor === false &&
      this._state.showNoteEditor === false &&
      this._state.showMapImageEditor === false &&
      this._state.editMode === EditMode.Select
    ) {
      return;
    }

    this.changeState({
      ...this._state,
      showMapEditor: false,
      showTokenDeletion: false,
      showTokenEditor: false,
      showCharacterTokenEditor: false,
      showNoteEditor: false,
      showMapImageEditor: false,
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
      this.addChanges(this._stateMachine?.setNote(this._state.noteToEditPosition, "", -1, "", false));
    }

    this.modalClose();
  }

  noteEditorSave(id: string, colour: number, text: string, visibleToPlayers: boolean) {
    if (this._state.noteToEditPosition !== undefined) {
      this.addChanges(this._stateMachine?.setNote(
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

    const changes: Change[] = [];
    for (const t of this._state.tokensToDelete) {
      const chs = this._stateMachine?.setTokenById(t.id, undefined);
      if (chs !== undefined) {
        changes.push(...chs);
      }
    }

    this.addChanges(changes);
    this._stateMachine?.clearSelection();
    this.modalClose();
  }

  tokenEditorDelete() {
    if (this._state.tokenToEditPosition !== undefined) {
      try {
        this.addChanges(this._stateMachine?.setToken(this._state.tokenToEditPosition, undefined));
      } catch (e) {
        this.addToast('Failed to delete token', String(e.message));
      }
    }

    this.modalClose();
  }

  tokenEditorDeleteImage(image: IImage | undefined) {
    if (image === undefined) {
      return;
    }

    this.changeState({
      ...this._state,
      showTokenEditor: false, // will be put back when the image deletion modal is closed
      showTokenImageDeletion: true,
      tokenImageToDelete: image
    });
  }

  tokenEditorSave(properties: ITokenProperties) {
    if (this._state.tokenToEditPosition !== undefined) {
      try {
        this.addChanges(this._stateMachine?.setToken(this._state.tokenToEditPosition, properties));
      } catch (e) {
        this.addToast('Failed to save token', String(e.message));
      }
    }

    this.modalClose();
  }

  touchEnd(e: React.TouchEvent) {
    e.preventDefault();
    const t = this.touchMove(e);
    if (t === undefined || isAnEditorOpen(this._state) || isAMovementKeyDown(this._state.keysDown)) {
      return;
    }

    this.interactionEnd(t.cp, false, { ...this._state, touch: undefined });
  }

  touchMove(e: React.TouchEvent) {
    e.preventDefault();

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
    e.preventDefault();
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