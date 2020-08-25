import React, { useEffect, useRef, useState, useContext, useMemo, useCallback } from 'react';
import './App.css';
import './Map.css';

import { addToast } from './components/extensions';
import { FirebaseContext } from './components/FirebaseContextProvider';
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
import { registerMapAsRecent, consolidateMapChanges } from './services/extensions';

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

  useEffect(() => {
    if (canSeeAnything === false) {
      return addToast(statusContext, {
        title: "No tokens available",
        message: "The map owner has not assigned you any tokens, so you will not see any of the map yet.  If you remain on this page until they do, it will update."
      });
    }
  }, [statusContext, canSeeAnything]);

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
  function addChanges(changes: IChange[] | undefined) {
    if (changes === undefined || changes.length === 0 || userContext.dataService === undefined) {
      return;
    }

    userContext.dataService.addChanges(props.adventureId, props.mapId, changes)
      .then(() => console.log("Added " + changes.length + " changes"))
      .catch(e => console.error("Error adding " + changes.length + " changes", e));
  }

  // == UI STUFF ==

  const [isOwner, setIsOwner] = useState(false);
  const [editMode, setEditMode] = useState(EditMode.Select);
  const [mapColourMode, setMapColourMode] = useState(MapColourVisualisationMode.Areas);
  const [selectedColour, setSelectedColour] = useState(0);

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
    stateMachine?.clearHighlights();
    if (editMode !== EditMode.Select) {
      stateMachine?.clearSelection();
    }
  }, [stateMachine, editMode]);

  // Sync the drawing with the map colour mode
  useEffect(() => {
    stateMachine?.setShowMapColourVisualisation(mapColourMode === MapColourVisualisationMode.Connectivity);
  }, [stateMachine, mapColourMode]);

  function handleMapEditorSave(ffa: boolean) {
    setShowMapEditor(false);
    if (userContext.dataService !== undefined && map !== undefined) {
      var dataService = userContext.dataService;
      var mapRef = dataService.getMapRef(map.adventureId, map.id);

      // We should always do a consolidate here to avoid accidentally invalidating
      // any recent changes when switching from FFA to non-FFA mode, for example.
      // TODO I should make this update to the map record inside the consolidate transaction,
      // shouldn't I?
      consolidateMapChanges(dataService, firebaseContext.timestampProvider, map.adventureId, map.id, map.record)
        .then(() => dataService.update(mapRef, { ffa: ffa }))
        .then(() => console.log("Set FFA to " + ffa))
        .catch(e => console.error("Failed to set FFA:", e));
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

  function getClientPosition(e: React.MouseEvent<HTMLDivElement, MouseEvent>): THREE.Vector3 | undefined {
    var bounds = drawingRef.current?.getBoundingClientRect();
    if (bounds === undefined) {
      return undefined;
    }

    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;
    return new THREE.Vector3(x, bounds.height - y - 1, 0);
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (stateMachine === undefined) {
      return;
    }

    // See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
    // for a reference of key values.
    if (e.key === 'ArrowLeft') {
      stateMachine.panningX = -1;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      stateMachine.panningX = 1;
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      stateMachine.panningY = 1;
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      stateMachine.panningY = -1;
      e.preventDefault();
    }
  }, [stateMachine]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (stateMachine === undefined) {
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      stateMachine.panningX = 0;
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      stateMachine.panningY = 0;
      e.preventDefault();
    } else if (e.key === 'Escape') {
      // This should cancel any drag operation
      stateMachine.clearHighlights();
      stateMachine.clearSelection();
    } else if (e.key === 'a' || e.key === 'A') {
      if (canDoAnything) {
        setEditMode(EditMode.Area);
      }
    } else if (e.key === 'n' || e.key === 'N') {
      if (canDoAnything) {
        setEditMode(EditMode.Notes);
      }
    } else if (e.key === 'p' || e.key === 'P') {
      setEditMode(EditMode.Pan);
    } else if (e.key === 'r' || e.key === 'R') {
      stateMachine.resetView();
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
  }, [stateMachine, canDoAnything]);

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    var cp = getClientPosition(e);
    if (cp === undefined) {
      return;
    }

    setIsDraggingView(editMode === EditMode.Pan);
    switch (editMode) {
      case EditMode.Select: stateMachine?.selectionDragStart(cp, e.shiftKey); break;
      case EditMode.Area: stateMachine?.faceDragStart(cp, e.shiftKey); break;
      case EditMode.Wall: stateMachine?.wallDragStart(cp, e.shiftKey); break;
      case EditMode.Pan: stateMachine?.panStart(cp, e.shiftKey); break;
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    var cp = getClientPosition(e);
    if (cp === undefined) {
      return;
    }

    switch (editMode) {
      case EditMode.Select: stateMachine?.moveSelectionTo(cp); break;
      case EditMode.Area: stateMachine?.moveFaceHighlightTo(cp); break;
      case EditMode.Wall: stateMachine?.moveWallHighlightTo(cp, e.shiftKey); break;
      case EditMode.Pan: stateMachine?.panTo(cp); break;
    }

    return cp;
  }

  function handleMouseUp(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    setIsDraggingView(false);
    var cp = handleMouseMove(e);
    if (cp === undefined) {
      return;
    }

    switch (editMode) {
      case EditMode.Select:
        addChanges(stateMachine?.selectionDragEnd(cp));
        break;

      case EditMode.Token:
        // Show the token dialog now.  We'll create or alter the token upon close of
        // the dialog.
        var token = stateMachine?.getToken(cp);
        setShowTokenEditor(true);
        setTokenToEdit(token);
        setTokenToEditPosition(cp);
        break;

      case EditMode.Notes:
        // Show the notes dialog now.  Again, we'll create or alter the note upon
        // close of the dialog.
        var note = stateMachine?.getNote(cp);
        setShowNoteEditor(true);
        setNoteToEdit(note);
        setNoteToEditPosition(cp);
        break;

      case EditMode.Area:
        addChanges(stateMachine?.faceDragEnd(cp, selectedColour));
        break;

      case EditMode.Wall:
        addChanges(stateMachine?.wallDragEnd(cp, selectedColour));
        break;

      case EditMode.Pan: stateMachine?.panEnd(); break;
    }
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    console.log("Handling wheel.  dX=" + e.deltaX + ", dY=" + e.deltaY + ", dZ=" + e.deltaZ);
    if (e.deltaY !== 0) {
      stateMachine?.zoomBy(e.deltaY);
      e.preventDefault();
    }
  }, [stateMachine]);

  // We need an event listener for the window resize so that we can update the drawing,
  // and for the keyboard and wheel events so that we can implement UI functionality with them.
  useEffect(() => {
    const handleWindowResize = (ev: UIEvent) => { stateMachine?.resize(); };
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
  }, [stateMachine, handleKeyDown, handleKeyUp, handleWheel]);

  const [showAnnotationFlags, setShowAnnotationFlags] = useState(ShowAnnotationFlags.All);
  const [customAnnotationFlags, setCustomAnnotationFlags] = useState(false);

  function cycleShowAnnotationFlags(flags: ShowAnnotationFlags) {
    // Doing this causes the map annotations to notice if they should override
    // any customisations
    setCustomAnnotationFlags(false);
    setShowAnnotationFlags(flags);
  }

  // We need to suppress the map annotations under a few circumstances:
  // - while the view is being dragged around, to maintain performance
  // - while a modal is visible, so that the overlays don't appear on top
  const suppressAnnotations = useMemo(
    () => isDraggingView || showMapEditor || showTokenEditor,
    [isDraggingView, showMapEditor, showTokenEditor]
  );

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
        <MapInfo map={map?.record} players={players} tokens={mapState.tokens} />
      </div>
      <div className="Map-content">
        <div id="drawingDiv" ref={drawingRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} />
      </div>
      <MapEditorModal show={showMapEditor} map={map?.record}
        handleClose={() => setShowMapEditor(false)} handleSave={handleMapEditorSave} />
      <TokenEditorModal selectedColour={selectedColour} show={showTokenEditor}
        token={tokenToEdit}
        players={players} handleClose={() => setShowTokenEditor(false)}
        handleDelete={handleTokenEditorDelete} handleSave={handleTokenEditorSave} />
      <NoteEditorModal show={showNoteEditor} note={noteToEdit} handleClose={() => setShowNoteEditor(false)}
        handleDelete={handleNoteEditorDelete} handleSave={handleNoteEditorSave} />
      <MapAnnotations annotations={mapState.annotations} showFlags={showAnnotationFlags} customFlags={customAnnotationFlags}
        setCustomFlags={setCustomAnnotationFlags} suppressAnnotations={suppressAnnotations} />
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