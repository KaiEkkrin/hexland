import { Grid } from './grid';
import { IGridGeometry, GridCoord } from './gridGeometry';
import { HexGridGeometry } from './hexGridGeometry';
import { FaceHighlight } from './highlight';
import { SquareGridGeometry } from './squareGridGeometry';

import * as THREE from 'three';

// A container for the entirety of the drawing.
// TODO Disposal of the resources used by this when required
export class ThreeDrawing {
  private _mount: HTMLDivElement;
  private _gridGeometry: IGridGeometry;

  private _camera: THREE.OrthographicCamera;
  private _faceCoordRenderTarget: THREE.WebGLRenderTarget;
  private _renderer: THREE.WebGLRenderer;

  private _scene: THREE.Scene;
  private _faceCoordScene: THREE.Scene;

  private _grid: Grid;
  private _faceHighlight: FaceHighlight;

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
    this._grid = new Grid(this._gridGeometry);
    this._grid.addGridToScene(this._scene, 0, 0, 1);
    //grid.addSolidToScene(this._scene, 0, 0, 1);

    // Texture of face co-ordinates within the tile.
    this._faceCoordScene = new THREE.Scene();
    this._faceCoordRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    this._grid.addCoordColoursToScene(this._faceCoordScene, 0, 0, 1);

    // The face highlight
    this._faceHighlight = new FaceHighlight(this._gridGeometry);
    this._faceHighlight.addToScene(this._scene);

    this.animate = this.animate.bind(this);
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Don't re-render the visible scene unless something changed:
    // (Careful -- don't chain these method calls up with ||, it's important
    // I actually call each one and don't skip later ones if an early one returned
    // true)
    var gridNeedsRedraw = this._grid.needsRedraw();
    var faceHighlightNeedsRedraw = this._faceHighlight.needsRedraw();

    if (gridNeedsRedraw || faceHighlightNeedsRedraw) {
      this._renderer.render(this._scene, this._camera);
    }

    if (gridNeedsRedraw) {
      this._renderer.setRenderTarget(this._faceCoordRenderTarget);
      this._renderer.render(this._faceCoordScene, this._camera);
      this._renderer.setRenderTarget(null);
    }
  }

  getGridCoordAt<T, E>(e: React.MouseEvent<T, E>): GridCoord {
    var bounds = this._mount.getBoundingClientRect();
    var x = e.clientX - bounds.left;
    var y = e.clientY - bounds.top;

    var buf = new Uint8Array(4);
    this._renderer.readRenderTargetPixels(this._faceCoordRenderTarget, x, bounds.height - y - 1, 1, 1, buf);
    return this._gridGeometry?.decodeCoordSample(buf, 0);
  }

  hideFaceHighlight() {
    this._faceHighlight.move(undefined);
  }

  moveFaceHighlightTo<T, E>(e: React.MouseEvent<T, E>) {
    var position = this.getGridCoordAt(e);
    this._faceHighlight.move(position);
  }
}