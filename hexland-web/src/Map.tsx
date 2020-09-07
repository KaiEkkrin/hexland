import React, { useEffect, useRef, useState, useContext, useMemo, useCallback } from 'react';
import './App.css';
import './Map.css';

import { addToast } from './components/extensions';
import { FirebaseContext } from './components/FirebaseContextProvider';
import MapContextMenu from './components/MapContextMenu';
import MapControls, { EditMode, MapColourVisualisationMode } from './components/MapControls';
import MapAnnotations, { ShowAnnotationFlags } from './components/MapAnnotations';
import MapEditorModal from './components/MapEditorModal';
import MapInfo from './components/MapInfo';
import Navigation from './components/Navigation';
import NoteEditorModal from './components/NoteEditorModal';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { StatusContext } from './components/StatusContextProvider';
import TokenEditorModal from './components/TokenEditorModal';
import { UserContext } from './components/UserContextProvider';

import { IPlayer } from './data/adventure';
import { IAnnotation } from './data/annotation';
import { IChange } from './data/change';
import { trackChanges } from './data/changeTracking';
import { IToken, ITokenProperties } from './data/feature';
import { IAdventureIdentified } from './data/identified';
import { IMap } from './data/map';
import { registerMapAsRecent, consolidateMapChanges, editMap } from './services/extensions';

import { standardColours } from './models/featureColour';
import { MapStateMachine, createDefaultState } from './models/mapStateMachine';

import { RouteComponentProps } from 'react-router-dom';

import * as THREE from 'three';
import fluent from 'fluent-iterable';

function Map(props: IMapPageProps) {
  const firebaseContext = useContext(FirebaseContext);
  const userContext = useContext(UserContext);
  const statusContext = useContext(StatusContext);

  const drawingRef = useRef<HTMLDivElement>(null);

  const [map, setMap] = useState(undefined as IAdventureIdentified<IMap> | undefined);
  const [players, setPlayers] = useState([] as IPlayer[]);
  const [stateMachine, setStateMachine] = useState(undefined as MapStateMachine | undefined);
  const [canDoAnything, setCanDoAnything] = useState(false);
  const [mapState, setMapState] = useState(createDefaultState());

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

    // TODO remove debug after confirming we don't multiple-watch things
    console.log("Watching adventure " + props.adventureId + ", map " + props.mapId);
    var mapRef = userContext.dataService.getMapRef(props.adventureId, props.mapId);
    return userContext.dataService.watch<IMap>(
      mapRef, m => setMap(m === undefined ? undefined : {
        adventureId: props.adventureId,
        id: props.mapId,
        record: m
      }),
      e => console.error("Error watching map " + props.mapId, e)
    );
  }, [userContext.dataService, props.adventureId, props.mapId]);

  // Track changes to the map
  useEffect(() => {
    if (
      userContext.dataService === undefined || map === undefined ||
      drawingRef?.current === null
    ) {
      setStateMachine(undefined);
      return;
    }

    registerMapAsRecent(userContext.dataService, map.adventureId, map.id, map.record)
      .catch(e => console.error("Error registering map as recent", e));
    consolidateMapChanges(userContext.dataService, firebaseContext.timestampProvider, map.adventureId, map.id, map.record)
      .catch(e => console.error("Error consolidating map changes", e));

    var sm = new MapStateMachine(
      map.record, userContext.dataService.getUid(), standardColours, drawingRef.current, setMapState
    );
    setStateMachine(sm);

    console.log("Watching changes to map " + map.id);
    var stopWatchingChanges = userContext.dataService.watchChanges(map.adventureId, map.id,
      chs => trackChanges(map.record, sm.changeTracker, chs.chs, chs.user),
      e => console.error("Error watching map changes", e));
    
    return () => {
      stopWatchingChanges();
      sm.dispose();
    };
  }, [userContext.dataService, firebaseContext.timestampProvider, map]);

  // If we can't see anything, notify the user
  const canSeeAnything = useMemo(() => {
    return mapState.seeEverything || fluent(mapState.tokens).any(t => t.selectable);
  }, [mapState]);

  // This helps us focus somewhere useful when the map becomes visible
  useEffect(() => {
    if (canSeeAnything === false) {
      var removeToast = addToast(statusContext, {
        title: "No tokens available",
        message: "The map owner has not assigned you any tokens, so you will not see any of the map yet.  If you remain on this page until they do, it will update."
      });
      return () => {
        // When this stops being true, as well as removing the toast, we want to
        // focus somewhere suitable:
        removeToast();
        stateMachine?.resetView();
      };
    }
  }, [statusContext, canSeeAnything, stateMachine]);

  // Track the adventure's players
  useEffect(() => {
    if (userContext.dataService === undefined) {
      return () => {};
    }

    console.log("Watching players in adventure " + props.adventureId);
    return userContext.dataService.watchPlayers(props.adventureId, setPlayers,
      e => console.error("Error watching players", e));
  }, [userContext.dataService, props.adventureId, canDoAnything]);

  // How to create and share the map changes we make
  const addChanges = useCallback((changes: IChange[] | undefined) => {
    if (changes === undefined || changes.length === 0 || userContext.dataService === undefined) {
      return;
    }

    userContext.dataService.addChanges(props.adventureId, props.mapId, changes)
      .then(() => console.log("Added " + changes.length + " changes"))
      .catch(e => console.error("Error adding " + changes.length + " changes", e));
  }, [userContext.dataService, props.adventureId, props.mapId]);

  // == UI STUFF ==

  const [isOwner, setIsOwner] = useState(false);
  const [editMode, setEditMode] = useState(EditMode.Select);
  const [mapColourMode, setMapColourMode] = useState(MapColourVisualisationMode.Areas);
  const [selectedColour, setSelectedColour] = useState(0);

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuX, setContextMenuX] = useState(0);
  const [contextMenuY, setContextMenuY] = useState(0);
  const [contextMenuToken, setContextMenuToken] = useState<IToken | undefined>(undefined);
  const [contextMenuNote, setContextMenuNote] = useState<IAnnotation | undefined>(undefined);

  const [showMapEditor, setShowMapEditor] = useState(false);
  const [showTokenEditor, setShowTokenEditor] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);

  const [tokenToEdit, setTokenToEdit] = useState(undefined as IToken | undefined);
  const [tokenToEditPosition, setTokenToEditPosition] = useState(undefined as THREE.Vector3 | undefined);
  const [noteToEdit, setNoteToEdit] = useState(undefined as IAnnotation | undefined);
  const [noteToEditPosition, setNoteToEditPosition] = useState(undefined as THREE.Vector3 | undefined);

  const [isDraggingView, setIsDraggingView] = useState(false);

  useEffect(() => {
    setCanDoAnything(map?.record.ffa === true || userContext.dataService?.getUid() === map?.record.owner);
  }, [userContext.dataService, map]);

  useEffect(() => {
    setIsOwner(userContext.dataService?.getUid() === map?.record.owner);
  }, [userContext.dataService, map]);

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

  function handleMapEditorSave(adventureId: string, updated: IMap) {
    setShowMapEditor(false);
    if (userContext.dataService !== undefined && map !== undefined) {
      var dataService = userContext.dataService;

      // We should always do a consolidate here to avoid accidentally invalidating
      // any recent changes when switching from FFA to non-FFA mode, for example.
      // TODO I should make this update to the map record inside the consolidate transaction,
      // shouldn't I?  (Except, if I turn the consolidate into a Firebase function,
      // that's not going to fly...  Maybe it's fine.)
      consolidateMapChanges(dataService, firebaseContext.timestampProvider, map.adventureId, map.id, map.record)
        .then(() => editMap(dataService, map.adventureId, map.id, updated))
        .then(() => console.log("Updated map"))
        .catch(e => console.error("Failed to update map:", e));
    }
  }

  function handleTokenEditorDelete() {
    if (tokenToEditPosition !== undefined) {
      addChanges(stateMachine?.setToken(tokenToEditPosition, undefined));
    }
    setShowTokenEditor(false);
  }

  function handleTokenEditorSave(properties: ITokenProperties) {
    if (tokenToEditPosition !== undefined) {
      addChanges(stateMachine?.setToken(tokenToEditPosition, properties));
    }
    setShowTokenEditor(false);
  }

  function handleNoteEditorDelete() {
    if (noteToEditPosition !== undefined) {
      addChanges(stateMachine?.setNote(noteToEditPosition, "", -1, "", false));
    }
    setShowNoteEditor(false);
  }

  function handleNoteEditorSave(id: string, colour: number, text: string, visibleToPlayers: boolean) {
    if (noteToEditPosition !== undefined) {
      addChanges(stateMachine?.setNote(noteToEditPosition, id, colour, text, visibleToPlayers));
    }
    setShowNoteEditor(false);
  }

  // We want to disable most of the handlers, below, if a modal editor is open, to prevent
  // accidents whilst editing
  const anEditorIsOpen = useMemo(
    () => showMapEditor || showNoteEditor || showTokenEditor,
    [showMapEditor, showNoteEditor, showTokenEditor]
  );

  const getClientPosition = useCallback((clientX: number, clientY: number) => {
    var bounds = drawingRef.current?.getBoundingClientRect();
    if (bounds === undefined) {
      return undefined;
    }

    var x = clientX - bounds.left;
    var y = clientY - bounds.top;
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
    var cp = getClientPosition(contextMenuX, contextMenuY);
    if (cp !== undefined) {
      editNote(cp, stateMachine?.getNote(cp));
    }
  }, [contextMenuX, contextMenuY, editNote, getClientPosition, stateMachine]);

  const editTokenFromMenu = useCallback(() => {
    var cp = getClientPosition(contextMenuX, contextMenuY);
    if (cp !== undefined) {
      editToken(cp, stateMachine?.getToken(cp));
    }
  }, [contextMenuX, contextMenuY, editToken, getClientPosition, stateMachine]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);

    var cp = getClientPosition(e.clientX, e.clientY);
    if (cp !== undefined) {
      setContextMenuToken(stateMachine?.getToken(cp));
      setContextMenuNote(stateMachine?.getNote(cp));
    }
  }, [getClientPosition, setShowContextMenu, setContextMenuX, setContextMenuY, setContextMenuToken, setContextMenuNote, stateMachine]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (stateMachine === undefined || anEditorIsOpen) {
      return;
    }

    // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
    // for a reference of key values.
    if (e.key === 'ArrowLeft') {
      addChanges(stateMachine.setPanningX(-1));
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      addChanges(stateMachine.setPanningX(1));
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      addChanges(stateMachine.setPanningY(1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      addChanges(stateMachine.setPanningY(-1));
      e.preventDefault();
    }
  }, [stateMachine, addChanges, anEditorIsOpen]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (stateMachine === undefined || anEditorIsOpen) {
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      addChanges(stateMachine.setPanningX(0));
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      addChanges(stateMachine.setPanningY(0));
      e.preventDefault();
    } else if (e.key === 'Escape') {
      // This should cancel any drag operation, and also return us to
      // select mode
      stateMachine.clearHighlights(selectedColour);
      stateMachine.clearSelection();
      setEditMode(EditMode.Select);
    } else if (e.key === 'a' || e.key === 'A') {
      if (canDoAnything) {
        setEditMode(EditMode.Area);
      }
    } else if (e.key === 'n' || e.key === 'N') {
      if (canDoAnything) {
        setEditMode(EditMode.Notes);
      }
    } else if (e.key === 'o' || e.key === 'O') {
      stateMachine.resetView();
    } else if (e.key === 'p' || e.key === 'P') {
      setEditMode(EditMode.Pan);
    } else if (e.key === 'r' || e.key === 'R') {
      if (canDoAnything) {
        setEditMode(EditMode.Room);
      }
    } else if (e.key === 's' || e.key === 'S') {
      setEditMode(EditMode.Select);
    } else if (e.key === 't' || e.key === 'T') {
      if (canDoAnything) {
        setEditMode(EditMode.Token);
      }
    } else if (e.key === 'w' || e.key === 'W') {
      if (canDoAnything) {
        setEditMode(EditMode.Wall);
      }
    }
  }, [stateMachine, addChanges, anEditorIsOpen, canDoAnything, selectedColour, setEditMode]);

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    setShowContextMenu(false);
    var cp = getClientPosition(e.clientX, e.clientY);
    if (cp === undefined || anEditorIsOpen) {
      return;
    }

    setIsDraggingView(editMode === EditMode.Pan);
    switch (editMode) {
      case EditMode.Select: stateMachine?.selectionDragStart(cp, e.shiftKey); break;
      case EditMode.Area: stateMachine?.faceDragStart(cp, e.shiftKey, selectedColour); break;
      case EditMode.Wall: stateMachine?.wallDragStart(cp, e.shiftKey, selectedColour); break;
      case EditMode.Room: stateMachine?.roomDragStart(cp, e.shiftKey, selectedColour); break;
      case EditMode.Pan: stateMachine?.panStart(cp, e.shiftKey); break;
    }
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    var cp = getClientPosition(e.clientX, e.clientY);
    if (cp === undefined || anEditorIsOpen) {
      return undefined;
    }

    switch (editMode) {
      case EditMode.Select: stateMachine?.moveSelectionTo(cp); break;
      case EditMode.Area: stateMachine?.moveFaceHighlightTo(cp, selectedColour); break;
      case EditMode.Wall: stateMachine?.moveWallHighlightTo(cp, e.shiftKey, selectedColour); break;
      case EditMode.Room: stateMachine?.moveRoomHighlightTo(cp, e.shiftKey, selectedColour); break;
      case EditMode.Pan: stateMachine?.panTo(cp); break;
    }

    return cp;
  }, [anEditorIsOpen, editMode, getClientPosition, selectedColour, stateMachine]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setIsDraggingView(false);
    var cp = handleMouseMove(e);
    if (cp === undefined || anEditorIsOpen) {
      return;
    }

    var changes: IChange[] | undefined;
    switch (editMode) {
      case EditMode.Select:
        changes = stateMachine?.selectionDragEnd(cp);
        break;

      case EditMode.Token:
        // Show the token dialog now.  We'll create or alter the token upon close of
        // the dialog.
        var token = stateMachine?.getToken(cp);
        editToken(cp, token);
        break;

      case EditMode.Notes:
        // Show the notes dialog now.  Again, we'll create or alter the note upon
        // close of the dialog.
        var note = stateMachine?.getNote(cp);
        editNote(cp, note);
        break;

      case EditMode.Area:
        changes = stateMachine?.faceDragEnd(cp, selectedColour);
        break;

      case EditMode.Wall:
        changes = stateMachine?.wallDragEnd(cp, selectedColour);
        break;

      case EditMode.Room:
        changes = stateMachine?.roomDragEnd(cp, e.shiftKey, selectedColour);
        break;

      case EditMode.Pan: stateMachine?.panEnd(); break;
    }

    if (changes !== undefined && changes.length > 0) {
      // We've done something -- reset the edit mode
      setEditMode(EditMode.Select);
    }
    addChanges(changes);
  }, [addChanges, anEditorIsOpen, editMode, editNote, editToken, handleMouseMove, selectedColour, setEditMode, setIsDraggingView, stateMachine]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.deltaY !== 0 && !anEditorIsOpen) {
      stateMachine?.zoomBy(e.deltaY);
    }
  }, [stateMachine, anEditorIsOpen]);

  // We need an event listener for the window resize so that we can update the drawing,
  // and for the keyboard and wheel events so that we can implement UI functionality with them.
  // We also take over the context menu.
  useEffect(() => {
    const handleWindowResize = (ev: UIEvent) => { stateMachine?.resize(); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('wheel', handleWheel);
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('wheel', handleWheel);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [stateMachine, handleContextMenu, handleKeyDown, handleKeyUp, handleWheel]);

  const [showAnnotationFlags, setShowAnnotationFlags] = useState(ShowAnnotationFlags.All);
  const [customAnnotationFlags, setCustomAnnotationFlags] = useState(false);

  function cycleShowAnnotationFlags(flags: ShowAnnotationFlags) {
    // Doing this causes the map annotations to notice if they should override
    // any customisations
    setCustomAnnotationFlags(false);
    setShowAnnotationFlags(flags);
  }

  return (
    <div className="Map-container">
      <div className="Map-nav">
        <Navigation title={map?.record.name} />
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
          resetView={c => stateMachine?.resetView(c)} />
      </div>
      <div className="Map-content">
        <div id="drawingDiv" ref={drawingRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} />
      </div>
      <MapEditorModal show={showMapEditor} map={map}
        handleClose={() => setShowMapEditor(false)} handleSave={handleMapEditorSave} />
      <TokenEditorModal selectedColour={selectedColour} show={showTokenEditor}
        token={tokenToEdit}
        players={players} handleClose={() => setShowTokenEditor(false)}
        handleDelete={handleTokenEditorDelete} handleSave={handleTokenEditorSave} />
      <NoteEditorModal show={showNoteEditor} note={noteToEdit} handleClose={() => setShowNoteEditor(false)}
        handleDelete={handleNoteEditorDelete} handleSave={handleNoteEditorSave} />
      <MapAnnotations annotations={mapState.annotations} showFlags={showAnnotationFlags} customFlags={customAnnotationFlags}
        setCustomFlags={setCustomAnnotationFlags} suppressAnnotations={isDraggingView} />
      <MapContextMenu
        show={showContextMenu}
        setShow={setShowContextMenu}
        x={contextMenuX}
        y={contextMenuY}
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