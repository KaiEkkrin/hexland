import { IGridCoord, IGridEdge, coordString, coordsEqual, edgeString, edgesEqual } from './coord';
import { FeatureDictionary, IFeature } from './feature';

// Equivalent feature dictionary tests to the coord dictionary tests:

test('grid coord dictionary entries', () => {
  let dict = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  let a = { x: 0, y: 0 };
  let b = { x: 0, y: 1 };
  let c = { x: -8, y: 1 };
  let d = { x: -2, y: 66 };
  let e = { x: -2, y: 83 };

  let b2 = { x: 0, y: 1 };

  // At the start everything should be empty
  expect(dict.get(a)).toBeUndefined();

  let allKeys: IGridCoord[] = [];
  let allValues: number[] = [];
  dict.forEach(f => {
    allKeys.push(f.position);
    allValues.push(f.colour);
  });

  expect(allKeys.length).toBe(0);
  expect(allValues.length).toBe(0);

  // Add some things
  dict.add({ position: a, colour: 61 });
  dict.add({ position: b, colour: 62 });
  dict.add({ position: c, colour: 63 });
  dict.add({ position: d, colour: 64 });

  // Change something
  let removed = dict.remove(b2);
  expect(removed?.colour).toBe(62);
  dict.add({ position: b, colour: 66 });

  // Remove something
  dict.remove(d);
  dict.remove(e);

  // Now:
  expect(dict.get(a)?.colour).toBe(61);
  expect(dict.get(b)?.colour).toBe(66);
  expect(dict.get(c)?.colour).toBe(63);
  expect(dict.get(d)?.colour).toBeUndefined();

  dict.forEach(f => {
    allKeys.push(f.position);
    allValues.push(f.colour);
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
  let dict = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
  let a = { x: 0, y: 0, edge: 0 };
  let b = { x: 0, y: 1, edge: 0 };
  let c = { x: 0, y: 0, edge: 1 };
  let d = { x: 0, y: 1, edge: 1 };
  
  let c2 = { x: 0, y: 0, edge: 1 };

  dict.add({ position: a, colour: 61 });
  dict.add({ position: b, colour: 62 });
  dict.add({ position: c, colour: 63 });

  expect(dict.get(a)?.colour).toBe(61);
  expect(dict.get(b)?.colour).toBe(62);
  expect(dict.get(c2)?.colour).toBe(63);
  expect(dict.get(d)?.colour).toBeUndefined();

  let allKeys: IGridEdge[] = [];
  let allValues: number[] = [];
  dict.forEach(f => {
    allKeys.push(f.position);
    allValues.push(f.colour);
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