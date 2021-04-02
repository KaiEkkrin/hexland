import { GridCoord, GridEdge } from '../data/coord';
import { IFeature, IFeatureDictionary } from '../data/feature';
import * as THREE from 'three';
import { IGridGeometry } from './gridGeometry';

export module rasterLoS {
  // Creates the line through the given two points in line co-ordinates
  // and returns it too. (Points in homogeneous co-ordinates)
  export function createLineThrough(
    a: THREE.Vector3,
    b: THREE.Vector3,
    line: THREE.Vector3
  ): THREE.Vector3 {
    // as per https://en.wikipedia.org/wiki/Line_coordinates the line is defined
    // as (lx + my + nz = 0) where (l, m, n) is the 3-vector in line co-ordinates
    if (a.equals(b)) {
      throw Error("Points are equal");
    }

    // This formula from "Formulas" further down that page, turning a and b into
    // homogeneous co-ordinates
    return line.set(
      a.y * b.z - b.y * a.z,
      b.x * a.z - a.x * b.z,
      a.x * b.y - b.x * a.y
    );
  }

  // Creates the intersection between the two lines (if it exists) and fills into into
  // `point` in homogeneous co-ordinates.
  // I notice these two functions are the same
  export function createLineIntersection(
    a: THREE.Vector3,
    b: THREE.Vector3,
    point: THREE.Vector3
  ): THREE.Vector3 {
    if (a.equals(b)) {
      throw Error("Lines are equal");
    }

    return point.set(
      a.y * b.z - b.y * a.z,
      b.x * a.z - a.x * b.z,
      a.x * b.y - b.x * a.y
    );
  }

  // Decreases visibility (0 visible, 1 partial, 2 hidden) on a face.
  function decreaseVisibility(
    position: GridCoord, vis: number, los: IFeatureDictionary<GridCoord, IFeature<GridCoord>>
  ) {
    const before = los.remove(position);
    if (before !== undefined) {
      // Combining two partials makes a hidden
      los.add({ position, colour: before.colour === 1 && vis === 1 ? 2 : Math.max(before.colour, vis) });
    } else {
      los.add({ position, colour: vis });
    }
  }

  // Fills in the visible faces by tracing LoS
  // between the two rays (in line co-ordinates)
  // Only pays attention to the areas within the given tiles.
  export function traceSquaresRows(
    a: THREE.Vector3, // first ray
    b: THREE.Vector3, // second ray
    start: GridCoord, // start position to rasterise from
    direction: number, // -1 or 1 depending on which direction to progress in
    min: number, // lower y bound of LoS
    max: number, // upper y bound of LoS
    los: IFeatureDictionary<GridCoord, IFeature<GridCoord>>, // write here. 1 for semi visible, 2 for fully
  ): void {
    const r1 = new THREE.Vector3(start.x, start.y + direction, 1);
    const r2 = new THREE.Vector3(r1.x + direction, r1.y, 1);
    const directionStep = new THREE.Vector3(0, direction, 0);
    const [rasterLine, h1, h2] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    while (r1.y >= min && r1.y <= max) {
      //console.log(`r1 = ${r1.x}, ${r1.y}; r2 = ${r2.x}, ${r2.y}`);

      // Find the points of intersection
      createLineThrough(r1, r2, rasterLine);
      createLineIntersection(rasterLine, a, h1);
      createLineIntersection(rasterLine, b, h2);

      // Identify the grid coords affected
      const i1 = { x: h1.x / h1.z, y: h1.y / h1.z };
      const i2 = { x: h2.x / h2.z, y: h2.y / h2.z };

      const gi1Y = Math.round(i1.y);
      const gi2Y = Math.round(i2.y);
      if (gi1Y !== gi2Y) {
        // Something has gone wrong!
        throw Error(`Rows rasterisation came off axis: i1 = ${i1.x}, ${i1.y}; i2 = ${i2.x}, ${i2.y}`);
      }

      const gi1XFloor = Math.floor(i1.x);
      const gi1XCeil = Math.ceil(i1.x);
      const gi2XFloor = Math.floor(i2.x);
      const gi2XCeil = Math.ceil(i2.x);

      const [giLOuter, giLInner, giUInner, giUOuter] = i1.x < i2.x ?
        [gi1XFloor, gi1XCeil, gi2XFloor, gi2XCeil] :
        [gi2XFloor, gi2XCeil, gi1XFloor, gi1XCeil];

      //console.log(`at y=${gi1Y}: ${giLOuter}:${iL}:${giLInner} -- ${giUInner}:${iU}:${giUOuter}`);

      // Fill in the visibilities.
      // Either end may be either hidden or partially visible depending on
      // how far the actual ray intersection is from the coord
      if (giLOuter !== giLInner) {
        decreaseVisibility({ x: giLOuter, y: gi1Y }, 1, los);
      }

      for (let x = giLInner; x <= giUInner; ++x) {
        decreaseVisibility({ x, y: gi1Y }, x === giLOuter || x === giUOuter ? 1 : 2, los);
      }

      if (giUOuter !== giUInner) {
        decreaseVisibility({ x: giUOuter, y: gi1Y }, 1, los);
      }

      // Move the raster line along a step
      r1.add(directionStep);
      r2.add(directionStep);
    }
  }

  export function traceSquaresColumns(
    a: THREE.Vector3, // first ray
    b: THREE.Vector3, // second ray
    start: GridCoord, // start position to rasterise from
    direction: number, // -1 or 1 depending on which direction to progress in
    min: number, // lower x bound of LoS
    max: number, // upper x bound of LoS
    los: IFeatureDictionary<GridCoord, IFeature<GridCoord>>, // write here. 1 for semi visible, 2 for fully
  ): void {
    const r1 = new THREE.Vector3(start.x + direction, start.y, 1);
    const r2 = new THREE.Vector3(r1.x, r1.y + direction, 1);
    const directionStep = new THREE.Vector3(direction, 0, 0);
    const [rasterLine, h1, h2] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    while (r1.x >= min && r1.x <= max) {
      //console.log(`r1 = ${r1.x}, ${r1.y}; r2 = ${r2.x}, ${r2.y}`);

      // Find the points of intersection
      createLineThrough(r1, r2, rasterLine);
      createLineIntersection(rasterLine, a, h1);
      createLineIntersection(rasterLine, b, h2);

      // Identify the grid coords affected
      const i1 = { x: h1.x / h1.z, y: h1.y / h1.z };
      const i2 = { x: h2.x / h2.z, y: h2.y / h2.z };

      const gi1X = Math.round(i1.x);
      const gi2X = Math.round(i2.x);
      if (gi1X !== gi2X) {
        // Something has gone wrong!
        throw Error(`Columns rasterisation came off axis: i1 = ${i1.x}, ${i1.y}; i2 = ${i2.x}, ${i2.y}`);
      }

      const gi1YFloor = Math.floor(i1.y);
      const gi1YCeil = Math.ceil(i1.y);
      const gi2YFloor = Math.floor(i2.y);
      const gi2YCeil = Math.ceil(i2.y);

      const [giLOuter, giLInner, giUInner, giUOuter] = i1.y < i2.y ?
        [gi1YFloor, gi1YCeil, gi2YFloor, gi2YCeil] :
        [gi2YFloor, gi2YCeil, gi1YFloor, gi1YCeil];

      //console.log(`at x=${gi1X}: ${giLOuter}:${iL}:${giLInner} -- ${giUInner}:${iU}:${giUOuter}`);

      // Fill in the visibilities.
      // Either end may be either hidden or partially visible depending on
      // how far the actual ray intersection is from the coord
      if (giLOuter !== giLInner) {
        decreaseVisibility({ x: gi1X, y: giLOuter }, 1, los);
      }

      for (let y = giLInner; y <= giUInner; ++y) {
        decreaseVisibility({ x: gi1X, y }, y === giLOuter || y === giUOuter ? 1 : 2, los);
      }

      if (giUOuter !== giUInner) {
        decreaseVisibility({ x: gi1X, y: giUOuter }, 1, los);
      }

      // Move the raster line along a step
      r1.add(directionStep);
      r2.add(directionStep);
    }
  }

  // Blocks out the LoS from a single face by walls.
  // TODO Optimise to include only reachable walls (by map colouring), etc?
  export function traceSingleSquares(
    geometry: IGridGeometry, // TODO fix for hexes too; integrate with IGridGeometry (or not)
    origin: THREE.Vector3, // position to look from (homogeneous co-ordinates; or, z=1)
    min: THREE.Vector2, // lower bounds of LoS area
    max: THREE.Vector2, // upper bounds of LoS area
    walls: IFeatureDictionary<GridEdge, IFeature<GridEdge>>, // read only
    los: IFeatureDictionary<GridCoord, IFeature<GridCoord>>, // write here. 1 for semi visible, 2 for fully
  ): void {
    const [w1, w2, wCentre, a, b] =
      [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    function traceWall(wall: IFeature<GridEdge>): void {
      // TODO check for the wall being at least partly inside the same map colouring area as the
      // origin here; otherwise, can ignore it
      const adjacency = geometry.getEdgeFaceAdjacency(wall.position);

      // If either face is outside bounds we can skip it
      for (const adj of adjacency) {
        if (adj.x < min.x || adj.y < min.y || adj.x > max.x || adj.y > max.y) {
          return;
        }
      }
    
      // If both sides of this wall are already invisible we can safely skip it -- it would
      // have no effect on the LoS overall
      const minVisibility = adjacency.reduce(
        (vis, adj) =>
        {
          const here = los.get(adj);
          return Math.min(vis, here?.colour ?? 0);
        }, 0
      );
      if (minVisibility === 2) {
        return;
      }
    
      // TODO Possible optimisation here -- merge aligned walls into longer sections handled together
      // (Although, that wouldn't work for hexes...)
    
      // Work out the two ends of the wall in LoS co-ordinates, wherein the integer co-ordinate is in
      // the centre of the face
      if (wall.position.edge === 0) {
        // bottom left -> top left
        w1.set(wall.position.x - 0.5, wall.position.y + 0.5, 1);
        w2.set(wall.position.x - 0.5, wall.position.y - 0.5, 1);
        wCentre.set(wall.position.x - 0.5, wall.position.y, 1);
      } else {
        // top left -> top right
        w1.set(wall.position.x - 0.5, wall.position.y - 0.5, 1);
        w2.set(wall.position.x + 0.5, wall.position.y - 0.5, 1);
        wCentre.set(wall.position.x, wall.position.y - 0.5, 1);
      }

      // Draw the rays
      createLineThrough(origin, w1, a);
      createLineThrough(origin, w2, b);

      // The start position is the closest adjacent face to the origin
      const { start } = adjacency.reduce(
        ({ start, dsq }, adj) => {
          const pos = new THREE.Vector3(adj.x, adj.y, 1);
          const posDsq = pos.distanceToSquared(origin);
          return posDsq < dsq ? { start: adj, dsq: posDsq } : { start, dsq };
        },
        { start: undefined as GridCoord | undefined, dsq: Number.MAX_SAFE_INTEGER }
      );
      if (start === undefined) {
        throw Error("Start position couldn't be resolved");
      }

      // Do we want to trace rows or columns?
      if (Math.abs(wCentre.x - origin.x) > Math.abs(wCentre.y - origin.y)) {
        traceSquaresColumns(
          a, b, start, Math.sign(wCentre.x - origin.x), min.x, max.x, los
        );
      } else {
        traceSquaresRows(
          a, b, start, Math.sign(wCentre.y - origin.y), min.y, max.y, los
        );
      }
    }

    walls.forEach(w => traceWall(w));
  }
}