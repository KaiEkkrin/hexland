import { MapColouring } from './colouring';
import { HexGridGeometry } from './hexGridGeometry';
import { SquareGridGeometry } from './squareGridGeometry';
import { FeatureDictionary, IFeature } from '../data/feature';
import { IGridCoord, coordString } from '../data/coord';

// TODO This will be a super trivial test because expressing complex maps in
// code isn't nice -- to better exercise it, I should create a map colouring
// visualisation mode, enabled if you're the map owner.

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

test('Surround three hexes on a hex grid', () => {
  var colouring = new MapColouring(new HexGridGeometry(100, 8));

  // We'll surround these three, and then "zero" by itself
  const zero = { x: 0, y: 0 };
  const inner = [{ x: 0, y: 1 }, { x: 1, y: 0 }];

  // These are all the hexes right around them
  const outer = [
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: -1, y: 2 },
    { x: 0, y: 2 },
    { x: 1, y: 1 },
    { x: 2, y: 0 },
    { x: 2, y: -1 },
    { x: 1, y: -1 }
  ];

  // These are a few further away for sanity
  const further = [
    { x: -2, y: 2 },
    { x: 0, y: -2 },
    { x: 3, y: 3 },
    { x: 3, y: -3 }
  ];

  // At the beginning everything should be 0
  expect(colouring.colourOf(zero)).toBe(0);
  inner.forEach(c => expect(colouring.colourOf(c)).toBe(0));
  outer.forEach(c => expect(colouring.colourOf(c)).toBe(0));
  further.forEach(c => expect(colouring.colourOf(c)).toBe(0));

  // Do most of the surround except for the two walls on the right-hand side
  [
    { x: 1, y: 0, edge: 1 },
    { x: 0, y: 0, edge: 2 },
    { x: 0, y: 0, edge: 1 },
    { x: 0, y: 0, edge: 0 },
    { x: -1, y: 1, edge: 2 },
    { x: 0, y: 1, edge: 0 },
    { x: -1, y: 2, edge: 2 },
    { x: 0, y: 2, edge: 1 },
    { x: 1, y: 1, edge: 0 },
    { x: 1, y: 1, edge: 1 }
  ].forEach(w => colouring.setWall(w, true));

  // Everything should still be the same colour after that
  var colour = colouring.colourOf(zero);
  inner.forEach(c => expect(colouring.colourOf(c)).toBe(colour));
  outer.forEach(c => expect(colouring.colourOf(c)).toBe(colour));
  further.forEach(c => expect(colouring.colourOf(c)).toBe(colour));

  // Close off the right-hand side and the three inner hexes should be a different
  // colour to the rest
  [
    { x: 2, y: 0, edge: 0 },
    { x: 1, y: 0, edge: 2 }
  ].forEach(w => colouring.setWall(w, true));

  var innerColour = colouring.colourOf(zero);
  var outerColour = colouring.colourOf(outer[0]);
  expect(innerColour).not.toBe(outerColour);

  inner.forEach(c => expect(colouring.colourOf(c)).toBe(innerColour));
  outer.forEach(c => expect(colouring.colourOf(c)).toBe(outerColour));
  further.forEach(c => expect(colouring.colourOf(c)).toBe(outerColour));

  // Put down walls between "zero" and the others and it should end up different again
  [
    { x: 0, y: 1, edge: 1 },
    { x: 1, y: 0, edge: 0 }
  ].forEach(w => colouring.setWall(w, true));

  var zeroColour = colouring.colourOf(zero);
  innerColour = colouring.colourOf(inner[0]);
  outerColour = colouring.colourOf(outer[0]);
  
  expect(zeroColour).not.toBe(innerColour);
  expect(zeroColour).not.toBe(outerColour);
  expect(innerColour).not.toBe(outerColour);

  inner.forEach(c => expect(colouring.colourOf(c)).toBe(innerColour));
  outer.forEach(c => expect(colouring.colourOf(c)).toBe(outerColour));
  further.forEach(c => expect(colouring.colourOf(c)).toBe(outerColour));

  // The same should hold for the visualisation, except we can't expect the further-away
  // hexes to be visualised
  var vis = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  colouring.visualise(vis, (p, c, cc) => { return { position: p, colour: c / cc }; });

  var zeroVisColour = vis.get(zero)?.colour ?? -1;
  var innerVisColour = vis.get(inner[0])?.colour ?? -1;
  var outerVisColour = vis.get(outer[0])?.colour ?? -1;

  expect(zeroVisColour).not.toBe(innerVisColour);
  expect(zeroVisColour).not.toBe(outerVisColour);
  expect(innerVisColour).not.toBe(outerVisColour);

  [zeroVisColour, innerVisColour, outerVisColour].forEach(c => {
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(1);
  });

  inner.forEach(c => expect(vis.get(c)?.colour).toBe(innerVisColour));
  outer.forEach(c => expect(vis.get(c)?.colour).toBe(outerVisColour));

  // Bust the inner area open and the outer colour should flood into it, but the
  // zero hex should stay its own
  colouring.setWall({ x: 1, y: 0, edge: 1 }, false);

  var zeroColour = colouring.colourOf(zero);
  outerColour = colouring.colourOf(outer[0]);
  
  expect(zeroColour).not.toBe(outerColour);

  inner.forEach(c => expect(colouring.colourOf(c)).toBe(outerColour));
  outer.forEach(c => expect(colouring.colourOf(c)).toBe(outerColour));
  further.forEach(c => expect(colouring.colourOf(c)).toBe(outerColour));
});