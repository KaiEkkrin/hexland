import { IAreaAdd, IWallAdd, IChange, ITokenRemove, ChangeType, ChangeCategory, ITokenAdd, ITokenMove } from '../data/change';
import { IChangeTracker } from '../data/changeTracking';
import { IGridCoord, IGridEdge, coordAdd, coordsEqual, coordSub } from '../data/coord';
import { IToken, IFeature } from '../data/feature';
import { Areas } from './areas';
import { EdgeHighlighter, FaceHighlighter } from './dragHighlighter';
import { FeatureColour } from './featureColour';
import { Grid } from './grid';
import { IGridGeometry} from './gridGeometry';
import { HexGridGeometry } from './hexGridGeometry';
import { RedrawFlag } from './redrawFlag';
import { SquareGridGeometry } from './squareGridGeometry';
import { TextCreator } from './textCreator';
import { IInstancedToken, Tokens } from './tokens';
import { Walls } from './walls';

import * as THREE from 'three';

const areaZ = 0.5;
const tokenZ = 0.6;
const wallZ = 0.6;
const selectionZ = 1.0;
const highlightZ = 1.1;
const textZ = 1.5; // for some reason the text doesn't alpha blend correctly; putting it
                   // on top seems to look fine

const wallAlpha = 0.15;
const edgeAlpha = 0.5;
const tokenAlpha = 0.7;
const selectionAlpha = 0.9;
const areaAlpha = 1.0;

const spacing = 75.0;
const tileDim = 12;

const zoomStep = 1.001;
const zoomMin = 1;
const zoomMax = 4;
const rotationStep = 0.004;

// A container for the entirety of the drawing.
// TODO Disposal of the resources used by this when required
export class ThreeDrawing implements IChangeTracker {
  private readonly _gridGeometry: IGridGeometry;

  private readonly _camera: THREE.OrthographicCamera;
  private readonly _faceCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _edgeCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _renderer: THREE.WebGLRenderer;

  private readonly _scene: THREE.Scene;
  private readonly _faceCoordScene: THREE.Scene;
  private readonly _edgeCoordScene: THREE.Scene;

  private readonly _grid: Grid;
  private readonly _areas: Areas;
  private readonly _highlightedAreas: Areas;
  private readonly _highlightedWalls: Walls;
  private readonly _selection: Areas;
  private readonly _selectionDrag: Areas; // a copy of the selection shown only while dragging it
  private readonly _selectionDragRed: Areas; // likewise, but shown if the selection couldn't be dropped there
  private readonly _tokens: Tokens;
  private readonly _walls: Walls;

  private readonly _darkColourMaterials: THREE.MeshBasicMaterial[];
  private readonly _lightColourMaterials: THREE.MeshBasicMaterial[];
  private readonly _selectionMaterials: THREE.MeshBasicMaterial[];
  private readonly _invalidSelectionMaterials: THREE.MeshBasicMaterial[];
  private readonly _textMaterial: THREE.MeshBasicMaterial;

  private readonly _gridNeedsRedraw: RedrawFlag;
  private readonly _needsRedraw: RedrawFlag;

  private _zoom: number;
  private _rotation: number;
  private _panX: number;
  private _panY: number;

  private _renderWidth: number;
  private _renderHeight: number;

  private _zoomRotateLast: THREE.Vector2 | undefined;
  private _isRotating: boolean = false;
  private _panLast: THREE.Vector2 | undefined;

  private _edgeHighlighter: EdgeHighlighter;
  private _faceHighlighter: FaceHighlighter;

  private _selectDragStart: IGridCoord | undefined;
  private _tokenMoveDragStart: IGridCoord | undefined;
  private _tokenMoveDragSelectionPosition: IGridCoord | undefined;

  constructor(colours: FeatureColour[], mount: HTMLDivElement, textCreator: TextCreator, drawHexes: boolean) {
    this._zoom = 2;
    this._rotation = 0;
    this._panX = 0;
    this._panY = 0;

    this._renderWidth = Math.max(1, Math.floor(window.innerWidth));
    this._renderHeight = Math.max(1, Math.floor(window.innerHeight));

    const left = this._panX + this._renderWidth / -this._zoom;
    const right = this._panX + this._renderWidth / this._zoom;
    const top = this._panY + this._renderHeight / -this._zoom;
    const bottom = this._panY + this._renderHeight / this._zoom;
    this._camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 1000);
    this._camera.position.z = 5;
    this._camera.setRotationFromAxisAngle(new THREE.Vector3(0, 0, 1), this._rotation);

    this._gridNeedsRedraw = new RedrawFlag();
    this._needsRedraw = new RedrawFlag();

    this._scene = new THREE.Scene();
    this._renderer = new THREE.WebGLRenderer();
    this._renderer.setSize(this._renderWidth, this._renderHeight, false); // TODO measure actual div size instead?
    mount.appendChild(this._renderer.domElement);

    this._gridGeometry = drawHexes ? new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);
    this._grid = new Grid(this._gridGeometry, this._gridNeedsRedraw, edgeAlpha);
    this._grid.addGridToScene(this._scene, 0, 0, 1);

    // Texture of face co-ordinates within the tile.
    this._faceCoordScene = new THREE.Scene();
    this._faceCoordRenderTarget = new THREE.WebGLRenderTarget(this._renderWidth, this._renderHeight);
    this._grid.addCoordColoursToScene(this._faceCoordScene, 0, 0, 1);

    // Texture of edge co-ordinates within the tile.
    this._edgeCoordScene = new THREE.Scene();
    this._edgeCoordRenderTarget = new THREE.WebGLRenderTarget(this._renderWidth, this._renderHeight);
    this._grid.addEdgeColoursToScene(this._edgeCoordScene, 0, 0, 1);

    this._darkColourMaterials = colours.map(c => new THREE.MeshBasicMaterial({ color: c.dark.getHex() }));
    this._lightColourMaterials = colours.map(c => new THREE.MeshBasicMaterial({ color: c.light.getHex() }));
    this._selectionMaterials = [new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x606060,
    })];
    this._invalidSelectionMaterials = [new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x600000,
    })];
    this._textMaterial = new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide });

    // The filled areas
    this._areas = new Areas(this._gridGeometry, this._needsRedraw, areaAlpha, areaZ);
    this._areas.addToScene(this._scene, this._darkColourMaterials);

    // The highlighted areas
    // (TODO does this need to be a different feature set from the selection?)
    this._highlightedAreas = new Areas(this._gridGeometry, this._needsRedraw, areaAlpha, highlightZ, 100);
    this._highlightedAreas.addToScene(this._scene, this._selectionMaterials);

    // The highlighted walls
    this._highlightedWalls = new Walls(this._gridGeometry, this._needsRedraw, edgeAlpha, highlightZ, 100);
    this._highlightedWalls.addToScene(this._scene, this._selectionMaterials);

    // The selection
    this._selection = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selection.addToScene(this._scene, this._selectionMaterials);
    this._selectionDrag = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selectionDrag.addToScene(this._scene, this._selectionMaterials);
    this._selectionDragRed = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selectionDragRed.addToScene(this._scene, this._invalidSelectionMaterials);

    // The tokens
    this._tokens = new Tokens(this._gridGeometry, this._needsRedraw, textCreator, this._textMaterial,
      tokenAlpha, tokenZ, textZ);
    this._tokens.addToScene(this._scene, this._lightColourMaterials);

    // The walls
    this._walls = new Walls(this._gridGeometry, this._needsRedraw, wallAlpha, wallZ);
    this._walls.addToScene(this._scene, this._lightColourMaterials);

    // The highlighters
    this._edgeHighlighter = new EdgeHighlighter(this._walls, this._highlightedWalls);
    this._faceHighlighter = new FaceHighlighter(this._areas, this._highlightedAreas);

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

  // == IChangeTracker implementation ==

  areaAdd(feature: IFeature<IGridCoord>) {
    return this._areas.add(feature);
  }

  areaRemove(position: IGridCoord) {
    return this._areas.remove(position);
  }

  tokenAdd(feature: IToken) {
    return this._tokens.add(feature as IInstancedToken);
  }

  tokenRemove(position: IGridCoord) {
    return this._tokens.remove(position);
  }

  wallAdd(feature: IFeature<IGridEdge>) {
    return this._walls.add(feature);
  }

  wallRemove(position: IGridEdge) {
    return this._walls.remove(position);
  }

  getConsolidated(): IChange[] {
    var all: IChange[] = [];
    this._areas.all.forEach(v => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Area,
      feature: v
    } as IAreaAdd));
    
    this._tokens.all.forEach(v => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: v
    } as ITokenAdd));

    this._walls.all.forEach(v => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Wall,
      feature: v
    } as IWallAdd));

    return all;
  }

  // == Other things ==

  resize() {
    var width = Math.max(1, Math.floor(window.innerWidth));
    var height = Math.max(1, Math.floor(window.innerHeight));

    this._renderer.setSize(width, height, false);
    this._edgeCoordRenderTarget.setSize(width, height);
    this._faceCoordRenderTarget.setSize(width, height);

    this._camera.left = this._panX + width / -this._zoom;
    this._camera.right = this._panX + width / this._zoom;
    this._camera.top = this._panY + height / -this._zoom;
    this._camera.bottom = this._panY + height / this._zoom;
    this._camera.setRotationFromAxisAngle(new THREE.Vector3(0, 0, 1), this._rotation);
    this._camera.updateProjectionMatrix();

    // TODO Also add or remove grid tiles as required

    this._renderWidth = width;
    this._renderHeight = height;
    this._needsRedraw.setNeedsRedraw();
    this._gridNeedsRedraw.setNeedsRedraw();
  }

  resetView() {
    this._zoom = 2;
    this._rotation = 0;
    this._panX = 0;
    this._panY = 0;
    this.resize();
  }

  zoomRotateEnd() {
    this._zoomRotateLast = undefined;
  }

  zoomRotateStart(cp: THREE.Vector2, rotate: boolean) {
    this._zoomRotateLast = cp;
    this._isRotating = rotate;
  }

  zoomRotateTo(cp: THREE.Vector2) {
    if (this._zoomRotateLast === undefined) {
      return;
    }

    if (this._isRotating === true) {
      this._rotation -= (cp.x - this._zoomRotateLast.x) * rotationStep;
    } else {
      this._zoom = Math.min(zoomMax, Math.max(zoomMin, this._zoom * Math.pow(zoomStep, cp.y - this._zoomRotateLast.y)));
    }

    this.resize();
    this._zoomRotateLast = cp;
  }

  panEnd() {
    this._panLast = undefined;
  }

  panStart(cp: THREE.Vector2) {
    this._panLast = cp;
  }

  panTo(cp: THREE.Vector2) {
    if (this._panLast === undefined) {
      return;
    }

    this._panX -= (cp.x - this._panLast.x);
    this._panY += (cp.y - this._panLast.y);
    this.resize();
    this._panLast = cp;
  }

  getGridCoordAt(cp: THREE.Vector2): IGridCoord | undefined {
    var buf = new Uint8Array(4);
    this._renderer.readRenderTargetPixels(this._faceCoordRenderTarget, cp.x, cp.y, 1, 1, buf);
    return this._gridGeometry?.decodeCoordSample(buf, 0);
  }

  getGridEdgeAt(cp: THREE.Vector2): IGridEdge | undefined {
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

  private canDropSelectionAt(position: IGridCoord) {
    if (this._tokenMoveDragStart === undefined) {
      return false;
    }

    // We can't drop a selection at this position if it would overwrite any un-selected
    // tokens:
    var delta = coordSub(position, this._tokenMoveDragStart);
    return this._selection.all.reduce((ok, f) => {
      var moved = coordAdd(f.position, delta);
      var alreadyThere = this._tokens.at(moved);
      return (ok && (alreadyThere === undefined || this._selection.at(moved) !== undefined));
    }, true);
  }

  clearSelection() {
    this._selection.clear();
  }

  edgeDragStart(cp: THREE.Vector2) {
    this._edgeHighlighter.dragStart(this.getGridEdgeAt(cp));
  }

  edgeDragEnd(cp: THREE.Vector2, colour: number): IChange[] {
    return this._edgeHighlighter.dragEnd(this.getGridEdgeAt(cp), colour);
  }

  faceDragStart(cp: THREE.Vector2) {
    this._faceHighlighter.dragStart(this.getGridCoordAt(cp));
  }

  faceDragEnd(cp: THREE.Vector2, colour: number): IChange[] {
    return this._faceHighlighter.dragEnd(this.getGridCoordAt(cp), colour);
  }

  moveEdgeHighlightTo(cp: THREE.Vector2) {
    this._edgeHighlighter.moveHighlight(this.getGridEdgeAt(cp));
  }

  moveFaceHighlightTo(cp: THREE.Vector2) {
    this._faceHighlighter.moveHighlight(this.getGridCoordAt(cp));
  }

  moveSelectionTo(cp: THREE.Vector2) {
    if (this._tokenMoveDragStart === undefined || this._tokenMoveDragSelectionPosition === undefined) {
      return;
    }

    // TODO: Support drag to create a multiple selection.
    var position = this.getGridCoordAt(cp);
    if (position !== undefined && !coordsEqual(position, this._tokenMoveDragSelectionPosition)) {
      var selectionDrag = this.canDropSelectionAt(position) ? this._selectionDrag :
        this._selectionDragRed;

      var delta = coordSub(position, this._tokenMoveDragStart);
      this._selectionDrag.clear();
      this._selectionDragRed.clear();
      console.log("Moving " + this._selection.all.length + " selected positions");
      this._selection.all.forEach(f => {
        var dragged = { position: coordAdd(f.position, delta), colour: f.colour };
        console.log(f.position.toString() + " -> " + dragged.position.toString());
        selectionDrag.add(dragged);
      });

      this._tokenMoveDragSelectionPosition = position;
    }
  }

  setToken(cp: THREE.Vector2, colour: number, text: string, playerIds: string[]): IChange[] {
    var position = this.getGridCoordAt(cp);
    var chs: IChange[] = [];
    if (position !== undefined) {
      if (this._tokens.at(position) !== undefined) {
        // Replace the existing token
        chs.push({
          ty: ChangeType.Remove,
          cat: ChangeCategory.Token,
          position: position
        } as ITokenRemove);
      }

      if (colour >= 0) {
        chs.push({
          ty: ChangeType.Add,
          cat: ChangeCategory.Token,
          feature: {
            position: position,
            colour: colour,
            text: text,
            players: playerIds
          }
        } as ITokenAdd);
      }
    }

    return chs;
  }

  selectionDragStart(cp: THREE.Vector2) {
    var position = this.getGridCoordAt(cp);
    if (position) {
      if (this._selection.at(position) !== undefined) {
        this._tokenMoveDragStart = position;
        this._tokenMoveDragSelectionPosition = position;
        this._selectionDrag.clear();
        this._selectionDragRed.clear();
        this._selection.all.forEach(f => this._selectionDrag.add(f));
      } else {
        this._selectDragStart = position;
      }
    }
  }

  selectionDragEnd(cp: THREE.Vector2, shiftKey: boolean): IChange[] {
    var position = this.getGridCoordAt(cp);
    var chs: IChange[] = [];
    if (position) {
      if (this._tokenMoveDragStart !== undefined) {
        var delta = coordSub(position, this._tokenMoveDragStart);
        this._selectionDrag.clear();
        this._selectionDragRed.clear();

        if (this.canDropSelectionAt(position)) {
          // Create commands that move all the tokens
          chs.push(...this._selection.all.map(t => {
            return {
              ty: ChangeType.Move,
              cat: ChangeCategory.Token,
              newPosition: coordAdd(t.position, delta),
              oldPosition: t.position
            } as ITokenMove;
          }));

          // Move the selection to the target positions
          this._selection.all.map(t => this._selection.remove(t.position))
            .forEach(f => {
              if (f !== undefined) {
                this._selection.add({ position: coordAdd(f.position, delta), colour: f.colour });
              }
            });
        }

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

    return chs;
  }
}