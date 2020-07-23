import { GridCoord, GridEdge, CoordDictionary } from "./coord";
import * as THREE from 'three';

test('addFace adds within the tile', () => {
  var c = new GridCoord(new THREE.Vector2(2, 1), new THREE.Vector2(4, 5));
  var d = c.addFace(new THREE.Vector2(1, 3), 12);
  expect(d.tile.x).toBe(2);
  expect(d.tile.y).toBe(1);
  expect(d.face.x).toBe(5);
  expect(d.face.y).toBe(8);
});

test('addFace adds a tile', () => {
  var c = new GridCoord(new THREE.Vector2(2, 1), new THREE.Vector2(4, 5));
  var d = c.addFace(new THREE.Vector2(1, 3), 8);
  expect(d.tile.x).toBe(2);
  expect(d.tile.y).toBe(2);
  expect(d.face.x).toBe(5);
  expect(d.face.y).toBe(0);
});

test('addFace adds a tile and subtracts two', () => {
  var c = new GridCoord(new THREE.Vector2(2, 1), new THREE.Vector2(4, 5));
  var d = c.addFace(new THREE.Vector2(-13, 3), 8);
  expect(d.tile.x).toBe(0);
  expect(d.tile.y).toBe(2);
  expect(d.face.x).toBe(7);
  expect(d.face.y).toBe(0);
});

test('addFace correctly subtracts negatives', () => {
  var c = new GridCoord(new THREE.Vector2(-2, 0), new THREE.Vector2(4, 5));
  var d = c.addFace(new THREE.Vector2(-6, -6), 8);
  expect(d.tile.x).toBe(-3);
  expect(d.tile.y).toBe(-1);
  expect(d.face.x).toBe(6);
  expect(d.face.y).toBe(7);
});

test('grid coord dictionary entries', () => {
  var dict = new CoordDictionary<GridCoord, number>();
  var a = new GridCoord(new THREE.Vector2(0, 0), new THREE.Vector2(0, 0));
  var b = new GridCoord(new THREE.Vector2(0, 0), new THREE.Vector2(0, 1));
  var c = new GridCoord(new THREE.Vector2(-1, 0), new THREE.Vector2(0, 1));
  var d = new GridCoord(new THREE.Vector2(-1, 8), new THREE.Vector2(6, 2));
  var e = new GridCoord(new THREE.Vector2(-1, 9), new THREE.Vector2(6, 2));

  var b2 = new GridCoord(new THREE.Vector2(0, 0), new THREE.Vector2(0, 1));

  // At the start everything should be empty
  expect(dict.get(a)).toBeUndefined();

  var allKeys: GridCoord[] = [];
  var allValues: number[] = [];
  dict.foreach((k, v) => {
    allKeys.push(k);
    allValues.push(v);
  });

  expect(allKeys.length).toBe(0);
  expect(allValues.length).toBe(0);

  // Add some things
  dict.set(a, 61);
  dict.set(b, 62);
  dict.set(c, 63);
  dict.set(d, 64);

  // Change something
  dict.set(b2, 66);

  // Remove something
  dict.remove(d);
  dict.remove(e);

  // Now:
  expect(dict.get(a)).toBe(61);
  expect(dict.get(b)).toBe(66);
  expect(dict.get(c)).toBe(63);
  expect(dict.get(d)).toBeUndefined();

  dict.foreach((k, v) => {
    allKeys.push(k);
    allValues.push(v);
  });

  expect(allValues.length).toBe(3);
  expect(allValues).toContain(61);
  expect(allValues).toContain(63);
  expect(allValues).toContain(66);

  expect(allKeys.length).toBe(3);
  expect(allKeys.findIndex(k => k.equals(a))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => k.equals(b))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => k.equals(c))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => k.equals(d))).toBe(-1);
});

test('grid edge dictionary entries', () => {
  var dict = new CoordDictionary<GridEdge, number>();
  var a = new GridEdge(new GridCoord(new THREE.Vector2(0, 0), new THREE.Vector2(0, 0)), 0);
  var b = new GridEdge(new GridCoord(new THREE.Vector2(0, 0), new THREE.Vector2(0, 1)), 0);
  var c = new GridEdge(new GridCoord(new THREE.Vector2(0, 0), new THREE.Vector2(0, 0)), 1);
  var d = new GridEdge(new GridCoord(new THREE.Vector2(0, 0), new THREE.Vector2(0, 1)), 1);
  
  var c2 = new GridEdge(new GridCoord(new THREE.Vector2(0, 0), new THREE.Vector2(0, 0)), 1);

  dict.set(a, 61);
  dict.set(b, 62);
  dict.set(c, 63);

  expect(dict.get(a)).toBe(61);
  expect(dict.get(b)).toBe(62);
  expect(dict.get(c2)).toBe(63);
  expect(dict.get(d)).toBeUndefined();

  var allKeys: GridEdge[] = [];
  var allValues: number[] = [];
  dict.foreach((k, v) => {
    allKeys.push(k);
    allValues.push(v);
  });

  expect(allValues.length).toBe(3);
  expect(allValues).toContain(61);
  expect(allValues).toContain(62);
  expect(allValues).toContain(63);

  expect(allKeys.length).toBe(3);
  expect(allKeys.findIndex(k => k.equals(a))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => k.equals(b))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => k.equals(c))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => k.equals(d))).toBe(-1);
});