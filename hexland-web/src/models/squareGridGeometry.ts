import { GridCoord, GridEdge } from '../data/coord';
import { lerp } from './extraMath';
import { BaseGeometry, FaceCentre, IGridGeometry, EdgeGeometry } from './gridGeometry';
import * as THREE from 'three';

export class SquareGridGeometry extends BaseGeometry implements IGridGeometry {
  private readonly _squareSize: number;
  private readonly _off: number;

  constructor(squareSize: number, tileDim: number) {
    super(tileDim, 2);
    this._squareSize = squareSize;
    this._off = squareSize * 0.5;
  }

  protected createCentre(x: number, y: number, z: number): FaceCentre {
    return new FaceCentre(x * this._squareSize, y * this._squareSize, z);
  }

  private createTopLeft(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._off, c.y - this._off, c.z);
  }

  private createTopRight(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._off, c.y - this._off, c.z);
  }

  private createBottomLeft(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x - this._off, c.y + this._off, c.z);
  }

  private createBottomRight(c: FaceCentre): THREE.Vector3 {
    return new THREE.Vector3(c.x + this._off, c.y + this._off, c.z);
  }

  protected createEdgeGeometry(coord: GridEdge, alpha: number, z: number): EdgeGeometry {
    var centre = this.createCoordCentre(coord, z);
    var otherCentre = this.createCoordCentre(
      coord.edge === 0 ? coord.addFace(new THREE.Vector2(-1, 0), this.tileDim) :
      coord.addFace(new THREE.Vector2(0, -1), this.tileDim),
      z
    );

    var tip1 = coord.edge === 0 ? this.createBottomLeft(centre) : this.createTopLeft(centre);
    var tip2 = coord.edge === 0 ? this.createTopLeft(centre) : this.createTopRight(centre);
    return new EdgeGeometry(tip1, tip2, centre, otherCentre, alpha);
  }

  private pushSquareIndices(indices: number[], baseIndex: number) {
    indices.push(baseIndex);
    indices.push(baseIndex + 1);
    indices.push(baseIndex + 2);
    indices.push(-1);

    indices.push(baseIndex + 1);
    indices.push(baseIndex + 3);
    indices.push(baseIndex + 2);
    indices.push(-1);
  }

  createGridVertices(tile: THREE.Vector2, z: number): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y <= this.tileDim; ++y) {
      for (var x = 0; x <= this.tileDim; ++x) {
        var centre = this.createCentre(tile.x * this.tileDim + x, tile.y * this.tileDim + y, z);
        vertices.push(this.createTopLeft(centre));
      }
    }

    return vertices;
  }

  createGridLineIndices(): number[] {
    var indices = [];

    // All the horizontal lines:
    for (var i = 0; i <= this.tileDim; ++i) {
      indices.push(i * (this.tileDim + 1));
      indices.push(i * (this.tileDim + 1) + this.tileDim);
      indices.push(-1);
    }

    // All the vertical lines:
    for (i = 0; i <= this.tileDim; ++i) {
      indices.push(i);
      indices.push(i + this.tileDim * (this.tileDim + 1));
      indices.push(-1);
    }

    return indices;
  }

  createSolidVertices(tile: THREE.Vector2, alpha: number, z: number): THREE.Vector3[] {
    var vertices = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        var centre = this.createCentre(tile.x * this.tileDim + x, tile.y * this.tileDim + y, z);
        vertices.push(lerp(centre, this.createTopLeft(centre), alpha));
        vertices.push(lerp(centre, this.createBottomLeft(centre), alpha));
        vertices.push(lerp(centre, this.createTopRight(centre), alpha));
        vertices.push(lerp(centre, this.createBottomRight(centre), alpha));
      }
    }

    return vertices;
  }

  // Creates a buffer of indices into the output of `createSolidVertices`
  // suitable for drawing a solid mesh of the grid.
  createSolidMeshIndices(): number[] {
    var indices: number[] = [];
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        // For some reason Three.js uses triangles rather than triangle strips, grr
        var baseIndex = y * this.tileDim * 4 + x * 4;
        this.pushSquareIndices(indices, baseIndex);
      }
    }

    return indices;
  }

  // Creates some colours for testing the solid vertices, above.
  createSolidTestColours(): Float32Array {
    var colours = new Float32Array(this.tileDim * this.tileDim * 12);
    var colour = new THREE.Color();
    for (var i = 0; i < this.tileDim * this.tileDim; ++i) {
      colour.setHSL(i / (this.tileDim * this.tileDim), 1, 0.5);
      for (var j = 0; j < 4; ++j) {
        colours[i * 12 + j * 3] = colour.r;
        colours[i * 12 + j * 3 + 1] = colour.g;
        colours[i * 12 + j * 3 + 2] = colour.b;
      }
    }

    return colours;
  }

  createSolidCoordColours(tile: THREE.Vector2): Float32Array {
    var colours = new Float32Array(this.tileDim * this.tileDim * 12);
    var offset = 0;
    for (var y = 0; y < this.tileDim; ++y) {
      for (var x = 0; x < this.tileDim; ++x) {
        for (var i = 0; i < 4; ++i) {
          this.toPackedXYEdge(colours, offset, tile.x, tile.y, 0);
          this.toPackedXYAbs(colours, offset + 2, x, y);
          offset += 3;
        }
      }
    }

    return colours;
  }

  faceSize(): number {
    return this._squareSize;
  }

  toSingle(): IGridGeometry {
    return new SquareGridGeometry(this._squareSize, 1);
  }

  transformToEdge(o: THREE.Object3D, coord: GridEdge): void {
    var centre = this.createCoordCentre(coord, 0);
    o.translateX(centre.x);
    o.translateY(centre.y);
    if (coord.edge === 1) {
      o.rotateZ(Math.PI * 0.5);
    }
  }

  updateFaceHighlight(buf: THREE.BufferGeometry, coord: GridCoord | undefined, z: number): void {
    if (!coord) {
      buf.setDrawRange(0, 0);
      return;
    }

    var position = buf.attributes.position as THREE.BufferAttribute;
    var centre = this.createCoordCentre(coord, z);

    var topLeft = this.createTopLeft(centre);
    position.setXYZ(0, topLeft.x, topLeft.y, 2);

    var bottomLeft = this.createBottomLeft(centre);
    position.setXYZ(1, bottomLeft.x, bottomLeft.y, 2);

    var topRight = this.createTopRight(centre);
    position.setXYZ(2, topRight.x, topRight.y, 2);

    var bottomRight = this.createBottomRight(centre);
    position.setXYZ(3, bottomRight.x, bottomRight.y, 2);

    position.needsUpdate = true;
    buf.setDrawRange(0, buf.index?.array.length ?? 0);
    buf.computeBoundingSphere();
  }
}