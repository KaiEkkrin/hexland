import { coordString, edgeString, GridCoord, GridEdge } from '../data/coord';
import { FeatureDictionary, IFeature, IFeatureDictionary } from '../data/feature';
import { rasterLoS } from '../data/rasterLoS';
import { SquareGridGeometry } from './squareGridGeometry';

import * as THREE from 'three';

function initLoSDictionary(
  min: THREE.Vector2,
  max: THREE.Vector2,
  los?: IFeatureDictionary<GridCoord, IFeature<GridCoord>>
) {
  los ??= new FeatureDictionary<GridCoord, IFeature<GridCoord>>(coordString);
  los.clear();
  for (let y = min.y; y <= max.y; ++y) {
    for (let x = min.x; x <= max.x; ++x) {
      los.add({ position: { x, y }, colour: 0 });
    }
  }
  return los;
}

function losString(
  min: THREE.Vector2,
  max: THREE.Vector2,
  los: FeatureDictionary<GridCoord, IFeature<GridCoord>>
): string {
  // Writes the LoS to the a string as a grid as follows
  // . = fully visible
  // o = partially visible
  // X = fully hidden
  const messages: string[] = [];
  const topRow: string[] = [];
  for (let x = min.x; x <= max.x; ++x) {
    topRow.push(`${x}`.padStart(2, ' '));
  }

  messages.push(`    ${topRow.join('')}\n`);
  for (let y = min.y; y <= max.y; ++y) {
    const row: string[] = [];
    for (let x = min.x; x <= max.x; ++x) {
      const there = los.get({ x, y });
      if (there !== undefined) {
        row.push(there.colour === 0 ? '.' : there.colour === 1 ? 'o' : 'X');
      } else {
        row.push(' ');
      }
    }

    const prefix = `${y}`.padStart(3, ' ');
    messages.push(`${prefix}  ${row.join(' ')}`);
  }

  return '\n' + messages.join('\n');
}

describe('raster LoS test', () => {
  const geometry = new SquareGridGeometry(75, 8);
  const origin = new THREE.Vector3(0, 0, 1);
  const min = new THREE.Vector2(-8, -8);
  const max = new THREE.Vector2(8, 8);
  const walls = new FeatureDictionary<GridEdge, IFeature<GridEdge>>(edgeString);
  const los = new FeatureDictionary<GridCoord, IFeature<GridCoord>>(coordString);

  // Initialise everything to visible
  function initLoS(minX?: number, minY?: number, maxX?: number, maxY?: number) {
    min.set(minX ?? -8, minY ?? -8);
    max.set(maxX ?? 8, maxY ?? 8);
    walls.clear();
    initLoSDictionary(min, max, los);
  }

  test('rasterise horizontally from origin (minus)', () => {
    initLoS();

    // rays
    const a = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(-1, -1, 1), new THREE.Vector3()
    );
    const b = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(1, -1, 1), new THREE.Vector3()
    );

    rasterLoS.traceSquaresRows(a, b, { x: origin.x, y: origin.y }, -1, min.y, max.y, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  o X X X X X X X X X X X X X X X o
 -7  . o X X X X X X X X X X X X X o .
 -6  . . o X X X X X X X X X X X o . .
 -5  . . . o X X X X X X X X X o . . .
 -4  . . . . o X X X X X X X o . . . .
 -3  . . . . . o X X X X X o . . . . .
 -2  . . . . . . o X X X o . . . . . .
 -1  . . . . . . . o X o . . . . . . .
  0  . . . . . . . . . . . . . . . . .
  1  . . . . . . . . . . . . . . . . .
  2  . . . . . . . . . . . . . . . . .
  3  . . . . . . . . . . . . . . . . .
  4  . . . . . . . . . . . . . . . . .
  5  . . . . . . . . . . . . . . . . .
  6  . . . . . . . . . . . . . . . . .
  7  . . . . . . . . . . . . . . . . .
  8  . . . . . . . . . . . . . . . . .`);
  });

  test('rasterise vertically from origin (minus)', () => {
    initLoS();
  
    // rays
    const a = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(-1, 1, 1), new THREE.Vector3()
    );
    const b = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(-1, -1, 1), new THREE.Vector3()
    );

    rasterLoS.traceSquaresColumns(a, b, { x: origin.x, y: origin.y }, -1, min.x, max.x, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  o . . . . . . . . . . . . . . . .
 -7  X o . . . . . . . . . . . . . . .
 -6  X X o . . . . . . . . . . . . . .
 -5  X X X o . . . . . . . . . . . . .
 -4  X X X X o . . . . . . . . . . . .
 -3  X X X X X o . . . . . . . . . . .
 -2  X X X X X X o . . . . . . . . . .
 -1  X X X X X X X o . . . . . . . . .
  0  X X X X X X X X . . . . . . . . .
  1  X X X X X X X o . . . . . . . . .
  2  X X X X X X o . . . . . . . . . .
  3  X X X X X o . . . . . . . . . . .
  4  X X X X o . . . . . . . . . . . .
  5  X X X o . . . . . . . . . . . . .
  6  X X o . . . . . . . . . . . . . .
  7  X o . . . . . . . . . . . . . . .
  8  o . . . . . . . . . . . . . . . .`);
  });

  test('rasterise horizontally from origin (plus)', () => {
    initLoS();

    // rays
    const a = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(-1, 1, 1), new THREE.Vector3()
    );
    const b = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(1, 1, 1), new THREE.Vector3()
    );

    rasterLoS.traceSquaresRows(a, b, { x: origin.x, y: origin.y }, 1, min.y, max.y, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . . . . . . . . . . . . .
 -7  . . . . . . . . . . . . . . . . .
 -6  . . . . . . . . . . . . . . . . .
 -5  . . . . . . . . . . . . . . . . .
 -4  . . . . . . . . . . . . . . . . .
 -3  . . . . . . . . . . . . . . . . .
 -2  . . . . . . . . . . . . . . . . .
 -1  . . . . . . . . . . . . . . . . .
  0  . . . . . . . . . . . . . . . . .
  1  . . . . . . . o X o . . . . . . .
  2  . . . . . . o X X X o . . . . . .
  3  . . . . . o X X X X X o . . . . .
  4  . . . . o X X X X X X X o . . . .
  5  . . . o X X X X X X X X X o . . .
  6  . . o X X X X X X X X X X X o . .
  7  . o X X X X X X X X X X X X X o .
  8  o X X X X X X X X X X X X X X X o`);
  });

  test('rasterise vertically from origin (plus)', () => {
    initLoS();
  
    // rays
    const a = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(1, 1, 1), new THREE.Vector3()
    );
    const b = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(1, -1, 1), new THREE.Vector3()
    );

    rasterLoS.traceSquaresColumns(a, b, { x: origin.x, y: origin.y }, 1, min.x, max.x, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . . . . . . . . . . . . o
 -7  . . . . . . . . . . . . . . . o X
 -6  . . . . . . . . . . . . . . o X X
 -5  . . . . . . . . . . . . . o X X X
 -4  . . . . . . . . . . . . o X X X X
 -3  . . . . . . . . . . . o X X X X X
 -2  . . . . . . . . . . o X X X X X X
 -1  . . . . . . . . . o X X X X X X X
  0  . . . . . . . . . X X X X X X X X
  1  . . . . . . . . . o X X X X X X X
  2  . . . . . . . . . . o X X X X X X
  3  . . . . . . . . . . . o X X X X X
  4  . . . . . . . . . . . . o X X X X
  5  . . . . . . . . . . . . . o X X X
  6  . . . . . . . . . . . . . . o X X
  7  . . . . . . . . . . . . . . . o X
  8  . . . . . . . . . . . . . . . . o`);
  });

  test('draw one wall above origin', () => {
    initLoS();
    walls.add({ position: { x: 0, y: 0, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  o X X X X X X X X X X X X X X X o
 -7  . o X X X X X X X X X X X X X o .
 -6  . . o X X X X X X X X X X X o . .
 -5  . . . o X X X X X X X X X o . . .
 -4  . . . . o X X X X X X X o . . . .
 -3  . . . . . o X X X X X o . . . . .
 -2  . . . . . . o X X X o . . . . . .
 -1  . . . . . . . o X o . . . . . . .
  0  . . . . . . . . . . . . . . . . .
  1  . . . . . . . . . . . . . . . . .
  2  . . . . . . . . . . . . . . . . .
  3  . . . . . . . . . . . . . . . . .
  4  . . . . . . . . . . . . . . . . .
  5  . . . . . . . . . . . . . . . . .
  6  . . . . . . . . . . . . . . . . .
  7  . . . . . . . . . . . . . . . . .
  8  . . . . . . . . . . . . . . . . .`);
  });

  test('draw L shape top left of origin', () => {
    initLoS();
    walls.add({ position: { x: 0, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 0, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  X X X X X X X X X X X X X X X X o
 -7  X X X X X X X X X X X X X X X o .
 -6  X X X X X X X X X X X X X X o . .
 -5  X X X X X X X X X X X X X o . . .
 -4  X X X X X X X X X X X X o . . . .
 -3  X X X X X X X X X X X o . . . . .
 -2  X X X X X X X X X X o . . . . . .
 -1  X X X X X X X X X o . . . . . . .
  0  X X X X X X X X . . . . . . . . .
  1  X X X X X X X o . . . . . . . . .
  2  X X X X X X o . . . . . . . . . .
  3  X X X X X o . . . . . . . . . . .
  4  X X X X o . . . . . . . . . . . .
  5  X X X o . . . . . . . . . . . . .
  6  X X o . . . . . . . . . . . . . .
  7  X o . . . . . . . . . . . . . . .
  8  o . . . . . . . . . . . . . . . .`);
  });

  test('draw origin boxed in', () => {
    initLoS();
    walls.add({ position: { x: 0, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 0, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 1, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 1, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  X X X X X X X X X X X X X X X X X
 -7  X X X X X X X X X X X X X X X X X
 -6  X X X X X X X X X X X X X X X X X
 -5  X X X X X X X X X X X X X X X X X
 -4  X X X X X X X X X X X X X X X X X
 -3  X X X X X X X X X X X X X X X X X
 -2  X X X X X X X X X X X X X X X X X
 -1  X X X X X X X X X X X X X X X X X
  0  X X X X X X X X . X X X X X X X X
  1  X X X X X X X X X X X X X X X X X
  2  X X X X X X X X X X X X X X X X X
  3  X X X X X X X X X X X X X X X X X
  4  X X X X X X X X X X X X X X X X X
  5  X X X X X X X X X X X X X X X X X
  6  X X X X X X X X X X X X X X X X X
  7  X X X X X X X X X X X X X X X X X
  8  X X X X X X X X X X X X X X X X X`);
  });

  test('draw four 2-distance walls', () => {
    initLoS();
    walls.add({ position: { x: 0, y: -1, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -1, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 2, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . o X X X X X o . . . . .
 -7  . . . . . . o X X X o . . . . . .
 -6  . . . . . . o X X X o . . . . . .
 -5  . . . . . . o X X X o . . . . . .
 -4  . . . . . . . o X o . . . . . . .
 -3  o . . . . . . o X o . . . . . . o
 -2  X o o o . . . o X o . . . o o o X
 -1  X X X X o o o . . . o o o X X X X
  0  X X X X X X X . . . X X X X X X X
  1  X X X X o o o . . . o o o X X X X
  2  X o o o . . . o X o . . . o o o X
  3  o . . . . . . o X o . . . . . . o
  4  . . . . . . . o X o . . . . . . .
  5  . . . . . . o X X X o . . . . . .
  6  . . . . . . o X X X o . . . . . .
  7  . . . . . . o X X X o . . . . . .
  8  . . . . . o X X X X X o . . . . .`);
  });

  test('draw four 3-distance walls', () => {
    initLoS();
    walls.add({ position: { x: 0, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 3, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 3, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . . o X X X o . . . . . .
 -7  . . . . . . . o X o . . . . . . .
 -6  . . . . . . . o X o . . . . . . .
 -5  . . . . . . . o X o . . . . . . .
 -4  . . . . . . . o X o . . . . . . .
 -3  . . . . . . . o X o . . . . . . .
 -2  o . . . . . . . . . . . . . . . o
 -1  X o o o o o . . . . . o o o o o X
  0  X X X X X X . . . . . X X X X X X
  1  X o o o o o . . . . . o o o o o X
  2  o . . . . . . . . . . . . . . . o
  3  . . . . . . . o X o . . . . . . .
  4  . . . . . . . o X o . . . . . . .
  5  . . . . . . . o X o . . . . . . .
  6  . . . . . . . o X o . . . . . . .
  7  . . . . . . . o X o . . . . . . .
  8  . . . . . . o X X X o . . . . . .`);
  });

  test('draw four 5-distance walls', () => {
    initLoS();
    walls.add({ position: { x: 0, y: -4, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -4, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 5, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 5, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . . . o X o . . . . . . .
 -7  . . . . . . . o X o . . . . . . .
 -6  . . . . . . . o X o . . . . . . .
 -5  . . . . . . . o X o . . . . . . .
 -4  . . . . . . . . . . . . . . . . .
 -3  . . . . . . . . . . . . . . . . .
 -2  . . . . . . . . . . . . . . . . .
 -1  o o o o . . . . . . . . . o o o o
  0  X X X X . . . . . . . . . X X X X
  1  o o o o . . . . . . . . . o o o o
  2  . . . . . . . . . . . . . . . . .
  3  . . . . . . . . . . . . . . . . .
  4  . . . . . . . . . . . . . . . . .
  5  . . . . . . . o X o . . . . . . .
  6  . . . . . . . o X o . . . . . . .
  7  . . . . . . . o X o . . . . . . .
  8  . . . . . . . o X o . . . . . . .`);
  });

  test('draw four 2-distance corners', () => {
    initLoS();
    walls.add({ position: { x: -1, y: -1, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -1, y: -1, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 2, y: -1, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 1, y: -1, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -1, y: 1, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -1, y: 2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 2, y: 1, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 1, y: 2, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  X X X X X o . . . . . o X X X X X
 -7  X X X X X X o . . . o X X X X X X
 -6  X X X X X X o . . . o X X X X X X
 -5  X X X X X X o . . . o X X X X X X
 -4  X X X X X X X o . o X X X X X X X
 -3  o X X X X X X o . o X X X X X X o
 -2  . o o o X X X o . o X X X o o o .
 -1  . . . . o o o . . . o o o . . . .
  0  . . . . . . . . . . . . . . . . .
  1  . . . . o o o . . . o o o . . . .
  2  . o o o X X X o . o X X X o o o .
  3  o X X X X X X o . o X X X X X X o
  4  X X X X X X X o . o X X X X X X X
  5  X X X X X X o . . . o X X X X X X
  6  X X X X X X o . . . o X X X X X X
  7  X X X X X X o . . . o X X X X X X
  8  X X X X X o . . . . . o X X X X X`);
  });

  test('draw four 3-distance corners', () => {
    initLoS();
    walls.add({ position: { x: -2, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: 3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 3, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  X X X o . . . . . . . . . o X X X
 -7  X X X X o . . . . . . . o X X X X
 -6  X X X X o . . . . . . . o X X X X
 -5  o X X X X o . . . . . o X X X X o
 -4  . o o X X X o . . . o X X X o o .
 -3  . . . o X X o . . . o X X o . . .
 -2  . . . . o o . . . . . o o . . . .
 -1  . . . . . . . . . . . . . . . . .
  0  . . . . . . . . . . . . . . . . .
  1  . . . . . . . . . . . . . . . . .
  2  . . . . o o . . . . . o o . . . .
  3  . . . o X X o . . . o X X o . . .
  4  . o o X X X o . . . o X X X o o .
  5  o X X X X o . . . . . o X X X X o
  6  X X X X o . . . . . . . o X X X X
  7  X X X X o . . . . . . . o X X X X
  8  X X X o . . . . . . . . . o X X X`);
  });

  test('draw vertical walls of 3', () => {
    initLoS();
    walls.add({ position: { x: -3, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -3, y: -1, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 4, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 4, y: -1, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 4, y: -2, edge: 0 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . . . . . . . . . . . . .
 -7  . . . . . . . . . . . . . . . . .
 -6  o . . . . . . . . . . . . . . . o
 -5  X o . . . . . . . . . . . . . o X
 -4  X X o o . . . . . . . . . o o X X
 -3  X X X X o . . . . . . . o X X X X
 -2  X X X X X . . . . . . . X X X X X
 -1  X X X X X . . . . . . . X X X X X
  0  X X X X X . . . . . . . X X X X X
  1  o o o o o . . . . . . . o o o o o
  2  . . . . . . . . . . . . . . . . .
  3  . . . . . . . . . . . . . . . . .
  4  . . . . . . . . . . . . . . . . .
  5  . . . . . . . . . . . . . . . . .
  6  . . . . . . . . . . . . . . . . .
  7  . . . . . . . . . . . . . . . . .
  8  . . . . . . . . . . . . . . . . .`);
  });

  test('draw horizontal walls of 3', () => {
    initLoS();
    walls.add({ position: { x: 0, y: -3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 1, y: -3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 2, y: -3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 0, y: 4, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 1, y: 4, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 2, y: 4, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . . . o X X X X X X o . .
 -7  . . . . . . . o X X X X X o . . .
 -6  . . . . . . . o X X X X o . . . .
 -5  . . . . . . . o X X X X o . . . .
 -4  . . . . . . . o X X X o . . . . .
 -3  . . . . . . . . . . . . . . . . .
 -2  . . . . . . . . . . . . . . . . .
 -1  . . . . . . . . . . . . . . . . .
  0  . . . . . . . . . . . . . . . . .
  1  . . . . . . . . . . . . . . . . .
  2  . . . . . . . . . . . . . . . . .
  3  . . . . . . . . . . . . . . . . .
  4  . . . . . . . o X X X o . . . . .
  5  . . . . . . . o X X X X o . . . .
  6  . . . . . . . o X X X X o . . . .
  7  . . . . . . . o X X X X X o . . .
  8  . . . . . . . o X X X X X X o . .`);
  });

  test('draw vertical walls of 3 with a gap', () => {
    initLoS();
    walls.add({ position: { x: -3, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 4, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 4, y: -2, edge: 0 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . . . . . . . . . . . . .
 -7  . . . . . . . . . . . . . . . . .
 -6  o . . . . . . . . . . . . . . . o
 -5  X o . . . . . . . . . . . . . o X
 -4  X X o o . . . . . . . . . o o X X
 -3  o o o X o . . . . . . . o X o o o
 -2  . . . o o . . . . . . . o o . . .
 -1  o o o o o . . . . . . . o o o o o
  0  X X X X X . . . . . . . X X X X X
  1  o o o o o . . . . . . . o o o o o
  2  . . . . . . . . . . . . . . . . .
  3  . . . . . . . . . . . . . . . . .
  4  . . . . . . . . . . . . . . . . .
  5  . . . . . . . . . . . . . . . . .
  6  . . . . . . . . . . . . . . . . .
  7  . . . . . . . . . . . . . . . . .
  8  . . . . . . . . . . . . . . . . .`);
  });

  test('draw horizontal walls of 3 with a gap', () => {
    initLoS();
    walls.add({ position: { x: 0, y: -3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 2, y: -3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 0, y: 4, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 2, y: 4, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . . . o X o . o X X o . .
 -7  . . . . . . . o X o . o X o . . .
 -6  . . . . . . . o X o . o o . . . .
 -5  . . . . . . . o X o o X o . . . .
 -4  . . . . . . . o X o o o . . . . .
 -3  . . . . . . . . . . . . . . . . .
 -2  . . . . . . . . . . . . . . . . .
 -1  . . . . . . . . . . . . . . . . .
  0  . . . . . . . . . . . . . . . . .
  1  . . . . . . . . . . . . . . . . .
  2  . . . . . . . . . . . . . . . . .
  3  . . . . . . . . . . . . . . . . .
  4  . . . . . . . o X o o o . . . . .
  5  . . . . . . . o X o o X o . . . .
  6  . . . . . . . o X o . o o . . . .
  7  . . . . . . . o X o . o X o . . .
  8  . . . . . . . o X o . o X X o . .`);
  });

  test('draw four 3-distance corners with offset view (tall)', () => {
    initLoS(-10, -9, 6, 11);
    walls.add({ position: { x: -2, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: 3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 3, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -10-9-8-7-6-5-4-3-2-1 0 1 2 3 4 5 6

 -9  X X X X X o . . . . . . . . . o X
 -8  X X X X X o . . . . . . . . . o X
 -7  X X X X X X o . . . . . . . o X X
 -6  o X X X X X o . . . . . . . o X X
 -5  . o o X X X X o . . . . . o X X X
 -4  . . . o o X X X o . . . o X X X o
 -3  . . . . . o X X o . . . o X X o .
 -2  . . . . . . o o . . . . . o o . .
 -1  . . . . . . . . . . . . . . . . .
  0  . . . . . . . . . . . . . . . . .
  1  . . . . . . . . . . . . . . . . .
  2  . . . . . . o o . . . . . o o . .
  3  . . . . . o X X o . . . o X X o .
  4  . . . o o X X X o . . . o X X X o
  5  . o o X X X X o . . . . . o X X X
  6  o X X X X X o . . . . . . . o X X
  7  X X X X X X o . . . . . . . o X X
  8  X X X X X o . . . . . . . . . o X
  9  X X X X X o . . . . . . . . . o X
 10  X X X X o . . . . . . . . . . . o
 11  X X X o . . . . . . . . . . . . .`);
  });

  test('draw four 3-distance corners with offset view (wide)', () => {
    initLoS(-10, -9, 11, 7);
    walls.add({ position: { x: -2, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: 3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 3, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -10-9-8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8 91011

 -9  X X X X X o . . . . . . . . . o X X X X X X
 -8  X X X X X o . . . . . . . . . o X X X X X X
 -7  X X X X X X o . . . . . . . o X X X X X X o
 -6  o X X X X X o . . . . . . . o X X X X X o .
 -5  . o o X X X X o . . . . . o X X X X o o . .
 -4  . . . o o X X X o . . . o X X X o o . . . .
 -3  . . . . . o X X o . . . o X X o . . . . . .
 -2  . . . . . . o o . . . . . o o . . . . . . .
 -1  . . . . . . . . . . . . . . . . . . . . . .
  0  . . . . . . . . . . . . . . . . . . . . . .
  1  . . . . . . . . . . . . . . . . . . . . . .
  2  . . . . . . o o . . . . . o o . . . . . . .
  3  . . . . . o X X o . . . o X X o . . . . . .
  4  . . . o o X X X o . . . o X X X o o . . . .
  5  . o o X X X X o . . . . . o X X X X o o . .
  6  o X X X X X o . . . . . . . o X X X X X o .
  7  X X X X X X o . . . . . . . o X X X X X X o`);
  });

  test('draw four 3-distance corners with offset view and origin (tall)', () => {
    initLoS(-10, -9, 6, 11);
    walls.add({ position: { x: -2, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: 3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 3, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(new THREE.Vector3(0, 2, 1), min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -10-9-8-7-6-5-4-3-2-1 0 1 2 3 4 5 6

 -9  . . o X X X o . . . . . . . o X X
 -8  . . . o X X X o . . . . . o X X X
 -7  . . . . o X X o . . . . . o X X o
 -6  . . . . o X X o . . . . . o X X o
 -5  . . . . . o X X o . . . o X X o .
 -4  . . . . . . o X o . . . o X o . .
 -3  . . . . . . o X o . . . o X o . .
 -2  . . . . . . . . . . . . . . . . .
 -1  . . . . . . . . . . . . . . . . .
  0  o o o . . . . . . . . . . . . . .
  1  X X X o o o o o . . . . . o o o o
  2  X X X X X X X X . . . . . X X X X
  3  X X X X X X X X . . . . . X X X X
  4  X X X o o o . . . . . . . . . o o
  5  o o o . . . . . . . . . . . . . .
  6  . . . . . . . . . . . . . . . . .
  7  . . . . . . . . . . . . . . . . .
  8  . . . . . . . . . . . . . . . . .
  9  . . . . . . . . . . . . . . . . .
 10  . . . . . . . . . . . . . . . . .
 11  . . . . . . . . . . . . . . . . .`);
  });

  test('draw four 3-distance corners with offset view and origin (wide)', () => {
    initLoS(-10, -9, 11, 7);
    walls.add({ position: { x: -2, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: 3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 3, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(new THREE.Vector3(2, 0, 1), min, max, walls, los);
    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -10-9-8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8 91011

 -9  o . . . . . . . . . o X X X X o . . . . . .
 -8  X o . . . . . . . . o X X X X o . . . . . .
 -7  X X o . . . . . . . . o X X o . . . . . . .
 -6  X X X o o . . . . . . o X X o . . . . . . .
 -5  X X X X X o . . . . . o X X o . . . . . . .
 -4  o o X X X X o o . . . o X X . . . . . . . .
 -3  . . o o o X X X . . . o X X . . . . . . . .
 -2  . . . . . o o o . . . . . . . . . . . . . .
 -1  . . . . . . . . . . . . . . . . . . . . . .
  0  . . . . . . . . . . . . . . . . . . . . . .
  1  . . . . . . . . . . . . . . . . . . . . . .
  2  . . . . . o o o . . . . . . . . . . . . . .
  3  . . o o o X X X . . . o X X . . . . . . . .
  4  o o X X X X o o . . . o X X . . . . . . . .
  5  X X X X X o . . . . . o X X o . . . . . . .
  6  X X X o o . . . . . . o X X o . . . . . . .
  7  X X o . . . . . . . . o X X o . . . . . . .`);
  });

  test('draw four 3-distance corners with two combined views', () => {
    initLoS(-10, -9, 11, 7);
    walls.add({ position: { x: -2, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: 3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 3, edge: 1 }, colour: 0 });

    geometry.drawLoSSingle(new THREE.Vector3(0, -2, 1), min, max, walls, los);

    const other = geometry.drawLoSSingle(new THREE.Vector3(0, 2, 1), min, max, walls, initLoSDictionary(min, max));
    rasterLoS.combine(los, other);

    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -10-9-8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8 91011

 -9  . . . . . . . . . . . . . . . . . . . . . .
 -8  . . . . . . . . . . . . . . . . . . . . . .
 -7  . . . . . . . . . . . . . . . . . . . . . .
 -6  . . . . . . . . . . . . . . . . . . . . . .
 -5  . . . . . . . . . . . . . . . . . . . . . .
 -4  . . . . . . . . . . . . . . . . . . . . . .
 -3  . . . . . . o X . . . . . X o . . . . . . .
 -2  . . . . . . . . . . . . . . . . . . . . . .
 -1  . . . . . . . . . . . . . . . . . . . . . .
  0  o o o . . . . . . . . . . . . . . . o o o o
  1  . . . . . . . . . . . . . . . . . . . . . .
  2  . . . . . . . . . . . . . . . . . . . . . .
  3  . . . . . . o X . . . . . X o . . . . . . .
  4  . . . . . . . . . . . . . . . . . . . . . .
  5  . . . . . . . . . . . . . . . . . . . . . .
  6  . . . . . . . . . . . . . . . . . . . . . .
  7  . . . . . . . . . . . . . . . . . . . . . .`);
  });

  test('draw four 3-distance corners with a view in each corner', () => {
    initLoS(-10, -9, 11, 7);
    walls.add({ position: { x: -2, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: 3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 3, edge: 1 }, colour: 0 });

    geometry.drawLoSSingle(new THREE.Vector3(-2, -2, 1), min, max, walls, los);
    rasterLoS.combine(
      los,
      ...[new THREE.Vector3(2, -2, 1), new THREE.Vector3(2, 2, 1), new THREE.Vector3(-2, 2, 1)].map(o =>
        geometry.drawLoSSingle(
          o, min, max, walls, initLoSDictionary(min, max)
        )
      )
    );

    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -10-9-8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8 91011

 -9  . . . . . . . . . . . . . . . . . . . . . .
 -8  . . . . . . . . . . . . . . . . . . . . . .
 -7  . . . . . . . . . . . . . . . . . . . . . .
 -6  . . . . . . . . . . . . . . . . . . . . . .
 -5  . . . . . . . . . . . . . . . . . . . . . .
 -4  . . . . . . . . . . . . . . . . . . . . . .
 -3  . . . . . . . X . . . . . X . . . . . . . .
 -2  . . . . . . . . . . . . . . . . . . . . . .
 -1  . . . . . . . . . . . . . . . . . . . . . .
  0  . . . . . . . . . . . . . . . . . . . . . .
  1  . . . . . . . . . . . . . . . . . . . . . .
  2  . . . . . . . . . . . . . . . . . . . . . .
  3  . . . . . . . X . . . . . X . . . . . . . .
  4  . . . . . . . . . . . . . . . . . . . . . .
  5  . . . . . . . . . . . . . . . . . . . . . .
  6  . . . . . . . . . . . . . . . . . . . . . .
  7  . . . . . . . . . . . . . . . . . . . . . .`);
  });

  test('draw four 3-distance U shapes with a view in each one', () => {
    initLoS(-10, -9, 11, 7);
    walls.add({ position: { x: -2, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: -1, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: -2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: -2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 2, y: -1, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: -2, y: 3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -2, y: 2, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 3, y: 2, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 3, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 2, y: 2, edge: 1 }, colour: 0 });

    geometry.drawLoSSingle(new THREE.Vector3(-2, -2, 1), min, max, walls, los);
    rasterLoS.combine(
      los,
      ...[new THREE.Vector3(2, -2, 1), new THREE.Vector3(2, 2, 1), new THREE.Vector3(-2, 2, 1)].map(o =>
        geometry.drawLoSSingle(
          o, min, max, walls, initLoSDictionary(min, max)
        )
      )
    );

    const losStr = losString(min, max, los);
    //console.log(losStr);
    expect(losStr).toBe(`
    -10-9-8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8 91011

 -9  . . . . . o X X X X X X X X X o . . . . . .
 -8  . . . . . . o X X X X X X X o . . . . . . .
 -7  . . . . . . . o X X X X X o . . . . . . . .
 -6  . . . . . . . . o X X X o . . . . . . . . .
 -5  . . . . . . . . . o X o . . . . . . . . . .
 -4  . . . . . . . . . . o . . . . . . . . . . .
 -3  . . . . . X X X . . . . . X X X . . . . . .
 -2  . . . . . . . X . . . . . X . . . . . . . .
 -1  . . . . . . . . . . . . . . . . . . . . . .
  0  o o . . . . . . . . o . . . . . . . . o o o
  1  . . . . . . . . . . . . . . . . . . . . . .
  2  . . . . . . . X . . . . . X . . . . . . . .
  3  . . . . . X X X . . . . . X X X . . . . . .
  4  . . . . . . . . . . o . . . . . . . . . . .
  5  . . . . . . . . . o X o . . . . . . . . . .
  6  . . . . . . . . o X X X o . . . . . . . . .
  7  . . . . . . . o X X X X X o . . . . . . . .`);
  });

  test('200x200 performance', () => {
    initLoS(-100, -100, 99, 99);
    for (let i = 0; i < 100; ++i) {
      const x = Math.floor(Math.random() * 200) - 100;
      const y = Math.floor(Math.random() * 200) - 100;
      const edge = Math.floor(Math.random() * 2);
      //console.log(`x: ${x}, y: ${y}, edge: ${edge}`);
      walls.add({ position: { x, y, edge }, colour: 0 });
    }

    geometry.drawLoSSingle(origin, min, max, walls, los);
    //console.log(losString(min, max, los));
  });
});
