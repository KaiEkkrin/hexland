import React, { RefObject } from 'react';
import './App.css';
import './Map.css';
import Navigation from './Navigation';

import { ThreeDrawing } from './models/drawing';
import { FeatureColour } from './models/featureColour';

import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';

import { RouteComponentProps } from 'react-router-dom';

import { faDrawPolygon, faMousePointer, faPlus, faSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

enum EditMode {
  Select = 1,
  Token = 2,
  Area = 3,
  Wall = 4,
}

interface IMapControlsProps {
  colours: string[];
  getEditMode(): EditMode;
  setEditMode(value: EditMode): void;
  getSelectedColour(): number;
  setSelectedColour(value: number): void;
}

class MapControls extends React.Component<IMapControlsProps> {
  render() {
    return (
      <div className="Map-controls bg-dark">
        <ButtonGroup toggle vertical>
          <ToggleButton type="radio" variant="dark" key={EditMode.Select}
            value={EditMode.Select}
            checked={this.props.getEditMode() === EditMode.Select}
            onChange={(e) => this.props.setEditMode(EditMode.Select)}>
            <FontAwesomeIcon icon={faMousePointer} color="white" />
          </ToggleButton>
          <ToggleButton type="radio" variant="dark" key={EditMode.Token}
            value={EditMode.Token}
            checked={this.props.getEditMode() === EditMode.Token}
            onChange={(e) => this.props.setEditMode(EditMode.Token)}>
            <FontAwesomeIcon icon={faPlus} color="white" />
          </ToggleButton>
          <ToggleButton type="radio" variant="dark" key={EditMode.Area}
            value={EditMode.Token}
            checked={this.props.getEditMode() === EditMode.Area}
            onChange={(e) => this.props.setEditMode(EditMode.Area)}>
            <FontAwesomeIcon icon={faSquare} color="white" />
          </ToggleButton>
          <ToggleButton type="radio" variant="dark" key={EditMode.Wall}
            value={EditMode.Wall}
            checked={this.props.getEditMode() === EditMode.Wall}
            onChange={(e) => this.props.setEditMode(EditMode.Wall)}>
            <FontAwesomeIcon icon={faDrawPolygon} color="white" />
          </ToggleButton>
        </ButtonGroup>
        <ButtonGroup toggle vertical>
          {this.props.colours.map((c, i) =>
            <ToggleButton type="radio" variant="dark" key={i} value={i}
              checked={this.props.getSelectedColour() === i}
              onChange={(e) => this.props.setSelectedColour(i)}>
              <FontAwesomeIcon icon={faSquare} color={c} />
            </ToggleButton>
          )}
          <ToggleButton type="radio" variant="dark" key={-1} value={-1}
            checked={this.props.getSelectedColour() === -1}
            onChange={(e) => this.props.setSelectedColour(-1)}>
            <FontAwesomeIcon icon={faSquare} color="black" />
          </ToggleButton>
        </ButtonGroup>
      </div>
    );
  }
}

interface IMapProps {
  geometry: string;
}

class MapState {
  editMode = EditMode.Select;
  selectedColour = 0;
}

class Map extends React.Component<RouteComponentProps<IMapProps>, MapState> {
  private readonly _colours: FeatureColour[];
  private readonly _mount: RefObject<HTMLDivElement>;
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

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
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

    this._drawing = new ThreeDrawing(this._colours, mount, this.props.match.params.geometry === "hex");
    this._drawing.animate();
  }

  private handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this._mouseIsDown = true;
    if (this.state.editMode === EditMode.Select) {
      this._drawing?.selectionDragStart(e);
    }
  }

  private handleMouseLeave(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this._drawing?.hideEdgeHighlight();
    this._drawing?.hideFaceHighlight();
  }

  private handleMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (this.state.editMode === EditMode.Select) {
      this._drawing?.moveSelectionTo(e);
    }

    if (this.state.editMode === EditMode.Area) {
      this._drawing?.moveFaceHighlightTo(e);
      if (this._mouseIsDown === true) {
        this._drawing?.setArea(e, this.state.selectedColour);
      }
    } else {
      this._drawing?.hideFaceHighlight();
    }

    if (this.state.editMode === EditMode.Wall) {
      this._drawing?.moveEdgeHighlightTo(e);
      if (this._mouseIsDown === true) {
        this._drawing?.setWall(e, this.state.selectedColour);
      }
    } else {
      this._drawing?.hideEdgeHighlight();
    }
  }

  private handleMouseUp(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this.handleMouseMove(e);
    this._mouseIsDown = false;
    if (this.state.editMode === EditMode.Select) {
      this._drawing?.selectionDragEnd(e);
    } else if (this.state.editMode === EditMode.Token) {
      this._drawing?.setToken(e, this.state.selectedColour);
    }
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
      </div>
    );
  }
}

export default Map;
