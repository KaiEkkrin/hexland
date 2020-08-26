import { IGridCoord, coordString, IGridEdge, coordsEqual } from '../data/coord';
import { FeatureDictionary, IFeature, IFeatureDictionary } from '../data/feature';
import { MapColouring } from './colouring';
import { TestVertexCollection } from './occlusion';
import { IGridGeometry } from './gridGeometry';

import * as THREE from 'three';

// Visibility colours.
export const oNone = 0;
export const oPartial = 1;
export const oFull = 2;

const z = 0; // no 3D in map right now
const alpha = 0.9; // how close to the edge of the face our exterior visibility checking
                   // points are

// With this special feature class, we can accumulate visibility information and then
// emit a single colour with the known values above.
export interface IVisibility extends IFeature<IGridCoord> {
  count: number; // the number of visibility checking points
  hidden: number; // a bitfield of how many of those points are hidden
  mapColour: number; // the map colour here
}

// Gets the hidden value corresponding to no visibility at all.
function getNoVisibilityValue(count: number) {
  return (1 << count) - 1;
}

function getVisibilityColour(count: number, hidden: number) {
  return hidden === 0 ? oFull :
    hidden === getNoVisibilityValue(count) ? oNone :
    oPartial;
}

function createVisibility(position: IGridCoord, count: number, isHidden: boolean, mapColour: number): IVisibility {
  return {
    position: position,
    count: count,
    hidden: isHidden === true ? getNoVisibilityValue(count) : 0,
    colour: isHidden === true ? oNone : oFull,
    mapColour: mapColour
  };
}

function combineVisibility(a: IVisibility, b: IVisibility): IVisibility {
  // When combining, a point is visible if it's visible from any of the sources
  var hidden = a.hidden & b.hidden;
  return {
    position: a.position,
    count: a.count,
    hidden: hidden,
    colour: getVisibilityColour(a.count, hidden),
    mapColour: a.mapColour
  };
}

// For unit testing.
export function testVisibilityOf(geometry: IGridGeometry, coord: IGridCoord, target: IGridCoord, wall: IGridEdge) {
  var occ = geometry.createEdgeOcclusion(coord, wall, z);
  var testCollection = new TestVertexCollection(geometry, z, alpha);
  var vis = createVisibility(target, testCollection.count, false, 0);

  var i = 0;
  for (var v of testCollection.enumerate(target)) {
    if (occ.test(v)) {
      vis.hidden |= (1 << i);
    }
    ++i;
  }

  vis.colour = getVisibilityColour(vis.count, vis.hidden);
  return vis.colour;
}

// Using the map colouring, creates a line-of-sight dictionary for the given coord.
// A LoS dictionary maps each coord to its visibility.
export function create(geometry: IGridGeometry, colouring: MapColouring, coord: IGridCoord | undefined) {
  const los = new FeatureDictionary<IGridCoord, IVisibility>(coordString);

  // The number of test vertices will be a function of only the geometry.
  // We create them right away and re-use them for each test, because creating
  // them all for each test is very expensive (too many allocations)
  const testCollection = new TestVertexCollection(geometry, z, alpha);

  // With the undefined coord, return an LoS that hides everything
  if (coord === undefined) {
    colouring.forEachFace(f => {
      los.add(createVisibility(f.position, testCollection.count, true, 0));
    });

    return los;
  }

  // Add everything within bounds (we know we can't see outside bounds) with
  // visible status and everything outside with invisible status
  // TODO can I optimise this somehow...?
  const colour = colouring.colourOf(coord);
  colouring.forEachFace(f => {
    los.add(createVisibility(f.position, testCollection.count, f.colour !== colour, f.colour));
  })

  // Get all the relevant walls that we need to check against
  const walls = colouring.getWallsOfColour(colour);

  // To achieve a decently performing LoS creation, we need to aggressively cull
  // walls that we can't see from the algorithm (there should be many of those).
  // To achieve this, we'll order the walls closest first, and decorate them all
  // with information about their adjacent faces: if neither adjacent face is visible,
  // the wall can be ignored.

  // TODO Can I also try removing invisible faces from the LoS entirely rather than
  // colouring them oNone?  That would avoid the problem of re-checking them, but
  // make the combine() function below more complicated...
  const here = geometry.createCoordCentre(new THREE.Vector3(), coord, 0);
  function *decorateWalls() {
    const target = new THREE.Vector3();
    const scratch1 = new THREE.Vector3();
    const scratch2 = new THREE.Vector3();
    for (var w of walls) {
      yield {
        wall: w,
        adj: geometry.getEdgeFaceAdjacency(w.position),
        dsq: geometry.createEdgeCentre(target, scratch1, scratch2, w.position, z)
          .distanceToSquared(here)
      };
    }
  }

  const decoratedWalls = [...decorateWalls()].sort((a, b) => a.dsq - b.dsq);

  // Check each coord (that isn't the source) for occlusion by each wall.
  decoratedWalls.forEach(w => {
    // If all the adjacent faces are hidden, this wall can be ignored
    var adjHidden = w.adj.map(c => los.get(c)?.colour === oNone)
      .reduce((a, b) => a && b);
    if (adjHidden === true) {
      return;
    }

    var occ = geometry.createEdgeOcclusion(coord, w.wall.position, z); // TODO re-use this memory too?
    los.forEach(f => {
      if (f.colour === oNone) {
        // This is definitely not visible from here
        return;
      }

      if (coordsEqual(f.position, coord)) {
        // We definitely *can* see ourselves and don't need to check
        return;
      }

      var i = 0;
      for (var v of testCollection.enumerate(f.position)) {
        if (occ.test(v)) {
          f.hidden |= (1 << i);
        }
        ++i;
      }

      f.colour = getVisibilityColour(f.count, f.hidden);
    });
  });

  return los;
}

// Combines the second LoS into the first one, resulting in a single LoS showing the
// union of visible faces as visible.  Edits `a`, but leaves `b` untouched.
export function combine(
  a: IFeatureDictionary<IGridCoord, IVisibility>,
  b: IFeatureDictionary<IGridCoord, IVisibility>
) {
  b.forEach(inB => {
    // The remove and re-add is to make sure that `a` updates with any change in colour.
    // TODO I'm sure it should be possible to optimise this ...?
    var inA = a.remove(inB.position);
    if (inA !== undefined) {
      a.add(combineVisibility(inA, inB));
    } else {
      a.add(inB);
    }
  });
}