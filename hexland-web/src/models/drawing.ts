import { GridCoord, GridEdge } from '../data/coord';
import { Areas } from './areas';
import { Grid } from './grid';
import { FeatureColour } from './featureColour';
import { IGridGeometry} from './gridGeometry';
import { HexGridGeometry } from './hexGridGeometry';
import { FaceHighlight, EdgeHighlight } from './highlight';
import { RedrawFlag } from './redrawFlag';
import { Selection } from './selection';
import { SquareGridGeometry } from './squareGridGeometry';
import { Tokens } from './tokens';
import { Walls } from './walls';

import * as THREE from 'three';

const edgeAlpha = 0.5;

// A container for the entirety of the drawing.
// TODO Disposal of the resources used by this when required
export class ThreeDrawing {
  private _mount: HTMLDivElement;
  private _gridGeometry: IGridGeometry;

  private _camera: THREE.OrthographicCamera;
  private _faceCoordRenderTarget: THREE.WebGLRenderTarget;
  private _edgeCoordRenderTarget: THREE.WebGLRenderTarget;
  private _renderer: THREE.WebGLRenderer;

  private _scene: THREE.Scene;
  private _faceCoordScene: THREE.Scene;
  private _edgeCoordScene: THREE.Scene;

  private _grid: Grid;
  private _edgeHighlight: EdgeHighlight;
  private _faceHighlight: FaceHighlight;
  private _areas: Areas;
  private _selection: Selection;
  private _tokens: Tokens;
  private _walls: Walls;

  private _darkColourMaterials: THREE.MeshBasicMaterial[];
  private _lightColourMaterials: THREE.MeshBasicMaterial[];
  private _selectionMaterials: THREE.MeshBasicMaterial[];

  private _gridNeedsRedraw: RedrawFlag;
  private _needsRedraw: RedrawFlag;

  constructor(colours: FeatureColour[], mount: HTMLDivElement, drawHexes: boolean) {
    const spacing = 75.0;
    const tileDim = 12;

    const left = window.innerWidth / -2;
    const right = window.innerWidth / 2;
    const top = window.innerHeight / -2;
    const bottom = window.innerHeight / 2;
    this._camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000);
    this._camera.position.z = 5;

    this._gridNeedsRedraw = new RedrawFlag();
    this._needsRedraw = new RedrawFlag();

    // TODO use the bounding rect of `mount` instead of window.innerWidth and window.innerHeight;
    // except, it's not initialised yet (?)
    this._mount = mount;
    this._scene = new THREE.Scene();
    this._renderer = new THREE.WebGLRenderer();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(this._renderer.domElement);

    this._gridGeometry = drawHexes ? new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);
    this._grid = new Grid(this._gridGeometry, this._gridNeedsRedraw, edgeAlpha);
    this._grid.addGridToScene(this._scene, 0, 0, 1);
    //grid.addSolidToScene(this._scene, 0, 0, 1);

    // Texture of face co-ordinates within the tile.
    this._faceCoordScene = new THREE.Scene();
    this._faceCoordRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    this._grid.addCoordColoursToScene(this._faceCoordScene, 0, 0, 1);

    // Texture of edge co-ordinates within the tile.
    this._edgeCoordScene = new THREE.Scene();
    this._edgeCoordRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    this._grid.addEdgeColoursToScene(this._edgeCoordScene, 0, 0, 1);

    // The edge highlight
    this._edgeHighlight = new EdgeHighlight(this._gridGeometry, this._needsRedraw, edgeAlpha);
    this._edgeHighlight.addToScene(this._scene);

    // The face highlight
    this._faceHighlight = new FaceHighlight(this._gridGeometry, this._needsRedraw);
    this._faceHighlight.addToScene(this._scene);

    this._darkColourMaterials = colours.map(c => new THREE.MeshBasicMaterial({ color: c.dark.getHex() }));
    this._lightColourMaterials = colours.map(c => new THREE.MeshBasicMaterial({ color: c.light.getHex() }));
    this._selectionMaterials = colours.map(c => new THREE.MeshBasicMaterial({ color: 0xb0b0b0 }));

    // The filled areas
    this._areas = new Areas(this._gridGeometry, this._needsRedraw);
    this._areas.addToScene(this._scene, this._darkColourMaterials);

    // The selection
    this._selection = new Selection(this._gridGeometry, this._needsRedraw);
    this._selection.addToScene(this._scene, this._selectionMaterials);

    // The tokens
    this._tokens = new Tokens(this._gridGeometry, this._needsRedraw);
    this._tokens.addToScene(this._scene, this._lightColourMaterials);

    // The walls
    this._walls = new Walls(this._gridGeometry, this._needsRedraw);
    this._walls.addToScene(this._scene, this._lightColourMaterials);

    this.animate = this.animate.bind(this);
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Don't re-render the visible scene unless something changed:
    // (Careful -- don't chain these method calls up with ||, it's important
    // I actually call each one and don't skip later ones if an early one returned
    // true)
    var needsRedraw = this._needsRedraw.needsRedraw();
    var gridNeedsRedraw = this._gridNeedsRedraw.needsRedraw();

    if (needsRedraw) {
      this._renderer.render(this._scene, this._camera);
    }

    if (gridNeedsRedraw) {
      this._renderer.setRenderTarget(this._faceCoordRenderTarget);
      this._renderer.render(this._faceCoordScene, this._camera);

      this._renderer.setRenderTarget(this._edgeCoordRenderTarget);
      this._renderer.render(this._edgeCoordScene, this._camera);

      this._renderer.setRenderTarget(null);
    }
  }

  getGridCoordAt<T, E>(e: React.MouseEvent<T, E>): GridCoord | undefined {
    var bounds = this._mount.getBoundingClientRect();
    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;

    var buf = new Uint8Array(4);
    this._renderer.readRenderTargetPixels(this._faceCoordRenderTarget, x, bounds.height - y - 1, 1, 1, buf);
    return this._gridGeometry?.decodeCoordSample(buf, 0);
  }

  getGridEdgeAt<T, E>(e: React.MouseEvent<T, E>): GridEdge | undefined {
    var bounds = this._mount.getBoundingClientRect();
    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;

    var buf = new Uint8Array(4);
    this._renderer.readRenderTargetPixels(this._edgeCoordRenderTarget, x, bounds.height - y - 1, 1, 1, buf);
    return this._gridGeometry?.decodeEdgeSample(buf, 0);
  }

  addToSelection<T, E>(e: React.MouseEvent<T, E>) {
    var position = this.getGridCoordAt(e);
    if (position && this._tokens.at(position) !== undefined) {
      this._selection.add(position, 0);
    }
  }

  clearSelection() {
    this._selection.clear();
  }

  hideEdgeHighlight() {
    this._edgeHighlight.move(undefined);
  }

  moveEdgeHighlightTo<T, E>(e: React.MouseEvent<T, E>) {
    var position = this.getGridEdgeAt(e);
    this._edgeHighlight.move(position);
  }

  hideFaceHighlight() {
    this._faceHighlight.move(undefined);
  }

  moveFaceHighlightTo<T, E>(e: React.MouseEvent<T, E>) {
    var position = this.getGridCoordAt(e);
    this._faceHighlight.move(position);
  }

  setArea<T, E>(e: React.MouseEvent<T, E>, colour: number) {
    var position = this.getGridCoordAt(e);
    if (position) {
      if (colour < 0) {
        this._areas.remove(position);
      } else {
        this._areas.add(position, colour);
      }
    }
  }

  setToken<T, E>(e: React.MouseEvent<T, E>, colour: number) {
    var position = this.getGridCoordAt(e);
    if (position) {
      if (colour < 0) {
        this._tokens.remove(position);
      } else {
        this._tokens.add(position, colour);
      }
    }
  }

  setWall<T, E>(e: React.MouseEvent<T, E>, colour: number) {
    var position = this.getGridEdgeAt(e);
    if (position) {
      if (colour < 0) {
        this._walls.remove(position);
      } else {
        this._walls.add(position, colour);
      }
    }
  }

  startSelection<T, E>(e: React.MouseEvent<T, E>) {
    this._selection.clear();
    var position = this.getGridCoordAt(e);
    if (position) {
      if (this._tokens.at(position) !== undefined) {
        this._selection.add(position, 0);
      } else {
        this._selection.clear();
      }
    }
  }
}