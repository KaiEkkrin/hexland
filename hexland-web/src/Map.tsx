import React, { RefObject } from 'react';
import './App.css';
import './Map.css';

import { AppContext, AppState } from './App';
import MapControls, { EditMode } from './components/MapControls';
import MapEditorModal from './components/MapEditorModal';
import Navigation from './components/Navigation';
import TokenEditorModal from './components/TokenEditorModal';

import { IPlayer } from './data/adventure';
import { IChanges, IChange } from './data/change';
import { trackChanges } from './data/changeTracking';
import { IToken } from './data/feature';
import { MapType, IMap } from './data/map';
import { IProfile } from './data/profile';
import { registerMapAsRecent, consolidateMapChanges } from './services/extensions';
import { IDataService } from './services/interfaces';

import { ThreeDrawing } from './models/drawing';
import { FeatureColour } from './models/featureColour';
import { TextCreator } from './models/textCreator';

import { RouteComponentProps } from 'react-router-dom';

import * as THREE from 'three';

interface IMapProps extends IMapPageProps {
  dataService: IDataService | undefined;
  profile: IProfile | undefined;
}

class MapState {
  record: IMap | undefined;
  editMode = EditMode.Select;
  selectedColour = 0;
  showMapEditor = false;
  showTokenEditor = false;
  tokenToEdit: IToken | undefined = undefined;
  tokenToEditPosition: THREE.Vector2 | undefined;
  players: IPlayer[] = [];
}

class Map extends React.Component<IMapProps, MapState> {
  private readonly _colours: FeatureColour[];
  private readonly _mount: RefObject<HTMLDivElement>;
  private readonly _textCreator: TextCreator;
  private _drawing: ThreeDrawing | undefined;
  private _stopWatchingMap: (() => void) | undefined;
  private _stopWatchingPlayers: (() => void) | undefined;

  constructor(props: IMapProps) {
    super(props);
    this.state = new MapState();

    // Generate my standard colours
    this._colours = [];
    for (var i = 0; i < 6; ++i) {
      this._colours.push(new FeatureColour((i + 0.5) / 6.0));
    }

    this._mount = React.createRef();
    this._textCreator = new TextCreator();

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleTokenEditorClose = this.handleTokenEditorClose.bind(this);
    this.handleTokenEditorDelete = this.handleTokenEditorDelete.bind(this);
    this.handleTokenEditorSave = this.handleTokenEditorSave.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    this.handleOpenMapEditor = this.handleOpenMapEditor.bind(this);
    this.handleMapEditorClose = this.handleMapEditorClose.bind(this);
    this.handleMapEditorSave = this.handleMapEditorSave.bind(this);
    this.resetView = this.resetView.bind(this);
    this.setEditMode = this.setEditMode.bind(this);
  }

  private get canOpenMapEditor(): boolean {
    return this.props.dataService?.getUid() === this.state.record?.owner;
  }

  // Gets our standard colours.
  private get hexColours(): string[] {
    return this._colours.map(c => "#" + c.lightHexString);
  }

  private async loadMap(mount: HTMLDivElement): Promise<void> {
    // Detach from any existing map
    this._stopWatchingMap?.();
    this._stopWatchingMap = undefined;
    this._stopWatchingPlayers?.();
    this._stopWatchingPlayers = undefined;

    // I don't think we mind very much if this record changes under our feet
    var record = await this.props.dataService?.getMap(this.props.adventureId, this.props.mapId);
    if (record === undefined) {
      return;
    }

    this.setState({ record: record });
    await registerMapAsRecent(
      this.props.dataService, this.props.profile, this.props.adventureId, this.props.mapId, record
    );
    var drawing = new ThreeDrawing(
      this._colours,
      mount,
      this._textCreator,
      record.ty === MapType.Hex
    );

    // If relevant, consolidate any existing changes to this map to reduce the amount
    // of database clutter
    await consolidateMapChanges(
      this.props.dataService, this.props.adventureId, this.props.mapId, record
    );

    this._stopWatchingMap = this.props.dataService?.watchChanges(
      this.props.adventureId,
      this.props.mapId,
      (chs: IChanges) => { if (this._drawing !== undefined) { trackChanges(drawing, chs.chs); } },
      (e: Error) => console.error("Error watching map changes:", e)
    );

    this._stopWatchingPlayers = this.props.dataService?.watchPlayers(
      this.props.adventureId,
      (players: IPlayer[]) => { this.setState({ players: players }); },
      (e: Error) => console.error("Error watching players:", e)
    );

    this._drawing = drawing; // TODO dispose any old one
    this._drawing.animate();
  }

  private addChanges(changes: IChange[] | undefined) {
    if (changes === undefined ||
      changes.length === 0 ||
      this.props.dataService === undefined
    ) {
      return;
    }

    this.props.dataService.addChanges(this.props.adventureId, this.props.mapId, changes)
      .then(() => console.log("Added " + changes.length + " changes"))
      .catch(e => console.error("Error adding " + changes.length + " changes", e));
  }

  componentDidMount() {
    window.addEventListener('resize', this.handleWindowResize);

    var mount = this._mount.current;
    if (!mount) {
      return;
    }

    this.loadMap(mount)
      .then(() => console.log("Map " + this.props.mapId + " successfully loaded"))
      .catch(e => console.error("Error loading map " + this.props.mapId, e));
  }

  componentDidUpdate(prevProps: IMapProps, prevState: MapState) {
    if (this.props.dataService !== prevProps.dataService ||
      this.props.adventureId !== prevProps.adventureId ||
      this.props.mapId !== prevProps.mapId
    ) {
      var mount = this._mount.current;
      if (!mount) {
        return;
      }

      this.loadMap(mount)
        .then(() => console.log("Map " + this.props.mapId + " successfully loaded"))
        .catch(e => console.error("Error loading map " + this.props.mapId, e));
    }
  }

  componentWillUnmount() {
    this._stopWatchingMap?.();
    this._stopWatchingMap = undefined;
    this._stopWatchingPlayers?.();
    this._stopWatchingPlayers = undefined;
    window.removeEventListener('resize', this.handleWindowResize);
  }

  private getClientPosition(e: React.MouseEvent<HTMLDivElement, MouseEvent>): THREE.Vector2 | undefined {
    // TODO fix this positioning, which is currently slightly wrong
    var bounds = this._mount.current?.getBoundingClientRect();
    if (bounds === undefined) {
      return undefined;
    }

    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;
    return new THREE.Vector2(x, bounds.height - y - 1);
  }

  private handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    var cp = this.getClientPosition(e);
    if (cp === undefined) {
      return;
    }

    switch (this.state.editMode) {
      case EditMode.Select: this._drawing?.selectionDragStart(cp); break;
      case EditMode.Area: this._drawing?.faceDragStart(cp); break;
      case EditMode.Wall: this._drawing?.edgeDragStart(cp); break;
      case EditMode.Pan: this._drawing?.panStart(cp); break;
      case EditMode.Zoom: this._drawing?.zoomRotateStart(cp, e.shiftKey); break;
    }
  }

  private handleMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    var cp = this.getClientPosition(e);
    if (cp === undefined) {
      return;
    }

    switch (this.state.editMode) {
      case EditMode.Select: this._drawing?.moveSelectionTo(cp); break;
      case EditMode.Area: this._drawing?.moveFaceHighlightTo(cp); break;
      case EditMode.Wall: this._drawing?.moveEdgeHighlightTo(cp); break;
      case EditMode.Pan: this._drawing?.panTo(cp); break;
      case EditMode.Zoom: this._drawing?.zoomRotateTo(cp); break;
    }
  }

  private handleMouseUp(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this.handleMouseMove(e);
    var cp = this.getClientPosition(e);
    if (cp === undefined) {
      return;
    }

    switch (this.state.editMode) {
      case EditMode.Select:
        this.addChanges(this._drawing?.selectionDragEnd(cp, e.shiftKey));
        break;

      case EditMode.Token:
        // Show the token dialog now.  We'll create or alter the token upon close of
        // the dialog.
        var token = this._drawing?.getToken(cp);
        this.setState({
          showTokenEditor: true,
          tokenToEdit: token,
          tokenToEditPosition: cp
        });
        break;

      case EditMode.Area:
        this.addChanges(this._drawing?.faceDragEnd(cp, this.state.selectedColour));
        break;

      case EditMode.Wall:
        this.addChanges(this._drawing?.edgeDragEnd(cp, this.state.selectedColour));
        break;

      case EditMode.Pan: this._drawing?.panEnd(); break;
      case EditMode.Zoom: this._drawing?.zoomRotateEnd(); break;
    }
  }

  private handleTokenEditorClose() {
    this.setState({ showTokenEditor: false, tokenToEdit: undefined, tokenToEditPosition: undefined });
  }

  private handleTokenEditorDelete() {
    if (this.state.tokenToEditPosition !== undefined) {
      this.addChanges(
        this._drawing?.setToken(this.state.tokenToEditPosition, -1, "", [])
      );
    }

    this.handleTokenEditorClose();
  }

  private handleTokenEditorSave(text: string, colour: number, playerIds: string[]) {
    if (this.state.tokenToEditPosition !== undefined) {
      this.addChanges(
        this._drawing?.setToken(
          this.state.tokenToEditPosition,
          colour,
          text,
          playerIds
        )
      );
    }

    this.handleTokenEditorClose();
  }

  private handleOpenMapEditor() {
    this.setState({ showMapEditor: true });
  }

  private handleMapEditorClose() {
    this.setState({ showMapEditor: false });
  }

  private handleMapEditorSave(ffa: boolean) {
    this.handleMapEditorClose();
    if (this.props.dataService !== undefined) {
      var mapRef = this.props.dataService.getMapRef(this.props.adventureId, this.props.mapId);
      this.props.dataService.update(mapRef, { ffa: ffa })
        .then(() => console.log("Set FFA to " + ffa))
        .catch(e => console.error("Failed to set FFA:", e));
    }
  }

  private handleWindowResize(ev: UIEvent) {
    this._drawing?.resize();
  }

  private resetView() {
    this._drawing?.resetView();
  }

  private setEditMode(value: EditMode) {
    this.setState({ editMode: value });
    if (value !== EditMode.Select) {
      this._drawing?.clearSelection();
    }
  }

  render() {
    return (
      <div className="Map-container">
        <div className="Map-nav">
          <Navigation getTitle={() => this.state.record?.name} />
        </div>
        <MapControls colours={this.hexColours}
          getEditMode={() => this.state.editMode}
          setEditMode={this.setEditMode}
          getSelectedColour={() => this.state.selectedColour}
          setSelectedColour={(v) => { this.setState({ selectedColour: v }); }}
          resetView={this.resetView}
          canOpenMapEditor={this.canOpenMapEditor}
          openMapEditor={this.handleOpenMapEditor} />
        <div className="Map-content">
          <div id="drawingDiv" ref={this._mount}
            onMouseDown={this.handleMouseDown}
            onMouseMove={this.handleMouseMove}
            onMouseUp={this.handleMouseUp} />
        </div>
        <MapEditorModal show={this.state.showMapEditor} map={this.state.record}
          handleClose={this.handleMapEditorClose} handleSave={this.handleMapEditorSave} />
        <TokenEditorModal selectedColour={this.state.selectedColour} show={this.state.showTokenEditor}
          token={this.state.tokenToEdit} hexColours={this.hexColours}
          players={this.state.players} handleClose={this.handleTokenEditorClose}
          handleDelete={this.handleTokenEditorDelete} handleSave={this.handleTokenEditorSave} />
      </div>
    );
  }
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
