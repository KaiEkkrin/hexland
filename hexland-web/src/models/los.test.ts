import { HexGridGeometry } from "./hexGridGeometry";
import { SquareGridGeometry } from "./squareGridGeometry";
import * as LoS from './los';

const hexGridGeometry = new HexGridGeometry(75, 12);
const squareGridGeometry = new SquareGridGeometry(75, 12);

test('Head on (hex)', () => {
  var coord = { x: 0, y: 0 };
  var edge = { x: 0, y: 0, edge: 0 };

  // The visibility of the face directly behind that edge should be None
  var vis = LoS.testVisibilityOf(hexGridGeometry, coord, { x: -1, y: 0 }, edge);
  expect(vis).toBe(LoS.oNone);

  // The visibility of the other faces around us should be Full
  [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
  ].forEach(target => {
    var vis = LoS.testVisibilityOf(hexGridGeometry, coord, target, edge);
    expect(vis).toBe(LoS.oFull);
  });
});

test('Edge on (hex, left)', () => {
  var coord = { x: 0, y: 0 };
  var edge = { x: -1, y: 1, edge: 1 };

  // The visibility of all faces around us should be Full
  for (var y = -2; y <= 2; ++y) {
    for (var x = -2; x <= 2; ++x) {
      var vis = LoS.testVisibilityOf(hexGridGeometry, coord, { x: x, y: y }, edge);
      expect(vis).toBe(LoS.oFull);
    }
  }
});

test('Edge on (hex, right)', () => {
  var coord = { x: 0, y: 0 };
  var edge = { x: 1, y: 0, edge: 1 };

  // The visibility of all faces around us should be Full
  for (var y = -1; y <= 3; ++y) {
    for (var x = -1; x <= 3; ++x) {
      var vis = LoS.testVisibilityOf(hexGridGeometry, coord, { x: x, y: y }, edge);
      expect(vis).toBe(LoS.oFull);
    }
  }
});

test('Head on (square, left)', () => {
  var coord = { x: 0, y: 0 };
  var edge = { x: 0, y: 0, edge: 0 };

  // The visibility of the face directly behind that edge should be None
  var vis = LoS.testVisibilityOf(squareGridGeometry, coord, { x: -1, y: 0 }, edge);
  expect(vis).toBe(LoS.oNone);

  // The visibility of the other faces around us and the diagonals behind
  // us should be Full
  [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ].forEach(target => {
    var vis = LoS.testVisibilityOf(squareGridGeometry, coord, target, edge);
    expect(vis).toBe(LoS.oFull);
  });

  // The visibility of the diagonals in front of us should be Partial
  [
    { x: -1, y: 1 },
    { x: -1, y: -1 }
  ].forEach(target => {
    var vis = LoS.testVisibilityOf(squareGridGeometry, coord, target, edge);
    expect(vis).toBe(LoS.oPartial);
  });
});

test('Head on (square, right)', () => {
  var coord = { x: 0, y: 0 };
  var edge = { x: 1, y: 0, edge: 0 };

  // The visibility of the face directly behind that edge should be None
  var vis = LoS.testVisibilityOf(squareGridGeometry, coord, { x: 1, y: 0 }, edge);
  expect(vis).toBe(LoS.oNone);

  // The visibility of the other faces around us and the diagonals behind
  // us should be Full
  [
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 }
  ].forEach(target => {
    var vis = LoS.testVisibilityOf(squareGridGeometry, coord, target, edge);
    expect(vis).toBe(LoS.oFull);
  });

  // The visibility of the diagonals in front of us should be Partial
  [
    { x: 1, y: 1 },
    { x: 1, y: -1 }
  ].forEach(target => {
    var vis = LoS.testVisibilityOf(squareGridGeometry, coord, target, edge);
    expect(vis).toBe(LoS.oPartial);
  });
});

test('Head on (square, top)', () => {
  var coord = { x: 0, y: 0 };
  var edge = { x: 0, y: 0, edge: 1 };

  // The visibility of the face directly behind that edge should be None
  var vis = LoS.testVisibilityOf(squareGridGeometry, coord, { x: 0, y: -1 }, edge);
  expect(vis).toBe(LoS.oNone);

  // The visibility of the other faces around us and the diagonals behind
  // us should be Full
  [
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 1, y: 1 }
  ].forEach(target => {
    var vis = LoS.testVisibilityOf(squareGridGeometry, coord, target, edge);
    expect(vis).toBe(LoS.oFull);
  });

  // The visibility of the diagonals in front of us should be Partial
  [
    { x: -1, y: -1 },
    { x: 1, y: -1 }
  ].forEach(target => {
    var vis = LoS.testVisibilityOf(squareGridGeometry, coord, target, edge);
    expect(vis).toBe(LoS.oPartial);
  });
});

test('Head on (square, bottom)', () => {
  var coord = { x: 0, y: 0 };
  var edge = { x: 0, y: 1, edge: 1 };

  // The visibility of the face directly behind that edge should be None
  var vis = LoS.testVisibilityOf(squareGridGeometry, coord, { x: 0, y: 1 }, edge);
  expect(vis).toBe(LoS.oNone);

  // The visibility of the other faces around us and the diagonals behind
  // us should be Full
  [
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: -1 },
    { x: 1, y: -1 }
  ].forEach(target => {
    var vis = LoS.testVisibilityOf(squareGridGeometry, coord, target, edge);
    expect(vis).toBe(LoS.oFull);
  });

  // The visibility of the diagonals in front of us should be Partial
  [
    { x: -1, y: 1 },
    { x: 1, y: 1 }
  ].forEach(target => {
    var vis = LoS.testVisibilityOf(squareGridGeometry, coord, target, edge);
    expect(vis).toBe(LoS.oPartial);
  });
});