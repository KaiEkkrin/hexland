import { GridCoord } from "./gridGeometry";
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