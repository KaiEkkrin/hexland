import { IGridCoord, coordString, IGridEdge, coordsEqual } from '../data/coord';
import { FeatureDictionary, IFeature, IFeatureDictionary } from '../data/feature';
import { MapColouring } from './colouring';
import { TestVertexCollection } from './occlusion';
import { IGridGeometry } from './gridGeometry';

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
  testCollection.testCoord(target, (c, v, i) => {
    if (occ.test(v)) {
      vis.hidden |= (1 << i);
    }
    return true;
  });
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

  // Check each coord (that isn't the source) for occlusion by each wall.
  walls.forEach(w => {
    var occ = geometry.createEdgeOcclusion(coord, w.position, z); // TODO re-use this memory too?
    los.forEach(f => {
      if (f.mapColour !== colour) {
        // This is definitely not visible from here
        return;
      }

      if (coordsEqual(f.position, coord)) {
        // We definitely *can* see ourselves and don't need to check
        return;
      }

      testCollection.testCoord(f.position, (c, v, i) => {
        if (occ.test(v)) {
          f.hidden |= (1 << i);
        }
        return true;
      });

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