import React, { RefObject } from 'react';
import './App.css';
import './Map.css';
import Navigation from './Navigation';

import { HexGrid, SquareGrid } from './models/grid';

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
  private mount: RefObject<HTMLDivElement>;

  constructor(props: IDrawingProps) {
    super(props);
    this.mount = React.createRef();
  }

  private get drawHexes(): boolean {
    return this.props.geometry === "hex";
  }

  componentDidMount() {
    const spacing = 75.0;
    const tileDim = 12;

    var mount = this.mount.current;
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

    var grid = this.drawHexes ? new HexGrid(spacing, tileDim) : new SquareGrid(spacing, tileDim);
    grid.addToScene(scene, 0, 0, 1);

    camera.position.z = 5;
    renderer.render(scene, camera);
  }

  render() {
    return (
      <div ref={this.mount} />
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
