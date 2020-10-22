import { Timestamp } from './types';

// We deliberately create a `sprite` record that contains info about the spritesheet too.  This
// wastes a bit of database space (not much, it should be fine) in exchange for providing a very
// convenient format that can be used in the token to specify what sprite to show for it.
export interface ISprite {
  source: string; // the path of the user-uploaded image in Storage, e.g. `images/${uid}/${id}`
  id: string; // the id of the spritesheet image in Storage, forming path `sprites/${id}`
  geometry: string; // converted by "convertSpriteGeometry" below; a string so it can be indexed
  position: number; // y * columns + x
}

// #149: The spritesheet record is stored per-map.
export interface ISpritesheet {
  sprites: string[]; // the sprites in position order, "" denoting any blank spaces
  geometry: string;
  freeSpaces: number; // keep this in sync with `sprites` during transactions
  date: Timestamp | number; // initialise this to `serverTimestamp`
  supersededBy: string; // the id of a newer spritesheet overriding this one or "" if none
  refs: number; // starting at 0, the number of open edits for this spritesheet
}

export interface ISpriteGeometry {
  columns: number;
  rows: number;
}

export const defaultSpriteGeometry: ISpriteGeometry = { columns: 4, rows: 4 };

export function fromSpriteGeometryString(g: string): ISpriteGeometry {
  const result = /^([0-9]+)x([0-9]+)$/.exec(g);
  if (result) {
    const columns = Number.parseInt(result[1]);
    const rows = Number.parseInt(result[2]);
    if (columns && rows) {
      return { columns: columns, rows: rows };
    }
  }

  return defaultSpriteGeometry;
}

export function toSpriteGeometryString(g: ISpriteGeometry): string {
  return `${g.columns}x${g.rows}`;
}

// This helps create known sprite paths in storage.
// We hardwire the ".png" extension for now to get around issues with content type
export function getSpritePath(sprite: ISprite) {
  return `sprites/${sprite.id}.png`;
}

export function getSpritePathFromId(id: string) {
  return `sprites/${id}.png`;
}