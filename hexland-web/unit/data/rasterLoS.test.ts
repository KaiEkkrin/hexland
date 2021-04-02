import { coordString, edgeString, GridCoord, GridEdge } from './coord';
import { FeatureDictionary, IFeature } from './feature';
import { rasterLoS } from './rasterLoS';

import * as THREE from 'three';

describe('test on 16 square', () =>
{
  const origin = new THREE.Vector3(0, 0, 1);
  const min = new THREE.Vector2(-8, -8);
  const max = new THREE.Vector2(8, 8);
  const walls = new FeatureDictionary<GridEdge, IFeature<GridEdge>>(edgeString);
  const los = new FeatureDictionary<GridCoord, IFeature<GridCoord>>(coordString);

  // Initialise everything to invisible
  function initLoS() {
    los.clear();
    for (let y = min.y; y <= max.y; ++y) {
      for (let x = min.x; x <= max.x; ++x) {
        los.add({ position: { x, y }, colour: 2 });
      }
    }
  }

  function printLoS() {
    // Writes the LoS to the console log as a grid as follows
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

    console.log(messages.join('\n'));
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

    rasterLoS.traceSquaresRows(a, b, new THREE.Vector2(origin.x, origin.y), -1, min.y, max.y, walls, los);
    printLoS();
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

    rasterLoS.traceSquaresColumns(a, b, new THREE.Vector2(origin.x, origin.y), -1, min.x, max.x, walls, los);
    printLoS();
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

    rasterLoS.traceSquaresRows(a, b, new THREE.Vector2(origin.x, origin.y), 1, min.y, max.y, walls, los);
    printLoS();
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

    rasterLoS.traceSquaresColumns(a, b, new THREE.Vector2(origin.x, origin.y), 1, min.x, max.x, walls, los);
    printLoS();
  });
});
