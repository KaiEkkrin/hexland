import React, { RefObject } from 'react';
import './App.css';
import './Map.css';
import Navigation from './Navigation';

import { Grid } from './models/grid';
import { IGridGeometry, GridCoord } from './models/gridGeometry';
import { HexGridGeometry } from './models/hexGridGeometry';
import { SquareGridGeometry } from './models/squareGridGeometry';

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

// TODO Disposal of the resources used by this when required
class ThreeDrawing {
  private _mount: HTMLDivElement;
  private _gridGeometry: IGridGeometry;

  private _camera: THREE.OrthographicCamera;
  private _faceCoordRenderTarget: THREE.WebGLRenderTarget;
  private _renderer: THREE.WebGLRenderer;

  private _scene: THREE.Scene;
  private _faceCoordScene: THREE.Scene;

  constructor(mount: HTMLDivElement, drawHexes: boolean) {
    const spacing = 75.0;
    const tileDim = 12;

    const left = window.innerWidth / -2;
    const right = window.innerWidth / 2;
    const top = window.innerHeight / -2;
    const bottom = window.innerHeight / 2;
    this._camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000);
    this._camera.position.z = 5;

    // TODO use the bounding rect of `mount` instead of window.innerWidth and window.innerHeight;
    // except, it's not initialised yet (?)
    this._mount = mount;
    this._scene = new THREE.Scene();
    this._renderer = new THREE.WebGLRenderer();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(this._renderer.domElement);

    this._gridGeometry = drawHexes ? new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);
    var grid = new Grid(this._gridGeometry);
    //grid.addGridToScene(this._scene, 0, 0, 1);
    grid.addSolidToScene(this._scene, 0, 0, 1);

    // Texture of face co-ordinates within the tile.
    this._faceCoordScene = new THREE.Scene();
    this._faceCoordRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    grid.addCoordColoursToScene(this._faceCoordScene, 0, 0, 1);

    this.animate = this.animate.bind(this);
  }

  animate() {
    requestAnimationFrame(this.animate);

    // TODO Don't re-render unless something changed (?)
    this._renderer.render(this._scene, this._camera);

    this._renderer.setRenderTarget(this._faceCoordRenderTarget);
    this._renderer.render(this._faceCoordScene, this._camera);
    this._renderer.setRenderTarget(null);
  }

  getGridCoordAt<T, E>(e: React.MouseEvent<T, E>): GridCoord {
    var bounds = this._mount.getBoundingClientRect();
    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;

    var buf = new Uint8Array(4);
    this._renderer.readRenderTargetPixels(this._faceCoordRenderTarget, x, bounds.height - y - 1, 1, 1, buf);
    return this._gridGeometry?.decodeCoordSample(buf, 0);
  }
}

interface IDrawingProps {
  geometry: string;
}

class Drawing extends React.Component<IDrawingProps> {
  private _mount: RefObject<HTMLDivElement>;
  private _drawing: ThreeDrawing | undefined;

  constructor(props: IDrawingProps) {
    super(props);
    this._mount = React.createRef();
    this.handleClick = this.handleClick.bind(this);
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

  handleClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (!this._drawing) { return; }

    var bounds = document.getElementById("drawingDiv")?.getBoundingClientRect();
    if (!bounds) { return; }

    var coord = this._drawing.getGridCoordAt(e);
    alert('tile ' + coord.tile.x + ', ' + coord.tile.y + ', face ' + coord.face.x + ', ' + coord.face.y);
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
