import React, { RefObject } from 'react';
import './App.css';
import './Map.css';
import Navigation from './Navigation';

import { ThreeDrawing } from './models/drawing';
import { FeatureColour } from './models/featureColour';
import { TextCreator } from './models/textCreator';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import ToggleButton from 'react-bootstrap/ToggleButton';

import { RouteComponentProps } from 'react-router-dom';

import { faDrawPolygon, faMousePointer, faPlus, faSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import * as THREE from 'three';

enum EditMode {
  Select = 1,
  Token = 2,
  Area = 3,
  Wall = 4,
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
}

function MapControls(props: IMapControlsProps) {
  return (
    <div className="Map-controls bg-dark">
      <ButtonGroup toggle vertical>
        <ToggleButton type="radio" variant="dark" key={EditMode.Select}
          value={EditMode.Select}
          checked={props.getEditMode() === EditMode.Select}
          onChange={(e) => props.setEditMode(EditMode.Select)}>
          <FontAwesomeIcon icon={faMousePointer} color="white" />
        </ToggleButton>
        <ToggleButton type="radio" variant="dark" key={EditMode.Token}
          value={EditMode.Token}
          checked={props.getEditMode() === EditMode.Token}
          onChange={(e) => props.setEditMode(EditMode.Token)}>
          <FontAwesomeIcon icon={faPlus} color="white" />
        </ToggleButton>
        <ToggleButton type="radio" variant="dark" key={EditMode.Area}
          value={EditMode.Token}
          checked={props.getEditMode() === EditMode.Area}
          onChange={(e) => props.setEditMode(EditMode.Area)}>
          <FontAwesomeIcon icon={faSquare} color="white" />
        </ToggleButton>
        <ToggleButton type="radio" variant="dark" key={EditMode.Wall}
          value={EditMode.Wall}
          checked={props.getEditMode() === EditMode.Wall}
          onChange={(e) => props.setEditMode(EditMode.Wall)}>
          <FontAwesomeIcon icon={faDrawPolygon} color="white" />
        </ToggleButton>
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
  geometry: string;
}

class MapState {
  editMode = EditMode.Select;
  selectedColour = 0;
  showTokenEditor = false;
  contextualColour = 0;
  contextualPosition: THREE.Vector2 | undefined = undefined;
  contextualText = "";
}

class Map extends React.Component<RouteComponentProps<IMapProps>, MapState> {
  private readonly _colours: FeatureColour[];
  private readonly _mount: RefObject<HTMLDivElement>;
  private readonly _textCreator: TextCreator;
  private _drawing: ThreeDrawing | undefined;

  private _mouseIsDown: boolean = false;

  constructor(props: RouteComponentProps<IMapProps>) {
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
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleTokenEditorClose = this.handleTokenEditorClose.bind(this);
    this.handleTokenEditorDelete = this.handleTokenEditorDelete.bind(this);
    this.handleTokenEditorSave = this.handleTokenEditorSave.bind(this);
    this.isModalSaveDisabled = this.isModalSaveDisabled.bind(this);
    this.setEditMode = this.setEditMode.bind(this);
  }

  // Gets our standard colours.
  private get hexColours(): string[] {
    return this._colours.map(c => "#" + c.lightHexString);
  }

  componentDidMount() {
    var mount = this._mount.current;
    if (!mount) {
      return;
    }

    this._drawing = new ThreeDrawing(this._colours, mount, this._textCreator, this.props.match.params.geometry === "hex");
    this._drawing.animate();
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
    this._mouseIsDown = true;
    var cp = this.getClientPosition(e);
    if (this.state.editMode === EditMode.Select && cp !== undefined) {
      this._drawing?.selectionDragStart(cp);
    }
  }

  private handleMouseLeave(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this._drawing?.hideEdgeHighlight();
    this._drawing?.hideFaceHighlight();
  }

  private handleMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    var cp = this.getClientPosition(e);
    if (cp === undefined) {
      return;
    }

    if (this.state.editMode === EditMode.Select) {
      this._drawing?.moveSelectionTo(cp);
    }

    if (this.state.editMode === EditMode.Area) {
      this._drawing?.moveFaceHighlightTo(cp);
      if (this._mouseIsDown === true) {
        this._drawing?.setArea(cp, this.state.selectedColour);
      }
    } else {
      this._drawing?.hideFaceHighlight();
    }

    if (this.state.editMode === EditMode.Wall) {
      this._drawing?.moveEdgeHighlightTo(cp);
      if (this._mouseIsDown === true) {
        this._drawing?.setWall(cp, this.state.selectedColour);
      }
    } else {
      this._drawing?.hideEdgeHighlight();
    }
  }

  private handleMouseUp(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this.handleMouseMove(e);
    this._mouseIsDown = false;
    var cp = this.getClientPosition(e);
    if (this.state.editMode === EditMode.Select && cp !== undefined) {
      this._drawing?.selectionDragEnd(cp, e.shiftKey);
    } else if (this.state.editMode === EditMode.Token && cp !== undefined) {
      // Show the token dialog now.  We'll create the token upon close of
      // the dialog.
      var token = this._drawing?.getToken(cp);
      this.setState({
        showTokenEditor: true,
        contextualColour: Math.max(0, token?.colour ?? this.state.selectedColour),
        contextualPosition: cp,
        contextualText: token?.text ?? "",
      });
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

  private isModalSaveDisabled(): boolean {
    return this.state.contextualText === undefined ||
      this.state.contextualText.length === 0;
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
        <Navigation />
        <MapControls colours={this.hexColours}
          getEditMode={() => this.state.editMode}
          setEditMode={this.setEditMode}
          getSelectedColour={() => this.state.selectedColour}
          setSelectedColour={(v) => { this.setState({ selectedColour: v }); }} />
        <div className="Map-content">
          <div id="drawingDiv" ref={this._mount}
               onMouseDown={this.handleMouseDown}
               onMouseEnter={this.handleMouseMove}
               onMouseLeave={this.handleMouseLeave}
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

export default Map;
