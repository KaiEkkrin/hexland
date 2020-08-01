import React, { RefObject } from 'react';
import './App.css';
import './Map.css';
import Navigation from './Navigation';

import { AppContext, AppState } from './App';
import { MapType, IMap } from './data/map';
import { IProfile } from './data/profile';
import { registerMapAsRecent } from './services/extensions';
import { IDataService } from './services/interfaces';

import { ThreeDrawing } from './models/drawing';
import { FeatureColour } from './models/featureColour';
import { TextCreator } from './models/textCreator';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ToggleButton from 'react-bootstrap/ToggleButton';
import Tooltip from 'react-bootstrap/Tooltip';

import { RouteComponentProps } from 'react-router-dom';

import { faDotCircle, faDrawPolygon, faHandPaper, faMousePointer, faPlus, faSearch, faSquare, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import * as THREE from 'three';
enum EditMode {
  Select = "select",
  Token = "token",
  Area = "area",
  Wall = "wall",
  Pan = "pan",
  Zoom = "zoom",
}

interface IEditModeButtonProps {
  mode: EditMode;
  icon: IconDefinition;
  tooltip: string;
  getEditMode(): EditMode;
  setEditMode(value: EditMode): void;
}

function EditModeButton(props: IEditModeButtonProps) {
  return (
    <OverlayTrigger key={props.mode} placement="right" overlay={
      <Tooltip id={props.mode + "-tooltip"}>{props.tooltip}</Tooltip>
    }>
      <ToggleButton type="radio" variant="dark" key={props.mode} value={props.mode}
        checked={props.getEditMode() === props.mode}
        onChange={(e) => props.setEditMode(props.mode)}>
        <FontAwesomeIcon icon={props.icon} color="white" />
      </ToggleButton>
    </OverlayTrigger>
  );
}

interface INegativeColourProps {
  includeNegative: boolean;
  getSelectedColour(): number;
  setSelectedColour(value: number): void;
}

function NegativeColour(props: INegativeColourProps) {
  if (props.includeNegative === false) {
    return null;
  }

  return (
    <ToggleButton type="radio" variant="dark" key={-1} value={-1}
      checked={props.getSelectedColour() === -1}
      onChange={(e) => props.setSelectedColour(-1)}>
      <FontAwesomeIcon icon={faSquare} color="black" />
    </ToggleButton>
  );
}

interface IColourSelectionProps {
  colours: string[];
  includeNegative: boolean;
  isVertical: boolean;
  getSelectedColour(): number;
  setSelectedColour(value: number): void;
}

function ColourSelection(props: IColourSelectionProps) {
  return (
    <ButtonGroup toggle vertical={props.isVertical === true}>
      {props.colours.map((c, i) =>
        <ToggleButton type="radio" variant="dark" key={i} value={i}
          checked={props.getSelectedColour() === i}
          onChange={(e) => props.setSelectedColour(i)}>
          <FontAwesomeIcon icon={faSquare} color={c} />
        </ToggleButton>
      )}
      <NegativeColour includeNegative={props.includeNegative}
        getSelectedColour={props.getSelectedColour}
        setSelectedColour={props.setSelectedColour} />
    </ButtonGroup>
  );
}

interface IMapControlsProps {
  colours: string[];
  getEditMode(): EditMode;
  setEditMode(value: EditMode): void;
  getSelectedColour(): number;
  setSelectedColour(value: number): void;
  resetView(): void;
}

function MapControls(props: IMapControlsProps) {
  return (
    <div className="Map-controls bg-dark">
      <ButtonGroup className="mb-2" toggle vertical>
        <EditModeButton mode={EditMode.Select} icon={faMousePointer} tooltip="Select and move tokens"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Token} icon={faPlus} tooltip="Add and edit tokens"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Area} icon={faSquare} tooltip="Paint areas"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Wall} icon={faDrawPolygon} tooltip="Paint walls"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Pan} icon={faHandPaper} tooltip="Pan the map view"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Zoom} icon={faSearch} tooltip="Zoom the map view, or Shift-click to rotate"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
      </ButtonGroup>
      <ButtonGroup className="mb-2">
        <OverlayTrigger placement="right" overlay={
          <Tooltip id="reset-tooltip">Reset the map view</Tooltip>
        }>
          <Button variant="dark" onClick={() => props.resetView()}>
            <FontAwesomeIcon icon={faDotCircle} color="white" />
          </Button>
        </OverlayTrigger>
      </ButtonGroup>
      <ColourSelection colours={props.colours}
        includeNegative={true}
        isVertical={true}
        getSelectedColour={props.getSelectedColour}
        setSelectedColour={props.setSelectedColour} />
    </div>
  );
}

interface IMapProps {
  dataService: IDataService | undefined;
  profile: IProfile | undefined;
  mapId: string;
}

class MapState {
  record: IMap | undefined;
  editMode = EditMode.Select;
  selectedColour = 0;
  showTokenEditor = false;
  contextualColour = 0;
  contextualPosition: THREE.Vector2 | undefined;
  contextualText = "";
}

class Map extends React.Component<IMapProps, MapState> {
  private readonly _colours: FeatureColour[];
  private readonly _mount: RefObject<HTMLDivElement>;
  private readonly _textCreator: TextCreator;
  private _drawing: ThreeDrawing | undefined;

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
    this.isModalSaveDisabled = this.isModalSaveDisabled.bind(this);
    this.resetView = this.resetView.bind(this);
    this.setEditMode = this.setEditMode.bind(this);
  }

  // Gets our standard colours.
  private get hexColours(): string[] {
    return this._colours.map(c => "#" + c.lightHexString);
  }

  private async loadMap(mount: HTMLDivElement): Promise<void> {
    var record = await this.props.dataService?.getMap(this.props.mapId);
    if (record === undefined) {
      return;
    }

    this.setState({ record: record });
    await registerMapAsRecent(this.props.dataService, this.props.profile, this.props.mapId, record);
    this._drawing = new ThreeDrawing(
      this._colours,
      mount,
      this._textCreator,
      record.ty === MapType.Hex
    );

    this._drawing.loadFeatures(record);
    this._drawing.animate();
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
    if (this.props.dataService !== prevProps.dataService || this.props.mapId !== prevProps.mapId) {
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
    if (this.state.record !== undefined && this._drawing !== undefined) {
      // Save changes to the map.  TODO Should be able to eventually remove this!
      // Since I don't have map sharing right now, it's okay as a temporary measure.
      this._drawing.saveFeatures(this.state.record);
      this.props.dataService?.setMap(this.props.mapId, this.state.record)
        .then(() => console.log("Map " + this.props.mapId + " successfully saved"))
        .catch(e => console.error("Error saving map " + this.props.mapId, e));
    }

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
        this._drawing?.selectionDragEnd(cp, e.shiftKey);
        break;

      case EditMode.Token:
        // Show the token dialog now.  We'll create the token upon close of
        // the dialog.
        var token = this._drawing?.getToken(cp);
        this.setState({
          showTokenEditor: true,
          contextualColour: Math.max(0, token?.colour ?? this.state.selectedColour),
          contextualPosition: cp,
          contextualText: token?.text ?? "",
        });
        break;

      case EditMode.Area:
        this._drawing?.faceDragEnd(cp, this.state.selectedColour);
        break;

      case EditMode.Wall:
        this._drawing?.edgeDragEnd(cp, this.state.selectedColour);
        break;

      case EditMode.Pan: this._drawing?.panEnd(); break;
      case EditMode.Zoom: this._drawing?.zoomRotateEnd(); break;
    }
  }

  private handleTokenEditorClose() {
    this.setState({ showTokenEditor: false, contextualPosition: undefined });
  }

  private handleTokenEditorDelete() {
    if (this.state.contextualPosition !== undefined) {
      this._drawing?.setToken(this.state.contextualPosition, -1, this.state.contextualText);
    }

    this.handleTokenEditorClose();
  }

  private handleTokenEditorSave() {
    if (this.state.contextualPosition !== undefined) {
      this._drawing?.setToken(this.state.contextualPosition, this.state.contextualColour, this.state.contextualText);
    }

    this.handleTokenEditorClose();
  }

  private handleWindowResize(ev: UIEvent) {
    this._drawing?.resize();
  }

  private isModalSaveDisabled(): boolean {
    return this.state.contextualText === undefined ||
      this.state.contextualText.length === 0;
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
      <div>
        <Navigation className="Map-nav" getTitle={() => this.state.record?.name} />
        <MapControls colours={this.hexColours}
          getEditMode={() => this.state.editMode}
          setEditMode={this.setEditMode}
          getSelectedColour={() => this.state.selectedColour}
          setSelectedColour={(v) => { this.setState({ selectedColour: v }); }}
          resetView={this.resetView} />
        <div className="Map-content">
          <div id="drawingDiv" ref={this._mount}
            onMouseDown={this.handleMouseDown}
            onMouseMove={this.handleMouseMove}
            onMouseUp={this.handleMouseUp} />
        </div>
        <Modal show={this.state.showTokenEditor} onHide={this.handleTokenEditorClose}>
          <Modal.Header closeButton>
            <Modal.Title>Token</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group>
                <Form.Label>Text</Form.Label>
                <Form.Control type="text" maxLength={3} value={this.state.contextualText}
                  onChange={e => this.setState({ contextualText: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Colour</Form.Label>
                <Form.Row>
                  <ColourSelection colours={this.hexColours}
                    includeNegative={false}
                    isVertical={false}
                    getSelectedColour={() => this.state.contextualColour}
                    setSelectedColour={(v) => { this.setState({ contextualColour: v }); }} />
                </Form.Row>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="danger" onClick={this.handleTokenEditorDelete}>
              Delete
            </Button>
            <Button variant="secondary" onClick={this.handleTokenEditorClose}>
              Close
            </Button>
            <Button variant="primary"
              disabled={this.isModalSaveDisabled()}
              onClick={this.handleTokenEditorSave}>
              Save
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

interface IMapPageProps {
  mapId: string;
}

function MapPage(props: RouteComponentProps<IMapPageProps>) {
  return (
    <AppContext.Consumer>
      {(context: AppState) => context.user === null ? <div></div> : (
        <Map dataService={context.dataService} profile={context.profile}
          mapId={props.match.params.mapId} />
      )}
    </AppContext.Consumer>
  )
}

export default MapPage;
