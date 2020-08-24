import * as THREE from 'three';

export const position = new THREE.Vector3(0, 0, 2);
export const scale = new THREE.Vector3(1, 1, 1);
export const visible = false;
export const alter = jest.fn();

export const OutlinedRectangle = jest.fn().mockImplementation(() => {
  return {
    position: position,
    scale: scale,
    visible: visible,
    alter: alter
  };
});