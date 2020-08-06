import { trackChanges, SimpleChangeTracker } from './changeTracking';
import { ChangeType, ChangeCategory, ITokenMove, ITokenRemove } from './change';
import { IMap, MapType } from './map';

const ownerUid = "ownerUid";
function createTestMap(ffa: boolean): IMap {
  return {
    adventureName: "Test Adventure",
    name: "Test map",
    description: "Sphinx of black quartz, judge my vow",
    owner: ownerUid,
    ty: MapType.Hex,
    ffa: ffa
  };
}

// == AREAS ==

test('One area can be added and removed', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeTruthy();

  // ...but not twice
  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();
});

test('Multiple areas can be added and removed', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 2 },
      colour: 1
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 4 },
      colour: 2
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 2, y: 4 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 1, y: 2 }
  }, {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 2, y: 4 }
  }]

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeTruthy();
});

test('Areas cannot be added on top of each other', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 0, y: 2 },
      colour: 3
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 2 },
      colour: 4
    }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();

  // After that operation, we should still have the area added the first time
  // but not the other area added the second time -- the whole second operation
  // should have been cancelled
  var chs3 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs3, ownerUid);
  expect(ok).toBeTruthy();

  var chs4 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 0, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs4, ownerUid);
  expect(ok).toBeFalsy();
});

test('A double-remove area operation is also cancelled', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 2 },
      colour: 1
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 4 },
      colour: 2
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 2, y: 4 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  // This should remove nothing
  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 1, y: 2 }
  }, {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 2, y: 4 }
  }, {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 2, y: 4 }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();

  // ...as exemplified by this proper removal
  var chs3 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 1, y: 2 }
  }, {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 2, y: 4 }
  }];

  ok = trackChanges(map, tracker, chs3, ownerUid);
  expect(ok).toBeTruthy();
});

// == WALLS ==
// Since they're very similar to areas I won't do all the same tests

test('Walls cannot be added on top of each other', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: {
      position: { x: 1, y: 2, edge: 0 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: {
      position: { x: 1, y: 2, edge: 1 },
      colour: 3
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: {
      position: { x: 1, y: 2, edge: 0 },
      colour: 4
    }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();

  // After that operation, we should still have the wall added the first time
  // but not the other area added the second time -- the whole second operation
  // should have been cancelled
  var chs3 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 1, y: 2, edge: 0 }
  }];

  ok = trackChanges(map, tracker, chs3, ownerUid);
  expect(ok).toBeTruthy();

  var chs4 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 0, y: 2, edge: 1 }
  }];

  ok = trackChanges(map, tracker, chs4, ownerUid);
  expect(ok).toBeFalsy();
});

test('A double-remove wall operation is also cancelled', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: {
      position: { x: 1, y: 2, edge: 0 },
      colour: 1
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: {
      position: { x: 1, y: 2, edge: 1 },
      colour: 2
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: {
      position: { x: 2, y: 4, edge: 0 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  // This should remove nothing
  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 1, y: 2, edge: 0 }
  }, {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 1, y: 2, edge: 1 }
  }, {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 1, y: 2, edge: 1 }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();

  // ...as exemplified by this proper removal
  var chs3 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 1, y: 2, edge: 0 }
  }, {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 1, y: 2, edge: 1 }
  }];

  ok = trackChanges(map, tracker, chs3, ownerUid);
  expect(ok).toBeTruthy();
});

// == TOKENS ==

// Repeat the superposition test
test('Tokens cannot be added on top of each other', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3,
      text: "a"
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 0, y: 2 },
      colour: 3,
      text: "b"
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 4,
      text: "c"
    }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();

  // After that operation, we should still have the token added the first time
  // but not the other area added the second time -- the whole second operation
  // should have been cancelled
  var chs3 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs3, ownerUid);
  expect(ok).toBeTruthy();

  var chs4 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: { x: 0, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs4, ownerUid);
  expect(ok).toBeFalsy();
});

test('A token can be moved around', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3,
      text: "a"
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 2, y: 2 },
    oldPosition: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeTruthy();

  var chs3 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 2 },
    oldPosition: { x: 2, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs3, ownerUid);
  expect(ok).toBeTruthy();

  // A redundant move from its current position back to the same position
  // should be fine
  var chs4 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 2 },
    oldPosition: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs4, ownerUid);
  expect(ok).toBeTruthy();

  // We shouldn't be able to move it from a non-existent position, though
  var chs5 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 3, y: 2 },
    oldPosition: { x: 2, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs5, ownerUid);
  expect(ok).toBeFalsy();
});

test('Multiple tokens can be moved together', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3,
      text: "a"
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 3 },
      colour: 1,
      text: "b"
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 2, y: 2 },
      colour: 2,
      text: "c"
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  // I should not be able to move the two row-aligned tokens diagonally left-down one, because
  // token "b" is in the way:
  var chs2 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 0, y: 3 },
    oldPosition: { x: 1, y: 2 }
  }, {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 3 },
    oldPosition: { x: 2, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();

  // I should be able to move the two row-aligned tokens left one, so that
  // "c" occupies the position "a" previously had, with no problems:
  var chs3 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 0, y: 2 },
    oldPosition: { x: 1, y: 2 }
  }, {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 2 },
    oldPosition: { x: 2, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs3, ownerUid);
  expect(ok).toBeTruthy();
});

test('Multiple tokens can be moved together (in the other order)', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3,
      text: "a"
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 3 },
      colour: 1,
      text: "b"
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 2, y: 2 },
      colour: 2,
      text: "c"
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  // I should not be able to move the two row-aligned tokens diagonally left-down one, because
  // token "b" is in the way:
  var chs2 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 3 },
    oldPosition: { x: 2, y: 2 }
  }, {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 0, y: 3 },
    oldPosition: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();

  // I should be able to move the two row-aligned tokens left one, so that
  // "c" occupies the position "a" previously had, with no problems:
  var chs3 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 2 },
    oldPosition: { x: 2, y: 2 }
  }, {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 0, y: 2 },
    oldPosition: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs3, ownerUid);
  expect(ok).toBeTruthy();
});

test('I can move a token and add another one in its place', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3,
      text: "a"
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 1 },
      colour: 2,
      text: "blocker"
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  // This won't work, because the "blocker" token hasn't moved
  var chs2 = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 1 },
      colour: 1,
      text: "new"
    }
  }, {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 2, y: 2 },
    oldPosition: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();

  // This will work, because the "a" token has moved
  var chs3 = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 1,
      text: "new"
    }
  }, {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 2, y: 2 },
    oldPosition: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs3, ownerUid);
  expect(ok).toBeTruthy();

  // Removing them checks they all appeared as expected
  var chs4 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: { x: 1, y: 1 }
  }, {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: { x: 1, y: 2 }
  }, {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: { x: 2, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs4, ownerUid);
  expect(ok).toBeTruthy();
});

// == FFA OFF: USER VALIDATION ==

const uid1 = "uid1";
const uid2 = "uid2";

test('A non-owner cannot add and remove areas', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, uid1);
  expect(ok).toBeFalsy();

  ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs2, uid1);
  expect(ok).toBeFalsy();

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeTruthy();

  // ...but not twice
  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();
});

test('A non-owner cannot add and remove walls', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: {
      position: { x: 1, y: 2, edge: 1 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, uid1);
  expect(ok).toBeFalsy();

  ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 1, y: 2, edge: 1 }
  }];

  ok = trackChanges(map, tracker, chs2, uid1);
  expect(ok).toBeFalsy();

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeTruthy();

  // ...but not twice
  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();
});

test('A non-owner cannot alter tokens', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3,
      text: "a"
    }
  }];

  var ok = trackChanges(map, tracker, chs, uid1);
  expect(ok).toBeFalsy();

  ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs2, uid1);
  expect(ok).toBeFalsy();

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeTruthy();

  ok = trackChanges(map, tracker, chs2, ownerUid);
  expect(ok).toBeFalsy();
});

test('Users can move only their own tokens', () => {
  var map = createTestMap(false);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3,
      text: "a",
      players: [uid1]
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 2, y: 2 },
      colour: 2,
      text: "b",
      players: [uid2]
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 3, y: 2 },
      colour: 1,
      text: "c"
    }
  }];

  var ok = trackChanges(map, tracker, chs, ownerUid);
  expect(ok).toBeTruthy();

  function move(x: number, oldY: number, newY: number): ITokenMove {
    return {
      ty: ChangeType.Move,
      cat: ChangeCategory.Token,
      newPosition: { x: x, y: newY },
      oldPosition: { x: x, y: oldY }
    };
  }

  // This definitely shouldn't succeed
  ok = trackChanges(map, tracker, [move(1, 2, 1), move(2, 2, 1), move(3, 2, 1)], uid1);
  expect(ok).toBeFalsy();

  // Nor should this attempt of uid1 to move uid2's token
  ok = trackChanges(map, tracker, [move(2, 2, 1)], uid1);
  expect(ok).toBeFalsy();

  // It should be fine for each of them to move their own though
  ok = trackChanges(map, tracker, [move(1, 2, 1)], uid1);
  expect(ok).toBeTruthy();

  ok = trackChanges(map, tracker, [move(2, 2, 1)], uid2);
  expect(ok).toBeTruthy();

  ok = trackChanges(map, tracker, [move(3, 2, 1)], ownerUid);
  expect(ok).toBeTruthy();

  // The owner can move them all together
  ok = trackChanges(map, tracker, [move(1, 1, 0), move(2, 1, 0), move(3, 1, 0)], ownerUid);
  expect(ok).toBeTruthy();

  // We can also move them back again
  ok = trackChanges(map, tracker, [move(1, 0, 1)], uid1);
  expect(ok).toBeTruthy();

  ok = trackChanges(map, tracker, [move(2, 0, 1)], uid2);
  expect(ok).toBeTruthy();

  ok = trackChanges(map, tracker, [move(3, 0, 1)], ownerUid);
  expect(ok).toBeTruthy();
});

// == FFA ON: ANY USER ==

test('In FFA mode, a non-owner can create areas', () => {
  var map = createTestMap(true);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, uid1);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 1, y: 2 }
  }];

  ok = trackChanges(map, tracker, chs2, uid2);
  expect(ok).toBeTruthy();

  // ...but not twice
  ok = trackChanges(map, tracker, chs2, uid1);
  expect(ok).toBeFalsy();
});

test('In FFA mode, a non-owner can create walls', () => {
  var map = createTestMap(true);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: {
      position: { x: 1, y: 2, edge: 1 },
      colour: 3
    }
  }];

  var ok = trackChanges(map, tracker, chs, uid1);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 1, y: 2, edge: 1 }
  }];

  ok = trackChanges(map, tracker, chs2, uid2);
  expect(ok).toBeTruthy();

  // ...but not twice
  ok = trackChanges(map, tracker, chs2, uid1);
  expect(ok).toBeFalsy();
});

test('In FFA mode, a non-owner can do all token operations', () => {
  var map = createTestMap(true);
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3,
      text: "a",
      players: [uid1]
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 2, y: 2 },
      colour: 2,
      text: "b",
      players: [uid2]
    }
  }, {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: {
      position: { x: 3, y: 2 },
      colour: 1,
      text: "c"
    }
  }];

  var ok = trackChanges(map, tracker, chs, uid1);
  expect(ok).toBeTruthy();

  function move(x: number, oldY: number, newY: number): ITokenMove {
    return {
      ty: ChangeType.Move,
      cat: ChangeCategory.Token,
      newPosition: { x: x, y: newY },
      oldPosition: { x: x, y: oldY }
    };
  }

  // This will succeed now!
  ok = trackChanges(map, tracker, [move(1, 2, 1), move(2, 2, 1), move(3, 2, 1)], uid2);
  expect(ok).toBeTruthy();

  // I can remove them too
  function remove(x: number, y: number): ITokenRemove {
    return {
      ty: ChangeType.Remove,
      cat: ChangeCategory.Token,
      position: { x: x, y: y }
    };
  }

  ok = trackChanges(map, tracker, [remove(1, 1), remove(2, 1), remove(3, 1)], uid2);
  expect(ok).toBeTruthy();

  ok = trackChanges(map, tracker, [remove(1, 1), remove(2, 1), remove(3, 1)], uid2);
  expect(ok).toBeFalsy();
});