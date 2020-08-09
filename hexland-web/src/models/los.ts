import { IGridCoord, coordString, IGridEdge, coordsEqual } from '../data/coord';
import { FeatureDictionary, IFeatureDictionary, IVisibility } from '../data/feature';
import { MapColouring } from './colouring';
import { IGridGeometry } from './gridGeometry';
import { InstancedFeatures } from './instancedFeatures';
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

// Visibility colours.
export const oNone = 0;
export const oPartial = 1;
export const oFull = 2;

const z = 0; // no 3D in map right now

// TODO These are a bit specious right now.  See how convincing they look?
// I could tune them, or I could try going for the more solid but slower
// approach (testing corner-to-corner)
const innerAlpha = 0.9;
const outerAlpha = 1.1;

function testVisibility(geometry: IGridGeometry, innerFrustum: THREE.Frustum, outerFrustum: THREE.Frustum, vis: IVisibility) {
  // If the visibility coord falls within the inner frustum, it's fully hidden (no visibility.)
  // If it falls within the outer frustum but not the inner, it has partial visibility.
  const targetCentre = geometry.createCoordCentre(vis.position, z);
  if (innerFrustum.containsPoint(targetCentre)) {
    vis.colour = oNone;
  }

  // If the face is fully occluded we stop here (partial occlusion can't override it)
  if (vis.colour === oNone) {
    return;
  }

  if (outerFrustum.containsPoint(targetCentre)) {
    // Partial visibility by different edges results in no visibility.
    // TODO This is slightly too brutal right now (includes one edge entirely
    // hidden by another) and I should finesse it.  Perhaps track a list of
    // vertices and edges that contributed to occlusion?
    vis.colour = vis.colour === oFull ? oPartial : oNone;
  }
}

// For unit testing.
export function testVisibilityOf(geometry: IGridGeometry, coord: IGridCoord, target: IGridCoord, wall: IGridEdge) {
  var innerFrustum = geometry.getShadowFrustum(coord, wall, z, innerAlpha);
  var outerFrustum = geometry.getShadowFrustum(coord, wall, z, outerAlpha);
  var vis = { position: target, colour: oFull };
  testVisibility(geometry, innerFrustum, outerFrustum, vis);
  return vis.colour;
}

// Using the map colouring, creates a line-of-sight dictionary for the given coord.
// A LoS dictionary maps each coord to its visibility.
// TODO Write some unit tests for this before continuing rigging it in -- I suspect
// my visibility test isn't quite right right now.
export function create(geometry: IGridGeometry, colouring: MapColouring, coord: IGridCoord) {
  const los = new FeatureDictionary<IGridCoord, IVisibility>(coordString);

  // Add everything within bounds (we know we can't see outside bounds) with
  // visible status and everything outside with invisible status
  // TODO can I optimise this somehow...?
  var colour = colouring.colourOf(coord);
  colouring.forEachFace(f => {
    los.add({ position: f.position, colour: f.colour === colour ? oFull : oNone });
  })

  // Get all the relevant walls that we need to check against
  const walls = colouring.getWallsOfColour(colour);

  // Check each coord (that isn't the source) for occlusion by each wall.
  walls.forEach(w => {
    var innerFrustum = geometry.getShadowFrustum(coord, w.position, z, innerAlpha);
    var outerFrustum = geometry.getShadowFrustum(coord, w.position, z, outerAlpha);
    los.forEach(f => {
      if (!coordsEqual(f.position, coord)) {
        testVisibility(geometry, innerFrustum, outerFrustum, f);
      }
    });
  });

  return los;
}

// Combines the second LoS into the first one, resulting in a single LoS showing the
// union of visible faces as visible.
export function combine(
  a: IFeatureDictionary<IGridCoord, IVisibility>,
  b: IFeatureDictionary<IGridCoord, IVisibility>
) {
  b.forEach(v => {
    if (v.colour === oFull) {
      // No effect on visibility
      return;
    }

    var already = a.remove(v.position);
    if (already !== undefined) {
      switch (already.colour) {
        case oFull:
          already.colour = v.colour;
          break;

        case oPartial:
          already.colour = v.colour === oNone ? oNone : oPartial;
          break;
      }

      a.add(already);
    } else {
      a.add(v);
    }
  });
}

export class LoS extends InstancedFeatures<IGridCoord, IVisibility> {
  private readonly _bufferGeometry: THREE.BufferGeometry;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, alpha: number, areaZ: number, maxInstances?: number | undefined) {
    super(geometry, redrawFlag, coordString, maxInstances);

    var single = this.geometry.toSingle();
    var vertices = single.createSolidVertices(new THREE.Vector2(0, 0), alpha, areaZ);
    var indices = single.createSolidMeshIndices();

    this._bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    this._bufferGeometry.setIndex(indices);
  }

  protected createMesh(m: THREE.Material, maxInstances: number): THREE.InstancedMesh {
    var mesh = new THREE.InstancedMesh(this._bufferGeometry, m, maxInstances);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return mesh;
  }

  protected transformTo(o: THREE.Object3D, position: IGridCoord) {
    this.geometry.transformToCoord(o, position);
  }

  dispose() {
    super.dispose();
    this._bufferGeometry.dispose();
  }
}