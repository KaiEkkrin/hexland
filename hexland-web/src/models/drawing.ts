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
import { TextCreator } from './textCreator';
import { IToken, Tokens } from './tokens';
import { Walls } from './walls';

import * as THREE from 'three';

const edgeAlpha = 0.5;
const spacing = 75.0;
const tileDim = 12;

// A container for the entirety of the drawing.
// TODO Disposal of the resources used by this when required
export class ThreeDrawing {
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
  private readonly _textMaterial: THREE.MeshBasicMaterial;

  private readonly _gridNeedsRedraw: RedrawFlag;
  private readonly _needsRedraw: RedrawFlag;

  private _selectDragStart: GridCoord | undefined;
  private _tokenMoveDragStart: GridCoord | undefined;
  private _tokenMoveDragSelectionPosition: GridCoord | undefined;

  constructor(colours: FeatureColour[], mount: HTMLDivElement, textCreator: TextCreator, drawHexes: boolean) {
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
    this._scene = new THREE.Scene();
    this._renderer = new THREE.WebGLRenderer();
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(this._renderer.domElement);

    this._gridGeometry = drawHexes ? new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);
    this._grid = new Grid(this._gridGeometry, this._gridNeedsRedraw, edgeAlpha);
    this._grid.addGridToScene(this._scene, 0, 0, 1);

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
    this._selectionMaterials = colours.map(c => new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x606060,
    }));
    this._textMaterial = new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide });

    // The filled areas
    this._areas = new Areas(this._gridGeometry, this._needsRedraw);
    this._areas.addToScene(this._scene, this._darkColourMaterials);

    // The selection
    this._selection = new Selection(this._gridGeometry, this._needsRedraw);
    this._selection.addToScene(this._scene, this._selectionMaterials);
    this._selectionDrag = new Selection(this._gridGeometry, this._needsRedraw);
    this._selectionDrag.addToScene(this._scene, this._selectionMaterials);

    // The tokens
    this._tokens = new Tokens(this._gridGeometry, this._needsRedraw, textCreator, this._textMaterial);
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

  getGridCoordAt(cp: THREE.Vector2): GridCoord | undefined {
    var buf = new Uint8Array(4);
    this._renderer.readRenderTargetPixels(this._faceCoordRenderTarget, cp.x, cp.y, 1, 1, buf);
    return this._gridGeometry?.decodeCoordSample(buf, 0);
  }

  getGridEdgeAt(cp: THREE.Vector2): GridEdge | undefined {
    var buf = new Uint8Array(4);
    this._renderer.readRenderTargetPixels(this._edgeCoordRenderTarget, cp.x, cp.y, 1, 1, buf);
    return this._gridGeometry?.decodeEdgeSample(buf, 0);
  }

  getToken(cp: THREE.Vector2): IToken | undefined {
    var position = this.getGridCoordAt(cp);
    if (position === undefined) {
      return undefined;
    }

    return this._tokens.at(position);
  }

  clearSelection() {
    this._selection.clear();
  }

  hideEdgeHighlight() {
    this._edgeHighlight.move(undefined);
  }

  moveEdgeHighlightTo(cp: THREE.Vector2) {
    var position = this.getGridEdgeAt(cp);
    this._edgeHighlight.move(position);
  }

  hideFaceHighlight() {
    this._faceHighlight.move(undefined);
  }

  moveFaceHighlightTo(cp: THREE.Vector2) {
    var position = this.getGridCoordAt(cp);
    this._faceHighlight.move(position);
  }

  moveSelectionTo(cp: THREE.Vector2) {
    if (this._tokenMoveDragStart === undefined || this._tokenMoveDragSelectionPosition === undefined) {
      return;
    }

    // TODO: Support drag to create a multiple selection.
    var position = this.getGridCoordAt(cp);
    if (position && !position.equals(this._tokenMoveDragSelectionPosition)) {
      var delta = position.toVector(tileDim).sub(this._tokenMoveDragStart.toVector(tileDim));
      this._selectionDrag.clear();
      this._selection.all.forEach(f => {
        var dragged = { position: f.position.addFace(delta, tileDim), colour: f.colour };
        this._selectionDrag.add(dragged);
      });

      this._tokenMoveDragSelectionPosition = position;
    }
  }

  setArea(cp: THREE.Vector2, colour: number) {
    var position = this.getGridCoordAt(cp);
    if (position) {
      if (colour < 0) {
        this._areas.remove(position);
      } else {
        this._areas.add({ position: position, colour: colour });
      }
    }
  }

  setToken(cp: THREE.Vector2, colour: number, text: string) {
    var position = this.getGridCoordAt(cp);
    if (position) {
      this._tokens.remove(position); // replace any existing token
      if (colour >= 0) {
        this._tokens.add({ position: position, colour: colour, text: text, textMesh: undefined });
      }
    }
  }

  setWall(cp: THREE.Vector2, colour: number) {
    var position = this.getGridEdgeAt(cp);
    if (position) {
      if (colour < 0) {
        this._walls.remove(position);
      } else {
        this._walls.add({ position: position, colour: colour });
      }
    }
  }

  selectionDragStart(cp: THREE.Vector2) {
    var position = this.getGridCoordAt(cp);
    if (position) {
      if (this._selection.at(position) !== undefined) {
        this._tokenMoveDragStart = position;
        this._tokenMoveDragSelectionPosition = position;
        this._selectionDrag.clear();
        this._selection.all.forEach(f => this._selectionDrag.add(f));
      } else {
        this._selectDragStart = position;
      }
    }
  }

  selectionDragEnd(cp: THREE.Vector2, shiftKey: boolean) {
    var position = this.getGridCoordAt(cp);
    if (position) {
      if (this._tokenMoveDragStart !== undefined) {
        // TODO: Fix it so that I can't drop tokens on top of each other, thereby deleting
        // the token that used to be on the spot.
        // (Will require a bit of finesse!  Especially with multiple selection.)
        var delta = position.toVector(tileDim).sub(this._tokenMoveDragStart.toVector(tileDim));
        this._selectionDrag.clear();

        // To avoid overlap deletions, we need to first pick up every token, and then
        // put them all down again:
        this._selection.all.map(t => this._tokens.remove(t.position))
          .forEach(f => {
            if (f !== undefined) {
              f.position = f.position.addFace(delta, tileDim);
              this._tokens.add(f);
            }
          });
        this._selection.all.map(t => this._selection.remove(t.position))
          .forEach(f => {
            if (f !== undefined) {
              this._selection.add({ position: f.position.addFace(delta, tileDim), colour: f.colour });
            }
          });

        this._tokenMoveDragStart = undefined;
        this._tokenMoveDragSelectionPosition = undefined;
      }

      if (this._selectDragStart !== undefined) {
        if (!shiftKey) {
          this._selection.clear();
        }

        if (this._tokens.at(position) !== undefined) {
          this._selection.add({ position: position, colour: 0 });
        }

        this._selectDragStart = undefined;
      }
    }
  }
}