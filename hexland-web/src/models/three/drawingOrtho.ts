import { IGridCoord, IGridEdge, IGridVertex } from '../../data/coord';
import { MapColouring } from '../colouring';
import { FeatureColour } from '../featureColour';
import { IGridGeometry } from '../gridGeometry';
import { IDrawing } from '../interfaces';
import { RedrawFlag } from '../redrawFlag';

import { Areas } from './areas';
import { Grid } from './grid';
import { LoS } from './los';
import { MapColourVisualisation } from './mapColourVisualisation';
import { OutlinedRectangle } from './overlayRectangle';
import textCreator from './textCreator';
import { Tokens } from './tokens';
import { Vertices } from './vertices';
import { Walls } from './walls';

import * as THREE from 'three';

const areaZ = 0.5;
const tokenZ = 0.6;
const wallZ = 0.6;
const gridZ = 0.7;
const losZ = 0.8;
const selectionZ = 1.0;
const highlightZ = 1.1;
const vertexHighlightZ = 1.2;
const textZ = 1.5; // for some reason the text doesn't alpha blend correctly; putting it
                   // on top seems to look fine
const invalidSelectionZ = 1.6; // must hide the text

const wallAlpha = 0.15;
const edgeAlpha = 0.5;
const vertexAlpha = 0.5;
const tokenAlpha = 0.7;
const selectionAlpha = 0.9;
const losAlpha = 1.0;
const areaAlpha = 1.0;
const vertexHighlightAlpha = 0.35;

// An orthographic implementation of IDrawing using THREE.js.
export class DrawingOrtho implements IDrawing {
  private readonly _gridGeometry: IGridGeometry;
  private readonly _mount: HTMLDivElement;

  private readonly _camera: THREE.OrthographicCamera;
  private readonly _overlayCamera: THREE.OrthographicCamera;
  private readonly _faceCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _edgeCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _vertexCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _renderer: THREE.WebGLRenderer;
  private readonly _canvasClearColour: THREE.Color;
  private readonly _textureClearColour: THREE.Color;

  private readonly _scene: THREE.Scene;
  private readonly _overlayScene: THREE.Scene;
  private readonly _faceCoordScene: THREE.Scene;
  private readonly _edgeCoordScene: THREE.Scene; // TODO after the vertex scene do I still need this?
  private readonly _vertexCoordScene: THREE.Scene;
  private readonly _texelReadBuf = new Uint8Array(4);

  private readonly _grid: Grid;
  private readonly _areas: Areas;
  private readonly _highlightedAreas: Areas;
  private readonly _highlightedVertices: Vertices;
  private readonly _highlightedWalls: Walls;
  private readonly _los: LoS;
  private readonly _selection: Areas;
  private readonly _selectionDrag: Areas; // a copy of the selection shown only while dragging it
  private readonly _selectionDragRed: Areas; // likewise, but shown if the selection couldn't be dropped there
  private readonly _tokens: Tokens;
  private readonly _walls: Walls;
  private readonly _mapColourVisualisation: MapColourVisualisation;

  private readonly _darkColourMaterials: THREE.MeshBasicMaterial[];
  private readonly _lightColourMaterials: THREE.MeshBasicMaterial[];
  private readonly _losMaterials: THREE.MeshBasicMaterial[];
  private readonly _selectionMaterials: THREE.MeshBasicMaterial[];
  private readonly _invalidSelectionMaterials: THREE.MeshBasicMaterial[];
  private readonly _textMaterial: THREE.MeshBasicMaterial;

  private readonly _outlinedRectangle: OutlinedRectangle;

  private readonly _gridNeedsRedraw: RedrawFlag;
  private readonly _needsRedraw: RedrawFlag;

  private readonly _scratchMatrix1 = new THREE.Matrix4();
  private readonly _scratchQuaternion = new THREE.Quaternion();

  private _showMapColourVisualisation = false;
  private _disposed = false;

  constructor(
    gridGeometry: IGridGeometry,
    colours: FeatureColour[],
    mount: HTMLDivElement,
    seeEverything: boolean
  ) {
    this._gridGeometry = gridGeometry;
    this._mount = mount;

    // We need these to initialise things, but they'll be updated dynamically
    const renderWidth = Math.max(1, Math.floor(window.innerWidth));
    const renderHeight = Math.max(1, Math.floor(window.innerHeight));

    this._camera = new THREE.OrthographicCamera(0, 0, renderWidth, renderHeight, 0.1, 1000);
    this._camera.position.z = 5;

    this._overlayCamera = new THREE.OrthographicCamera(0, 0, renderWidth, renderHeight, 0.1, 1000);
    this._overlayCamera.position.z = 5;

    this._gridNeedsRedraw = new RedrawFlag();
    this._needsRedraw = new RedrawFlag();

    this._scene = new THREE.Scene();
    this._overlayScene = new THREE.Scene();
    this._renderer = new THREE.WebGLRenderer();
    this._canvasClearColour = new THREE.Color(0.1, 0.1, 0.1);
    this._textureClearColour = new THREE.Color(0, 0, 0); // we'll flip to this when required
    this._renderer.setClearColor(this._canvasClearColour); // a dark grey background will show up LoS
    mount.appendChild(this._renderer.domElement);
    this._mount = mount;

    this._grid = new Grid(this._gridGeometry, this._gridNeedsRedraw, gridZ, edgeAlpha, vertexAlpha);
    this._grid.addGridToScene(this._scene, 0, 0, 1);

    // Texture of face co-ordinates within the tile.
    this._faceCoordScene = new THREE.Scene();
    this._faceCoordRenderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight);
    this._grid.addCoordColoursToScene(this._faceCoordScene, 0, 0, 1);

    // Texture of edge co-ordinates within the tile.
    this._edgeCoordScene = new THREE.Scene();
    this._edgeCoordRenderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight);
    this._grid.addEdgeColoursToScene(this._edgeCoordScene, 0, 0, 1);

    // Texture of vertex co-ordinates within the tile.
    this._vertexCoordScene = new THREE.Scene();
    this._vertexCoordRenderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight);
    this._grid.addVertexColoursToScene(this._vertexCoordScene, 0, 0, 1);

    this._darkColourMaterials = colours.map(c => new THREE.MeshBasicMaterial({ color: c.dark.getHex() }));
    this._lightColourMaterials = colours.map(c => new THREE.MeshBasicMaterial({ color: c.light.getHex() }));
    this._selectionMaterials = [new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x606060,
    })];
    this._invalidSelectionMaterials = [new THREE.MeshBasicMaterial({ color: 0xa00000 })];
    this._textMaterial = new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide });

    // For the LoS, we'll use different blending depending on the map settings -- non-owners in
    // FFA mode should find things out of LoS literally invisible; owners and FFA players shouldn't.
    // The LoS materials are (no visibility, partial visibility, full visibility) in order.
    this._losMaterials = [new THREE.MeshBasicMaterial({
      blending: THREE.MultiplyBlending,
      color: seeEverything ? 0x555555 : 0
    }), new THREE.MeshBasicMaterial({
      blending: THREE.MultiplyBlending,
      color: seeEverything ? 0xaaaaaa : 0x7f7f7f,
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

    // The highlighted vertices
    this._highlightedVertices = new Vertices(this._gridGeometry, this._needsRedraw, vertexHighlightAlpha, vertexHighlightZ, 100);
    this._highlightedVertices.setMaterials(this._selectionMaterials);
    this._highlightedVertices.addToScene(this._scene);

    // The highlighted walls
    this._highlightedWalls = new Walls(this._gridGeometry, this._needsRedraw, edgeAlpha, highlightZ, 100);
    this._highlightedWalls.setMaterials(this._selectionMaterials);
    this._highlightedWalls.addToScene(this._scene);

    // The LoS
    this._los = new LoS(this._gridGeometry, this._needsRedraw, losAlpha, losZ, 5000);
    this._los.setMaterials(this._losMaterials);
    this._los.addToScene(this._scene);

    // The selection
    this._selection = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selection.setMaterials(this._selectionMaterials);
    this._selection.addToScene(this._scene);
    this._selectionDrag = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selectionDrag.setMaterials(this._selectionMaterials);
    this._selectionDrag.addToScene(this._scene);
    this._selectionDragRed = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, invalidSelectionZ, 100);
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

    // The map colour visualisation (added on request instead of the areas)
    this._mapColourVisualisation = new MapColourVisualisation(this._gridGeometry, this._needsRedraw, areaAlpha, areaZ);

    // The outlined rectangle
    this._outlinedRectangle = new OutlinedRectangle(gridGeometry, this._needsRedraw);
    this._outlinedRectangle.addToScene(this._overlayScene);
  }

  get areas() { return this._areas; }
  get tokens() { return this._tokens; }
  get walls() { return this._walls; }

  get highlightedAreas() { return this._highlightedAreas; }
  get highlightedVertices() { return this._highlightedVertices; }
  get highlightedWalls() { return this._highlightedWalls; }

  get selection() { return this._selection; }
  get selectionDrag() { return this._selectionDrag; }
  get selectionDragRed() { return this._selectionDragRed; }

  get los() { return this._los; }

  get outlinedRectangle() { return this._outlinedRectangle; }

  animate(fn: () => void) {
    if (this._disposed) {
      return;
    }

    requestAnimationFrame(() => this.animate(fn));

    fn();

    // Don't re-render the visible scene unless something changed:
    // (Careful -- don't chain these method calls up with ||, it's important
    // I actually call each one and don't skip later ones if an early one returned
    // true)
    var needsRedraw = this._needsRedraw.needsRedraw();
    var gridNeedsRedraw = this._gridNeedsRedraw.needsRedraw();

    if (needsRedraw) {
      this._renderer.render(this._scene, this._camera);

      if (this._outlinedRectangle.visible === true) {
        this._renderer.autoClear = false;
        this._renderer.render(this._overlayScene, this._overlayCamera);
        this._renderer.autoClear = true;
      }
    }

    if (gridNeedsRedraw) {
      this._renderer.setRenderTarget(this._faceCoordRenderTarget);
      this._renderer.setClearColor(this._textureClearColour);
      this._renderer.render(this._faceCoordScene, this._camera);

      this._renderer.setRenderTarget(this._edgeCoordRenderTarget); // TODO #40 do I still need this?
      this._renderer.render(this._edgeCoordScene, this._camera);

      this._renderer.setRenderTarget(this._vertexCoordRenderTarget);
      this._renderer.render(this._vertexCoordScene, this._camera);

      this._renderer.setRenderTarget(null);
      this._renderer.setClearColor(this._canvasClearColour);
    }
  }

  getGridCoordAt(cp: THREE.Vector3): IGridCoord | undefined {
    this._renderer.readRenderTargetPixels(this._faceCoordRenderTarget, cp.x, cp.y, 1, 1, this._texelReadBuf);
    return this._gridGeometry?.decodeCoordSample(this._texelReadBuf, 0);
  }

  getGridEdgeAt(cp: THREE.Vector3): IGridEdge | undefined {
    this._renderer.readRenderTargetPixels(this._edgeCoordRenderTarget, cp.x, cp.y, 1, 1, this._texelReadBuf);
    return this._gridGeometry?.decodeEdgeSample(this._texelReadBuf, 0);
  }

  getGridVertexAt(cp: THREE.Vector3): IGridVertex | undefined {
    this._renderer.readRenderTargetPixels(this._vertexCoordRenderTarget, cp.x, cp.y, 1, 1, this._texelReadBuf);
    return this._gridGeometry?.decodeVertexSample(this._texelReadBuf, 0);
  }

  getViewportToWorld(target: THREE.Matrix4): THREE.Matrix4 {
    // For some reason, the camera's projection matrix doesn't include
    // the rotation!
    const rotationMatrix = this._scratchMatrix1.makeRotationFromQuaternion(
      this._scratchQuaternion.setFromEuler(this._camera.rotation)
    );
    return target.multiplyMatrices(
      rotationMatrix,
      this._camera.projectionMatrixInverse
    );
  }

  getWorldToViewport(target: THREE.Matrix4): THREE.Matrix4 {
    // For some reason, the camera's projection matrix doesn't include
    // the rotation!
    const rotationMatrix = this._scratchMatrix1.makeRotationFromQuaternion(
      this._scratchQuaternion.setFromEuler(this._camera.rotation).inverse()
    );
    return target.multiplyMatrices(
      this._camera.projectionMatrix,
      rotationMatrix
    );
  }

  handleChangesApplied(mapColouring: MapColouring) {
    if (this._showMapColourVisualisation === true) {
      this._mapColourVisualisation.clear(); // TODO try to do it incrementally? (requires checking for colour count changes...)
      this._mapColourVisualisation.visualise(this._scene, mapColouring);
    }
  }

  resize(translation: THREE.Vector3, rotation: THREE.Quaternion, scaling: THREE.Vector3) {
    var width = Math.max(1, Math.floor(window.innerWidth));
    var height = Math.max(1, Math.floor(window.innerHeight));

    this._renderer.setSize(width, height, false);
    this._edgeCoordRenderTarget.setSize(width, height);
    this._faceCoordRenderTarget.setSize(width, height);
    this._vertexCoordRenderTarget.setSize(width, height);

    this._camera.left = translation.x + width / -scaling.x;
    this._camera.right = translation.x + width / scaling.x;
    this._camera.top = translation.y + height / -scaling.y;
    this._camera.bottom = translation.y + height / scaling.y;
    this._camera.setRotationFromQuaternion(rotation);
    this._camera.updateProjectionMatrix();

    this._overlayCamera.left = 0;
    this._overlayCamera.right = width;
    this._overlayCamera.top = height;
    this._overlayCamera.bottom = 0;
    this._overlayCamera.updateProjectionMatrix();

    // TODO Also add or remove grid tiles as required

    this._needsRedraw.setNeedsRedraw();
    this._gridNeedsRedraw.setNeedsRedraw();
  }

  setShowMapColourVisualisation(show: boolean, mapColouring: MapColouring) {
    if (show === this._showMapColourVisualisation) {
      return;
    }

    this._showMapColourVisualisation = show;
    if (show === true) {
      // Remove the area visualisation:
      this._areas.removeFromScene();

      // Add the map colour visualisation based on the current map colours:
      this._mapColourVisualisation.visualise(this._scene, mapColouring);
    } else {
      // Remove any map colour visualisation and put the area visualisation back
      this._mapColourVisualisation.removeFromScene();
      this._areas.addToScene(this._scene);
    }
  }

  worldToViewport(target: THREE.Vector3) {
    return target.applyEuler(this._camera.rotation) // for some reason this isn't in the projection matrix!
      .applyMatrix4(this._camera.projectionMatrix);
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
    this._vertexCoordScene.dispose();

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

    this._outlinedRectangle.dispose();

    this._darkColourMaterials.forEach(m => m.dispose());
    this._lightColourMaterials.forEach(m => m.dispose());
    this._losMaterials.forEach(m => m.dispose());
    this._selectionMaterials.forEach(m => m.dispose());
    this._invalidSelectionMaterials.forEach(m => m.dispose());
    this._textMaterial.dispose();

    this._disposed = true;
  }
}