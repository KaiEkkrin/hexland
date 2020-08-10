import { IChange, ITokenRemove, ChangeType, ChangeCategory, ITokenAdd, ITokenMove } from '../data/change';
import { trackChanges } from '../data/changeTracking';
import { IGridCoord, IGridEdge, coordAdd, coordsEqual, coordSub } from '../data/coord';
import { IToken } from '../data/feature';
import { IMap, MapType } from '../data/map';
import { Areas } from './areas';
import { MapColouring } from './colouring';
import { EdgeHighlighter, FaceHighlighter } from './dragHighlighter';
import { FeatureColour } from './featureColour';
import { Grid } from './grid';
import { IGridGeometry} from './gridGeometry';
import { HexGridGeometry } from './hexGridGeometry';
import * as LoS from './los';
import { MapChangeTracker } from './mapChangeTracker';
import { MapColourVisualisation } from './mapColourVisualisation';
import { RedrawFlag } from './redrawFlag';
import { SquareGridGeometry } from './squareGridGeometry';
import { TextCreator } from './textCreator';
import { Tokens } from './tokens';
import { Walls } from './walls';

import * as THREE from 'three';

const areaZ = 0.5;
const tokenZ = 0.6;
const wallZ = 0.6;
const gridZ = 0.7;
const losZ = 0.8;
const selectionZ = 1.0;
const highlightZ = 1.1;
const textZ = 1.5; // for some reason the text doesn't alpha blend correctly; putting it
                   // on top seems to look fine

const wallAlpha = 0.15;
const edgeAlpha = 0.5;
const tokenAlpha = 0.7;
const selectionAlpha = 0.9;
const losAlpha = 1.0;
const areaAlpha = 1.0;

const spacing = 75.0;
const tileDim = 12;

const zoomStep = 1.001;
const zoomMin = 1;
const zoomMax = 4;
const rotationStep = 0.004;

// A container for the entirety of the drawing.
// Remember to call dispose() when this drawing is no longer in use!
export class ThreeDrawing {
  private readonly _map: IMap;
  private readonly _uid: string;

  private readonly _gridGeometry: IGridGeometry;
  private readonly _mount: HTMLDivElement;

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
  private readonly _los: LoS.LoS;
  private readonly _selection: Areas;
  private readonly _selectionDrag: Areas; // a copy of the selection shown only while dragging it
  private readonly _selectionDragRed: Areas; // likewise, but shown if the selection couldn't be dropped there
  private readonly _tokens: Tokens;
  private readonly _walls: Walls;

  private readonly _mapColouring: MapColouring;
  private readonly _mapColourVisualisation: MapColourVisualisation;

  private readonly _darkColourMaterials: THREE.MeshBasicMaterial[];
  private readonly _lightColourMaterials: THREE.MeshBasicMaterial[];
  private readonly _losMaterials: THREE.MeshBasicMaterial[];
  private readonly _selectionMaterials: THREE.MeshBasicMaterial[];
  private readonly _invalidSelectionMaterials: THREE.MeshBasicMaterial[];
  private readonly _textMaterial: THREE.MeshBasicMaterial;

  private readonly _gridNeedsRedraw: RedrawFlag;
  private readonly _needsRedraw: RedrawFlag;

  private readonly _changeTracker: MapChangeTracker;

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

  private _showMapColourVisualisation = false;

  private _disposed: boolean = false;

  constructor(colours: FeatureColour[], mount: HTMLDivElement, textCreator: TextCreator, map: IMap, uid: string) {
    this._map = map;
    this._uid = uid;

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
    this._renderer.setClearColor(new THREE.Color(0.1, 0.1, 0.1)); // a dark grey background will show up LoS
    this._renderer.setSize(this._renderWidth, this._renderHeight, false); // TODO measure actual div size instead?
    mount.appendChild(this._renderer.domElement);
    this._mount = mount;

    this._gridGeometry = map.ty === MapType.Hex ? new HexGridGeometry(spacing, tileDim) : new SquareGridGeometry(spacing, tileDim);
    this._grid = new Grid(this._gridGeometry, this._gridNeedsRedraw, gridZ, edgeAlpha);
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

    // For the LoS, we'll use different blending depending on the map settings -- non-owners in
    // FFA mode should find things out of LoS literally invisible; owners and FFA players shouldn't.
    // The LoS materials are (no visibility, partial visibility, full visibility) in order.
    this._losMaterials = [new THREE.MeshBasicMaterial({
      blending: THREE.MultiplyBlending,
      color: this.seeEverything ? 0x555555 : 0
    }), new THREE.MeshBasicMaterial({
      blending: THREE.MultiplyBlending,
      color: this.seeEverything ? 0xaaaaaa : 0x7f7f7f,
    }), new THREE.MeshBasicMaterial({
      blending: THREE.MultiplyBlending,
      color: 0xffffff, // should do nothing :)
    })];

    // The filled areas
    this._areas = new Areas(this._gridGeometry, this._needsRedraw, areaAlpha, areaZ);
    this._areas.setMaterials(this._darkColourMaterials);
    this._areas.addToScene(this._scene);

    // The highlighted areas
    // (TODO does this need to be a different feature set from the selection?)
    this._highlightedAreas = new Areas(this._gridGeometry, this._needsRedraw, areaAlpha, highlightZ, 100);
    this._highlightedAreas.setMaterials(this._selectionMaterials);
    this._highlightedAreas.addToScene(this._scene);

    // The highlighted walls
    this._highlightedWalls = new Walls(this._gridGeometry, this._needsRedraw, edgeAlpha, highlightZ, 100);
    this._highlightedWalls.setMaterials(this._selectionMaterials);
    this._highlightedWalls.addToScene(this._scene);

    // The LoS
    this._los = new LoS.LoS(this._gridGeometry, this._needsRedraw, losAlpha, losZ, 5000); // TODO could run out really fast!
    this._los.setMaterials(this._losMaterials);
    this._los.addToScene(this._scene);

    // The selection
    this._selection = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selection.setMaterials(this._selectionMaterials);
    this._selection.addToScene(this._scene);
    this._selectionDrag = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selectionDrag.setMaterials(this._selectionMaterials);
    this._selectionDrag.addToScene(this._scene);
    this._selectionDragRed = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selectionDragRed.setMaterials(this._invalidSelectionMaterials);
    this._selectionDragRed.addToScene(this._scene);

    // The tokens
    this._tokens = new Tokens(this._gridGeometry, this._needsRedraw, textCreator, this._textMaterial,
      tokenAlpha, tokenZ, textZ);
    this._tokens.setMaterials(this._lightColourMaterials);
    this._tokens.addToScene(this._scene);

    // The walls
    this._walls = new Walls(this._gridGeometry, this._needsRedraw, wallAlpha, wallZ);
    this._walls.setMaterials(this._lightColourMaterials);
    this._walls.addToScene(this._scene);

    // The highlighters
    this._edgeHighlighter = new EdgeHighlighter(this._walls, this._highlightedWalls);
    this._faceHighlighter = new FaceHighlighter(this._areas, this._highlightedAreas);

    // The map colouring
    // TODO Expand its bounds dynamically as the grid expands
    this._mapColouring = new MapColouring(this._gridGeometry);
    this._mapColouring.expandBounds(
      new THREE.Vector2(-tileDim, -tileDim),
      new THREE.Vector2(2 * tileDim - 1, 2 * tileDim - 1)
    );

    // The map colour visualisation (added on request instead of the areas)
    this._mapColourVisualisation = new MapColourVisualisation(this._gridGeometry, this._needsRedraw, areaAlpha, areaZ);

    // The change tracker
    this._changeTracker = new MapChangeTracker(
      this._areas,
      this._tokens,
      this._walls,
      this._mapColouring,
      () => {
        this.buildLoS(); // TODO avoid this when only walls have changed
        if (this._showMapColourVisualisation === true) {
          this._mapColourVisualisation.clear(); // TODO try to do it incrementally? (requires checking for colour count changes...)
          this._mapColourVisualisation.visualise(this._scene, this._mapColouring);
        }
      }
    );

    this.animate = this.animate.bind(this);
  }

  private get seeEverything() { return this._uid === this._map.owner || this._map.ffa; }

  get changeTracker() { return this._changeTracker; }

  animate() {
    if (this._disposed) {
      return;
    }

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

  private getLoSPositions() {
    // These are the positions we should be projecting line-of-sight from.
    var myTokens = this._tokens.all.filter(t =>
      t.players.find(p => this._uid === p) !== undefined || this.seeEverything);
    var selectedTokens = myTokens.filter(t => this._selection.get(t.position) !== undefined);
    if (selectedTokens.length === 0) {
      if (this.seeEverything) {
        // Render no LoS at all
        return undefined;
      } else {
        // Show the LoS of all my tokens
        return myTokens.map(t => t.position);
      }
    } else {
      // Show the LoS of only the selected tokens
      return selectedTokens.map(t => t.position);
    }
  }

  buildLoS() {
    // TODO can I do this incrementally, or do I need to rebuild on every change?
    // Rebuilding on every change makes it much simpler...
    var positions = this.getLoSPositions();
    console.log("LoS positions: " + positions?.length ?? -1);
    this._los.clear();
    if (positions !== undefined && positions.length > 0) {
      // TODO deal with dynamic grid sizing and all that fun here, create a suitable
      // abstraction!
      positions.forEach(p => {
        var losHere = LoS.create(this._gridGeometry, this._mapColouring, p);
        LoS.combine(this._los, losHere);
      });
    }
  }

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

    return this._tokens.get(position);
  }

  private canDropSelectionAt(position: IGridCoord) {
    if (this._tokenMoveDragStart === undefined) {
      return false;
    }

    // We want to answer true to this query iff actually moving the tokens here would
    // be accepted by the change tracker, and so we create our own change tracker to do this.
    // It's safe for us to use our current areas, walls and map colouring because those won't
    // change, but we need to clone our tokens into a scratch dictionary.
    var delta = coordSub(position, this._tokenMoveDragStart);
    var changes = this._selection.all.map(f => {
      return {
        ty: ChangeType.Move,
        cat: ChangeCategory.Token,
        newPosition: coordAdd(f.position, delta),
        oldPosition: f.position
      };
    });

    var changeTracker = new MapChangeTracker(this._areas, this._tokens.clone(), this._walls, this._mapColouring);
    return trackChanges(this._map, changeTracker, changes, this._uid);
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
      this._selection.forEach(f => {
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
      if (this._tokens.get(position) !== undefined) {
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
      if (this._selection.get(position) !== undefined) {
        this._tokenMoveDragStart = position;
        this._tokenMoveDragSelectionPosition = position;
        this._selectionDrag.clear();
        this._selectionDragRed.clear();
        this._selection.forEach(f => this._selectionDrag.add(f));
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

        if (this._tokens.get(position) !== undefined) {
          this._selection.add({ position: position, colour: 0 });
        }

        this._selectDragStart = undefined;
        this.buildLoS();
      }
    }

    return chs;
  }

  setShowMapColourVisualisation(show: boolean) {
    if (show === this._showMapColourVisualisation) {
      return;
    }

    this._showMapColourVisualisation = show;
    if (show === true) {
      // Remove the area visualisation:
      this._areas.removeFromScene();

      // Add the map colour visualisation based on the current map colours:
      this._mapColourVisualisation.visualise(this._scene, this._mapColouring);
    } else {
      // Remove any map colour visualisation and put the area visualisation back
      this._mapColourVisualisation.removeFromScene();
      this._areas.addToScene(this._scene);
    }
  }

  dispose() {
    if (this._disposed === true) {
      return;
    }

    this._mount.removeChild(this._renderer.domElement);

    this._faceCoordRenderTarget.dispose();
    this._edgeCoordRenderTarget.dispose();
    this._renderer.dispose();

    this._scene.dispose();
    this._faceCoordScene.dispose();
    this._edgeCoordScene.dispose();

    this._grid.dispose();
    this._areas.dispose();
    this._walls.dispose();
    this._highlightedAreas.dispose();
    this._highlightedWalls.dispose();
    this._selection.dispose();
    this._selectionDrag.dispose();
    this._selectionDragRed.dispose();
    this._tokens.dispose();
    this._walls.dispose();
    this._mapColourVisualisation.dispose();

    this._darkColourMaterials.forEach(m => m.dispose());
    this._lightColourMaterials.forEach(m => m.dispose());
    this._losMaterials.forEach(m => m.dispose());
    this._selectionMaterials.forEach(m => m.dispose());
    this._invalidSelectionMaterials.forEach(m => m.dispose());
    this._textMaterial.dispose();

    this._disposed = true;
  }
}