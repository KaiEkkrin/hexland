import { GridCoord, GridEdge } from '../data/coord';
import { lerp } from './extraMath';
import { BaseGeometry, FaceCentre, IGridGeometry, EdgeGeometry } from './gridGeometry';
import * as THREE from 'three';

// A tile of hexes.
export class HexGridGeometry extends BaseGeometry implements IGridGeometry {
  private readonly _hexSize: number;

  private readonly _xStep: number;
  private readonly _yStep: number;
  private readonly _xOffLeft: number;
  private readonly _xOffTop: number;
  private readonly _yOffTop: number;

  constructor(hexSize: number, tileDim: number) {
    super(tileDim, 3);
    this._hexSize = hexSize;

    this._xStep = this._hexSize * Math.sin(Math.PI / 3.0);
    this._yStep = this._hexSize / 2.0; // * Math.sin(Math.PI / 6.0)
    this._xOffLeft = this._xStep * 2.0 / 3.0;
    this._xOffTop = this._xStep / 3.0;
    this._yOffTop = this._hexSize * 0.5;
  }

  protected createCentre(x: number, y: number, z: number): FaceCentre {
    return new FaceCentre(x * this._xStep, x * this._yStep + y * this._hexSize, z);
  }

  private createLeft(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._xOffLeft, c.y, c.z);
  }

  private createTopLeft(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._xOffTop, c.y - this._yOffTop, c.z);
  }

  private createTopRight(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._xOffTop, c.y - this._yOffTop, c.z);
  }

  private createRight(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._xOffLeft, c.y, c.z);
  }

  private createBottomLeft(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._xOffTop, c.y + this._yOffTop, c.z);
  }

  private createBottomRight(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._xOffTop, c.y + this._yOffTop, c.z);
  }

  protected createEdgeGeometry(coord: GridEdge, alpha: number, z: number): EdgeGeometry {
    var centre = this.createCoordCentre(coord, z);
    var otherCentre = this.createCoordCentre(
      coord.edge === 0 ? coord.addFace(new THREE.Vector2(-1, 0), this.tileDim) :
      coord.edge === 1 ? coord.addFace(new THREE.Vector2(0, -1), this.tileDim) :
      coord.addFace(new THREE.Vector2(1, -1), this.tileDim),
      z
    );

    var tip1 = coord.edge === 0 ? this.createLeft(centre) :
      coord.edge === 1 ? this.createTopLeft(centre) :
      this.createTopRight(centre);

    var tip2 = coord.edge === 0 ? this.createTopLeft(centre) :
      coord.edge === 1 ? this.createTopRight(centre) :
      this.createRight(centre);

    return new EdgeGeometry(tip1, tip2, centre, otherCentre, alpha);
  }

  private pushHexIndices(indices: number[], offset: number) {
    indices.push(offset);
    indices.push(offset + 2);
    indices.push(offset + 1);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 3);
    indices.push(offset + 2);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 4);
    indices.push(offset + 3);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 5);
    indices.push(offset + 4);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 6);
    indices.push(offset + 5);
    indices.push(-1);

    indices.push(offset);
    indices.push(offset + 1);
    indices.push(offset + 6);
    indices.push(-1);
  }

  private vertexIndexOf(x: number, y: number, v: number) {
    return (y + 1) * (this.tileDim + 1) * 2 + x * 2 + v;
  }

  private createFaceHighlightIndices(): number[] {
    var indices: number[] = [];
    this.pushHexIndices(indices, 0);
    return indices;
  }

  createFaceHighlight(): THREE.BufferGeometry {
    var buf = new THREE.BufferGeometry();
    buf.setAttribute('position', new THREE.BufferAttribute(new Float32Array(21), 3));
    buf.setIndex(this.createFaceHighlightIndices());
    buf.setDrawRange(0, 0); // starts hidden
    return buf;
  }

  createGridVertices(tile: THREE.Vector2, z: number): THREE.Vector3[] {
    var vertices = [];

    // For each hex, we need to add only two unique vertices out of six; we'll use
    // the left and top-left vertices.  We need to fill in enough points for createLineIndices()
    // below to have access to all it needs 
    for (var y = -1; y <= this.tileDim; ++y) {
      for (var x = 0; x <= this.tileDim; ++x) {
        var centre = this.createCentre(tile.x * this.tileDim + x, tile.y * this.tileDim + y, z);
        vertices.push(this.createLeft(centre));
        vertices.push(this.createTopLeft(centre));
      }
    }

    return vertices;
  }

  createGridLineIndices(): number[] {
    var indices = [];

    // We only need to draw the top part of each hex -- the bottom part will be taken care of.
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        // Left -- 1st vertex of the hex at (x, y)
        indices.push(this.vertexIndexOf(x, y, 0));

        // Top left -- 2nd vertex of the hex at (x, y)
        indices.push(this.vertexIndexOf(x, y, 1));

        // Top right -- 1st vertex of the hex at (x + 1, y - 1)
        indices.push(this.vertexIndexOf(x + 1, y - 1, 0));

        // Right -- 2nd vertex of the hex at (x + 1, y)
        indices.push(this.vertexIndexOf(x + 1, y, 1));

        // Push a primitive restart
        indices.push(-1);
      }
    }

    return indices;
  }

  createSolidVertices(tile: THREE.Vector2, alpha: number, z: number): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        var centre = this.createCentre(tile.x * this.tileDim + x, tile.y * this.tileDim + y, z);
        vertices.push(centre);
        vertices.push(lerp(centre, this.createLeft(centre), alpha));
        vertices.push(lerp(centre, this.createTopLeft(centre), alpha));
        vertices.push(lerp(centre, this.createTopRight(centre), alpha));
        vertices.push(lerp(centre, this.createRight(centre), alpha));
        vertices.push(lerp(centre, this.createBottomRight(centre), alpha));
        vertices.push(lerp(centre, this.createBottomLeft(centre), alpha));
      }
    }

    return vertices;
  }

  createSolidMeshIndices(): number[] {
    var indices: number[] = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        var baseIndex = y * this.tileDim * 7 + x * 7;
        this.pushHexIndices(indices, baseIndex);
      }
    }

    return indices;
  }

  createSolidTestColours(): Float32Array {
    var colours = new Float32Array(this.tileDim * this.tileDim * 21);
    var colour = new THREE.Color();
    for (var i = 0; i < this.tileDim * this.tileDim; ++i) {
      colour.setHSL(i / (this.tileDim * this.tileDim), 1, 0.5);
      for (var j = 0; j < 7; ++j) {
        colours[i * 21 + j * 3] = colour.r;
        colours[i * 21 + j * 3 + 1] = colour.g;
        colours[i * 21 + j * 3 + 2] = colour.b;
      }
    }

    return colours;
  }

  createSolidCoordColours(tile: THREE.Vector2): Float32Array {
    var colours = new Float32Array(this.tileDim * this.tileDim * 21);
    var offset = 0;
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var i = 0; i < 7; ++i) {
          this.toPackedXYEdge(colours, offset, tile.x, tile.y, 0);
          this.toPackedXYAbs(colours, offset + 2, x, y);
          offset += 3;
        }
      }
    }

    return colours;
  }

  toSingle(): IGridGeometry {
    return new HexGridGeometry(this._hexSize, 1);
  }

  transformToEdge(o: THREE.Object3D, coord: GridEdge): void {
    var centre = this.createCoordCentre(coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
    if (coord.edge === 1) {
      o.rotateZ(Math.PI / 3.0);
    } else if (coord.edge === 2) {
      o.rotateZ(Math.PI * 2.0 / 3.0);
    }
  }

  updateFaceHighlight(buf: THREE.BufferGeometry, coord: GridCoord | undefined, z: number): void {
    if (!coord) {
      buf.setDrawRange(0, 0);
      return;
    }

    var position = buf.attributes.position as THREE.BufferAttribute;
    var x = coord.tile.x * this.tileDim + coord.face.x;
    var y = coord.tile.y * this.tileDim + coord.face.y;
    var centre = this.createCentre(x, y, z);
    position.setXYZ(0, centre.x, centre.y, 2);

    var left = this.createLeft(centre);
    position.setXYZ(1, left.x, left.y, 2);

    var topLeft = this.createTopLeft(centre);
    position.setXYZ(2, topLeft.x, topLeft.y, 2);

    var topRight = this.createTopRight(centre);
    position.setXYZ(3, topRight.x, topRight.y, 2);

    var right = this.createRight(centre);
    position.setXYZ(4, right.x, right.y, 2);

    var bottomRight = this.createBottomRight(centre);
    position.setXYZ(5, bottomRight.x, bottomRight.y, 2);

    var bottomLeft = this.createBottomLeft(centre);
    position.setXYZ(6, bottomLeft.x, bottomLeft.y, 2);

    position.needsUpdate = true;
    buf.setDrawRange(0, buf.index?.array.length ?? 0);
    buf.computeBoundingSphere();
  }
}