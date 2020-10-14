import React, { useEffect, useRef, useState, useContext, useMemo, useCallback, useReducer } from 'react';
import './App.css';
import './Map.css';

import { addToast } from './components/extensions';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import MapContextMenu from './components/MapContextMenu';
import MapControls, { MapColourVisualisationMode } from './components/MapControls';
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
import { trackChanges } from './data/changeTracking';
import { ITokenProperties } from './data/feature';
import { IAdventureIdentified } from './data/identified';
import { createTokenSizes, IMap, MAP_CONTAINER_CLASS } from './data/map';
import { getUserPolicy } from './data/policy';
import { IProfile } from './data/profile';
import { registerMapAsRecent, watchChangesAndConsolidate, removeMapFromRecent } from './services/extensions';
import { IDataService, IFunctionsService } from './services/interfaces';

import { standardColours } from './models/featureColour';
import { MapStateMachine, createDefaultState, zoomMax, zoomMin } from './models/mapStateMachine';
import { createDefaultUiState, isAnEditorOpen, MapUi } from './models/mapUi';
import { networkStatusTracker } from './models/networkStatusTracker';

import { Link, RouteComponentProps, useHistory } from 'react-router-dom';

import * as THREE from 'three';
import fluent from 'fluent-iterable';
import { v4 as uuidv4 } from 'uuid';

// The map component is rather large because of all the state that got pulled into it...
function Map({ adventureId, mapId }: IMapPageProps) {
  const { dataService, functionsService, user } = useContext(UserContext);
  const { analytics, logError, logEvent } = useContext(AnalyticsContext);
  const profile = useContext(ProfileContext);
  const statusContext = useContext(StatusContext);
  const history = useHistory();

  const drawingRef = useRef<HTMLDivElement>(null);

  const [map, setMap] = useState(undefined as IAdventureIdentified<IMap> | undefined);
  const [players, setPlayers] = useState([] as IPlayer[]);
  const [mapState, setMapState] = useState(createDefaultState());
  const [uiState, setUiState] = useState(createDefaultUiState());

  // We only track a user policy if the user is the map owner
  const userPolicy = useMemo(() => {
    if (map?.record.owner !== user?.uid || profile === undefined) {
      return undefined;
    }

    return getUserPolicy(profile.level);
  }, [map, profile, user]);

  // Create a suitable title
  const title = useMemo(() => {
    if (map === undefined || profile === undefined) {
      return undefined;
    }

    const adventureLink = "/adventure/" + adventureId;
    const objectsString = userPolicy === undefined ? undefined : " (" + mapState.objectCount + "/" + userPolicy.objects + ")";
    return (
      <div style={{ overflowWrap: 'normal' }}>
        <Link to={adventureLink}>{map.record.adventureName}</Link> | {map.record.name}{objectsString}
      </div>
    );
  }, [adventureId, profile, map, mapState, userPolicy]);

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
    if (dataService === undefined) {
      return;
    }

    const mapRef = dataService.getMapRef(adventureId, mapId);

    // How to handle a map load failure.
    function couldNotLoad(message: string) {
      statusContext.toasts.next({
        id: uuidv4(),
        record: { title: 'Error loading map', message: message }
      });

      const uid = user?.uid;
      if (uid && mapRef) {
        removeMapFromRecent(dataService, uid, mapRef.id)
          .catch(e => logError("Error removing map from recent", e));
      }

      history.replace('/');
    }

    // Check this map exists and can be fetched (the watch doesn't do this for us)
    dataService.get(mapRef)
      .then(r => {
        if (r === undefined) {
          couldNotLoad('That map does not exist.');
        }
      })
      .catch(e => {
        logError("Error checking for map " + mapId + ": ", e);
        couldNotLoad(e.message);
      });

    analytics?.logEvent("select_content", {
      "content_type": "map",
      "item_id": mapId
    });

    return dataService.watch<IMap>(
      mapRef, m => setMap(m === undefined ? undefined : {
        adventureId: adventureId,
        id: mapId,
        record: m
      }),
      e => logError("Error watching map " + mapId, e)
    );
  }, [dataService, user, analytics, logError, history, adventureId, mapId, statusContext]);

  // Track changes to the map.
  // We don't start watching until we have an initialised state machine (which means the
  // consolidate is done).
  // The "openMap" utility's dependencies are deliberately limited to prevent it from being
  // re-created and causing lots of extra Firebase work.
  const openMap = useCallback(async (
    logError: (message: string, e: any, fatal?: boolean | undefined) => void,
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
      logError("Error registering map " + map.adventureId + "/" + map.id + " as recent", e);
    }

    try {
      console.log("consolidating map changes");
      functionsService.consolidateMapChanges(map.adventureId, map.id, false);
    } catch (e) {
      logError("Error consolidating map " + map.adventureId + "/" + map.id + " changes", e);
    }

    const userPolicy = uid === map.record.owner ? getUserPolicy(profile.level) : undefined;
    setStateMachine(new MapStateMachine(
      dataService, map, uid, standardColours, mount, userPolicy, setMapState
    ));
  }, [setMapState, setStateMachine]);

  useEffect(() => {
    const uid = user?.uid;
    if (
      dataService === undefined ||
      functionsService === undefined ||
      map === undefined ||
      uid === undefined ||
      profile === undefined ||
      drawingRef?.current === null
    ) {
      setStateMachine(undefined);
      return;
    }

    openMap(logError, dataService, functionsService, uid, profile, map, drawingRef?.current)
      .catch(e => logError("Error opening map", e));
  }, [logError, drawingRef, openMap, map, profile, dataService, functionsService, user]);

  useEffect(() => {
    if (stateMachine === undefined) {
      return undefined;
    }

    console.log("Watching changes to map " + stateMachine.map.id);
    networkStatusTracker.clear();
    return watchChangesAndConsolidate(
      dataService, functionsService,
      stateMachine.map.adventureId, stateMachine.map.id,
      chs => {
        networkStatusTracker.onChanges(chs);
        return trackChanges(stateMachine.map.record, stateMachine.changeTracker, chs.chs, chs.user);
      },
      () => stateMachine.changeTracker.clear(),
      logEvent,
      e => logError("Error watching map changes", e));
  }, [logError, logEvent, stateMachine, dataService, functionsService]);

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
    if (dataService === undefined) {
      return () => {};
    }

    console.log("Watching players in adventure " + adventureId);
    return dataService.watchPlayers(adventureId, setPlayers,
      e => logError("Error watching players", e));
  }, [logError, dataService, adventureId]);

  // == UI STUFF ==

  const getClientPosition = useCallback((clientX: number, clientY: number) => {
    let bounds = drawingRef.current?.getBoundingClientRect();
    if (bounds === undefined) {
      return undefined;
    }

    let x = clientX - bounds.left;
    let y = clientY - bounds.top;
    return new THREE.Vector3(x, bounds.height - y - 1, 0);
  }, [drawingRef]);

  // We have a separate state tracking object to manage the interdependencies between
  // different parts of the UI
  const ui = useMemo(
    () => statusContext.toasts === undefined ? undefined :
      new MapUi(setUiState, getClientPosition, logError, statusContext.toasts),
    [logError, getClientPosition, setUiState, statusContext.toasts]
  );

  // This is a bit nasty, but if we didn't update our ui object with any new map state machine
  // we'd have to make said state machine a parameter of basically everything
  useEffect(() => {
    if (ui !== undefined) {
      ui.stateMachine = stateMachine;
    }
  }, [stateMachine, ui]);

  const mapContainerClassName = useMemo(
    () => uiState.touch !== undefined || uiState.mouseDown ?
      `${MAP_CONTAINER_CLASS} Map-interaction` : `${MAP_CONTAINER_CLASS}`,
    [uiState.mouseDown, uiState.touch]
  );

  const [mapColourMode, setMapColourMode] = useState(MapColourVisualisationMode.Areas);

  // Map controls stuff
  const resetView = useCallback((c?: string | undefined) => stateMachine?.resetView(c), [stateMachine]);
  const zoomIn = useCallback(() => stateMachine?.zoomBy(-0.5, 2), [stateMachine]);
  const zoomOut = useCallback(() => stateMachine?.zoomBy(0.5, 2), [stateMachine]);
  const zoomInDisabled = useMemo(() => mapState.zoom >= zoomMax, [mapState]);
  const zoomOutDisabled = useMemo(() => mapState.zoom <= zoomMin, [mapState]);

  // Sync the drawing with the map colour mode
  useEffect(() => {
    stateMachine?.setShowMapColourVisualisation(mapColourMode === MapColourVisualisationMode.Connectivity);
  }, [stateMachine, mapColourMode]);

  // Our token sizes are map dependent
  const tokenSizes = useMemo(
    () => map === undefined ? undefined : createTokenSizes(map.record.ty),
    [map]
  );

  const handleMapEditorSave = useCallback(async (adventureId: string, updated: IMap) => {
    if (ui === undefined) {
      return;
    }

    await ui.mapEditorSave(
      dataService,
      functionsService,
      map, updated,
      (message, e) => logError(message, e)
    );
  }, [logError, map, ui, dataService, functionsService]);

  const handleModalClose = useCallback(() => ui?.modalClose(), [ui]);
  const handleTokenEditorDelete = useCallback(() => ui?.tokenEditorDelete(), [ui]);
  const handleTokenEditorSave = useCallback(
    (properties: ITokenProperties) => ui?.tokenEditorSave(properties),
    [ui]
  );

  const handleNoteEditorDelete = useCallback(() => ui?.noteEditorDelete(), [ui]);
  const handleNoteEditorSave = useCallback((id: string, colour: number, text: string, visibleToPlayers: boolean) => {
    ui?.noteEditorSave(id, colour, text, visibleToPlayers);
  }, [ui]);

  const handleTokenDeletion = useCallback(() => ui?.tokenDeletion(), [ui]);

  // We want to disable most of the handlers, below, if a modal editor is open, to prevent
  // accidents whilst editing
  const anEditorIsOpen = useMemo(() => isAnEditorOpen(uiState), [uiState]);

  const flipToken = useCallback((cp: THREE.Vector3) => {
    if (stateMachine === undefined) {
      return;
    }

    const here = stateMachine.getToken(cp);
    if (here !== undefined) {
      try {
        ui?.addChanges(stateMachine.flipToken(here));
      } catch (e) {
        statusContext.toasts.next({ id: uuidv4(), record: {
          title: "Cannot flip token",
          message: String(e.message)
        }});
      }
    }
  }, [stateMachine, statusContext.toasts, ui]);

  const editNoteFromMenu = useCallback(() => ui?.editNote(), [ui]);
  const editTokenFromMenu = useCallback(() => ui?.editToken(), [ui]);

  const flipTokenFromMenu = useCallback(() => {
    console.log("called flipToken with x " + uiState.contextMenuX + ", y " + uiState.contextMenuY);
    const cp = getClientPosition(uiState.contextMenuX, uiState.contextMenuY);
    if (cp === undefined) {
      return;
    }

    flipToken(cp);
  }, [flipToken, getClientPosition, uiState.contextMenuX, uiState.contextMenuY]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    let bounds = drawingRef.current?.getBoundingClientRect();
    if (bounds === undefined) {
      return;
    }

    e.preventDefault();
    ui?.contextMenu(e, bounds);
  }, [drawingRef, ui]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (ui === undefined || anEditorIsOpen) {
      return;
    }

    ui.keyDown(e);
  }, [anEditorIsOpen, ui]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (ui === undefined || anEditorIsOpen) {
      return;
    }

    ui.keyUp(e, mapState.seeEverything);
  }, [anEditorIsOpen, mapState.seeEverything, ui]);

  // *** Mouse and touch specific handlers ***

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    ui?.mouseDown(e, getClientPosition(e.clientX, e.clientY));
  }, [getClientPosition, ui]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    return ui?.mouseMove(e, getClientPosition(e.clientX, e.clientY));
  }, [getClientPosition, ui]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const cp = handleMouseMove(e);
    ui?.mouseUp(e, cp);
  }, [handleMouseMove, ui]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => ui?.touchMove(e), [ui]);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => ui?.touchEnd(e), [ui]);
  const handleTouchStart = useCallback((e: React.TouchEvent) => ui?.touchStart(e), [ui]);

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

  // We take over the context menu for all-permissions users only to provide interaction.
  useEffect(() => {
    if (mapState.seeEverything) {
      document.addEventListener('contextmenu', handleContextMenu);
      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
      };
    } else {
      return undefined;
    }
  }, [handleContextMenu, mapState.seeEverything]);

  const [showAnnotationFlags, setShowAnnotationFlags] = useState(ShowAnnotationFlags.All);
  const [customAnnotationFlags, setCustomAnnotationFlags] = useState(false);

  const cycleShowAnnotationFlags = useCallback((flags: ShowAnnotationFlags) => {
    // Doing this causes the map annotations to notice if they should override
    // any customisations
    setCustomAnnotationFlags(false);
    setShowAnnotationFlags(flags);
  }, [setCustomAnnotationFlags, setShowAnnotationFlags]);

  return (
    <div className={mapContainerClassName}>
      <div className="Map-nav">
        <Navigation>{title}</Navigation>
      </div>
      <div className="Map-overlay">
        <MapControls
          editMode={uiState.editMode}
          setEditMode={m => ui?.setEditMode(m)}
          selectedColour={uiState.selectedColour}
          setSelectedColour={c => ui?.setSelectedColour(c)}
          resetView={resetView}
          zoomIn={zoomIn} zoomOut={zoomOut}
          zoomInDisabled={zoomInDisabled} zoomOutDisabled={zoomOutDisabled}
          mapColourVisualisationMode={mapColourMode}
          setMapColourVisualisationMode={setMapColourMode}
          canDoAnything={mapState.seeEverything}
          isOwner={mapState.isOwner}
          openMapEditor={() => ui?.showMapEditor()}
          setShowAnnotationFlags={cycleShowAnnotationFlags} />
        <MapInfo map={map?.record} players={players} tokens={mapState.tokens}
          canDoAnything={mapState.seeEverything} resetView={resetView}
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
      <MapEditorModal show={uiState.showMapEditor} map={map}
        handleClose={() => ui?.modalClose()} handleSave={handleMapEditorSave} />
      <TokenEditorModal selectedColour={uiState.selectedColour} show={uiState.showTokenEditor}
        sizes={tokenSizes} token={uiState.tokenToEdit}
        players={players} handleClose={handleModalClose}
        handleDelete={handleTokenEditorDelete} handleSave={handleTokenEditorSave} />
      <TokenDeletionModal show={uiState.showTokenDeletion} tokens={uiState.tokensToDelete}
        handleClose={handleModalClose} handleDelete={handleTokenDeletion} />
      <NoteEditorModal show={uiState.showNoteEditor} note={uiState.noteToEdit} handleClose={handleModalClose}
        handleDelete={handleNoteEditorDelete} handleSave={handleNoteEditorSave} />
      <MapAnnotations annotations={mapState.annotations} showFlags={showAnnotationFlags} customFlags={customAnnotationFlags}
        setCustomFlags={setCustomAnnotationFlags} suppressAnnotations={uiState.isDraggingView} />
      <MapContextMenu
        show={uiState.showContextMenu}
        hide={() => ui?.hideContextMenu()}
        x={uiState.contextMenuX}
        y={uiState.contextMenuY}
        pageRight={uiState.contextMenuPageRight}
        pageBottom={uiState.contextMenuPageBottom}
        token={uiState.contextMenuToken}
        note={uiState.contextMenuNote}
        editToken={editTokenFromMenu}
        flipToken={flipTokenFromMenu}
        editNote={editNoteFromMenu}
        editMode={uiState.editMode}
        setEditMode={m => ui?.setEditMode(m)} />
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