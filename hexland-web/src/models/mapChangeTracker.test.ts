import { MapColouring } from './colouring';
import { HexGridGeometry } from './hexGridGeometry';
import { MapChangeTracker } from './mapChangeTracker';
import { ChangeType, ChangeCategory } from '../data/change';
import { trackChanges, IChangeTracker } from '../data/changeTracking';
import { IGridEdge, IGridCoord, coordString, edgeString } from '../data/coord';
import { FeatureDictionary, IFeature, IToken } from '../data/feature';
import { MapType } from '../data/map';

const ownerUid = "owner";
const uid1 = "uid1";
const map = {
  adventureName: "Test Adventure",
  name: "Test Map",
  description: "A test",
  owner: ownerUid,
  ty: MapType.Hex,
  ffa: false
};

// This function builds the same walls around three hexes, with the 0,0 hex
// closed from the other two inner ones, done by a test in colouring.tests
function buildWallsOfThreeHexes(changeTracker: IChangeTracker) {
  var changes = [
    { x: 1, y: 0, edge: 1 },
    { x: 0, y: 0, edge: 2 },
    { x: 0, y: 0, edge: 1 },
    { x: 0, y: 0, edge: 0 },
    { x: -1, y: 1, edge: 2 },
    { x: 0, y: 1, edge: 0 },
    { x: -1, y: 2, edge: 2 },
    { x: 0, y: 2, edge: 1 },
    { x: 1, y: 1, edge: 0 },
    { x: 1, y: 1, edge: 1 },
    { x: 2, y: 0, edge: 0 },
    { x: 1, y: 0, edge: 2 },
    { x: 0, y: 1, edge: 1 },
    { x: 1, y: 0, edge: 0 }
  ].map(p => {
    return {
      ty: ChangeType.Add,
      cat: ChangeCategory.Wall,
      feature: { position: p, colour: 0 }
    };
  });

  return trackChanges(map, changeTracker, changes, ownerUid);
}

test('Unprivileged tokens cannot escape from bounded areas', () => {
  const areas = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  const tokens = new FeatureDictionary<IGridCoord, IToken>(coordString);
  const walls = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
  const colouring = new MapColouring(new HexGridGeometry(100, 8));
  var changeTracker = new MapChangeTracker(areas, tokens, walls, colouring);

  var ok = buildWallsOfThreeHexes(changeTracker);
  expect(ok).toBeTruthy();

  // console.log("zero colour: " + colouring.colourOf({ x: 0, y: 0 }));
  // console.log("inner colour: " + colouring.colourOf({ x: 0, y: 1 }));
  // console.log("outer colour: " + colouring.colourOf({ x: 1, y: -1 }));

  var addTokens = [
    { position: { x: 0, y: 0 }, colour: 0, players: [uid1], text: "Zero" },
    { position: { x: 0, y: 1 }, colour: 0, players: [uid1], text: "Inner" },
    { position: { x: -2, y: 2 }, colour: 0, players: [uid1], text: "Outer" }
  ].map(t => {
    return {
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: t
    };
  });

  ok = trackChanges(map, changeTracker, addTokens, ownerUid);
  expect(ok).toBeTruthy();

  const moveZeroToOuter = {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: -1 },
    oldPosition: { x: 0, y: 0 }
  };

  const moveWithinInner = {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 0 },
    oldPosition: { x: 0, y: 1 }
  };

  const moveOuterToOuter = {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: -1, y: 1 },
    oldPosition: { x: -2, y: 2 }
  };

  // We certainly can't do all three together
  ok = trackChanges(map, changeTracker, [moveZeroToOuter, moveWithinInner, moveOuterToOuter], uid1);
  expect(ok).toBeFalsy();

  // ...or zero-to-outer all by itself
  ok = trackChanges(map, changeTracker, [moveZeroToOuter], uid1);
  expect(ok).toBeFalsy();

  // We can, however, do the inner-to-inner and outer-to-outer moves
  ok = trackChanges(map, changeTracker, [moveWithinInner, moveOuterToOuter], uid1);
  expect(ok).toBeTruthy();

  // If we remove one of the walls between zero and outer, we can do that move too, even
  // if it's not the shortest-path wall
  const removeWall = {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: -1, y: 1, edge: 2 }
  };

  ok = trackChanges(map, changeTracker, [removeWall], ownerUid);
  expect(ok).toBeTruthy();

  ok = trackChanges(map, changeTracker, [moveZeroToOuter], uid1);
  expect(ok).toBeTruthy();

  // console.log("wall removed");
  // console.log("zero colour: " + colouring.colourOf({ x: 0, y: 0 }));
  // console.log("inner colour: " + colouring.colourOf({ x: 0, y: 1 }));
  // console.log("outer colour: " + colouring.colourOf({ x: 1, y: -1 }));

  // We still couldn't move it into the inner area, though
  const moveOuterToInner = {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 0, y: 1 },
    oldPosition: { x: 1, y: -1 }
  };

  ok = trackChanges(map, changeTracker, [moveOuterToInner], uid1);
  expect(ok).toBeFalsy();

  // The owner can do that, though
  ok = trackChanges(map, changeTracker, [moveOuterToInner], ownerUid);
  expect(ok).toBeTruthy();
});