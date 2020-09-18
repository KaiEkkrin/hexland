import { MapColouring } from './colouring';
import { HexGridGeometry } from './hexGridGeometry';
import { MapChangeTracker } from './mapChangeTracker';
import { ChangeType, ChangeCategory } from '../data/change';
import { trackChanges, IChangeTracker } from '../data/changeTracking';
import { IGridEdge, IGridCoord, coordString, edgeString } from '../data/coord';
import { FeatureDictionary, IFeature, IToken } from '../data/feature';
import { MapType } from '../data/map';
import { IAnnotation } from '../data/annotation';

const ownerUid = "owner";
const uid1 = "uid1";
const uid2 = "uid2";
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
  let changes = [
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

test('Unprivileged users cannot move other users\' tokens', () => {
  const areas = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  const tokens = new FeatureDictionary<IGridCoord, IToken>(coordString);
  const walls = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
  const notes = new FeatureDictionary<IGridCoord, IAnnotation>(coordString);

  const handleChangesApplied = jest.fn();
  const handleChangesAborted = jest.fn();
  let changeTracker = new MapChangeTracker(areas, tokens, walls, notes, undefined,
    handleChangesApplied, handleChangesAborted);

  // The walls should be irrelevant here :)
  let ok = buildWallsOfThreeHexes(changeTracker);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(1);
  expect(handleChangesApplied.mock.calls[0][0]).toBe(false); // no tokens changed
  expect(handleChangesAborted.mock.calls.length).toBe(0);

  let addTokens = [
    { position: { x: 0, y: 0 }, colour: 0, players: [uid1], text: "Zero" },
    { position: { x: 0, y: 1 }, colour: 0, players: [uid2], text: "Inner2" },
  ].map(t => {
    return {
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: t
    };
  });

  ok = trackChanges(map, changeTracker, addTokens, ownerUid);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(2);
  expect(handleChangesApplied.mock.calls[1][0]).toBe(true); // this time token changes were made
  expect(handleChangesAborted.mock.calls.length).toBe(0);

  const moveWithinInner = {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 0 },
    oldPosition: { x: 0, y: 1 }
  };

  // uid1 can't move uid2's token
  ok = trackChanges(map, changeTracker, [moveWithinInner], uid1);
  expect(ok).toBeFalsy();
  expect(handleChangesApplied.mock.calls.length).toBe(2);
  expect(handleChangesAborted.mock.calls.length).toBe(1); // this call failed

  // uid2 can, however :)
  ok = trackChanges(map, changeTracker, [moveWithinInner], uid2);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(3);
  expect(handleChangesApplied.mock.calls[2][0]).toBe(true); // this time token changes were made
  expect(handleChangesAborted.mock.calls.length).toBe(1);

  // neither of them can move both by swapping their positions:
  const moveSwap = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 0, y: 0 },
    oldPosition: { x: 1, y: 0 }
  }, {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 0 },
    oldPosition: { x: 0, y: 0 }
  }];

  ok = trackChanges(map, changeTracker, moveSwap, uid1);
  expect(ok).toBeFalsy();
  expect(handleChangesApplied.mock.calls.length).toBe(3);
  expect(handleChangesAborted.mock.calls.length).toBe(2);

  ok = trackChanges(map, changeTracker, moveSwap, uid2);
  expect(ok).toBeFalsy();
  expect(handleChangesApplied.mock.calls.length).toBe(3);
  expect(handleChangesAborted.mock.calls.length).toBe(3);

  ok = trackChanges(map, changeTracker, moveSwap, ownerUid);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(4);
  expect(handleChangesApplied.mock.calls[3][0]).toBe(true); // this time token changes were made
  expect(handleChangesAborted.mock.calls.length).toBe(3);

  // ...and after that, uid2 can still move their token back to its
  // now-vacant original position
  const moveBack = {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 0, y: 1 },
    oldPosition: { x: 0, y: 0 }
  };

  ok = trackChanges(map, changeTracker, [moveBack], uid2);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(5);
  expect(handleChangesApplied.mock.calls[4][0]).toBe(true); // this time token changes were made
  expect(handleChangesAborted.mock.calls.length).toBe(3);
});

test('Unprivileged tokens cannot escape from bounded areas', () => {
  const areas = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  const tokens = new FeatureDictionary<IGridCoord, IToken>(coordString);
  const walls = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
  const notes = new FeatureDictionary<IGridCoord, IAnnotation>(coordString);
  const colouring = new MapColouring(new HexGridGeometry(100, 8));

  const handleChangesApplied = jest.fn();
  const handleChangesAborted = jest.fn();
  let changeTracker = new MapChangeTracker(areas, tokens, walls, notes, colouring,
    handleChangesApplied, handleChangesAborted);

  let ok = buildWallsOfThreeHexes(changeTracker);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(1);
  expect(handleChangesApplied.mock.calls[0][0]).toBe(false); // no tokens changed
  expect(handleChangesAborted.mock.calls.length).toBe(0);

  // console.log("zero colour: " + colouring.colourOf({ x: 0, y: 0 }));
  // console.log("inner colour: " + colouring.colourOf({ x: 0, y: 1 }));
  // console.log("outer colour: " + colouring.colourOf({ x: 1, y: -1 }));

  let addTokens = [
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
  expect(handleChangesApplied.mock.calls.length).toBe(2);
  expect(handleChangesApplied.mock.calls[1][0]).toBe(true); // this time token changes were made
  expect(handleChangesAborted.mock.calls.length).toBe(0);

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
  expect(handleChangesApplied.mock.calls.length).toBe(2);
  expect(handleChangesAborted.mock.calls.length).toBe(1); // this call failed

  // ...or zero-to-outer all by itself
  ok = trackChanges(map, changeTracker, [moveZeroToOuter], uid1);
  expect(ok).toBeFalsy();
  expect(handleChangesApplied.mock.calls.length).toBe(2);
  expect(handleChangesAborted.mock.calls.length).toBe(2); // this call failed

  // We can, however, do the inner-to-inner and outer-to-outer moves
  ok = trackChanges(map, changeTracker, [moveWithinInner, moveOuterToOuter], uid1);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(3);
  expect(handleChangesApplied.mock.calls[2][0]).toBe(true); // this time token changes were made
  expect(handleChangesAborted.mock.calls.length).toBe(2);

  // If we remove one of the walls between zero and outer, we can do that move too, even
  // if it's not the shortest-path wall
  const removeWall = {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: -1, y: 1, edge: 2 }
  };

  ok = trackChanges(map, changeTracker, [removeWall], ownerUid);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(4);
  expect(handleChangesApplied.mock.calls[3][0]).toBe(false); // this was a wall change
  expect(handleChangesAborted.mock.calls.length).toBe(2);

  ok = trackChanges(map, changeTracker, [moveZeroToOuter], uid1);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(5);
  expect(handleChangesApplied.mock.calls[4][0]).toBe(true); // this time token changes were made
  expect(handleChangesAborted.mock.calls.length).toBe(2);

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
  expect(handleChangesApplied.mock.calls.length).toBe(5);
  expect(handleChangesAborted.mock.calls.length).toBe(3);

  // The owner can do that, though
  ok = trackChanges(map, changeTracker, [moveOuterToInner], ownerUid);
  expect(ok).toBeTruthy();
  expect(handleChangesApplied.mock.calls.length).toBe(6);
  expect(handleChangesApplied.mock.calls[5][0]).toBe(true); // this time token changes were made
  expect(handleChangesAborted.mock.calls.length).toBe(3);
});