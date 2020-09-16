import { coordString, IGridCoord } from './coord';
import { modFloor } from './extraMath';
import { FeatureDictionary, IFeature } from './feature';
import { IQuadtreeCoord, Quadtree, QuadtreeColouringDictionary } from './quadtree';

import * as seedrandom from 'seedrandom';
import fluent from 'fluent-iterable';

test('various coords are invalid', () => {
  const coords = [
    { x: 0.5, y: 1, size: 1 },
    { x: 3, y: -0.2, size: 2 },
    { x: 4, y: 4, size: 0.5 },
    { x: -4, y: -3, size: -1.5 },
    { x: 0, y: 0, size: 0 },
    { x: 22, y: 98, size: 6.8 }
  ];

  const quadtree = new Quadtree();
  for (var c of coords) {
    expect(quadtree.isValid(c)).toBeFalsy();
  }
});

test('coords of size 1 can be ascended and descended suitably', () => {
  const coords = [
    { x: 0, y: 0, size: 1 },
    { x: 4, y: 6, size: 1 },
    { x: -2, y: 6, size: 1 },
    { x: -4, y: -1, size: 1 },
    { x: 8, y: -2, size: 1 },
    { x: 0, y: -3, size: 1 },
    { x: 5, y: 0, size: 1 }
  ];

  const quadtree = new Quadtree();
  for (var c of coords) {
    expect(quadtree.isValid(c)).toBeTruthy();

    // Ascend until the containing coord's origin or end is at (0, 0).
    function ascend(d: IQuadtreeCoord) {
      const dEnd = quadtree.getEnd(d);
      if ((d.x === 0 && d.y === 0) || (dEnd.x === 0 || dEnd.y === 0)) {
        return;
      }

      const e = quadtree.ascend(d);
      expect(quadtree.isValid(e)).toBeTruthy();
      expect(quadtree.overlap(d, e)).toBeTruthy();
      expect(quadtree.overlap(e, d)).toBeTruthy();
      expect(e.size).toBe(d.size * 2);

      // If I descend from `e`, I should get four inner quadtrees including `d`,
      // which should all be valid
      const ds = [...quadtree.descend(e)];
      expect(ds).toHaveLength(4);
      ds.forEach(d2 => { expect(quadtree.isValid(d2)).toBeTruthy(); });

      const matching = ds.filter(d2 => quadtree.equals(d2, d));
      expect(matching).toHaveLength(1);

      ascend(e);
    }

    ascend(c);
  }
});

test('add and sample quadtree dictionary', () => {
  const quadtree = new Quadtree();
  const d = new QuadtreeColouringDictionary<IFeature<IQuadtreeCoord>>(
    quadtree, c => ({ position: c, colour: 0 }), (a, b) => a.colour === b.colour, f => f.colour === 0, false
  );

  // Test some default samples:
  var s00 = d.sample({ x: 0, y: 0 });
  expect(s00?.position.x).toBe(0);
  expect(s00?.position.y).toBe(0);
  expect(s00?.position.size).toBe(1);
  expect(s00?.colour).toBe(0);

  var s10 = d.sample({ x: -1, y: 0 });
  expect(s10?.position.x).toBe(-1);
  expect(s10?.position.y).toBe(0);
  expect(s10?.position.size).toBe(1);
  expect(s10?.colour).toBe(0);

  var s11 = d.sample({ x: -1, y: -1 });
  expect(s11?.position.x).toBe(-1);
  expect(s11?.position.y).toBe(-1);
  expect(s11?.position.size).toBe(1);
  expect(s11?.colour).toBe(0);

  var t11 = d.sample({ x: 1, y: 1 });
  expect(t11).toBeUndefined();

  // Adding this shouldn't expand, but should work :)
  expect(d.set({ position: { x: -1, y: 0, size: 1 }, colour: 1 })).toBeTruthy();

  s00 = d.sample({ x: 0, y: 0 });
  expect(s00?.position.x).toBe(0);
  expect(s00?.position.y).toBe(0);
  expect(s00?.position.size).toBe(1);
  expect(s00?.colour).toBe(0);

  s10 = d.sample({ x: -1, y: 0 });
  expect(s10?.position.x).toBe(-1);
  expect(s10?.position.y).toBe(0);
  expect(s10?.position.size).toBe(1);
  expect(s10?.colour).toBe(1); // changed

  s11 = d.sample({ x: -1, y: -1 });
  expect(s11?.position.x).toBe(-1);
  expect(s11?.position.y).toBe(-1);
  expect(s11?.position.size).toBe(1);
  expect(s11?.colour).toBe(0);

  // Try setting it again
  expect(d.set({ position: { x: -1, y: 0, size: 1 }, colour: 1 })).toBeFalsy(); // hopefully no change

  s00 = d.sample({ x: 0, y: 0 });
  expect(s00?.position.x).toBe(0);
  expect(s00?.position.y).toBe(0);
  expect(s00?.position.size).toBe(1);
  expect(s00?.colour).toBe(0);

  s10 = d.sample({ x: -1, y: 0 });
  expect(s10?.position.x).toBe(-1);
  expect(s10?.position.y).toBe(0);
  expect(s10?.position.size).toBe(1);
  expect(s10?.colour).toBe(1); // same

  s11 = d.sample({ x: -1, y: -1 });
  expect(s11?.position.x).toBe(-1);
  expect(s11?.position.y).toBe(-1);
  expect(s11?.position.size).toBe(1);
  expect(s11?.colour).toBe(0);

  // Try setting it back
  expect(d.set({ position: { x: -1, y: 0, size: 1 }, colour: 0 })).toBeTruthy();

  s00 = d.sample({ x: 0, y: 0 });
  expect(s00?.position.x).toBe(0);
  expect(s00?.position.y).toBe(0);
  expect(s00?.position.size).toBe(1);
  expect(s00?.colour).toBe(0);

  s10 = d.sample({ x: -1, y: 0 });
  expect(s10?.position.x).toBe(-1);
  expect(s10?.position.y).toBe(0);
  expect(s10?.position.size).toBe(1);
  expect(s10?.colour).toBe(0); // changed back

  s11 = d.sample({ x: -1, y: -1 });
  expect(s11?.position.x).toBe(-1);
  expect(s11?.position.y).toBe(-1);
  expect(s11?.position.size).toBe(1);
  expect(s11?.colour).toBe(0);

  // Adding a feature further out should expand the grid suitably.
  expect(d.set({ position: { x: 1, y: 1, size: 1 }, colour: 2 })).toBeTruthy();

  s00 = d.sample({ x: 0, y: 0 });
  expect(s00?.position.x).toBe(0);
  expect(s00?.position.y).toBe(0);
  expect(s00?.position.size).toBe(1);
  expect(s00?.colour).toBe(0);

  t11 = d.sample({ x: 1, y: 1 });
  expect(t11?.position.x).toBe(1);
  expect(t11?.position.y).toBe(1);
  expect(t11?.position.size).toBe(1);
  expect(t11?.colour).toBe(2);

  var t10 = d.sample({ x: 1, y: 0 });
  expect(t10?.position.x).toBe(1);
  expect(t10?.position.y).toBe(0);
  expect(t10?.position.size).toBe(1);
  expect(t10?.colour).toBe(0);

  s11 = d.sample({ x: -1, y: -1 }); // this will have been merged
  expect(s11?.position.x).toBe(-2);
  expect(s11?.position.y).toBe(-2);
  expect(s11?.position.size).toBe(2);
  expect(s11?.colour).toBe(0);

  var s21 = d.sample({ x: -2, y: -1 }); // so will this
  expect(s21?.position.x).toBe(-2);
  expect(s21?.position.y).toBe(-2);
  expect(s21?.position.size).toBe(2);
  expect(s21?.colour).toBe(0);

  // Let's test a double expansion as well
  expect(d.set({ position: { x: -7, y: 2, size: 1 }, colour: 3 })).toBeTruthy();

  s00 = d.sample({ x: 0, y: 0 });
  expect(s00?.position.x).toBe(0);
  expect(s00?.position.y).toBe(0);
  expect(s00?.position.size).toBe(1);
  expect(s00?.colour).toBe(0);

  t11 = d.sample({ x: 1, y: 1 });
  expect(t11?.position.x).toBe(1);
  expect(t11?.position.y).toBe(1);
  expect(t11?.position.size).toBe(1);
  expect(t11?.colour).toBe(2);

  s21 = d.sample({ x: -2, y: -1 }); // this will have been merged again
  expect(s21?.position.x).toBe(-8);
  expect(s21?.position.y).toBe(-8);
  expect(s21?.position.size).toBe(8);
  expect(s21?.colour).toBe(0);

  var u72 = d.sample({ x: -7, y: 2 });
  expect(u72?.position.x).toBe(-7);
  expect(u72?.position.y).toBe(2);
  expect(u72?.position.size).toBe(1);
  expect(u72?.colour).toBe(3);

  var u83 = d.sample({ x: -8, y: 3 });
  expect(u83?.position.x).toBe(-8);
  expect(u83?.position.y).toBe(3);
  expect(u83?.position.size).toBe(1);
  expect(u83?.colour).toBe(0);

  var u76 = d.sample({ x: -7, y: 6 });
  expect(u76?.position.x).toBe(-8);
  expect(u76?.position.y).toBe(4);
  expect(u76?.position.size).toBe(4);
  expect(u76?.colour).toBe(0);

  var u52 = d.sample({ x: -5, y: 2 });
  expect(u52?.position.x).toBe(-6);
  expect(u52?.position.y).toBe(2);
  expect(u52?.position.size).toBe(2);
  expect(u52?.colour).toBe(0);

  // Set a few values and some more things should merge (or not)
  expect(d.set({ position: { x: 1, y: 0, size: 1 }, colour: 4 })).toBeTruthy();
  expect(d.set({ position: { x: -7, y: 2, size: 1 }, colour: 0 })).toBeTruthy();
  expect(d.set({ position: { x: -7, y: 1, size: 1 }, colour: 0 })).toBeFalsy();

  s00 = d.sample({ x: 0, y: 0 });
  expect(s00?.position.x).toBe(0);
  expect(s00?.position.y).toBe(0);
  expect(s00?.position.size).toBe(1);
  expect(s00?.colour).toBe(0);

  t11 = d.sample({ x: 1, y: 1 });
  expect(t11?.position.x).toBe(1);
  expect(t11?.position.y).toBe(1);
  expect(t11?.position.size).toBe(1);
  expect(t11?.colour).toBe(2);

  t10 = d.sample({ x: 1, y: 0 }); // changed
  expect(t10?.position.x).toBe(1);
  expect(t10?.position.y).toBe(0);
  expect(t10?.position.size).toBe(1);
  expect(t10?.colour).toBe(4);

  u72 = d.sample({ x: -7, y: 2 }); // all merged
  expect(u72?.position.x).toBe(-8);
  expect(u72?.position.y).toBe(0);
  expect(u72?.position.size).toBe(8);
  expect(u72?.colour).toBe(0);

  u83 = d.sample({ x: -8, y: 3 });
  expect(u83?.position.x).toBe(-8);
  expect(u83?.position.y).toBe(0);
  expect(u83?.position.size).toBe(8);
  expect(u83?.colour).toBe(0);

  u76 = d.sample({ x: -7, y: 6 });
  expect(u76?.position.x).toBe(-8);
  expect(u76?.position.y).toBe(0);
  expect(u76?.position.size).toBe(8);
  expect(u76?.colour).toBe(0);

  // I should be able to expand with a default value and see things still auto-merged
  expect(d.set({ position: { x: -11, y: 1, size: 1 }, colour: 0 })).toBeFalsy();

  t11 = d.sample({ x: 1, y: 1 });
  expect(t11?.position.x).toBe(1);
  expect(t11?.position.y).toBe(1);
  expect(t11?.position.size).toBe(1);
  expect(t11?.colour).toBe(2);

  var t99 = d.sample({ x: 9, y: 9 });
  expect(t99?.position.x).toBe(8);
  expect(t99?.position.y).toBe(8);
  expect(t99?.position.size).toBe(8);
  expect(t99?.colour).toBe(0);

  u83 = d.sample({ x: -8, y: 3 });
  expect(u83?.position.x).toBe(-16);
  expect(u83?.position.y).toBe(0);
  expect(u83?.position.size).toBe(16);
  expect(u83?.colour).toBe(0);

  // Things should behave as expected if I set a block of a larger size
  expect(d.set({ position: { x: -12, y: 0, size: 4 }, colour: 1 })).toBeTruthy();

  var u111 = d.sample({ x: -11, y: 1 });
  expect(u111?.position.x).toBe(-12);
  expect(u111?.position.y).toBe(0);
  expect(u111?.position.size).toBe(4);
  expect(u111?.colour).toBe(1);

  var u131 = d.sample({ x: -13, y: 1 });
  expect(u131?.position.x).toBe(-16);
  expect(u131?.position.y).toBe(0);
  expect(u131?.position.size).toBe(4);
  expect(u131?.colour).toBe(0);

  u83 = d.sample({ x: -8, y: 3 });
  expect(u83?.position.x).toBe(-8);
  expect(u83?.position.y).toBe(0);
  expect(u83?.position.size).toBe(8);
  expect(u83?.colour).toBe(0);
});

test('quadtree dictionary matches behaviour of flat dictionary under random adds', () => {
  const fDict = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  const denseQDict = new QuadtreeColouringDictionary<IFeature<IQuadtreeCoord>>(
    new Quadtree(),
    c => ({ position: c, colour: 0 }),
    (a, b) => a.colour === b.colour,
    f => f.colour === 0,
    false
  );

  const sparseQDict = new QuadtreeColouringDictionary<IFeature<IQuadtreeCoord>>(
    new Quadtree(),
    c => ({ position: c, colour: 0 }),
    (a, b) => a.colour === b.colour,
    f => f.colour === 0,
    true
  );

  for (var qDict of [denseQDict, sparseQDict]) {
    fDict.clear();
    // I need to fill the flat dictionary up to my bounds.  The quadtree dictionary will
    // auto-size itself if I add a single entry:
    const size = 32;
    for (var y = -size; y < size; ++y) {
      for (var x = -size; x < size; ++x) {
        fDict.add({ position: { x: x, y: y }, colour: 0 });
      }
    }

    qDict.set({ position: { x: -size, y: -size, size: 1 }, colour: 0 });

    // Do some random sets, for a few iterations (on subsequent iterations,
    // some stuff should be randomly un-set as well)
    const rng = seedrandom.default("e93ebdae-39c9-43cf-a7d2-3a4b45d1feb1");
    for (var j = 0; j < 3; ++j) {
      var features: IFeature<IQuadtreeCoord>[] = [];
      for (var i = 0; i < size * size; ++i) {
        var random = rng.int32();
        x = modFloor(random, size * 2) - size;
        y = modFloor(Math.floor(random / (size * 2)), size * 2) - size;
        var colour = Math.floor(Math.abs(random) / (size * size * 4)) % 2;
        features.push({ position: { x: x, y: y, size: 1 }, colour: colour });
      }

      var fStart = performance.now();
      // for (var f of features) {
      //   expect(fDict.remove(f.position)).not.toBeUndefined();
      //   expect(fDict.add(f)).toBeTruthy();
      // }
      // We want to verify that these succeeded, without taking up significant time
      // e.g. by having the `expect` calls in the loop:
      var fOk = features.map(f2 => {
        if (fDict.remove(f2.position)) {
          return fDict.add(f2);
        } else {
          return false;
        }
      });
      var fEnd = performance.now();
      console.log("added " + features.length + " features to fDict in " + (fEnd - fStart) + " millis");
      expect(fOk.reduce((a, b) => a && b)).toBeTruthy();

      var qStart = performance.now();
      for (var f of features) {
        // can't assign any expectations to this right now... :)
        qDict.set(f);
      }
      var qEnd = performance.now();
      console.log("added " + features.length + " features to qDict in " + (qEnd - qStart) + " millis");

      // The two should come out equal:
      var valueString = "";
      for (y = -size; y < size; ++y) {
        for (x = -size; x < size; ++x) {
          var coord = { x: x, y: y, size: 1 };
          var value = fDict.get(coord);
          expect(value).not.toBeUndefined();
          valueString += value?.colour;

          var qValue = qDict.sample(coord);
          expect(qValue).not.toBeUndefined();
          expect(qValue?.colour).toBe(value?.colour);
        }

        valueString += "\n";
      }

      console.log(valueString);
    }

    console.log("***");
  }

  // We expect the dense dictionary to contain everything when enumerated, but the
  // sparse one to contain only the ones and not the zeroes:
  const oneCount = fluent(denseQDict).filter(f => f.colour === 1).count();
  const sparseCount = fluent(sparseQDict).count();
  expect(sparseCount).toBe(oneCount);
});