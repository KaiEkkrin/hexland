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
const spacing = 75.0;
const tileDim = 12;

// A container for the entirety of the drawing.
// TODO Disposal of the resources used by this when required
export class ThreeDrawing {
  private readonly _mount: HTMLDivElement;
  private readonly _gridGeometry: IGridGeometry;

  private readonly _camera: THREE.OrthographicCamera;
  private readonly _faceCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _edgeCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _renderer: THREE.WebGLRenderer;

  private readonly _scene: THREE.Scene;
  private readonly _faceCoordScene: THREE.Scene;
  private readonly _edgeCoordScene: THREE.Scene;

  private readonly _grid: Grid;
  private readonly _edgeHighlight: EdgeHighlight;
  private readonly _faceHighlight: FaceHighlight;
  private readonly _areas: Areas;
  private readonly _selection: Selection;
  private readonly _selectionDrag: Selection; // a copy of the selection shown only while dragging it
  private readonly _tokens: Tokens;
  private readonly _walls: Walls;

  private readonly _darkColourMaterials: THREE.MeshBasicMaterial[];
  private readonly _lightColourMaterials: THREE.MeshBasicMaterial[];
  private readonly _selectionMaterials: THREE.MeshBasicMaterial[];

  private readonly _gridNeedsRedraw: RedrawFlag;
  private readonly _needsRedraw: RedrawFlag;

  private _selectDragStart: GridCoord | undefined;
  private _tokenMoveDragStart: GridCoord | undefined;
  private _tokenMoveDragSelectionPosition: GridCoord | undefined;

  constructor(colours: FeatureColour[], mount: HTMLDivElement, drawHexes: boolean) {
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
    this._selectionDrag = new Selection(this._gridGeometry, this._needsRedraw);
    this._selectionDrag.addToScene(this._scene, this._selectionMaterials);

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

  moveSelectionTo<T, E>(e: React.MouseEvent<T, E>) {
    if (this._tokenMoveDragSelectionPosition === undefined) {
      return;
    }

    // TODO: Support multiple selection.  (A bit of a pain, what with not wanting to
    // allow tokens to drop on top of each other, so I can put it off for now.)
    var position = this.getGridCoordAt(e);
    if (position) {
      var delta = position.toVector(tileDim).sub(this._tokenMoveDragSelectionPosition.toVector(tileDim));
      this._selectionDrag.all.forEach(t => {
        this._selectionDrag.move(t, t.addFace(delta, tileDim));
      });

      this._tokenMoveDragSelectionPosition = position;
    }
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

  selectionDragStart<T, E>(e: React.MouseEvent<T, E>) {
    var position = this.getGridCoordAt(e);
    if (position) {
      if (this._selection.at(position) !== undefined) {
        this._tokenMoveDragStart = position;
        this._tokenMoveDragSelectionPosition = position;
        this._selection.all.forEach(c => {
          this._selectionDrag.add(c, 0);
        });
      } else {
        this._selectDragStart = position;
      }
    }
  }

  selectionDragEnd<T, E>(e: React.MouseEvent<T, E>) {
    var position = this.getGridCoordAt(e);
    if (position) {
      if (this._tokenMoveDragStart !== undefined) {
        // TODO: Fix it so that I can't drop tokens on top of each other.
        // (Will require a bit of finesse!  Especially with multiple selection.)
        var delta = position.toVector(tileDim).sub(this._tokenMoveDragStart.toVector(tileDim));
        this._selectionDrag.clear();
        this._selection.all.forEach(t => {
          var destination = t.addFace(delta, tileDim);
          this._selection.move(t, destination);
          this._tokens.move(t, destination);
        });

        this._tokenMoveDragStart = undefined;
        this._tokenMoveDragSelectionPosition = undefined;
      }

      if (this._selectDragStart !== undefined) {
        if (this._tokens.at(position) !== undefined) {
          this._selection.add(position, 0);
        } else {
          this._selection.clear();
        }

        this._selectDragStart = undefined;
      }
    }
  }
}