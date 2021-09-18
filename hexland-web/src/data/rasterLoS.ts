import { GridCoord } from './coord';
import { IBareFeature, IBoundedFeatureDictionary } from './feature';
import * as THREE from 'three';

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
    position: GridCoord, vis: number, los: IBoundedFeatureDictionary<GridCoord, IBareFeature>
  ) {
    const index = los.getIndex(position);
    if (index === undefined) {
      return;
    }

    const f = los.getByIndex(index);

    // Combining two partials makes a hidden
    los.setByIndex(
      index,
      { ...f, colour: f.colour === 1 && vis === 1 ? 2 : Math.max(f.colour, vis) }
    );
  }

  // Fills in the visible faces by tracing LoS
  // between the two rays (in line co-ordinates)
  // Only pays attention to the areas within the given tiles.
  export function traceSquaresRows(
    a: THREE.Vector3, // first ray
    b: THREE.Vector3, // second ray
    start: GridCoord, // start position to rasterise from
    direction: number, // -1 or 1 depending on which direction to progress in
    los: IBoundedFeatureDictionary<GridCoord, IBareFeature>, // write here.
                                                             // - 0 for fully visible
                                                             // - 1 for semi visible
                                                             // - 2 (or more) for fully hidden
  ): void {
    const r1 = new THREE.Vector3(start.x, start.y + direction, 1);
    const r2 = new THREE.Vector3(r1.x + direction, r1.y, 1);
    const directionStep = new THREE.Vector3(0, direction, 0);
    const [rasterLine, h1, h2] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const min = los.min.y;
    const max = los.max.y;
    while (r1.y >= min && r1.y <= max) {
      //console.debug(`r1 = ${r1.x}, ${r1.y}; r2 = ${r2.x}, ${r2.y}`);

      // Find the points of intersection
      createLineThrough(r1, r2, rasterLine);
      createLineIntersection(rasterLine, a, h1);
      createLineIntersection(rasterLine, b, h2);

      // Identify the grid coords affected
      let i1 = { x: h1.x / h1.z, y: h1.y / h1.z };
      let i2 = { x: h2.x / h2.z, y: h2.y / h2.z };
      if (i1.x > i2.x) {
        [i1, i2] = [i2, i1];
      }

      const gi1Y = Math.round(i1.y);
      const gi2Y = Math.round(i2.y);
      if (gi1Y !== gi2Y) {
        // Something has gone wrong!
        throw Error(`Rows rasterisation came off axis: i1 = ${i1.x}, ${i1.y}; i2 = ${i2.x}, ${i2.y}`);
      }

      let giLOuter = Math.floor(i1.x);
      const giLInner = Math.ceil(i1.x);
      const giUInner = Math.floor(i2.x);
      let giUOuter = Math.ceil(i2.x);

      // Remember the centres of the faces are at round number co-ordinates and the
      // edges at multiples of 0.5:
      if ((giLInner - i1.x) <= 0.5) {
        giLOuter = giLInner;
      }

      if ((i2.x - giUInner) <= 0.5) {
        giUOuter = giUInner;
      }

      //console.debug(`at y=${gi1Y}: ${giLOuter}:${i1.x}:${giLInner} -- ${giUInner}:${i2.x}:${giUOuter}`);

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
    los: IBoundedFeatureDictionary<GridCoord, IBareFeature>, // write here.
                                                             // - 0 for fully visible
                                                             // - 1 for semi visible
                                                             // - 2 (or more) for fully hidden
  ): void {
    const r1 = new THREE.Vector3(start.x + direction, start.y, 1);
    const r2 = new THREE.Vector3(r1.x, r1.y + direction, 1);
    const directionStep = new THREE.Vector3(direction, 0, 0);
    const [rasterLine, h1, h2] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const min = los.min.x;
    const max = los.max.x;
    while (r1.x >= min && r1.x <= max) {
      //console.debug(`r1 = ${r1.x}, ${r1.y}; r2 = ${r2.x}, ${r2.y}`);

      // Find the points of intersection
      createLineThrough(r1, r2, rasterLine);
      createLineIntersection(rasterLine, a, h1);
      createLineIntersection(rasterLine, b, h2);

      // Identify the grid coords affected
      let i1 = { x: h1.x / h1.z, y: h1.y / h1.z };
      let i2 = { x: h2.x / h2.z, y: h2.y / h2.z };
      if (i1.y > i2.y) {
        [i1, i2] = [i2, i1];
      }

      const gi1X = Math.round(i1.x);
      const gi2X = Math.round(i2.x);
      if (gi1X !== gi2X) {
        // Something has gone wrong!
        throw Error(`Columns rasterisation came off axis: i1 = ${i1.x}, ${i1.y}; i2 = ${i2.x}, ${i2.y}`);
      }

      let giLOuter = Math.floor(i1.y);
      const giLInner = Math.ceil(i1.y);
      const giUInner = Math.floor(i2.y);
      let giUOuter = Math.ceil(i2.y);

      // Remember the centres of the faces are at round number co-ordinates and the
      // edges at multiples of 0.5:
      if ((giLInner - i1.y) <= 0.5) {
        giLOuter = giLInner;
      }

      if ((i2.y - giUInner) <= 0.5) {
        giUOuter = giUInner;
      }

      //console.debug(`at x=${gi1X}: ${giLOuter}:${i1.y}:${giLInner} -- ${giUInner}:${i2.y}:${giUOuter}`);

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

  // Merges the other LoS into the target one. In the target, faces will be visible if
  // they are visible in it currently or in any of the targets.
  export function combine(
    target: IBoundedFeatureDictionary<GridCoord, IBareFeature>,
    ...others: IBoundedFeatureDictionary<GridCoord, IBareFeature>[]
  ) {
    for (const o of others) {
      for (const { position, feature } of o) {
        const targetIndex = target.getIndex(position);
        if (targetIndex === undefined) {
          continue;
        }

        const existing = target.getByIndex(targetIndex);
        target.setByIndex(
          targetIndex,
          { ...existing, colour: Math.min(existing.colour, feature.colour) }
        );
      }
    }
    return target;
  }
}