import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import './Map.css';

import { AppContext, AppState } from './App';
import MapControls, { EditMode } from './components/MapControls';
import MapEditorModal from './components/MapEditorModal';
import Navigation from './components/Navigation';
import TokenEditorModal from './components/TokenEditorModal';

import { IPlayer } from './data/adventure';
import { IChange } from './data/change';
import { trackChanges } from './data/changeTracking';
import { IToken } from './data/feature';
import { MapType, IMap } from './data/map';
import { IProfile } from './data/profile';
import { registerMapAsRecent, consolidateMapChanges } from './services/extensions';
import { IDataService } from './services/interfaces';

import { ThreeDrawing } from './models/drawing';
import { FeatureColour } from './models/featureColour';
import textCreator from './models/textCreator';

import { RouteComponentProps } from 'react-router-dom';

import * as THREE from 'three';

function getStandardColours() {
  var colours: FeatureColour[] = [];
  for (var i = 0; i < 6; ++i) {
    colours.push(new FeatureColour((i + 0.5) / 6.0));
  }

  return colours;
}

function getHexColours() {
  return getStandardColours().map(c => "#" + c.lightHexString);
}

interface IMapProps extends IMapPageProps {
  dataService: IDataService | undefined;
  profile: IProfile | undefined;
}

function Map(props: IMapProps) {
  const drawingRef = useRef<HTMLDivElement>(null);

  const [record, setRecord] = useState(undefined as IMap | undefined);
  const [players, setPlayers] = useState([] as IPlayer[]);
  const [drawing, setDrawing] = useState(undefined as ThreeDrawing | undefined);

  // We need an event listener for the window resize so that we can update the drawing
  useEffect(() => {
    const handleWindowResize = (ev: UIEvent) => { drawing?.resize(); };
    window.addEventListener('resize', handleWindowResize);
    return () => { window.removeEventListener('resize', handleWindowResize); };
  }, [drawing]);

  // Watch the map when it changes
  useEffect(() => {
    if (props.dataService === undefined) {
      return;
    }

    // TODO remove debug after confirming we don't multiple-watch things
    console.log("Watching adventure " + props.adventureId + ", map " + props.mapId);
    var mapRef = props.dataService.getMapRef(props.adventureId, props.mapId);
    return props.dataService.watch<IMap>(
      mapRef, setRecord,
      e => console.error("Error watching map " + props.mapId, e)
    );
  }, [props.dataService, props.adventureId, props.mapId]);

  // Track changes to the map
  useEffect(() => {
    if (props.dataService === undefined || props.profile === undefined || record === undefined ||
      drawingRef?.current === null
    ) {
      setDrawing(undefined);
      return;
    }

    registerMapAsRecent(props.dataService, props.profile, props.adventureId, props.mapId, record)
      .catch(e => console.error("Error registering map as recent", e));
    consolidateMapChanges(props.dataService, props.adventureId, props.mapId, record)
      .catch(e => console.error("Error consolidating map changes", e));

    var theDrawing = new ThreeDrawing(
      getStandardColours(), drawingRef.current, textCreator, record.ty === MapType.Hex
    );
    setDrawing(theDrawing);
    theDrawing.animate();

    // TODO my returned thing should also ensure drawing disposal
    console.log("Watching changes to map " + props.mapId);
    return props.dataService.watchChanges(props.adventureId, props.mapId,
      chs => trackChanges(theDrawing, chs.chs),
      e => console.error("Error watching map changes", e));
  }, [props, record]);

  // Track the adventure's players
  // TODO Can I pull this up into a component that remains in the tree while the user
  // remains in the same adventure?  (would require fun with contexts and the router)
  useEffect(() => {
    console.log("Watching players in adventure " + props.adventureId);
    return props.dataService?.watchPlayers(props.adventureId, setPlayers,
      e => console.error("Error watching players", e));
  }, [props.dataService, props.adventureId]);

  // How to create and share the map changes we make
  function addChanges(changes: IChange[] | undefined) {
    if (changes === undefined || changes.length === 0 || props.dataService === undefined) {
      return;
    }

    props.dataService.addChanges(props.adventureId, props.mapId, changes)
      .then(() => console.log("Added " + changes.length + " changes"))
      .catch(e => console.error("Error adding " + changes.length + " changes", e));
  }

  // == UI STUFF ==

  const [canOpenMapEditor, setCanOpenMapEditor] = useState(false);
  const [editMode, setEditMode] = useState(EditMode.Select);
  const [selectedColour, setSelectedColour] = useState(0);
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [showTokenEditor, setShowTokenEditor] = useState(false);
  const [tokenToEdit, setTokenToEdit] = useState(undefined as IToken | undefined);
  const [tokenToEditPosition, setTokenToEditPosition] = useState(undefined as THREE.Vector2 | undefined);

  useEffect(() => {
    setCanOpenMapEditor(props.dataService?.getUid() === record?.owner);
  }, [props.dataService, record]);

  // When the edit mode changes away from Select, we should clear any selection
  useEffect(() => {
    if (editMode !== EditMode.Select) {
      drawing?.clearSelection();
    }
  }, [drawing, editMode]);

  function handleMapEditorSave(ffa: boolean) {
    setShowMapEditor(false);
    if (props.dataService !== undefined && record !== undefined) {
      var mapRef = props.dataService.getMapRef(props.adventureId, props.mapId);
      props.dataService.update(mapRef, { ffa: ffa })
        .then(() => console.log("Set FFA to " + ffa))
        .catch(e => console.error("Failed to set FFA:", e));
    }
  }

  function handleTokenEditorDelete() {
    setShowTokenEditor(false);
    if (tokenToEditPosition !== undefined) {
      addChanges(drawing?.setToken(tokenToEditPosition, -1, "", []));
    }
  }

  function handleTokenEditorSave(text: string, colour: number, playerIds: string[]) {
    setShowTokenEditor(false);
    if (tokenToEditPosition !== undefined) {
      addChanges(drawing?.setToken(tokenToEditPosition, colour, text, playerIds));
    }
  }

  function getClientPosition(e: React.MouseEvent<HTMLDivElement, MouseEvent>): THREE.Vector2 | undefined {
    var bounds = drawingRef.current?.getBoundingClientRect();
    if (bounds === undefined) {
      return undefined;
    }

    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;
    return new THREE.Vector2(x, bounds.height - y - 1);
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    var cp = getClientPosition(e);
    if (cp === undefined) {
      return;
    }

    switch (editMode) {
      case EditMode.Select: drawing?.selectionDragStart(cp); break;
      case EditMode.Area: drawing?.faceDragStart(cp); break;
      case EditMode.Wall: drawing?.edgeDragStart(cp); break;
      case EditMode.Pan: drawing?.panStart(cp); break;
      case EditMode.Zoom: drawing?.zoomRotateStart(cp, e.shiftKey); break;
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    var cp = getClientPosition(e);
    if (cp === undefined) {
      return;
    }

    switch (editMode) {
      case EditMode.Select: drawing?.moveSelectionTo(cp); break;
      case EditMode.Area: drawing?.moveFaceHighlightTo(cp); break;
      case EditMode.Wall: drawing?.moveEdgeHighlightTo(cp); break;
      case EditMode.Pan: drawing?.panTo(cp); break;
      case EditMode.Zoom: drawing?.zoomRotateTo(cp); break;
    }

    return cp;
  }

  function handleMouseUp(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    var cp = handleMouseMove(e);
    if (cp === undefined) {
      return;
    }

    switch (editMode) {
      case EditMode.Select:
        addChanges(drawing?.selectionDragEnd(cp, e.shiftKey));
        break;

      case EditMode.Token:
        // Show the token dialog now.  We'll create or alter the token upon close of
        // the dialog.
        var token = drawing?.getToken(cp);
        setShowTokenEditor(true);
        setTokenToEdit(token);
        setTokenToEditPosition(cp);
        break;

      case EditMode.Area:
        addChanges(drawing?.faceDragEnd(cp, selectedColour));
        break;

      case EditMode.Wall:
        addChanges(drawing?.edgeDragEnd(cp, selectedColour));
        break;

      case EditMode.Pan: drawing?.panEnd(); break;
      case EditMode.Zoom: drawing?.zoomRotateEnd(); break;
    }
  }

  return (
    <div className="Map-container">
      <div className="Map-nav">
        <Navigation getTitle={() => record?.name} />
      </div>
      <MapControls colours={getHexColours()}
        getEditMode={() => editMode}
        setEditMode={setEditMode}
        getSelectedColour={() => selectedColour}
        setSelectedColour={setSelectedColour}
        resetView={() => drawing?.resetView()}
        canOpenMapEditor={canOpenMapEditor}
        openMapEditor={() => setShowMapEditor(true)} />
      <div className="Map-content">
        <div id="drawingDiv" ref={drawingRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} />
      </div>
      <MapEditorModal show={showMapEditor} map={record}
        handleClose={() => setShowMapEditor(false)} handleSave={handleMapEditorSave} />
      <TokenEditorModal selectedColour={selectedColour} show={showTokenEditor}
        token={tokenToEdit} hexColours={getHexColours()}
        players={players} handleClose={() => setShowTokenEditor(false)}
        handleDelete={handleTokenEditorDelete} handleSave={handleTokenEditorSave} />
    </div>
  );
}

interface IMapPageProps {
  adventureId: string;
  mapId: string;
}

function MapPage(props: RouteComponentProps<IMapPageProps>) {
  return (
    <AppContext.Consumer>
      {(context: AppState) => context.user === null ? <div></div> : (
        <Map dataService={context.dataService} profile={context.profile}
          adventureId={props.match.params.adventureId} mapId={props.match.params.mapId} />
      )}
    </AppContext.Consumer>
  )
}

export default MapPage;