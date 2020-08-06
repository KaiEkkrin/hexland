import { MapColouring } from './colouring';
import { SquareGridGeometry } from './squareGridGeometry';

// TODO This will be a super trivial test because expressing complex maps in
// code isn't nice -- to better exercise it, I should create a map colouring
// visualisation mode, enabled if you're the map owner.
// TODO *2 that said, it *really* needs more than this

test('Surround one square on a square grid', () => {
  var colouring = new MapColouring(new SquareGridGeometry(100, 8));

  // At the beginning we should just have colour 0 everywhere
  const surrounded = { x: 0, y: 0 };
  const notSurrounded = [
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -2, y: 2 },
    { x: 10, y: -20 }
  ];

  expect(colouring.colourOf(surrounded)).toBe(0);
  notSurrounded.forEach(c => expect(colouring.colourOf(c)).toBe(0));

  // Add these walls and there should be no change, although the colour
  // number might be different
  colouring.setWall({ x: 0, y: 0, edge: 0 }, true);
  colouring.setWall({ x: 0, y: 0, edge: 1 }, true);
  colouring.setWall({ x: 1, y: 0, edge: 0 }, true);

  var colour = colouring.colourOf(surrounded);
  notSurrounded.forEach(c => expect(colouring.colourOf(c)).toBe(colour));

  // Add the final one and (0, 0) should be entirely surrounded, and
  // a different colour to the others
  colouring.setWall({ x: 0, y: 1, edge: 1 }, true);

  var colourInside = colouring.colourOf(surrounded);
  var colourOutside = colouring.colourOf(notSurrounded[0]);
  expect(colourOutside).not.toBe(colourInside);
  notSurrounded.slice(1).forEach(c => expect(colouring.colourOf(c)).toBe(colourOutside));

  // Remove one of those walls again and once more everything should be
  // the same colour
  colouring.setWall({ x: 0, y: 0, edge: 0 }, false);

  colour = colouring.colourOf(surrounded);
  notSurrounded.forEach(c => expect(colouring.colourOf(c)).toBe(colour));
});