import { MapColouring } from "./colouring";
import { enumerateSquares, walledSquare } from "./colouring.test";
import { HexGridGeometry } from "./hexGridGeometry";
import * as LoS from './los';
import { SquareGridGeometry } from "./squareGridGeometry";
import { IGridCoord, coordString } from "../data/coord";

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

// TODO #5 Also test LoS.combine
test('Look through lots of 3-square rooms on a square grid', () => {
  const radius = 54;
  const step = 6;
  var geometry = new SquareGridGeometry(75, 12);
  var colouring = new MapColouring(geometry);

  for (var sq of enumerateSquares(radius, step)) {
    walledSquare(sq.x, sq.y).forEach(w => colouring.setWall(w, true));
  }
  colouring.recalculate();

  // Looking from inside one of the squares, I should see only its inside
  function testLoSInside(coord: IGridCoord) {
    const los = LoS.create(geometry, colouring, coord);

    var zeroPoint = {
      x: Math.floor(coord.x / step) * step,
      y: Math.floor(coord.y / step) * step
    };
    expect(los.get(zeroPoint)?.colour).toBe(LoS.oFull);
    expect(los.get({ x: zeroPoint.x + 1, y: zeroPoint.y + 2 })?.colour).toBe(LoS.oFull);

    expect(los.get({ x: zeroPoint.x + 4, y: zeroPoint.y + 4 })?.colour).toBe(LoS.oNone);
    expect(los.get({ x: zeroPoint.x + step, y: zeroPoint.y })?.colour).toBe(LoS.oNone);
    expect(los.get({ x: zeroPoint.x + 4 + step, y: zeroPoint.y + 4 + step })?.colour).toBe(LoS.oNone);
  }

  // Looking from outside of the square and next to it, I should see
  // vertically, but not horizontally
  function testLoSAtSide(coord: IGridCoord) {
    var sidePoint = {
      x: Math.floor(coord.x / step) * step + 4,
      y: Math.floor(coord.y / step) * step + 1
    };
    const los = LoS.create(geometry, colouring, sidePoint);

    expect(los.get(sidePoint)?.colour).toBe(LoS.oFull);
    for (var y = -radius; y < radius; y += step * 4) {
      var vPoint = {
        x: sidePoint.x,
        y: y
      };
      expect(los.get(vPoint)?.colour).toBe(LoS.oFull);
    }

    for (var x = -radius; x < radius; x += step * 4) {
      if (x === coord.x) {
        continue;
      }
      var hPoint = {
        x: x,
        y: sidePoint.y
      };
      expect(los.get(hPoint)?.colour).toBe(LoS.oNone);
    }
  }

  for (var sq of enumerateSquares(radius - step, step * 6)) {
    testLoSInside(sq);
    testLoSAtSide(sq);
  }
});