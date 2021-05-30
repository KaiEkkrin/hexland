import { coordString, edgeString, GridCoord, GridEdge } from '../data/coord';
import { FeatureDictionary, IFeature } from '../data/feature';
import { rasterLoS } from '../data/rasterLoS';
import { SquareGridGeometry } from './squareGridGeometry';

import * as THREE from 'three';

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

describe('test on 16 square', () =>
{
  const geometry = new SquareGridGeometry(75, 8);
  const origin = new THREE.Vector3(0, 0, 1);
  const min = new THREE.Vector2(-8, -8);
  const max = new THREE.Vector2(8, 8);
  const walls = new FeatureDictionary<GridEdge, IFeature<GridEdge>>(edgeString);
  const los = new FeatureDictionary<GridCoord, IFeature<GridCoord>>(coordString);

  // Initialise everything to visible
  function initLoS() {
    walls.clear();
    los.clear();
    for (let y = min.y; y <= max.y; ++y) {
      for (let x = min.x; x <= max.x; ++x) {
        los.add({ position: { x, y }, colour: 0 });
      }
    }
  }

  function printLoS() {
    console.log(losString(min, max, los));
  }

  test('rasterise horizontally from origin (minus)', () =>
  {
    initLoS();

    // rays
    const a = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(-1, -1, 1), new THREE.Vector3()
    );
    const b = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(1, -1, 1), new THREE.Vector3()
    );

    rasterLoS.traceSquaresRows(a, b, { x: origin.x, y: origin.y }, -1, min.y, max.y, los);
    //printLoS();
    expect(losString(min, max, los)).toBe(`
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

  test('rasterise vertically from origin (minus)', () =>
  {
    initLoS();
  
    // rays
    const a = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(-1, 1, 1), new THREE.Vector3()
    );
    const b = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(-1, -1, 1), new THREE.Vector3()
    );

    rasterLoS.traceSquaresColumns(a, b, { x: origin.x, y: origin.y }, -1, min.x, max.x, los);
    //printLoS();
    expect(losString(min, max, los)).toBe(`
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

  test('rasterise horizontally from origin (plus)', () =>
  {
    initLoS();

    // rays
    const a = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(-1, 1, 1), new THREE.Vector3()
    );
    const b = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(1, 1, 1), new THREE.Vector3()
    );

    rasterLoS.traceSquaresRows(a, b, { x: origin.x, y: origin.y }, 1, min.y, max.y, los);
    //printLoS();
    expect(losString(min, max, los)).toBe(`
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

  test('rasterise vertically from origin (plus)', () =>
  {
    initLoS();
  
    // rays
    const a = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(1, 1, 1), new THREE.Vector3()
    );
    const b = rasterLoS.createLineThrough(
      origin, new THREE.Vector3(1, -1, 1), new THREE.Vector3()
    );

    rasterLoS.traceSquaresColumns(a, b, { x: origin.x, y: origin.y }, 1, min.x, max.x, los);
    //printLoS();
    expect(losString(min, max, los)).toBe(`
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

  test('draw one wall above origin', () =>
  {
    initLoS();
    walls.add({ position: { x: 0, y: 0, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    //printLoS();
    expect(losString(min, max, los)).toBe(`
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

  test('draw L shape top left of origin', () =>
  {
    initLoS();
    walls.add({ position: { x: 0, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 0, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    //printLoS();
    expect(losString(min, max, los)).toBe(`
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

  test('draw origin boxed in', () =>
  {
    initLoS();
    walls.add({ position: { x: 0, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 0, edge: 1 }, colour: 0 });
    walls.add({ position: { x: 1, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 1, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    //printLoS();
    expect(losString(min, max, los)).toBe(`
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

  test('draw four further-away walls', () =>
  {
    initLoS();
    walls.add({ position: { x: 0, y: -1, edge: 1 }, colour: 0 });
    walls.add({ position: { x: -1, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 2, y: 0, edge: 0 }, colour: 0 });
    walls.add({ position: { x: 0, y: 2, edge: 1 }, colour: 0 });
    geometry.drawLoSSingle(origin, min, max, walls, los);
    //printLoS();
    expect(losString(min, max, los)).toBe(`
    -8-7-6-5-4-3-2-1 0 1 2 3 4 5 6 7 8

 -8  . . . . . o X X X X X o . . . . .
 -7  . . . . . o X X X X X o . . . . .
 -6  . . . . . . o X X X o . . . . . .
 -5  . . . . . . o X X X o . . . . . .
 -4  . . . . . . o X X X o . . . . . .
 -3  o o . . . . . o X o . . . . . o o
 -2  X X o o o . . o X o . . o o o X X
 -1  X X X X X o o . . . o o X X X X X
  0  X X X X X X X . . . X X X X X X X
  1  X X X X X o o . . . o o X X X X X
  2  X X o o o . . o X o . . o o o X X
  3  o o . . . . . o X o . . . . . o o
  4  . . . . . . o X X X o . . . . . .
  5  . . . . . . o X X X o . . . . . .
  6  . . . . . . o X X X o . . . . . .
  7  . . . . . o X X X X X o . . . . .
  8  . . . . . o X X X X X o . . . . .`
);
  });
});
