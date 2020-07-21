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
  private _hexCoordRenderTarget: THREE.WebGLRenderTarget | undefined;
  private _renderer: THREE.WebGLRenderer | undefined;

  constructor(props: IDrawingProps) {
    super(props);
    this._mount = React.createRef();
    this.handleClick = this.handleClick.bind(this);
  }

  private get camera(): THREE.OrthographicCamera {
    const left = window.innerWidth / -2;
    const right = window.innerWidth / 2;
    const top = window.innerHeight / -2;
    const bottom = window.innerHeight / 2;
    var camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000);
    camera.position.z = 5;
    return camera;
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
    this._renderer = new THREE.WebGLRenderer();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(this._renderer.domElement);

    this._gridGeometry = this.drawHexes ? new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);
    var grid = new Grid(this._gridGeometry);
    grid.addSolidToScene(scene, 0, 0, 1);

    this._renderer.render(scene, this.camera);

    // Texture of hex co-ordinates within the tile.
    // TODO fix the colours :)
    var hexCoordScene = new THREE.Scene();
    this._hexCoordRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    grid.addSolidToScene(hexCoordScene, 0, 0, 1);

    this._renderer.setRenderTarget(this._hexCoordRenderTarget);
    this._renderer.render(scene, this.camera);
    this._renderer.setRenderTarget(null);
  }

  handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!this._hexCoordRenderTarget) { return; }

    var bounds = document.getElementById("drawingDiv")?.getBoundingClientRect();
    if (!bounds) { return; }

    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;

    var buf = new Uint8Array(4);
    this._renderer?.readRenderTargetPixels(this._hexCoordRenderTarget, x, bounds.height - y - 1, 1, 1, buf);

    alert(x + ', ' + y + ' -> ' + buf[0] + ', ' + buf[1] + ', ' + buf[2]);
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
