import React, { RefObject } from 'react';
import './App.css';
import './Map.css';
import Navigation from './Navigation';

import { Grid } from './models/grid';
import { HexGridGeometry, SquareGridGeometry, IGridGeometry } from './models/gridGeometry';

import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';

import { RouteComponentProps } from 'react-router-dom';

import { faDrawPolygon, faMousePointer, faSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import * as THREE from 'three';

class MapControls extends React.Component {
  render() {
    return (
      <div className="Map-controls bg-dark">
        <ButtonGroup toggle vertical>
          <ToggleButton type="radio" variant="dark" value={0}>
            <FontAwesomeIcon icon={faMousePointer} color="white" />
          </ToggleButton>
          <ToggleButton type="radio" variant="dark" value={1}>
            <FontAwesomeIcon icon={faSquare} color="white" />
          </ToggleButton>
          <ToggleButton type="radio" variant="dark" value={2}>
            <FontAwesomeIcon icon={faDrawPolygon} color="white" />
          </ToggleButton>
        </ButtonGroup>
      </div>
    );
  }
}

interface IDrawingProps {
  geometry: string;
}

class Drawing extends React.Component<IDrawingProps> {
  private _mount: RefObject<HTMLDivElement>;
  private _gridGeometry: IGridGeometry | undefined;

  constructor(props: IDrawingProps) {
    super(props);
    this._mount = React.createRef();
    this.handleClick = this.handleClick.bind(this);
  }

  private get drawHexes(): boolean {
    return this.props.geometry === "hex";
  }

  componentDidMount() {
    const spacing = 75.0;
    const tileDim = 12;

    var mount = this._mount.current;
    if (!mount) {
      return;
    }

    var scene = new THREE.Scene();

    const left = window.innerWidth / -2;
    const right = window.innerWidth / 2;
    const top = window.innerHeight / -2;
    const bottom = window.innerHeight / 2;
    var camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000);
    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    this._gridGeometry = this.drawHexes ? new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);
    var grid = new Grid(this._gridGeometry);
    grid.addSolidToScene(scene, 0, 0, 1);

    camera.position.z = 5;
    renderer.render(scene, camera);

    // TODO: Having done this, also render a 4-number texture of the grid and tile
    // co-ordinates, so that I can use that for lookup rather than needing to do maths
    // to reverse the transform :)
  }

  handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!this._gridGeometry) { return; }

    var bounds = document.getElementById("drawingDiv")?.getBoundingClientRect();
    if (!bounds) { return; }

    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;
    alert(x + ', ' + y);
  }

  render() {
    return (
      <div id="drawingDiv" ref={this._mount} onClick={this.handleClick} />
    );
  }
}

function Map(props: RouteComponentProps<IDrawingProps>) {
  return (
    <div>
      <Navigation />
      <MapControls />
      <div className="Map-content">
        <Drawing geometry={props.match.params.geometry} />
      </div>
    </div>
  );
}

export default Map;
