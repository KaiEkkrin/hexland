import React, { useEffect, useRef, useState, useContext, useMemo, useCallback, useReducer } from 'react';
import './App.css';
import './Map.css';

import { addToast } from './components/extensions';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import { IAnalyticsContext } from './components/interfaces';
import MapContextMenu from './components/MapContextMenu';
import MapControls, { EditMode, MapColourVisualisationMode } from './components/MapControls';
import MapAnnotations, { ShowAnnotationFlags } from './components/MapAnnotations';
import MapEditorModal from './components/MapEditorModal';
import MapInfo from './components/MapInfo';
import Navigation from './components/Navigation';
import NoteEditorModal from './components/NoteEditorModal';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { StatusContext } from './components/StatusContextProvider';
import TokenDeletionModal from './components/TokenDeletionModal';
import TokenEditorModal from './components/TokenEditorModal';
import { UserContext } from './components/UserContextProvider';

import { IPlayer } from './data/adventure';
import { IAnnotation } from './data/annotation';
import { IChange } from './data/change';
import { netObjectCount, trackChanges } from './data/changeTracking';
import { IToken, ITokenProperties } from './data/feature';
import { IAdventureIdentified } from './data/identified';
import { IMap } from './data/map';
import { getUserPolicy } from './data/policy';
import { IProfile } from './data/profile';
import { registerMapAsRecent, editMap, watchChangesAndConsolidate, removeMapFromRecent } from './services/extensions';
import { IDataService, IFunctionsService } from './services/interfaces';

import { standardColours } from './models/featureColour';
import * as Keys from './models/keys';
import { MapStateMachine, createDefaultState } from './models/mapStateMachine';
import { networkStatusTracker } from './models/networkStatusTracker';

import { Link, RouteComponentProps, useHistory } from 'react-router-dom';

import * as THREE from 'three';
import fluent from 'fluent-iterable';
import { v4 as uuidv4 } from 'uuid';

// The map component is rather large because of all the state that got pulled into it...
function Map(props: IMapPageProps) {
  const userContext = useContext(UserContext);
  const analyticsContext = useContext(AnalyticsContext);
  const profile = useContext(ProfileContext);
  const statusContext = useContext(StatusContext);
  const history = useHistory();

  const drawingRef = useRef<HTMLDivElement>(null);

  const [map, setMap] = useState(undefined as IAdventureIdentified<IMap> | undefined);
  const [players, setPlayers] = useState([] as IPlayer[]);
  const [canDoAnything, setCanDoAnything] = useState(false);
  const [mapState, setMapState] = useState(createDefaultState());

  // We only track a user policy if the user is the map owner
  const userPolicy = useMemo(() => {
    if (map?.record.owner !== userContext.user?.uid || profile === undefined) {
      return undefined;
    }

    return getUserPolicy(profile.level);
  }, [map, profile, userContext]);

  // Create a suitable title
  const title = useMemo(() => {
    if (map === undefined || profile === undefined) {
      return undefined;
    }

    const adventureLink = "/adventure/" + props.adventureId;
    const objectsString = userPolicy === undefined ? undefined : " (" + mapState.objectCount + "/" + userPolicy.objects + ")";
    return (
      <div>
        <Link to={adventureLink}>{map.record.adventureName}</Link> | {map.record.name}{objectsString}
      </div>
    );
  }, [props.adventureId, profile, map, mapState, userPolicy]);

  // Track network status
  const [resyncCount, setResyncCount] = useState(0);
  useEffect(() => {
    const resyncSub = networkStatusTracker.resyncCount.subscribe(setResyncCount);
    return () => {
      resyncSub.unsubscribe();
    }
  }, [setResyncCount]);

  // Building the map state machine like this lets us auto-dispose old ones.
  // Careful, the function may be called more than once for any given pair of
  // arguments (state, action) (wtf, React?!)
  const [stateMachine, setStateMachine] = useReducer(
    (state: MapStateMachine | undefined, action: MapStateMachine | undefined) => {
      state?.dispose();
      return action;
    }, undefined
  );

  // Hide scroll bars whilst viewing the map.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  // Watch the map when it changes
  useEffect(() => {
    if (userContext.dataService === undefined) {
      return;
    }

    let mapRef = userContext.dataService.getMapRef(props.adventureId, props.mapId);

    // How to handle a map load failure.
    function couldNotLoad(message: string) {
      statusContext.toasts.next({
        id: uuidv4(),
        record: { title: 'Error loading map', message: message }
      });

      const uid = userContext.user?.uid;
      if (uid && mapRef) {
        removeMapFromRecent(userContext.dataService, uid, mapRef.id)
          .catch(e => analyticsContext.logError("Error removing map from recent", e));
      }

      history.replace('/');
    }

    // Check this map exists and can be fetched (the watch doesn't do this for us)
    userContext.dataService.get(mapRef)
      .then(r => {
        if (r === undefined) {
          couldNotLoad('That map does not exist.');
        }
      })
      .catch(e => {
        analyticsContext.logError("Error checking for map " + props.mapId + ": ", e);
        couldNotLoad(e.message);
      });

    analyticsContext.analytics?.logEvent("select_content", {
      "content_type": "map",
      "item_id": props.mapId
    });

    return userContext.dataService.watch<IMap>(
      mapRef, m => setMap(m === undefined ? undefined : {
        adventureId: props.adventureId,
        id: props.mapId,
        record: m
      }),
      e => analyticsContext.logError("Error watching map " + props.mapId, e)
    );
  }, [userContext, analyticsContext, history, props.adventureId, props.mapId, statusContext]);

  // Track changes to the map.
  // We don't start watching until we have an initialised state machine (which means the
  // consolidate is done).
  // The "openMap" utility's dependencies are deliberately limited to prevent it from being
  // re-created and causing lots of extra Firebase work.
  const openMap = useCallback(async (
    analyticsContext: IAnalyticsContext,
    dataService: IDataService,
    functionsService: IFunctionsService,
    uid: string,
    profile: IProfile,
    map: IAdventureIdentified<IMap>,
    mount: HTMLDivElement
  ) => {
    // These two calls are both done on a best-effort basis, because failing shouldn't
    // preclude us from opening the map (although hopefully they will succeed)
    try {
      registerMapAsRecent(dataService, uid, map.adventureId, map.id, map.record);
    } catch (e) {
      analyticsContext.logError("Error registering map " + map.adventureId + "/" + map.id + " as recent", e);
    }

    try {
      console.log("consolidating map changes");
      functionsService.consolidateMapChanges(map.adventureId, map.id, false);
    } catch (e) {
      analyticsContext.logError("Error consolidating map " + map.adventureId + "/" + map.id + " changes", e);
    }

    const userPolicy = uid === map.record.owner ? getUserPolicy(profile.level) : undefined;
    setStateMachine(new MapStateMachine(map, uid, standardColours, mount, userPolicy, setMapState));
  }, [setMapState, setStateMachine]);

  useEffect(() => {
    const uid = userContext.user?.uid;
    if (
      userContext.dataService === undefined ||
      userContext.functionsService === undefined ||
      map === undefined ||
      uid === undefined ||
      profile === undefined ||
      drawingRef?.current === null
    ) {
      setStateMachine(undefined);
      return;
    }

    openMap(analyticsContext, userContext.dataService, userContext.functionsService, uid, profile, map, drawingRef?.current)
      .catch(e => analyticsContext.logError("Error opening map", e));
  }, [analyticsContext, drawingRef, openMap, map, profile, userContext]);

  useEffect(() => {
    if (stateMachine === undefined) {
      return undefined;
    }

    console.log("Watching changes to map " + stateMachine.map.id);
    networkStatusTracker.clear();
    return watchChangesAndConsolidate(
      userContext.dataService, userContext.functionsService,
      stateMachine.map.adventureId, stateMachine.map.id,
      chs => {
        networkStatusTracker.onChanges(chs);
        return trackChanges(stateMachine.map.record, stateMachine.changeTracker, chs.chs, chs.user);
      },
      () => stateMachine.changeTracker.clear(),
      analyticsContext.logEvent,
      e => analyticsContext.logError("Error watching map changes", e));
  }, [analyticsContext, stateMachine, userContext]);

  // If we can't see anything, notify the user
  const canSeeAnything = useMemo(() => {
    return mapState.seeEverything || fluent(mapState.tokens).any(t => t.selectable);
  }, [mapState]);

  // This helps us focus somewhere useful when the map becomes visible
  useEffect(() => {
    if (canSeeAnything === false) {
      let removeToast = addToast(statusContext, {
        title: "No tokens available",
        message: "The map owner has not assigned you any tokens, so you will not see any of the map yet.  If you remain on this page until they do, it will update."
      });
      return () => {
        // When this stops being true, as well as removing the toast, we want to
        // focus somewhere suitable:
        removeToast();
        stateMachine?.resetView();
      };
    } else {
      return undefined;
    }
  }, [statusContext, canSeeAnything, stateMachine]);

  // Track the adventure's players
  useEffect(() => {
    if (userContext.dataService === undefined) {
      return () => {};
    }

    console.log("Watching players in adventure " + props.adventureId);
    return userContext.dataService.watchPlayers(props.adventureId, setPlayers,
      e => analyticsContext.logError("Error watching players", e));
  }, [analyticsContext, userContext.dataService, props.adventureId, canDoAnything]);

  // How to create and share the map changes we make
  const addChanges = useCallback((changes: IChange[] | undefined) => {
    const uid = userContext.user?.uid;
    if (
      changes === undefined || changes.length === 0 || userContext.dataService === undefined ||
      uid === undefined
    ) {
      return;
    }

    if (mapState.objectCount !== undefined && userPolicy !== undefined) {
      const expectedCount = mapState.objectCount + netObjectCount(changes);
      if (expectedCount > userPolicy.objects) {
        // Refuse to attempt these changes -- this would cause the map to be pruned on
        // consolidate, with consequent desyncs
        statusContext.toasts.next({ id: map?.id + "_hard_object_cap", record: {
          title: 'Too many objects', message: 'You have reached the object limit for this map.'
        }});
        return;
      } else if (expectedCount > userPolicy.objectsWarning) {
        // Still attempt these changes, but show the soft-cap warning.
        statusContext.toasts.next({ id: map?.id + "_soft_object_cap", record: {
          title: 'Too many objects', message: 'You are approaching the object limit for this map.  Consider clearing some unused areas or moving to a new map.'
        }});
      }
    }

    userContext.dataService.addChanges(props.adventureId, uid, props.mapId, changes)
      .then(() => console.log("Added " + changes.length + " changes"))
      .catch(e => analyticsContext.logError("Error adding " + changes.length + " changes", e));
  }, [userContext.dataService, userContext.user, analyticsContext, map, mapState, props.adventureId, props.mapId, statusContext.toasts, userPolicy]);

  // == UI STUFF ==

  const [isOwner, setIsOwner] = useState(false);
  const [editMode, setEditMode] = useState(EditMode.Select);
  const [mapColourMode, setMapColourMode] = useState(MapColourVisualisationMode.Areas);
  const [selectedColour, setSelectedColour] = useState(0);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuX, setContextMenuX] = useState(0);
  const [contextMenuY, setContextMenuY] = useState(0);
  const [contextMenuPageRight, setContextMenuPageRight] = useState(0);
  const [contextMenuPageBottom, setContextMenuPageBottom] = useState(0);
  const [contextMenuToken, setContextMenuToken] = useState<IToken | undefined>(undefined);
  const [contextMenuNote, setContextMenuNote] = useState<IAnnotation | undefined>(undefined);

  const [showMapEditor, setShowMapEditor] = useState(false);
  const [showTokenEditor, setShowTokenEditor] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showTokenDeletion, setShowTokenDeletion] = useState(false);

  const [tokenToEdit, setTokenToEdit] = useState(undefined as IToken | undefined);
  const [tokenToEditPosition, setTokenToEditPosition] = useState(undefined as THREE.Vector3 | undefined);
  const [noteToEdit, setNoteToEdit] = useState(undefined as IAnnotation | undefined);
  const [noteToEditPosition, setNoteToEditPosition] = useState(undefined as THREE.Vector3 | undefined);
  const [tokensToDelete, setTokensToDelete] = useState<IToken[]>([]);

  const [isDraggingView, setIsDraggingView] = useState(false);

  useEffect(() => {
    setCanDoAnything(map?.record.ffa === true || userContext.user?.uid === map?.record.owner);
  }, [userContext.user, map]);

  useEffect(() => {
    setIsOwner(userContext.user?.uid === map?.record.owner);
  }, [userContext.user, map]);

  // When the edit mode changes at all, reset any margin panning.
  // When the edit mode changes away from Select, we should clear any selection.
  // #36 When the edit mode changes at all, we should clear the highlights
  useEffect(() => {
    stateMachine?.panMarginReset();
    stateMachine?.clearHighlights(selectedColour);
    if (editMode !== EditMode.Select) {
      stateMachine?.clearSelection();
    }
  }, [stateMachine, editMode, selectedColour]);

  // Sync the drawing with the map colour mode
  useEffect(() => {
    stateMachine?.setShowMapColourVisualisation(mapColourMode === MapColourVisualisationMode.Connectivity);
  }, [stateMachine, mapColourMode]);

  const handleMapEditorSave = useCallback(async (adventureId: string, updated: IMap) => {
    setShowMapEditor(false);
    if (userContext.dataService !== undefined && map !== undefined) {
      let dataService = userContext.dataService;

      if (map.record.ffa === true && updated.ffa === false) {
        // We should do a consolidate first, otherwise we might be invalidating the
        // backlog of non-owner moves.
        try {
          console.log("consolidating map changes");
          await userContext.functionsService?.consolidateMapChanges(map.adventureId, map.id, false);
        } catch (e) {
          analyticsContext.logError("Error consolidating map " + map.adventureId + "/" + map.id + " changes", e);
        }
      }

      try {
        await editMap(dataService, map.adventureId, map.id, updated);
        console.log("Updated map");
      } catch (e) {
        analyticsContext.logError("Failed to update map: ", e);
      }
    }
  }, [analyticsContext, map, setShowMapEditor, userContext]);

  const handleModalClose = useCallback(() => {
    setShowMapEditor(false);
    setShowTokenDeletion(false);
    setShowTokenEditor(false);
    setShowNoteEditor(false);
    setEditMode(EditMode.Select);
  }, [setEditMode, setShowMapEditor, setShowTokenDeletion, setShowTokenEditor, setShowNoteEditor]);

  const handleTokenEditorDelete = useCallback(() => {
    if (tokenToEditPosition !== undefined) {
      addChanges(stateMachine?.setToken(tokenToEditPosition, undefined));
    }
    handleModalClose();
  }, [addChanges, handleModalClose, stateMachine, tokenToEditPosition]);

  const handleTokenEditorSave = useCallback((properties: ITokenProperties) => {
    if (tokenToEditPosition !== undefined) {
      addChanges(stateMachine?.setToken(tokenToEditPosition, properties));
    }
    handleModalClose();
  }, [addChanges, handleModalClose, stateMachine, tokenToEditPosition]);

  const handleNoteEditorDelete = useCallback(() => {
    if (noteToEditPosition !== undefined) {
      addChanges(stateMachine?.setNote(noteToEditPosition, "", -1, "", false));
    }
    handleModalClose();
  }, [addChanges, handleModalClose, noteToEditPosition, stateMachine]);

  const handleNoteEditorSave = useCallback((id: string, colour: number, text: string, visibleToPlayers: boolean) => {
    if (noteToEditPosition !== undefined) {
      addChanges(stateMachine?.setNote(noteToEditPosition, id, colour, text, visibleToPlayers));
    }
    handleModalClose();
  }, [addChanges, handleModalClose, noteToEditPosition, stateMachine]);

  const handleTokenDeletion = useCallback(() => {
    let changes: IChange[] = [];
    for (let t of tokensToDelete) {
      let chs = stateMachine?.setTokenPosition(t.position, undefined);
      if (chs !== undefined) {
        changes.push(...chs);
      }
    }

    addChanges(changes);
    stateMachine?.clearSelection();
    handleModalClose();
  }, [addChanges, handleModalClose, stateMachine, tokensToDelete]);

  // We track what keys are down so that we can disable mouse movement handlers if a movement key
  // is down (they don't play well together)
  const [keysDown, setKeysDown] = useReducer(Keys.keysDownReducer, {});
  const movementKeyDown = useMemo(
    () => Keys.isKeyDown(keysDown, 'ArrowLeft') || Keys.isKeyDown(keysDown, 'ArrowRight') ||
      Keys.isKeyDown(keysDown, 'ArrowUp') || Keys.isKeyDown(keysDown, 'ArrowDown') ||
      Keys.isKeyDown(keysDown, 'O'),
    [keysDown]
  );

  // ...and also that the mouse button is down so we can disable movement keys
  const [mouseDown, setMouseDown] = useState(false);

  // ...and also whether a touch is active (and its identifier.)
  const [touch, setTouch] = useState<number | undefined>(undefined);

  // We want to disable most of the handlers, below, if a modal editor is open, to prevent
  // accidents whilst editing
  const anEditorIsOpen = useMemo(
    () => showMapEditor || showNoteEditor || showTokenEditor,
    [showMapEditor, showNoteEditor, showTokenEditor]
  );

  const getClientPosition = useCallback((clientX: number, clientY: number) => {
    let bounds = drawingRef.current?.getBoundingClientRect();
    if (bounds === undefined) {
      return undefined;
    }

    let x = clientX - bounds.left;
    let y = clientY - bounds.top;
    return new THREE.Vector3(x, bounds.height - y - 1, 0);
  }, [drawingRef]);

  const editNote = useCallback((cp: THREE.Vector3, note: IAnnotation | undefined) => {
    setShowNoteEditor(true);
    setNoteToEdit(note);
    setNoteToEditPosition(cp);
  }, [setShowNoteEditor, setNoteToEdit, setNoteToEditPosition]);

  const editToken = useCallback((cp: THREE.Vector3, token: IToken | undefined) => {
    setShowTokenEditor(true);
    setTokenToEdit(token);
    setTokenToEditPosition(cp);
  }, [setShowTokenEditor, setTokenToEdit, setTokenToEditPosition]);

  const editNoteFromMenu = useCallback(() => {
    let cp = getClientPosition(contextMenuX, contextMenuY);
    if (cp !== undefined) {
      editNote(cp, stateMachine?.getNote(cp));
    }
  }, [contextMenuX, contextMenuY, editNote, getClientPosition, stateMachine]);

  const editTokenFromMenu = useCallback(() => {
    let cp = getClientPosition(contextMenuX, contextMenuY);
    if (cp !== undefined) {
      editToken(cp, stateMachine?.getToken(cp));
    }
  }, [contextMenuX, contextMenuY, editToken, getClientPosition, stateMachine]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    let bounds = drawingRef.current?.getBoundingClientRect();
    if (bounds === undefined) {
      return;
    }

    e.preventDefault();
    setShowContextMenu(true);
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);
    setContextMenuPageRight(bounds.right);
    setContextMenuPageBottom(bounds.bottom);

    let cp = getClientPosition(e.clientX, e.clientY);
    if (cp !== undefined) {
      setContextMenuToken(stateMachine?.getToken(cp));
      setContextMenuNote(stateMachine?.getNote(cp));
    }
  }, [getClientPosition, setShowContextMenu, setContextMenuX, setContextMenuY, setContextMenuPageBottom, setContextMenuToken, setContextMenuNote, stateMachine]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (stateMachine === undefined || anEditorIsOpen || mouseDown) {
      return;
    }

    // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
    // for a reference of key values.
    setKeysDown({ key: e.key, down: true });
    if (e.key === 'ArrowLeft') {
      if (e.repeat || !stateMachine.jogSelection({ x: -1, y: 0 })) {
        addChanges(stateMachine.setPanningX(-1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      if (e.repeat || !stateMachine.jogSelection({ x: 1, y: 0 })) {
        addChanges(stateMachine.setPanningX(1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (e.repeat || !stateMachine.jogSelection({ x: 0, y: 1 })) {
        addChanges(stateMachine.setPanningY(1));
      }
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      if (e.repeat || !stateMachine.jogSelection({ x: 0, y: -1 })) {
        addChanges(stateMachine.setPanningY(-1));
      }
      e.preventDefault();
    }
  }, [stateMachine, addChanges, anEditorIsOpen, mouseDown, setKeysDown]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (stateMachine === undefined || anEditorIsOpen) {
      return;
    }

    setKeysDown({ key: e.key, down: false });
    if (e.key === 'Escape') {
      // This should cancel any drag operation, and also return us to
      // select mode.  Unlike the other keys, it should operate even
      // during a mouse drag.
      stateMachine.clearHighlights(selectedColour);
      stateMachine.clearSelection();
      setEditMode(EditMode.Select);
      setShowContextMenu(false);
    }

    if (mouseDown) {
      return;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      addChanges(stateMachine.setPanningX(0));
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      addChanges(stateMachine.setPanningY(0));
      e.preventDefault();
    } else if (e.key === 'Delete') {
      // This invokes the token deletion if we've got tokens selected.
      let tokens = [...stateMachine.getSelectedTokens()];
      if (canDoAnything && tokens.length > 0) {
        setShowTokenDeletion(true);
        setTokensToDelete(tokens);
      }
    } else if (e.key === 'a' || e.key === 'A') {
      if (canDoAnything) {
        setEditMode(EditMode.Area);
      }
    } else if (e.key === 'o' || e.key === 'O') {
      stateMachine.resetView();
    } else if (e.key === 'r' || e.key === 'R') {
      if (canDoAnything) {
        setEditMode(EditMode.Room);
      }
    } else if (e.key === 's' || e.key === 'S') {
      setEditMode(EditMode.Select);
    } else if (e.key === 'w' || e.key === 'W') {
      if (canDoAnything) {
        setEditMode(EditMode.Wall);
      }
    }
  }, [stateMachine, addChanges, anEditorIsOpen, canDoAnything, mouseDown, selectedColour, setEditMode, setKeysDown, setShowContextMenu]);

  // *** Handler helpers to cover the common functionality between mouse and touch ***

  const handleInteractionEnd = useCallback((cp: THREE.Vector3, shiftKey: boolean) => {
    let changes: IChange[] | undefined;
    if (isDraggingView) {
      stateMachine?.panEnd();
      setIsDraggingView(false);
    } else {
      switch (editMode) {
        case EditMode.Select:
          changes = stateMachine?.selectionDragEnd(cp);
          break;

        case EditMode.Token:
          editToken(cp, stateMachine?.getToken(cp));
          break;

        case EditMode.Notes:
          editNote(cp, stateMachine?.getNote(cp));
          break;

        case EditMode.Area:
          changes = stateMachine?.faceDragEnd(cp, selectedColour);
          break;

        case EditMode.Wall:
          changes = stateMachine?.wallDragEnd(cp, selectedColour);
          break;

        case EditMode.Room:
          changes = stateMachine?.roomDragEnd(cp, shiftKey, selectedColour);
          break;
      }
    }

    if (changes !== undefined && changes.length > 0) {
      // We've done something -- reset the edit mode
      setEditMode(EditMode.Select);
    }
    addChanges(changes);
  }, [addChanges, editMode, editNote, editToken, isDraggingView, setEditMode, setIsDraggingView, selectedColour, stateMachine]);

  const handleInteractionMove = useCallback((cp: THREE.Vector3, shiftKey: boolean) => {
    if (isDraggingView) {
      stateMachine?.panTo(cp);
    } else {
      switch (editMode) {
        case EditMode.Select: stateMachine?.moveSelectionTo(cp); break;
        case EditMode.Area: stateMachine?.moveFaceHighlightTo(cp, selectedColour); break;
        case EditMode.Wall: stateMachine?.moveWallHighlightTo(cp, shiftKey, selectedColour); break;
        case EditMode.Room: stateMachine?.moveRoomHighlightTo(cp, shiftKey, selectedColour); break;
      }
    }

    return cp;
  }, [editMode, isDraggingView, selectedColour, stateMachine]);

  const handleInteractionStart = useCallback((cp: THREE.Vector3, shiftKey: boolean, ctrlKey: boolean) => {
    switch (editMode) {
      case EditMode.Select:
        if (shiftKey) {
          stateMachine?.selectionDragStart(cp);
        } else if (stateMachine?.selectToken(cp) !== true) {
          // There's no token here -- pan or rotate the view instead.
          setIsDraggingView(true);
          stateMachine?.clearSelection();
          stateMachine?.panStart(cp, ctrlKey);
        }
        break;

      case EditMode.Area: stateMachine?.faceDragStart(cp, shiftKey, selectedColour); break;
      case EditMode.Wall: stateMachine?.wallDragStart(cp, shiftKey, selectedColour); break;
      case EditMode.Room: stateMachine?.roomDragStart(cp, shiftKey, selectedColour); break;
    }
  }, [editMode, setIsDraggingView, selectedColour, stateMachine]);

  // *** Mouse and touch specific handlers ***

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setShowContextMenu(false);
    let cp = getClientPosition(e.clientX, e.clientY);
    if (cp === undefined || anEditorIsOpen || e.button !== 0 || movementKeyDown) {
      return;
    }

    setMouseDown(true);
    handleInteractionStart(cp, e.shiftKey, e.ctrlKey);
  }, [anEditorIsOpen, getClientPosition, handleInteractionStart, movementKeyDown, setMouseDown, setShowContextMenu]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    let cp = getClientPosition(e.clientX, e.clientY);
    if (cp === undefined || anEditorIsOpen || movementKeyDown) {
      return undefined;
    }

    return handleInteractionMove(cp, e.shiftKey);
  }, [anEditorIsOpen, getClientPosition, handleInteractionMove, movementKeyDown]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    let cp = handleMouseMove(e);
    if (cp === undefined || anEditorIsOpen || e.button !== 0 || movementKeyDown) {
      return;
    }

    setMouseDown(false);
    handleInteractionEnd(cp, e.shiftKey);
  }, [anEditorIsOpen, handleInteractionEnd, handleMouseMove, movementKeyDown, setMouseDown]);

  const isTrackingTouch = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; ++i) {
      if (e.changedTouches[i].identifier === touch) {
        return e.changedTouches[i];
      }
    }

    return undefined;
  }, [touch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // This only takes effect if the touch we're tracking has changed
    let t = isTrackingTouch(e);
    if (t === undefined) {
      return undefined;
    }

    let cp = getClientPosition(t.clientX, t.clientY);
    if (cp === undefined || anEditorIsOpen || movementKeyDown) {
      return undefined;
    }

    cp = handleInteractionMove(cp, false);
    return { touch: t, cp: cp };
  }, [anEditorIsOpen, getClientPosition, handleInteractionMove, isTrackingTouch, movementKeyDown]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    let x = handleTouchMove(e);
    if (x === undefined || anEditorIsOpen || movementKeyDown) {
      return;
    }

    setTouch(undefined);
    handleInteractionEnd(x.cp, false);
  }, [anEditorIsOpen, handleInteractionEnd, handleTouchMove, movementKeyDown, setTouch]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (touch !== undefined || e.changedTouches.length === 0) {
      return;
    }

    let t = e.changedTouches[0];
    setShowContextMenu(false);
    let cp = getClientPosition(t.clientX, t.clientY);
    if (cp === undefined || anEditorIsOpen || movementKeyDown) {
      return;
    }

    setTouch(t.identifier);
    handleInteractionStart(cp, false, false);
  }, [anEditorIsOpen, getClientPosition, handleInteractionStart, movementKeyDown, setTouch, touch]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.deltaY !== 0 && !anEditorIsOpen) {
      stateMachine?.zoomBy(e.deltaY);
    }
  }, [stateMachine, anEditorIsOpen]);

  const handleWindowResize = useCallback((ev: UIEvent) => { stateMachine?.resize(); }, [stateMachine]);

  // We need an event listener for the window resize so that we can update the drawing,
  // and for the keyboard and wheel events so that we can implement UI functionality with them.
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [handleKeyDown, handleKeyUp, handleWheel, handleWindowResize]);

  // We take over the context menu for map owners only to provide interaction.
  useEffect(() => {
    if (canDoAnything) {
      document.addEventListener('contextmenu', handleContextMenu);
      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
      };
    } else {
      return undefined;
    }
  }, [canDoAnything, handleContextMenu]);

  const [showAnnotationFlags, setShowAnnotationFlags] = useState(ShowAnnotationFlags.All);
  const [customAnnotationFlags, setCustomAnnotationFlags] = useState(false);

  const cycleShowAnnotationFlags = useCallback((flags: ShowAnnotationFlags) => {
    // Doing this causes the map annotations to notice if they should override
    // any customisations
    setCustomAnnotationFlags(false);
    setShowAnnotationFlags(flags);
  }, [setCustomAnnotationFlags, setShowAnnotationFlags]);

  return (
    <div className="Map-container">
      <div className="Map-nav">
        <Navigation>{title}</Navigation>
      </div>
      <div className="Map-overlay">
        <MapControls
          editMode={editMode}
          setEditMode={setEditMode}
          selectedColour={selectedColour}
          setSelectedColour={setSelectedColour}
          resetView={() => stateMachine?.resetView()}
          mapColourVisualisationMode={mapColourMode}
          setMapColourVisualisationMode={setMapColourMode}
          canDoAnything={canDoAnything}
          isOwner={isOwner}
          openMapEditor={() => setShowMapEditor(true)}
          setShowAnnotationFlags={cycleShowAnnotationFlags} />
        <MapInfo map={map?.record} players={players} tokens={mapState.tokens}
          canDoAnything={canDoAnything} resetView={c => stateMachine?.resetView(c)}
          resyncCount={resyncCount} />
      </div>
      <div className="Map-content">
        <div id="drawingDiv" ref={drawingRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchCancel={handleTouchEnd}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart} />
      </div>
      <MapEditorModal show={showMapEditor} map={map}
        handleClose={() => setShowMapEditor(false)} handleSave={handleMapEditorSave} />
      <TokenEditorModal selectedColour={selectedColour} show={showTokenEditor}
        token={tokenToEdit}
        players={players} handleClose={handleModalClose}
        handleDelete={handleTokenEditorDelete} handleSave={handleTokenEditorSave} />
      <TokenDeletionModal show={showTokenDeletion} tokens={tokensToDelete}
        handleClose={handleModalClose} handleDelete={handleTokenDeletion} />
      <NoteEditorModal show={showNoteEditor} note={noteToEdit} handleClose={handleModalClose}
        handleDelete={handleNoteEditorDelete} handleSave={handleNoteEditorSave} />
      <MapAnnotations annotations={mapState.annotations} showFlags={showAnnotationFlags} customFlags={customAnnotationFlags}
        setCustomFlags={setCustomAnnotationFlags} suppressAnnotations={isDraggingView} />
      <MapContextMenu
        show={showContextMenu}
        setShow={setShowContextMenu}
        x={contextMenuX}
        y={contextMenuY}
        pageRight={contextMenuPageRight}
        pageBottom={contextMenuPageBottom}
        token={contextMenuToken}
        note={contextMenuNote}
        editToken={editTokenFromMenu}
        editNote={editNoteFromMenu}
        editMode={editMode}
        setEditMode={setEditMode} />
    </div>
  );
}

interface IMapPageProps {
  adventureId: string;
  mapId: string;
}

function MapPage(props: RouteComponentProps<IMapPageProps>) {
  return (
    <RequireLoggedIn>
      <Map adventureId={props.match.params.adventureId} mapId={props.match.params.mapId} />
    </RequireLoggedIn>
  );
}

export default MapPage;