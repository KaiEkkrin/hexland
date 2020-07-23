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

interface IMapControlsProps {
  getEditMode(): number;
  setEditMode(value: number): void;
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
      </div>
    );
  }
}

interface IDrawingProps {
  geometry: string;
  getEditMode(): number;
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

    this._drawing = new ThreeDrawing(mount, this.drawHexes);
    this._drawing.animate();
  }

  handleMouseDown(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    this._mouseIsDown = true;
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
        this._drawing.addArea(e);
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
}

class Map extends React.Component<RouteComponentProps<IMapProps>, MapState> {
  constructor(props: RouteComponentProps<IMapProps>) {
    super(props);
    this.state = new MapState();
  }

  render() {
    return (
      <div>
        <Navigation />
        <MapControls getEditMode={() => this.state.editMode} setEditMode={(v) => { this.setState({ editMode: v }); }} />
        <div className="Map-content">
          <Drawing geometry={this.props.match.params.geometry} getEditMode={() => this.state.editMode} />
        </div>
      </div>
    );
  }
}

export default Map;
