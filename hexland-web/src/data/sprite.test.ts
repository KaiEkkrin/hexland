import { ISprite, SpriteManager } from "./sprite";

import { v4 as uuidv4 } from 'uuid';

function getElementName(i: number) {
  return `image_${i}.jpg`;
}

function *enumeratePaths(count: number) {
  for (let i = 0; i < count; ++i) {
    yield getElementName(i);
  }
}

function getNewElementName(i: number) {
  return `new_${i}.jpg`;
}

function verifySheetPaths(
  sheetPaths: Iterable<string>,
  allPaths: string[],
  start: number,
  end: number,
  missingElements: number[],
  newElements?: number[] | undefined
) {
  const expectedPaths = [...allPaths.slice(start, end)];
  for (const i of missingElements.filter(i2 => i2 >= start && i2 < end)) {
    expectedPaths[i - start] = "";
  }

  if (newElements !== undefined) {
    for (const i of newElements.filter(i2 => i2 >= start && i2 < end)) {
      expectedPaths[i - start] = getNewElementName(i);
    }
  }

  // We don't expect any trailing elements
  const expectedPathString = expectedPaths.toString().replace(/,+$/, '');
  expect([...sheetPaths].toString()).toBe(expectedPathString);
}

test('add and remove sprites in sequence', () => {
  const [columns, rows] = [4, 4];
  const sm = new SpriteManager([], uuidv4());

  // I should be able to do this a few times over, since each time around, I'm
  // resetting the spritesheet to empty
  for (const count of [1, 2, 10, 16, 20, 32, 50]) {
    const paths = [...enumeratePaths(count)];

    // Check sprites are added in sequence:
    let expectedPosition = 0;
    for (const source of paths) {
      const { isNew, sprite } = sm.addImage(source, columns, rows);
      expect(isNew).toBeTruthy();
      expect(sprite.source).toBe(source);
      expect(sprite.columns).toBe(columns);
      expect(sprite.rows).toBe(rows);
      expect(sprite.position).toBe(expectedPosition);
      if (++expectedPosition === (columns * rows)) {
        // Starting a new sheet here
        expectedPosition = 0;
      }
    }

    // Work out how many sheets we have:
    const sheetIds = sm.sheetIds();
    expect(sheetIds.length).toBe(Math.ceil(count / (columns * rows)));

    // We should be able to retrieve sheets ordered correctly:
    let countLeft = count;
    let start = 0;
    for (const id of sheetIds) {
      const sheetPaths = [...sm.sheetPaths(id)];
      const len = Math.min(countLeft, columns * rows);
      expect(sheetPaths).toHaveLength(len);
      expect(sheetPaths.toString()).toBe(paths.slice(start, start + len).toString());
      countLeft -= (columns * rows);
      start += (columns * rows);
    }

    // Check sprites are also removed correctly, and at suitable intervals,
    // whole sheets are removed too
    expectedPosition = 0;
    let expectedSheet = 0;
    for (const source of paths) {
      const { sprite, sheetId } = sm.removeImage(source);
      expect(sprite?.source).toBe(source);
      expect(sprite?.columns).toBe(columns);
      expect(sprite?.rows).toBe(rows);
      expect(sprite?.position).toBe(expectedPosition);

      if (++expectedPosition === (columns * rows)) {
        // Starting a new sheet here
        expect(sheetId).toBe(sheetIds[expectedSheet++]);
        expectedPosition = 0;
      } else if (expectedSheet * columns * rows + expectedPosition === count) {
        // This is the last sheet, which should be removed
        expect(sheetId).toBe(sheetIds[expectedSheet]);
      } else {
        expect(sheetId).toBeUndefined();
      }
    }
  }
});

test('fill holes in spritesheets', () => {
  const [columns, rows] = [4, 4];
  const sm = new SpriteManager([], uuidv4());
  const count = 48; // makes 3 full sheets.
  const paths = [...enumeratePaths(count)];

  // The above test will be good enough to check this is okay
  for (const source of paths) {
    const { isNew } = sm.addImage(source, columns, rows);
    expect(isNew).toBeTruthy();
  }

  // Remove the following:
  // - sheet 0, position 0 (tests the very start).
  // - sheet 0, position 7 (tests a mid-mid hole).
  // - sheet 0, position 15 (tests a mid-end hole).
  // - sheet 1, positions 0 and 1 (tests a double mid-start hole).
  // - sheet 1, positions 4 and 5 (tests a double mid-mid hole).
  // - sheet 1, positions 14 and 15 (tests a double mid-end hole).
  // - sheet 2, position 0 (tests a mid-start hole).
  // - sheet 2, position 15 (tests the very end).
  const allSprites = [...sm.sprites];
  const allRemoved: ISprite[] = [];
  const removedIndexes = [0, 7, 15, 16, 17, 20, 21, 30, 31, 32, 47];
  for (const i of removedIndexes) {
    const { sprite } = sm.removeImage(allSprites[i].source);
    expect(sprite).not.toBeUndefined();
    expect(sprite?.source).toBe(allSprites[i].source);
    if (sprite !== undefined) {
      allRemoved.push(sprite);
    }
  }

  // If I try to double-remove any of those I should get no removals back
  for (const r of allRemoved) {
    const { sprite } = sm.removeImage(r.source);
    expect(sprite).toBeUndefined();
  }

  // Check that if I enumerate the paths, all the proper holes are present:
  let sheetIds = sm.sheetIds();
  expect(sheetIds).toHaveLength(3);
  verifySheetPaths(sm.sheetPaths(sheetIds[0]), paths, 0, 16, removedIndexes);
  verifySheetPaths(sm.sheetPaths(sheetIds[1]), paths, 16, 32, removedIndexes);
  verifySheetPaths(sm.sheetPaths(sheetIds[2]), paths, 32, 48, removedIndexes);

  // Try adding new elements in sequence.
  // They should fill those holes in order
  const newElements: number[] = [];
  for (const i of removedIndexes) {
    const newName = getNewElementName(i);
    const { isNew, sprite } = sm.addImage(newName, columns, rows);
    expect(isNew).toBeTruthy();
    expect(sprite.source).toBe(newName);
    expect(sprite.columns).toBe(columns);
    expect(sprite.rows).toBe(rows);
    expect(sprite.position).toBe(i % 16);

    // We expect a new sheet id to have been generated for the sheet this sprite
    // went into:
    expect(sheetIds).not.toContainEqual(sprite.id);

    sheetIds = sm.sheetIds();
    expect(sheetIds).toHaveLength(3);
    expect(sheetIds).toContainEqual(sprite.id);

    newElements.push(i);

    // At each stage, I should get the proper spritesheets back with the holes filled
    // in appropriately
    verifySheetPaths(sm.sheetPaths(sheetIds[0]), paths, 0, 16, removedIndexes, newElements);
    verifySheetPaths(sm.sheetPaths(sheetIds[1]), paths, 16, 32, removedIndexes, newElements);
    verifySheetPaths(sm.sheetPaths(sheetIds[2]), paths, 32, 48, removedIndexes, newElements);
  }

  // After all of that, if I add yet another sprite, it should start a
  // new sheet once again.
  const { isNew, sprite } = sm.addImage("new.jpg", columns, rows);
  expect(isNew).toBeTruthy();
  expect(sprite.source).toBe("new.jpg");
  expect(sprite.columns).toBe(columns);
  expect(sprite.rows).toBe(rows);
  expect(sprite.position).toBe(0);
  expect(sheetIds).not.toContainEqual(sprite.id);
});

test('replace entries in spritesheets', () => {
  const [columns, rows] = [4, 4];
  const sm = new SpriteManager([], uuidv4());
  const count = 48; // makes 3 full sheets.
  const paths = [...enumeratePaths(count)];

  // The above test will be good enough to check this is okay
  for (const source of paths) {
    const { isNew } = sm.addImage(source, columns, rows);
    expect(isNew).toBeTruthy();
  }

  // We'll replace the same list of entries we removed in the previous test
  const replacedIndexes = [0, 7, 15, 16, 17, 20, 21, 30, 31, 32, 47];
  for (const i of replacedIndexes) {
    const oldName = getElementName(i);
    const newName = getNewElementName(i);
    const { isNew, sprite } = sm.replaceImage(oldName, newName, columns, rows);
    expect(isNew).toBeFalsy(); // we edited an existing entry
    expect(sprite.source).toBe(newName);
  }

  // After that process, all the replaced elements should appear in the sheet paths
  const sheetIds = sm.sheetIds();
  expect(sheetIds).toHaveLength(3);
  verifySheetPaths(sm.sheetPaths(sheetIds[0]), paths, 0, 16, replacedIndexes, replacedIndexes);
  verifySheetPaths(sm.sheetPaths(sheetIds[1]), paths, 16, 32, replacedIndexes, replacedIndexes);
  verifySheetPaths(sm.sheetPaths(sheetIds[2]), paths, 32, 48, replacedIndexes, replacedIndexes);

  // After all of that, if I add yet another sprite, it should start a
  // new sheet once again.
  const { isNew, sprite } = sm.addImage("new.jpg", columns, rows);
  expect(isNew).toBeTruthy();
  expect(sprite.source).toBe("new.jpg");
  expect(sprite.columns).toBe(columns);
  expect(sprite.rows).toBe(rows);
  expect(sprite.position).toBe(0);
  expect(sheetIds).not.toContainEqual(sprite.id);
});