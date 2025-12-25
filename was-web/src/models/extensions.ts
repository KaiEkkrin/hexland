import { IDrawing } from './interfaces';
import * as THREE from 'three';

const scratchMatrix1 = new THREE.Matrix4();
const scratchMatrix2 = new THREE.Matrix4();
const scratchMatrix3 = new THREE.Matrix4();

// TODO #135 Could I recalculate these (and the other matrices) only when they change (e.g.
// on `resize`) and not whenever required?
// Gets a client-to-world transformation, assuming the client occupies the whole window.
export function getClientToWorld(target: THREE.Matrix4, drawing: IDrawing): THREE.Matrix4 {
  const viewportToWorld = drawing.getViewportToWorld(scratchMatrix1);
  const viewportInvTranslation = scratchMatrix2.makeTranslation(-1, -1, 0);
  const viewportToWorldTrans = scratchMatrix3.multiplyMatrices(viewportToWorld, viewportInvTranslation);

  const viewportInvScaling = scratchMatrix2.makeScale(
    2.0 / window.innerWidth, 2.0 / window.innerHeight, 1
  );
  return target.multiplyMatrices(viewportToWorldTrans, viewportInvScaling);
}

// Gets a world-to-client transformation, assuming the client occupies the whole window.
export function getWorldToClient(target: THREE.Matrix4, drawing: IDrawing): THREE.Matrix4 {
  const worldToViewport = drawing.getWorldToViewport(scratchMatrix1);
  const viewportTranslation = scratchMatrix2.makeTranslation(1, 1, 0);
  const worldToViewportTrans = scratchMatrix3.multiplyMatrices(viewportTranslation, worldToViewport);

  const viewportScaling = scratchMatrix2.makeScale(
    0.5 * window.innerWidth, 0.5 * window.innerHeight, 1
  );
  return target.multiplyMatrices(viewportScaling, worldToViewportTrans);
}
