import { IGridCoord, IGridEdge, CoordDictionary, coordString, coordsEqual, edgeString, edgesEqual, getFace, getTile, createGridCoord, createGridEdge } from "./coord";

test('convert to and from grid coords', () => {
  const tileDim = 12;
  for (var i = 0; i < 5000; ++i) {
    var x = Math.floor(Math.random() * 1000) - 500;
    var y = Math.floor(Math.random() * 1000) - 500;
    var coord = { x: x, y: y };
    var tile = getTile(coord, tileDim);
    var face = getFace(coord, tileDim);
    var coord2 = createGridCoord(tile, face, tileDim);

    expect(face.x).toBeGreaterThanOrEqual(0);
    expect(face.x).toBeLessThan(tileDim);

    expect(face.y).toBeGreaterThanOrEqual(0);
    expect(face.y).toBeLessThan(tileDim);

    expect(coordsEqual(coord, coord2)).toBeTruthy();

    var e = Math.floor(Math.random() * 3);
    var edge = { x: x, y: y, edge: e };
    tile = getTile(edge, tileDim);
    face = getFace(edge, tileDim);
    var edge2 = createGridEdge(tile, face, tileDim, e);

    expect(face.x).toBeGreaterThanOrEqual(0);
    expect(face.x).toBeLessThan(tileDim);

    expect(face.y).toBeGreaterThanOrEqual(0);
    expect(face.y).toBeLessThan(tileDim);

    expect(edgesEqual(edge, edge2)).toBeTruthy();
  }
})

test('grid coord dictionary entries', () => {
  var dict = new CoordDictionary<IGridCoord, number>(coordString);
  var a = { x: 0, y: 0 };
  var b = { x: 0, y: 1 };
  var c = { x: -8, y: 1 };
  var d = { x: -2, y: 66 };
  var e = { x: -2, y: 83 };

  var b2 = { x: 0, y: 1 };

  // At the start everything should be empty
  expect(dict.get(a)).toBeUndefined();

  var allKeys: IGridCoord[] = [];
  var allValues: number[] = [];
  dict.foreach((k, v) => {
    allKeys.push(k);
    allValues.push(v);
  });

  expect(allKeys.length).toBe(0);
  expect(allValues.length).toBe(0);

  // Add some things
  dict.set(a, 61);
  dict.set(b, 62);
  dict.set(c, 63);
  dict.set(d, 64);

  // Change something
  dict.set(b2, 66);

  // Remove something
  dict.remove(d);
  dict.remove(e);

  // Now:
  expect(dict.get(a)).toBe(61);
  expect(dict.get(b)).toBe(66);
  expect(dict.get(c)).toBe(63);
  expect(dict.get(d)).toBeUndefined();

  dict.foreach((k, v) => {
    allKeys.push(k);
    allValues.push(v);
  });

  expect(allValues.length).toBe(3);
  expect(allValues).toContain(61);
  expect(allValues).toContain(63);
  expect(allValues).toContain(66);

  expect(allKeys.length).toBe(3);
  expect(allKeys.findIndex(k => coordsEqual(k, a))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => coordsEqual(k, b))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => coordsEqual(k, c))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => coordsEqual(k, d))).toBe(-1);
});

test('grid edge dictionary entries', () => {
  var dict = new CoordDictionary<IGridEdge, number>(edgeString);
  var a = { x: 0, y: 0, edge: 0 };
  var b = { x: 0, y: 1, edge: 0 };
  var c = { x: 0, y: 0, edge: 1 };
  var d = { x: 0, y: 1, edge: 1 };
  
  var c2 = { x: 0, y: 0, edge: 1 };

  dict.set(a, 61);
  dict.set(b, 62);
  dict.set(c, 63);

  expect(dict.get(a)).toBe(61);
  expect(dict.get(b)).toBe(62);
  expect(dict.get(c2)).toBe(63);
  expect(dict.get(d)).toBeUndefined();

  var allKeys: IGridEdge[] = [];
  var allValues: number[] = [];
  dict.foreach((k, v) => {
    allKeys.push(k);
    allValues.push(v);
  });

  expect(allValues.length).toBe(3);
  expect(allValues).toContain(61);
  expect(allValues).toContain(62);
  expect(allValues).toContain(63);

  expect(allKeys.length).toBe(3);
  expect(allKeys.findIndex(k => edgesEqual(k, a))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => edgesEqual(k, b))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => edgesEqual(k, c))).toBeGreaterThanOrEqual(0);
  expect(allKeys.findIndex(k => edgesEqual(k, d))).toBe(-1);
});