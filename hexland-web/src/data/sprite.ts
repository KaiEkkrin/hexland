import { v5 as uuidv5 } from 'uuid';

// We deliberately create a `sprite` record that contains info about the spritesheet too.  This
// wastes a bit of database space (not much, it should be fine) in exchange for providing a very
// convenient format that can be re-used in the token to specify what sprite to show for it.
export interface ISprite {
  source: string; // the path of the user-uploaded image in Storage, e.g. `images/${uid}/${id}`
  id: string; // the id of the spritesheet image in Storage, forming path `sprites/${id}`
  columns: number; // up to 4
  rows: number; // up to 4
  position: number; // y * columns + x
}

export interface ISpritesheets {
  sprites: ISprite[];
}

// This sprite comparison function will order them by sheet, then row, then column.
export function compareSprites(a: ISprite, b: ISprite): number {
  const idCmp = a.id.localeCompare(b.id);
  return idCmp !== 0 ? idCmp : a.position - b.position;
}

// This helps create known sprite paths in storage.
// We hardwire the ".png" extension for now to get around issues with content type
export function getSpritePath(sprite: ISprite) {
  return `sprites/${sprite.id}.png`;
}

// Describes an image spritesheet(s).  These will be associated with adventures and cover all the images
// that can be displayed in that adventure's maps.
// There will be one of these per adventure, managed by Firebase Functions only.  There's no need
// to have multiple records per adventure e.g. one per sheet -- that would just cause more reads and
// some "fun" with concurrency control.
export class SpriteManager {
  private readonly _sprites: ISprite[];
  private readonly _idSeed: string;
  private _nextIdName = 0;

  // Supplying `idSeed` here allows the sprite manager to generate predictable new ids
  constructor(sprites: ISprite[], idSeed: string) {
    this._sprites = sprites.sort(compareSprites);
    this._idSeed = idSeed;
  }

  // Changes the id of the given sprite's sheet, returning the new id.
  // The new id is based on the existing id and the sprite that caused the change; thus,
  // even if other sheets have changed, the same change to a particular sheet attempted
  // twice will result in the same changed sheet id.
  private changeSheetId(sprite: ISprite) {
    const oldId = sprite.id;
    const newId = uuidv5(`${sprite.source};${sprite.position}`, sprite.id);
    for (const s of this._sprites) {
      if (s.id === oldId) {
        s.id = newId;
      }
    }

    sprite.id = newId;
  }

  private generateId(): string {
    return uuidv5(String(this._nextIdName++), this._idSeed);
  }

  private insertImage(imagePath: string, reqColumns: number, reqRows: number): ISprite {
    // Walk through the current spritesheets looking for a gap where we can slot this image.
    let id = "";
    let position = reqColumns * reqRows;
    for (let i = 0; i < this._sprites.length; ++i) {
      const s = this._sprites[i];
      if (s.columns !== reqColumns || s.rows !== reqRows) {
        // Skip this entry -- wrong geometry.
        continue;
      }

      if (++position >= reqColumns * reqRows) {
        // We expect to have moved on to the next sheet.
        id = s.id;
        position = 0;
      }

      if (id !== s.id || s.position !== position) {
        // There is a gap here:
        const sprite: ISprite = {
          source: imagePath,
          id: id,
          columns: reqColumns,
          rows: reqRows,
          position: position
        };
        this._sprites.splice(i, 0, sprite);
        return sprite;
      }
    }

    // If we got here, there are no gaps.  Either add to the current sheet or if it's full
    // make a new one.
    ++position;
    const sprite: ISprite = (id.length > 0 && position < (reqColumns * reqRows)) ? {
      source: imagePath,
      id: id,
      columns: reqColumns,
      rows: reqRows,
      position: position
    } : {
      source: imagePath,
      id: this.generateId(),
      columns: reqColumns,
      rows: reqRows,
      position: 0
    };
    this._sprites.push(sprite); // TODO not maintaining alphabetical order of ids -- problematic?
                                // I think they just need to stay grouped together, which this will do
    return sprite;
  }

  // Gets the latest sprites that can be written back to the database after any changes.
  get sprites() { return this._sprites; }

  // Adds an image as a sprite.  `isNew` will be true if the spritesheets changed, else false.
  // Only considers spritesheets with the matching (row, column) counts.
  // If a change is made to a sheet, that sheet will be given a new id that will, of course,
  // be returned in the sprite record here.
  addImage(imagePath: string, columns: number, rows: number): { isNew: boolean, sprite: ISprite } {
    const already = this._sprites.find(
      s => s.source === imagePath && s.columns === columns && s.rows === rows
    );
    if (already !== undefined) {
      return { isNew: false, sprite: already };
    } else {
      const sprite = this.insertImage(imagePath, columns, rows);
      this.changeSheetId(sprite);
      return { isNew: true, sprite: sprite };
    }
  }

  // Removes an image from spritesheets.
  // Returns
  // - the sprite if one was removed, else undefined
  // - a sheet id if it no longer has any sprites on and can be deleted, else undefined.
  removeImage(imagePath: string): { sprite: ISprite | undefined, sheetId: string | undefined } {
    const i = this._sprites.findIndex(s => s.source === imagePath);
    if (i >= 0) {
      const sprite = this._sprites[i];
      this._sprites.splice(i, 1);
      return {
        sprite: sprite,
        sheetId: this._sprites.findIndex(s => s.id === sprite.id) >= 0 ? undefined : sprite.id
      };
    } else {
      return { sprite: undefined, sheetId: undefined };
    }
  }

  // Replaces the existing sprite with path `oldImagePath` with a sprite image from `newImagePath`
  // instead.  If no sprite is found, instead adds a new sprite.  (Always makes a change.)
  // If a change is made to a sheet, that sheet will be given a new id that will, of course,
  // be returned in the sprite record here.
  replaceImage(oldImagePath: string, newImagePath: string, columns: number, rows: number): { isNew: boolean, sprite: ISprite } {
    const already = this._sprites.find(
      s => s.source === oldImagePath && s.columns === columns && s.rows === rows
    );
    if (already !== undefined) {
      already.source = newImagePath;
      this.changeSheetId(already);
      return { isNew: false, sprite: already };
    } else {
      return this.addImage(newImagePath, columns, rows);
    }
  }

  // Gets an ordered list of the spritesheet ids (deduplicated.)
  sheetIds(): string[] {
    const sheetIds: string[] = [];
    for (const s of this._sprites) {
      if (sheetIds.find(id => id === s.id) === undefined) {
        sheetIds.push(s.id);
      }
    }

    return sheetIds;
  }

  // Gets an ordered list of the image paths that should contribute to a particular spritesheet,
  // such that `position` indexes this list.  (We return "" for gaps, but the list may be truncated if
  // all the gaps are at the end.)
  *sheetPaths(id: string): Iterable<string> {
    let position = -1;
    for (const s of this._sprites) {
      if (s.id !== id) {
        continue;
      }

      // If there are any blanks before the next sprite, emit blank paths
      while (++position < s.position) {
        yield "";
      }

      yield s.source;
    }
  }
}