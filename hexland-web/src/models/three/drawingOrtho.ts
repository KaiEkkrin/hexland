import { IGridCoord, IGridVertex } from '../../data/coord';
import { ITokenGeometry } from '../../data/tokenGeometry';
import { ITokenDrawing } from '../../data/tokens';
import { MapColouring } from '../colouring';
import { FeatureColour } from '../featureColour';
import { IGridGeometry } from '../gridGeometry';
import { IDrawing } from '../interfaces';
import { RedrawFlag } from '../redrawFlag';
import { IDownloadUrlCache } from '../../services/interfaces';

import { Areas, createPaletteColouredAreaObject, createAreas, createSelectionColouredAreaObject } from './areas';
import { Grid, IGridLoSPreRenderParameters } from './grid';
import { GridFilter } from './gridFilter';
import { LoS } from './los';
import { MapColourVisualisation } from './mapColourVisualisation';
import { OutlinedRectangle } from './overlayRectangle';
import { SelectionDrawing, TokenDrawing } from './tokenDrawingOrtho';
import { Vertices, createVertices, createSelectionColouredVertexObject, createSingleVertexGeometry, createTokenFillVertexGeometry, createPaletteColouredVertexObject } from './vertices';
import { Walls, createPaletteColouredWallObject, createSelectionColouredWallObject, createWallGeometry, createTokenFillEdgeGeometry } from './walls';

import * as THREE from 'three';

// Our Z values are in the range -1..1 so that they're the same in the shaders
const areaZ = -0.5;
const tokenZ = -0.3;
const wallZ = -0.45;
const tokenSpriteZ = -0.25;
const gridZ = -0.4;
const losZ = -0.2;
const losQ = 0.2;
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
const tokenSpriteAlpha = 0.6;
const selectionAlpha = 0.9;
const areaAlpha = 1.0;
const vertexHighlightAlpha = 0.35;

// An orthographic implementation of IDrawing using THREE.js.
export class DrawingOrtho implements IDrawing {
  private readonly _gridGeometry: IGridGeometry;
  private readonly _mount: HTMLDivElement;

  private readonly _camera: THREE.OrthographicCamera;
  private readonly _fixedCamera: THREE.OrthographicCamera;
  private readonly _overlayCamera: THREE.OrthographicCamera;
  private readonly _renderer: THREE.WebGLRenderer;
  private readonly _canvasClearColour: THREE.Color;

  private readonly _mapScene: THREE.Scene;
  private readonly _fixedFilterScene: THREE.Scene;
  private readonly _filterScene: THREE.Scene;
  private readonly _overlayScene: THREE.Scene;

  private readonly _grid: Grid;
  private readonly _gridFilter: GridFilter;
  private readonly _areas: Areas;
  private readonly _highlightedAreas: Areas;
  private readonly _highlightedVertices: Vertices;
  private readonly _highlightedWalls: Walls;
  private readonly _los: LoS;
  private readonly _losParameters: IGridLoSPreRenderParameters;
  private readonly _selection: ITokenDrawing;
  private readonly _selectionDrag: ITokenDrawing; // a copy of the selection shown only while dragging it
  private readonly _selectionDragRed: ITokenDrawing; // likewise, but shown if the selection couldn't be dropped there
  private readonly _tokens: ITokenDrawing;
  private readonly _walls: Walls;
  private readonly _mapColourVisualisation: MapColourVisualisation;

  private readonly _textMaterial: THREE.MeshBasicMaterial;

  private readonly _outlinedRectangle: OutlinedRectangle;

  private readonly _gridNeedsRedraw: RedrawFlag;
  private readonly _needsRedraw: RedrawFlag;

  private readonly _scratchMatrix1 = new THREE.Matrix4();
  private readonly _scratchQuaternion = new THREE.Quaternion();

  private _showLoS = false;
  private _showMapColourVisualisation = false;
  private _disposed = false;

  constructor(
    gridGeometry: IGridGeometry,
    tokenGeometry: ITokenGeometry,
    colours: FeatureColour[],
    mount: HTMLDivElement,
    seeEverything: boolean,
    urlCache: IDownloadUrlCache
  ) {
    this._gridGeometry = gridGeometry;
    this._mount = mount;

    // We need these to initialise things, but they'll be updated dynamically
    const renderWidth = Math.max(1, Math.floor(window.innerWidth));
    const renderHeight = Math.max(1, Math.floor(window.innerHeight));

    this._camera = new THREE.OrthographicCamera(0, renderWidth, renderHeight, 0, -1, 1);
    this._camera.position.z = 0;

    this._fixedCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    this._fixedCamera.position.z = 0;

    this._overlayCamera = new THREE.OrthographicCamera(0, renderWidth, renderHeight, 0, -1, 1);
    this._overlayCamera.position.z = 0;

    this._gridNeedsRedraw = new RedrawFlag();
    this._needsRedraw = new RedrawFlag();

    // These scenes need to be drawn in sequence to get the blending right and allow us
    // to draw the map itself, then overlay fixed features (the grid), then overlay LoS
    // to allow it to hide the grid, and overlay the UI overlay (drag rectangle).
    this._mapScene = new THREE.Scene();
    this._fixedFilterScene = new THREE.Scene();
    this._filterScene = new THREE.Scene();
    this._overlayScene = new THREE.Scene();

    this._renderer = new THREE.WebGLRenderer();
    this._canvasClearColour = new THREE.Color(0.1, 0.1, 0.1);
    this._renderer.autoClear = false;
    mount.appendChild(this._renderer.domElement);
    this._mount = mount;

    // Texture of face co-ordinates within the tile.
    this._grid = new Grid(
      this._gridGeometry,
      this._gridNeedsRedraw,
      gridZ,
      losZ,
      vertexAlpha,
      renderWidth,
      renderHeight
    );

    this._gridFilter = new GridFilter(this._grid.faceCoordRenderTarget.texture, gridZ);
    this._gridFilter.addToScene(this._fixedFilterScene);

    this._textMaterial = new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide });

    const darkColourParameters = { palette: colours.map(c => c.dark) };
    const lightColourParameters = { palette: colours.map(c => c.light) };

    const invalidSelectionColourParameters = {
      palette: [new THREE.Color(0xa00000)]
    };

    // The LoS
    const [losWidth, losHeight] = this.createLoSSize(renderWidth, renderHeight, new THREE.Vector3(2, 2, 1));
    this._los = new LoS(
      this._gridGeometry, this._needsRedraw, losZ, losQ, losWidth, losHeight
    );

    this._losParameters = {
      fullyHidden: 0.0, // increased if `seeEverything`
      fullyVisible: 1.0,
      losTarget: this._los.target
    };

    // The filled areas
    this._areas = createAreas(
      this._gridGeometry, this._needsRedraw,
      createPaletteColouredAreaObject(this._gridGeometry, areaAlpha, areaZ, darkColourParameters)
    );
    this._areas.addToScene(this._mapScene);

    // The highlighted areas
    // (TODO does this need to be a different feature set from the selection?)
    this._highlightedAreas = createAreas(
      this._gridGeometry, this._needsRedraw,
      createSelectionColouredAreaObject(this._gridGeometry, areaAlpha, highlightZ),
      100
    );
    this._highlightedAreas.addToScene(this._filterScene);

    // The highlighted vertices
    const highlightedVertexGeometry = createSingleVertexGeometry(this._gridGeometry, vertexHighlightAlpha, vertexHighlightZ);
    this._highlightedVertices = createVertices(
      this._gridGeometry, this._needsRedraw,
      createSelectionColouredVertexObject(highlightedVertexGeometry, this._gridGeometry),
      100
    );
    this._highlightedVertices.addToScene(this._filterScene);

    // The highlighted walls
    const highlightedWallGeometry = createWallGeometry(this._gridGeometry, edgeAlpha, highlightZ);
    this._highlightedWalls = new Walls(
      this._gridGeometry, this._needsRedraw,
      createSelectionColouredWallObject(highlightedWallGeometry, this._gridGeometry),
      undefined, 100
    );
    this._highlightedWalls.addToScene(this._filterScene);

    // The selection
    const tokenFillEdgeGeometry = createTokenFillEdgeGeometry(gridGeometry, selectionAlpha, selectionZ);
    const tokenFillVertexGeometry = createTokenFillVertexGeometry(gridGeometry, selectionAlpha, selectionZ);
    const createSelectedAreaObject = createSelectionColouredAreaObject(gridGeometry, selectionAlpha, selectionZ);
    const createSelectedWallObject = createSelectionColouredWallObject(tokenFillEdgeGeometry, gridGeometry);
    const createSelectedVertexObject = createSelectionColouredVertexObject(tokenFillVertexGeometry, gridGeometry);
    this._selection = new SelectionDrawing(
      gridGeometry, this._needsRedraw, createSelectedAreaObject, createSelectedWallObject, createSelectedVertexObject, this._filterScene
    );
    this._selectionDrag = new SelectionDrawing(
      gridGeometry, this._needsRedraw, createSelectedAreaObject, createSelectedWallObject, createSelectedVertexObject, this._filterScene
    );

    const createSelectedRedAreaObject = createPaletteColouredAreaObject(
      gridGeometry, selectionAlpha, invalidSelectionZ, invalidSelectionColourParameters
    );
    const createSelectedRedWallObject = createPaletteColouredWallObject(
      tokenFillEdgeGeometry, gridGeometry, invalidSelectionColourParameters
    );
    const createSelectedRedVertexObject = createPaletteColouredVertexObject(
      tokenFillVertexGeometry, gridGeometry, invalidSelectionColourParameters
    );
    this._selectionDragRed = new SelectionDrawing(
      gridGeometry, this._needsRedraw, createSelectedRedAreaObject, createSelectedRedWallObject, createSelectedRedVertexObject, this._filterScene
    );

    // The tokens
    this._tokens = new TokenDrawing(
      gridGeometry, tokenGeometry, this._needsRedraw, this._textMaterial, {
        alpha: tokenAlpha,
        spriteAlpha: tokenSpriteAlpha,
        z: tokenZ,
        spriteZ: tokenSpriteZ,
        textZ: textZ
      }, lightColourParameters, this._mapScene, urlCache
    );

    // The walls
    const wallGeometry = createWallGeometry(this._gridGeometry, wallAlpha, wallZ);
    this._walls = new Walls(
      this._gridGeometry, this._needsRedraw,
      createPaletteColouredWallObject(wallGeometry, this._gridGeometry, lightColourParameters),
      this._los.features
    );
    this._walls.addToScene(this._mapScene);

    // The map colour visualisation (added on request instead of the areas)
    this._mapColourVisualisation = new MapColourVisualisation(
      this._gridGeometry, this._needsRedraw, areaAlpha, areaZ
    );

    // The outlined rectangle
    this._outlinedRectangle = new OutlinedRectangle(gridGeometry, this._needsRedraw);
    this._outlinedRectangle.addToScene(this._overlayScene);
  }

  private createLoSSize(width: number, height: number, scaling: THREE.Vector3) {
    // We want the size of LoS faces to remain the same at different magnifications;
    // it can be smaller than the rendered grid (which will improve performance)
    return [Math.ceil(width * 0.5 / scaling.x), Math.ceil(height * 0.5 / scaling.y)];
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

  animate(preAnimate?: (() => void) | undefined, postAnimate?: (() => void) | undefined) {
    if (this._disposed) {
      return;
    }

    requestAnimationFrame(() => this.animate(preAnimate, postAnimate));
    preAnimate?.();

    // Check that we have enough grid.
    // If we don't, we'll fill it in on the next frame:
    this._grid.fitGridToFrame();

    // Don't re-render the visible scene unless something changed:
    // (Careful -- don't chain these method calls up with ||, it's important
    // I actually call each one and don't skip later ones if an early one returned
    // true)
    let needsRedraw = this._needsRedraw.needsRedraw();
    let gridNeedsRedraw = this._gridNeedsRedraw.needsRedraw();
    if (gridNeedsRedraw) {
      this._grid.render(this._renderer, this._camera);
    }

    if (gridNeedsRedraw || needsRedraw) {
      if (this._showLoS === true) {
        this._los.render(this._camera, this._fixedCamera, this._renderer);
        this._grid.preLoSRender(this._losParameters);
      }

      this._renderer.setRenderTarget(null);
      this._renderer.setClearColor(this._canvasClearColour);
      this._renderer.clear();
      this._renderer.render(this._mapScene, this._camera);
      this._renderer.render(this._fixedFilterScene, this._fixedCamera);
      this._renderer.render(this._filterScene, this._camera);
      this._renderer.render(this._overlayScene, this._overlayCamera);

      if (this._showLoS === true) {
        this._grid.postLoSRender();
      }
    }

    postAnimate?.();
  }

  checkLoS(cp: THREE.Vector3) {
    return this._showLoS ? (this._los.checkLoS(cp) ?? false) : true;
  }

  getGridCoordAt(cp: THREE.Vector3): IGridCoord | undefined {
    return this._grid.getGridCoordAt(cp);
  }

  getGridVertexAt(cp: THREE.Vector3): IGridVertex | undefined {
    return this._grid.getGridVertexAt(this._renderer, cp);
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
    const width = Math.max(1, Math.floor(window.innerWidth));
    const height = Math.max(1, Math.floor(window.innerHeight));

    this._renderer.setSize(width, height, false);
    this._grid.resize(width, height);

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

    this._gridFilter.resize(width, height);

    const [losWidth, losHeight] = this.createLoSSize(width, height, scaling);
    this._los.resize(losWidth, losHeight);

    this._needsRedraw.setNeedsRedraw();
    this._gridNeedsRedraw.setNeedsRedraw();
  }

  setLoSPositions(positions: IGridCoord[] | undefined, seeEverything: boolean) {
    const nowShowLoS = positions !== undefined;
    if (nowShowLoS) {
      this._grid.addLoSToScene(this._filterScene);
    } else {
      this._grid.removeLoSFromScene();
    }

    if (positions !== undefined) {
      this._los.setTokenPositions(positions);
    }

    this._showLoS = nowShowLoS;
    
    // Doing this makes fully-hidden areas show up a bit if we can notionally
    // see everything -- for the map owner / FFA mode.
    this._losParameters.fullyHidden = seeEverything ? 0.25 : 0.0;
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

    this._renderer.dispose();

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
    this._los.dispose();
    this._mapColourVisualisation.dispose();

    this._outlinedRectangle.dispose();

    this._textMaterial.dispose();

    this._disposed = true;
  }
}