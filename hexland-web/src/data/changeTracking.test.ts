import { trackChanges, SimpleChangeTracker } from './changeTracking';
import { ChangeType, ChangeCategory } from './change';

// == AREAS ==

test('One area can be added and removed', () => {
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3
    }
  }];

  var ok = trackChanges(tracker, chs);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 1, y: 2 }
  }];

  ok = trackChanges(tracker, chs2);
  expect(ok).toBeTruthy();

  // ...but not twice
  ok = trackChanges(tracker, chs2);
  expect(ok).toBeFalsy();
});

test('Multiple areas can be added and removed', () => {
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

  var ok = trackChanges(tracker, chs);
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

  ok = trackChanges(tracker, chs2);
  expect(ok).toBeTruthy();
});

test('Areas cannot be added on top of each other', () => {
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: {
      position: { x: 1, y: 2 },
      colour: 3
    }
  }];

  var ok = trackChanges(tracker, chs);
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

  ok = trackChanges(tracker, chs2);
  expect(ok).toBeFalsy();

  // After that operation, we should still have the area added the first time
  // but not the other area added the second time -- the whole second operation
  // should have been cancelled
  var chs3 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 1, y: 2 }
  }];

  ok = trackChanges(tracker, chs3);
  expect(ok).toBeTruthy();

  var chs4 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: { x: 0, y: 2 }
  }];

  ok = trackChanges(tracker, chs4);
  expect(ok).toBeFalsy();
});

test('A double-remove area operation is also cancelled', () => {
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

  var ok = trackChanges(tracker, chs);
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

  ok = trackChanges(tracker, chs2);
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

  ok = trackChanges(tracker, chs3);
  expect(ok).toBeTruthy();
});

// == WALLS ==
// Since they're very similar to areas I won't do all the same tests

test('Walls cannot be added on top of each other', () => {
  var tracker = new SimpleChangeTracker();
  var chs = [{
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: {
      position: { x: 1, y: 2, edge: 0 },
      colour: 3
    }
  }];

  var ok = trackChanges(tracker, chs);
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

  ok = trackChanges(tracker, chs2);
  expect(ok).toBeFalsy();

  // After that operation, we should still have the wall added the first time
  // but not the other area added the second time -- the whole second operation
  // should have been cancelled
  var chs3 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 1, y: 2, edge: 0 }
  }];

  ok = trackChanges(tracker, chs3);
  expect(ok).toBeTruthy();

  var chs4 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: { x: 0, y: 2, edge: 1 }
  }];

  ok = trackChanges(tracker, chs4);
  expect(ok).toBeFalsy();
});

test('A double-remove wall operation is also cancelled', () => {
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

  var ok = trackChanges(tracker, chs);
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

  ok = trackChanges(tracker, chs2);
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

  ok = trackChanges(tracker, chs3);
  expect(ok).toBeTruthy();
});

// == TOKENS ==

// Repeat the superposition test
test('Tokens cannot be added on top of each other', () => {
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

  var ok = trackChanges(tracker, chs);
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

  ok = trackChanges(tracker, chs2);
  expect(ok).toBeFalsy();

  // After that operation, we should still have the token added the first time
  // but not the other area added the second time -- the whole second operation
  // should have been cancelled
  var chs3 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: { x: 1, y: 2 }
  }];

  ok = trackChanges(tracker, chs3);
  expect(ok).toBeTruthy();

  var chs4 = [{
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: { x: 0, y: 2 }
  }];

  ok = trackChanges(tracker, chs4);
  expect(ok).toBeFalsy();
});

test('A token can be moved around', () => {
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

  var ok = trackChanges(tracker, chs);
  expect(ok).toBeTruthy();

  var chs2 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 2, y: 2 },
    oldPosition: { x: 1, y: 2 }
  }];

  ok = trackChanges(tracker, chs2);
  expect(ok).toBeTruthy();

  var chs3 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 2 },
    oldPosition: { x: 2, y: 2 }
  }];

  ok = trackChanges(tracker, chs3);
  expect(ok).toBeTruthy();

  // A redundant move from its current position back to the same position
  // should be fine
  var chs4 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 1, y: 2 },
    oldPosition: { x: 1, y: 2 }
  }];

  ok = trackChanges(tracker, chs4);
  expect(ok).toBeTruthy();

  // We shouldn't be able to move it from a non-existent position, though
  var chs5 = [{
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    newPosition: { x: 3, y: 2 },
    oldPosition: { x: 2, y: 2 }
  }];

  ok = trackChanges(tracker, chs5);
  expect(ok).toBeFalsy();
});

test('Multiple tokens can be moved together', () => {
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

  var ok = trackChanges(tracker, chs);
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

  ok = trackChanges(tracker, chs2);
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

  ok = trackChanges(tracker, chs3);
  expect(ok).toBeTruthy();
});

test('Multiple tokens can be moved together (in the other order)', () => {
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

  var ok = trackChanges(tracker, chs);
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

  ok = trackChanges(tracker, chs2);
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

  ok = trackChanges(tracker, chs3);
  expect(ok).toBeTruthy();
});

test('I can move a token and add another one in its place', () => {
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

  var ok = trackChanges(tracker, chs);
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

  ok = trackChanges(tracker, chs2);
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

  ok = trackChanges(tracker, chs3);
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

  ok = trackChanges(tracker, chs4);
  expect(ok).toBeTruthy();
});