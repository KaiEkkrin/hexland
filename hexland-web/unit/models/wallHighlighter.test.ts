import { HexGridGeometry } from "./hexGridGeometry";
import { SquareGridGeometry } from "./squareGridGeometry";
import { drawWallBetween } from './wallHighlighter';

let hexGeometry = new HexGridGeometry(75, 12);
let squareGeometry = new SquareGridGeometry(75, 12);

test('No walls are between a vertex and itself (square)', () => {
  for (let y = -3; y <= 3; y += 3) {
    for (let x = -3; x <= 3; x += 3) {
      let walls = [...drawWallBetween(squareGeometry, { x: x, y: y, vertex: 0 }, { x: x, y: y, vertex: 0 })];
      expect(walls.length).toBe(0);
    }
  }
});

test('No walls are between a vertex and itself (hex)', () => {
  for (let y = -3; y <= 3; y += 3) {
    for (let x = -3; x <= 3; x += 3) {
      for (let v = 0; v <= 1; ++v) {
        let walls = [...drawWallBetween(hexGeometry, { x: x, y: y, vertex: v }, { x: x, y: y, vertex: v })];
        expect(walls.length).toBe(0);
      }
    }
  }
});

test('Single hop (square)', () => {
  let walls = [...drawWallBetween(
    squareGeometry,
    { x: 0, y: 0, vertex: 0 },
    { x: 1, y: 0, vertex: 0 }
  )];

  expect(walls.length).toBe(1);
  expect(walls[0].x).toBe(0);
  expect(walls[0].y).toBe(0);
  expect(walls[0].edge).toBe(1);
});

test('Single hop (hex)', () => {
  let walls = [...drawWallBetween(
    hexGeometry,
    { x: 0, y: 0, vertex: 0 },
    { x: -1, y: 1, vertex: 1 }
  )];

  expect(walls.length).toBe(1);
  expect(walls[0].x).toBe(-1);
  expect(walls[0].y).toBe(1);
  expect(walls[0].edge).toBe(1);
})

test('Straight line (square)', () => {
  let walls = [...drawWallBetween(
    squareGeometry,
    { x: 0, y: 0, vertex: 0 },
    { x: 0, y: -3, vertex: 0 }
  )];

  expect(walls.length).toBe(3);

  walls.forEach(w => {
    expect(w.x).toBe(0);
    expect(w.edge).toBe(0);
  });

  expect(walls[0].y).toBe(-1);
  expect(walls[1].y).toBe(-2);
  expect(walls[2].y).toBe(-3);
});

test('Stair step (square)', () => {
  let walls = [...drawWallBetween(
    squareGeometry,
    { x: 0, y: 0, vertex: 0 },
    { x: 5, y: 5, vertex: 0 }
  )];

  // I'm not going to worry too much about where it went, just
  // that it did so in the minimum number of hops
  expect(walls.length).toBe(10);
});

test('Wiggly line (hex)', () => {
  let walls = [...drawWallBetween(
    hexGeometry,
    { x: -1, y: 1, vertex: 0 },
    { x: 3, y: -1, vertex: 0 }
  )];

  // Again, just check the hop count
  expect(walls.length).toBe(8);
});