import { RectangleOcclusion } from './occlusion';
import * as THREE from 'three';

test('rectangle occlusion includes only points within', () => {
  let occ = new RectangleOcclusion(0, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(1, 0, 0)
  ]);

  expect(occ.test(new THREE.Vector3(0.5, 0.5, 0))).toBeTruthy();
  expect(occ.test(new THREE.Vector3(0.2, 0.6, 10))).toBeTruthy();

  expect(occ.test(new THREE.Vector3(-0.5, -0.5, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(-10, -10, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(-10, 0, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(10, 0, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(0, -10, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(0, 10, 0))).toBeFalsy();
});

test('rectangle occlusion includes only points within (negative)', () => {
  let occ = new RectangleOcclusion(0, [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(-1, -1, 0),
    new THREE.Vector3(-1, 0, 0)
  ]);

  expect(occ.test(new THREE.Vector3(-0.5, -0.5, 0))).toBeTruthy();
  expect(occ.test(new THREE.Vector3(-0.2, -0.6, 10))).toBeTruthy();

  expect(occ.test(new THREE.Vector3(0.5, 0.5, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(-10, -10, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(-10, 0, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(10, 0, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(0, -10, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(0, 10, 0))).toBeFalsy();
});

test('rectangle occlusion includes only points within (angled)', () => {
  let occ = new RectangleOcclusion(0, [
    new THREE.Vector3(-3, -4, 0),
    new THREE.Vector3(4, -3, 0),
    new THREE.Vector3(3, 4, 0),
    new THREE.Vector3(-4, 3, 0)
  ]);

  expect(occ.test(new THREE.Vector3(1, 1, 0))).toBeTruthy();
  expect(occ.test(new THREE.Vector3(-2.5, -3.5, 0))).toBeTruthy();
  expect(occ.test(new THREE.Vector3(3.5, -2.5, 0))).toBeTruthy();
  expect(occ.test(new THREE.Vector3(2.5, 3.5, 0))).toBeTruthy();
  expect(occ.test(new THREE.Vector3(-3.5, 2.5, 0))).toBeTruthy();

  expect(occ.test(new THREE.Vector3(-3.9, -3.9, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(3.9, -3.9, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(-3.9, 3.9, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(3.9, 3.9, 0))).toBeFalsy();

  expect(occ.test(new THREE.Vector3(3, -4, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(4, 3, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(-3, 4, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(-4, -3, 0))).toBeFalsy();

  expect(occ.test(new THREE.Vector3(-6, 6, 0))).toBeFalsy();
  expect(occ.test(new THREE.Vector3(6, -6, 0))).toBeFalsy();
});