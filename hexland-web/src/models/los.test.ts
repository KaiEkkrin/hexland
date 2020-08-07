import { HexGridGeometry } from "./hexGridGeometry";
import * as LoS from './los';
import { SquareGridGeometry } from "./squareGridGeometry";

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