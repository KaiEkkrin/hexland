import { IGridCoord, IGridVertex } from '../../data/coord';
import { MapColouring } from '../colouring';
import { FeatureColour } from '../featureColour';
import { IGridGeometry } from '../gridGeometry';
import { IDrawing } from '../interfaces';
import { RedrawFlag } from '../redrawFlag';
import { RenderTargetReader } from './renderTargetReader';

import { Areas } from './areas';
import { Grid } from './grid';
import { GridFilter } from './gridFilter';
import { LoS } from './los';
import { MapColourVisualisation } from './mapColourVisualisation';
import { OutlinedRectangle } from './overlayRectangle';
import textCreator from './textCreator';
import { Tokens } from './tokens';
import { Vertices } from './vertices';
import { Walls } from './walls';

import * as THREE from 'three';
import fluent from 'fluent-iterable';

// Our Z values are in the range -1..1 so that they're the same in the shaders
const areaZ = -0.5;
const tokenZ = -0.4;
const wallZ = -0.4;
const gridZ = -0.3;
const losZ = -0.2;
const selectionZ = 0;
const highlightZ = 0.1;
const vertexHighlightZ = 0.2;
const textZ = 0.5; // for some reason the text doesn't alpha blend correctly; putting it
                   // on top seems to look fine.  This might be happening because the
                   // text was added to the scene later; I could try making a separate
                   // LoS scene rendered after the main one to get the rendering in the
                   // right order?
const invalidSelectionZ = 0.6; // must hide the text

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
  private readonly _fixedCamera: THREE.OrthographicCamera;
  private readonly _faceCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _vertexCoordRenderTarget: THREE.WebGLRenderTarget;
  private readonly _renderer: THREE.WebGLRenderer;
  private readonly _canvasClearColour: THREE.Color;
  private readonly _textureClearColour: THREE.Color;

  private readonly _mapScene: THREE.Scene;
  private readonly _fixedFilterScene: THREE.Scene;
  private readonly _filterScene: THREE.Scene;
  private readonly _overlayScene: THREE.Scene;
  private readonly _faceCoordScene: THREE.Scene;
  private readonly _vertexCoordScene: THREE.Scene;
  private readonly _texelReadBuf = new Uint8Array(4);
  private readonly _coordTargetReader: RenderTargetReader;

  private readonly _grid: Grid;
  private readonly _gridFilter: GridFilter;
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

    this._camera = new THREE.OrthographicCamera(0, 0, renderWidth, renderHeight, -1, 1);
    this._camera.position.z = 0;

    this._fixedCamera = new THREE.OrthographicCamera(0, 0, renderWidth, renderHeight, -1, 1);
    this._fixedCamera.position.z = 0;

    this._gridNeedsRedraw = new RedrawFlag();
    this._needsRedraw = new RedrawFlag();

    // These scenes need to be drawn in sequence to get the blending right and allow us
    // to draw the map itself, then overlay fixed features (the grid), then overlay LoS
    // to allow it to hide the grid, and finally overlay the UI overlay (drag rectangle).
    this._mapScene = new THREE.Scene();
    this._fixedFilterScene = new THREE.Scene();
    this._filterScene = new THREE.Scene();
    this._overlayScene = new THREE.Scene();

    this._renderer = new THREE.WebGLRenderer();
    this._canvasClearColour = new THREE.Color(0.1, 0.1, 0.1);
    this._textureClearColour = new THREE.Color(0, 0, 0); // we'll flip to this when required
    this._renderer.setClearColor(this._canvasClearColour); // a dark grey background will show up LoS
    mount.appendChild(this._renderer.domElement);
    this._mount = mount;

    // Texture of face co-ordinates within the tile.
    this._faceCoordScene = new THREE.Scene();
    this._faceCoordRenderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping
    });

    // Texture of vertex co-ordinates within the tile.
    this._vertexCoordScene = new THREE.Scene();
    this._vertexCoordRenderTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping
    });

    this._grid = new Grid(
      this._gridGeometry,
      this._gridNeedsRedraw,
      gridZ,
      vertexAlpha,
      this._faceCoordScene,
      this._vertexCoordScene
    );

    // We'll be wanting to sample the coord render target a lot in order to detect what grid to draw,
    // so we'll set up a reader
    this._coordTargetReader = new RenderTargetReader(this._faceCoordRenderTarget);

    // Render the middle of the grid by default (we need to have something to start things up)
    this._grid.extendAcrossRange(-1, -1, 1, 1);

    this._gridFilter = new GridFilter(this._fixedFilterScene, this._faceCoordRenderTarget.texture, gridZ);

    this._darkColourMaterials = colours.map(c => new THREE.MeshBasicMaterial({ color: c.dark.getHex() }));
    this._lightColourMaterials = colours.map(c => new THREE.MeshBasicMaterial({ color: c.light.getHex() }));
    this._selectionMaterials = [new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: 0x606060,
    }), new THREE.MeshBasicMaterial({
      blending: THREE.SubtractiveBlending,
      color: 0x606060
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
    this._areas.addToScene(this._mapScene);

    // The highlighted areas
    // (TODO does this need to be a different feature set from the selection?)
    this._highlightedAreas = new Areas(this._gridGeometry, this._needsRedraw, areaAlpha, highlightZ, 100);
    this._highlightedAreas.setMaterials(this._selectionMaterials);
    this._highlightedAreas.addToScene(this._filterScene);

    // The highlighted vertices
    this._highlightedVertices = new Vertices(this._gridGeometry, this._needsRedraw, vertexHighlightAlpha, vertexHighlightZ, 100);
    this._highlightedVertices.setMaterials(this._selectionMaterials);
    this._highlightedVertices.addToScene(this._filterScene);

    // The highlighted walls
    this._highlightedWalls = new Walls(this._gridGeometry, this._needsRedraw, edgeAlpha, highlightZ, 100);
    this._highlightedWalls.setMaterials(this._selectionMaterials);
    this._highlightedWalls.addToScene(this._filterScene);

    // The LoS
    this._los = new LoS(this._gridGeometry, this._needsRedraw, losAlpha, losZ, 5000);
    this._los.setMaterials(this._losMaterials);
    this._los.addToScene(this._filterScene);

    // The selection
    this._selection = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selection.setMaterials(this._selectionMaterials);
    this._selection.addToScene(this._filterScene);
    this._selectionDrag = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, selectionZ, 100);
    this._selectionDrag.setMaterials(this._selectionMaterials);
    this._selectionDrag.addToScene(this._filterScene);
    this._selectionDragRed = new Areas(this._gridGeometry, this._needsRedraw, selectionAlpha, invalidSelectionZ, 100);
    this._selectionDragRed.setMaterials(this._invalidSelectionMaterials);
    this._selectionDragRed.addToScene(this._filterScene);

    // The tokens
    this._tokens = new Tokens(this._gridGeometry, this._needsRedraw, textCreator, this._textMaterial,
      tokenAlpha, tokenZ, textZ);
    this._tokens.setMaterials(this._lightColourMaterials);
    this._tokens.addToScene(this._mapScene);

    // The walls
    this._walls = new Walls(this._gridGeometry, this._needsRedraw, wallAlpha, wallZ);
    this._walls.setMaterials(this._lightColourMaterials);
    this._walls.addToScene(this._mapScene);

    // The map colour visualisation (added on request instead of the areas)
    this._mapColourVisualisation = new MapColourVisualisation(this._gridGeometry, this._needsRedraw, areaAlpha, areaZ);

    // The outlined rectangle
    this._outlinedRectangle = new OutlinedRectangle(gridGeometry, this._needsRedraw);
    this._outlinedRectangle.addToScene(this._overlayScene);
  }

  private extendGridAround(s: number, t: number) {
    // We extend the grid around the given tile until we added something,
    // effectively making it at most 1 tile bigger than it previously was.
    var countAdded = 0;
    for (var expand = 1; countAdded === 0; ++expand) {
      countAdded = this._grid.extendAcrossRange(s - expand, t - expand, s + expand, t + expand);
    }
  }

  private fitGridToFrame() {
    const width = this._faceCoordRenderTarget.width;
    const height = this._faceCoordRenderTarget.height;

    // Take our control samples, which will be in grid coords, and map them
    // back into tile coords
    const samples = [...fluent(this.getGridSamples(width, height)).map(c => c === undefined ? undefined : {
      x: Math.floor(c.x / this._gridGeometry.tileDim),
      y: Math.floor(c.y / this._gridGeometry.tileDim)
    })];

    const undefinedCount = fluent(samples).count(s => s === undefined);
    if (undefinedCount === samples.length) {
      // This shouldn't happen unless we only just loaded the map.  Extend the grid around the origin.
      this.extendGridAround(0, 0);
    } else if (undefinedCount > 0) {
      // We're missing grid in part of the view.  Extend the grid by one around the first
      // tile that we found in view -- this should, over the course of a couple of frames,
      // fill the whole view
      const coreTile = samples.find(s => s !== undefined);
      if (coreTile !== undefined) { // clearly :)
        this.extendGridAround(coreTile.x, coreTile.y);
      }
    } else {
      // Reduce the amount of stuff we need to consider by removing any tiles outside this range.
      // (The 0 fallbacks here will never be used because of the if clause, and are here to
      // appease TypeScript)
      this._grid.shrinkToRange(
        Math.min(...samples.map(s => s?.x ?? 0)),
        Math.min(...samples.map(s => s?.y ?? 0)),
        Math.max(...samples.map(s => s?.x ?? 0)),
        Math.max(...samples.map(s => s?.y ?? 0))
      );
    }
  }

  private *getGridSamples(width: number, height: number) {
    var cp = new THREE.Vector3(Math.floor(width * 0.5), Math.floor(height * 0.5), 0);
    yield this.getGridCoordAt(cp);

    cp.set(0, 0, 0);
    yield this.getGridCoordAt(cp);

    cp.set(width - 1, 0, 0);
    yield this.getGridCoordAt(cp);

    cp.set(width - 1, height - 1, 0);
    yield this.getGridCoordAt(cp);

    cp.set(0, height - 1, 0);
    yield this.getGridCoordAt(cp);
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

  get boundsChanged() { return this._grid.boundsChanged; }
  get outlinedRectangle() { return this._outlinedRectangle; }

  animate(fn: () => void) {
    if (this._disposed) {
      return;
    }

    requestAnimationFrame(() => this.animate(fn));

    fn();

    // Check that we have enough grid.
    // If we don't, we'll fill it in on the next frame:
    this.fitGridToFrame();

    // Don't re-render the visible scene unless something changed:
    // (Careful -- don't chain these method calls up with ||, it's important
    // I actually call each one and don't skip later ones if an early one returned
    // true)
    var needsRedraw = this._needsRedraw.needsRedraw();
    var gridNeedsRedraw = this._gridNeedsRedraw.needsRedraw();

    if (gridNeedsRedraw) {
      this._renderer.setRenderTarget(this._faceCoordRenderTarget);
      this._renderer.setClearColor(this._textureClearColour);
      this._renderer.render(this._faceCoordScene, this._camera);

      this._renderer.setRenderTarget(this._vertexCoordRenderTarget);
      this._renderer.render(this._vertexCoordScene, this._camera);

      this._renderer.setRenderTarget(null);
      this._renderer.setClearColor(this._canvasClearColour);

      this._coordTargetReader.refresh(this._renderer);
    }

    if (gridNeedsRedraw || needsRedraw) {
      this._renderer.render(this._mapScene, this._camera);

      this._renderer.autoClear = false;
      this._renderer.render(this._fixedFilterScene, this._fixedCamera);
      this._renderer.render(this._filterScene, this._camera);
      this._renderer.render(this._overlayScene, this._fixedCamera);
      this._renderer.autoClear = true;
    }
  }

  getGridCoordAt(cp: THREE.Vector3): IGridCoord | undefined {
    return this._coordTargetReader.sample(
      cp.x, cp.y,
      (buf, offset) => this._gridGeometry?.decodeCoordSample(buf, offset)
    );
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
      this._mapColourVisualisation.visualise(this._mapScene, mapColouring);
    }
  }

  resize(translation: THREE.Vector3, rotation: THREE.Quaternion, scaling: THREE.Vector3) {
    var width = Math.max(1, Math.floor(window.innerWidth));
    var height = Math.max(1, Math.floor(window.innerHeight));

    this._renderer.setSize(width, height, false);
    this._faceCoordRenderTarget.setSize(width, height);
    this._vertexCoordRenderTarget.setSize(width, height);

    this._camera.left = translation.x + width / -scaling.x;
    this._camera.right = translation.x + width / scaling.x;
    this._camera.top = translation.y + height / -scaling.y;
    this._camera.bottom = translation.y + height / scaling.y;
    this._camera.setRotationFromQuaternion(rotation);
    this._camera.updateProjectionMatrix();

    this._fixedCamera.left = 0;
    this._fixedCamera.right = width;
    this._fixedCamera.top = height;
    this._fixedCamera.bottom = 0;
    this._fixedCamera.updateProjectionMatrix();

    // TODO Also add or remove grid tiles as required
    this._gridFilter.resize(width, height);

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
      this._mapColourVisualisation.visualise(this._mapScene, mapColouring);
    } else {
      // Remove any map colour visualisation and put the area visualisation back
      this._mapColourVisualisation.removeFromScene();
      this._areas.addToScene(this._mapScene);
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
    this._renderer.dispose();

    this._mapScene.dispose();
    this._fixedFilterScene.dispose();
    this._filterScene.dispose();
    this._overlayScene.dispose();
    this._faceCoordScene.dispose();
    this._vertexCoordScene.dispose();

    this._grid.dispose();
    this._gridFilter.dispose();
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