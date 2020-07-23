import React, { RefObject } from 'react';
import './App.css';
import './Map.css';
import Navigation from './Navigation';

import { ThreeDrawing } from './models/drawing';

import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';

import { RouteComponentProps } from 'react-router-dom';

import { faDrawPolygon, faMousePointer, faSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import * as THREE from 'three';

interface IMapControlsProps {
  colours: string[];
  getEditMode(): number;
  setEditMode(value: number): void;
  getSelectedColour(): number;
  setSelectedColour(value: number): void;
}

class MapControls extends React.Component<IMapControlsProps> {
  render() {
    return (
      <div className="Map-controls bg-dark">
        <ButtonGroup toggle vertical>
          <ToggleButton type="radio" variant="dark" value={0}
            checked={this.props.getEditMode() === 0}
            onChange={(e) => this.props.setEditMode(0)}>
            <FontAwesomeIcon icon={faMousePointer} color="white" />
          </ToggleButton>
          <ToggleButton type="radio" variant="dark" value={1}
            checked={this.props.getEditMode() === 1}
            onChange={(e) => this.props.setEditMode(1)}>
            <FontAwesomeIcon icon={faSquare} color="white" />
          </ToggleButton>
          <ToggleButton type="radio" variant="dark" value={2}
            checked={this.props.getEditMode() === 2}
            onChange={(e) => this.props.setEditMode(2)}>
            <FontAwesomeIcon icon={faDrawPolygon} color="white" />
          </ToggleButton>
        </ButtonGroup>
        <ButtonGroup toggle vertical>
          {this.props.colours.map((c, i) =>
            <ToggleButton type="radio" variant="dark" value={i}
              checked={this.props.getSelectedColour() === i}
              onChange={(e) => this.props.setSelectedColour(i)}>
              <FontAwesomeIcon icon={faSquare} color={c} />
            </ToggleButton>
          )}
          <ToggleButton type="radio" variant="dark" value={-1}
            checked={this.props.getSelectedColour() === -1}
            onChange={(e) => this.props.setSelectedColour(-1)}>
            <FontAwesomeIcon icon={faSquare} color="black" />
          </ToggleButton>
        </ButtonGroup>
      </div>
    );
  }
}

interface IDrawingProps {
  colours: THREE.Color[];
  geometry: string;
  getEditMode(): number;
  getSelectedColour(): number;
}

class Drawing extends React.Component<IDrawingProps> {
  private _mount: RefObject<HTMLDivElement>;
  private _drawing: ThreeDrawing | undefined;

  private _mouseIsDown: boolean = false;

  constructor(props: IDrawingProps) {
    super(props);
    this._mount = React.createRef();

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  private get drawHexes(): boolean {
    return this.props.geometry === "hex";
  }

  componentDidMount() {
    var mount = this._mount.current;
    if (!mount) {
      return;
    }

    this._drawing = new ThreeDrawing(this.props.colours, mount, this.drawHexes);
    this._drawing.animate();
  }

  handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this._mouseIsDown = true;
    this.handleMouseMove(e);
  }

  handleMouseLeave(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!this._drawing) { return; }
    this._drawing.hideEdgeHighlight();
    this._drawing.hideFaceHighlight();
  }

  handleMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!this._drawing) { return; }

    var editMode = this.props.getEditMode();
    if (editMode === 1) {
      this._drawing.moveFaceHighlightTo(e);
      if (this._mouseIsDown === true) {
        this._drawing.setArea(e, this.props.getSelectedColour());
      }
    } else {
      this._drawing.hideFaceHighlight();
    }

    if (editMode === 2) {
      this._drawing.moveEdgeHighlightTo(e);
    } else {
      this._drawing.hideEdgeHighlight();
    }
  }

  handleMouseUp(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this._mouseIsDown = false;
  }

  render() {
    return (
      <div id="drawingDiv" ref={this._mount}
           onMouseDown={this.handleMouseDown}
           onMouseEnter={this.handleMouseMove}
           onMouseLeave={this.handleMouseLeave}
           onMouseMove={this.handleMouseMove}
           onMouseUp={this.handleMouseUp} />
    );
  }
}

interface IMapProps {
  geometry: string;
}

class MapState {
  editMode = 0;
  selectedColour = 0;
}

class Map extends React.Component<RouteComponentProps<IMapProps>, MapState> {
  private _colours: THREE.Color[];

  constructor(props: RouteComponentProps<IMapProps>) {
    super(props);
    this.state = new MapState();

    // Generate my standard colours
    this._colours = [];
    for (var i = 0; i < 6; ++i) {
      var colour = new THREE.Color();
      colour.setHSL((i + 0.5) / 6.0, 0.5, 0.2);
      this._colours.push(colour);
    }
  }

  // Gets our standard colours.
  get hexColours(): string[] {
    return this._colours.map(c => "#" + c.getHexString());
  }

  render() {
    return (
      <div>
        <Navigation />
        <MapControls colours={this.hexColours}
          getEditMode={() => this.state.editMode}
          setEditMode={(v) => { this.setState({ editMode: v }); }}
          getSelectedColour={() => this.state.selectedColour}
          setSelectedColour={(v) => { this.setState({ selectedColour: v }); }} />
        <div className="Map-content">
          <Drawing colours={this._colours} geometry={this.props.match.params.geometry}
            getEditMode={() => this.state.editMode}
            getSelectedColour={() => this.state.selectedColour} />
        </div>
      </div>
    );
  }
}

export default Map;
