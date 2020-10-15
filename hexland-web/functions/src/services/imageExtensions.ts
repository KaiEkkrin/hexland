import { IAdventure } from '../data/adventure';
import { IImage, IImages } from '../data/image';
import { IMap } from '../data/map';
import { getUserPolicy } from '../data/policy';
import { IProfile } from '../data/profile';
import { ISprite, ISpritesheets, SpriteManager } from '../data/sprite';
import { IAdminDataService, ICollectionGroupQueryResult } from './extraInterfaces';
import { IDataService, IDataReference, IDataView, ILogger, IStorage, IDataAndReference, IStorageReference } from './interfaces';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { spawn } from 'child-process-promise';
import fluent from 'fluent-iterable';
import { v4 as uuidv4 } from 'uuid';

// For HttpsError.  It's a bit abstraction-breaking, but very convenient...
import * as functions from 'firebase-functions';

function getImageUid(path: string): string | undefined {
  // Extract the uid from the path.  We rely on the Storage security rules to have
  // enforced that uid
  // The leading / character is optional
  const result = /^\/?images\/([^\/]+)\/([^\/]+)/.exec(path);
  return result ? result[1] : undefined;
}

async function addImageTransaction(
  view: IDataView,
  name: string,
  path: string,
  imagesRef: IDataReference<IImages>,
  profileRef: IDataReference<IProfile>
): Promise<boolean> {
  // Fetch the current images record
  const images = await view.get(imagesRef);
  const imageCount = images?.images.length ?? 0;

  async function completeWithError(error: string) {
    if (images !== undefined) {
      await view.update(imagesRef, { lastError: error });
    } else {
      const newImages: IImages = {
        images: [],
        lastError: error
      };
      await view.set(imagesRef, newImages);
    }

    return false;
  }

  // Fetch the user's profile, to check whether they can add any more images
  const profile = await view.get(profileRef);
  if (profile === undefined) {
    return await completeWithError("No profile found");
  }

  const userPolicy = getUserPolicy(profile.level);
  if (imageCount >= userPolicy.images) {
    return await completeWithError("You have too many images; delete one to upload another.");
  }

  // Add the new image to the front of the list
  const newImage: IImage = { name: name, path: path };
  if (images !== undefined) {
    await view.update(imagesRef, { images: [newImage, ...images.images], lastError: "" });
  } else {
    const newImages: IImages = { images: [newImage], lastError: "" };
    await view.set(imagesRef, newImages);
  }

  return true;
}

// Adds an image.
// If we return false, the add wasn't successful -- delete the uploaded image.
export async function addImage(
  dataService: IDataService,
  storage: IStorage,
  logger: ILogger,
  name: string,
  path: string,
): Promise<boolean> {
  const uid = getImageUid(path);
  if (!uid) {
    logger.logWarning("Found image with unrecognised path: " + path);
    return false;
  }

  const imagesRef = dataService.getImagesRef(uid);
  const profileRef = dataService.getProfileRef(uid);
  try {
    const ok = await dataService.runTransaction(tr => addImageTransaction(tr, name, path, imagesRef, profileRef));
    if (!ok) {
      logger.logInfo(`Add ${path} reported an error -- deleting`);
      await storage.ref(path).delete();
    }
    return ok;
  } catch (e) {
    logger.logWarning(`Error on add ${path} -- deleting`, e);
    await storage.ref(path).delete();
    return false;
  }
}

function *enumerateMapAdventureRefs(
  mapRefs: ICollectionGroupQueryResult<IMap, IAdventure>[],
  except: IDataAndReference<IAdventure>[]
) {
  for (const m of mapRefs) {
    const a = m.getParent();
    if (!a) {
      continue;
    }

    if (except.find(a2 => a2.isEqual(a))) {
      continue;
    }

    yield a;
  }
}

async function deleteImageTransaction(
  view: IDataView,
  imagesRef: IDataReference<IImages>,
  adventureRefs: IDataAndReference<IAdventure>[],
  mapRefs: ICollectionGroupQueryResult<IMap, IAdventure>[],
  path: string
) {
  // Fetch all those adventures and maps again to make sure we're not trampling on a
  // subsequent map assignment
  const adventures = await Promise.all(adventureRefs.map(async a => {
    const adventure = await view.get(a);
    return { r: a, record: adventure };
  }));

  const maps = await Promise.all(mapRefs.map(async m => {
    const map = await view.get(m);
    return { r: m, record: map };
  }));

  // For each map, we need to fetch its matching adventure record, if we didn't already
  const mapAdventures = await Promise.all(
    fluent(enumerateMapAdventureRefs(mapRefs, adventureRefs)).map(async a => {
      const adventure = await view.get(a);
      return { r: a, record: adventure };
    })
  );

  // Remove this image from the images list
  const images = await view.get(imagesRef);
  if (images !== undefined) {
    const updatedImages = images.images.filter(i => i.path !== path);
    await view.update(imagesRef, { images: updatedImages });
  }

  // For each adventure, remove this image from its own image path, and remove it from
  // any maps that have it
  await Promise.all(adventures.map(async a => {
    if (!a.record) {
      return;
    }

    const updatedMaps = a.record.maps.map(m => m.imagePath === path ? { ...m, imagePath: "" } : m);
    await view.update(a.r, {
      maps: updatedMaps,
      imagePath: a.record.imagePath === path ? "" : path
    });
  }));

  // For each map record, remove this image
  await Promise.all(maps.map(async m => {
    if (m.record?.imagePath === path) {
      await view.update(m.r, { imagePath: "" });
    }
  }));

  // For each of the map adventure records that didn't appear in our main list of
  // adventure hits, remove this image from any maps
  await Promise.all(mapAdventures.map(async a => {
    if (!a.record) {
      return;
    }

    const updatedMaps = a.record.maps.map(m => m.imagePath === path ? { ...m, imagePath: "" } : m);
    await view.update(a.r, { maps: updatedMaps });
  }));
}

// Deletes an image.
export async function deleteImage(
  dataService: IAdminDataService,
  storage: IStorage,
  logger: ILogger,
  uid: string,
  path: string
): Promise<void> {
  const pathUid = getImageUid(path);
  if (!pathUid || pathUid !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'This image path corresponds to a different user id');
  }

  // We don't bother with profile and players here, because they will be naturally updated
  // by their user while navigating the UI.  I can add the functionality if it turns out
  // that the image being suddenly absent is a really bad experience.
  const images = dataService.getImagesRef(uid);
  const adventures = await dataService.getAdventureRefsByImagePath(path);
  const maps = await dataService.getMapRefsByImagePath(path);

  // TODO #149 Delete any associated sprites too?  (requires a complex query?)

  await dataService.runTransaction(
    tr => deleteImageTransaction(tr, images, adventures, maps, path)
  );

  await storage.ref(path).delete();
}

class SpriteEditException {
  private readonly _message: string;

  constructor(message: string) {
    this._message = message;
  }

  get message() { return this._message; }
}

async function getNewSpritesheetRecord(
  view: IDataView,
  newPath: string,
  oldPath: string | undefined,
  spritesRef: IDataReference<ISpritesheets>,
  seed: string
) {
  // #46: I'm going to hardwire these for now.
  const columns = 4;
  const rows = 4;

  const spritesheets = await view.get(spritesRef);
  const oldSprite = spritesheets?.sprites.find(s => s.source === oldPath);
  
  // Sanity check just in case someone does this
  if (oldPath === newPath && oldSprite !== undefined) {
    return { oldSprite: oldSprite, newSprite: undefined, newSheetPaths: undefined, sm: undefined };
  }

  const sm = new SpriteManager(spritesheets?.sprites ?? [], seed);
  if (oldPath !== undefined) {
    const { sprite } = sm.replaceImage(oldPath, newPath, columns, rows);
    const sheetPaths = [...sm.sheetPaths(sprite.id)];
    return { oldSprite: oldSprite, newSprite: sprite, newSheetPaths: sheetPaths, sm: sm };
  } else {
    const { sprite } = sm.addImage(newPath, columns, rows);
    const sheetPaths = [...sm.sheetPaths(sprite.id)];
    return { oldSprite: oldSprite, newSprite: sprite, newSheetPaths: sheetPaths, sm: sm };
  }
}

async function createSpritesheet(storage: IStorage, sprite: ISprite, sheetPaths: string[]): Promise<IStorageReference> {
  // See https://firebase.google.com/docs/functions/gcp-storage-events for an example of the
  // kind of thing I am doing in this function.
  const tmp = os.tmpdir();
  const tmpPaths: string[] = [];
  try {
    // Download all the source files from Storage.  (This should preserve ordering)
    // TODO #46 To save bandwidth, I could try cutting out the existing images and only
    // downloading the new sprite.  This might be slower, and certainly more complicated...
    const downloaded = await Promise.all(sheetPaths.map(async p => {
      const tmpPath = path.join(tmp, uuidv4()); // TODO eurgh do I need file extensions?
      await storage.ref(p).download(tmpPath);
      return tmpPath;
    }));
    tmpPaths.push(...downloaded);

    // Do the montage
    // TODO sort out the hardwired values here :p
    const tmpSheetPath = path.join(tmp, `${uuidv4()}.png`);
    await spawn('montage', [
      '-geometry', '256x256',
      '-tile', '4x4',
      '-alpha', 'background',
      '-depth', '8',
      ...tmpPaths,
      tmpSheetPath
    ]);
    tmpPaths.push(tmpSheetPath);

    // Upload that new spritesheet
    const sheetRef = storage.ref(`sprites/${sprite.id}`);
    await sheetRef.upload(tmpSheetPath, { contentType: 'image/png' });
    return sheetRef;
  } finally {
    for (const p of tmpPaths) {
      fs.unlink(p, () => {});
    }
  }
}

async function commitSpritesheet(
  view: IDataView,
  newPath: string,
  oldPath: string | undefined,
  spritesRef: IDataReference<ISpritesheets>,
  seed: string,
  newId: string
): Promise<ISprite> {
  // If calling getNewSpritesheetRecord again produces a new sprite with the same ID,
  // I know that the spritesheet I already made is valid and I can commit the changes.
  const { newSprite, sm } = await getNewSpritesheetRecord(
    view, newPath, oldPath, spritesRef, seed
  );

  if (newSprite?.id !== newId) {
    throw new SpriteEditException('Edit conflict on ' + newPath);
  }

  if (sm === undefined) {
    // This is fatal
    throw Error('Sprite was deleted');
  }

  view.update(spritesRef, { sprites: sm.sprites });
  return newSprite;
}

async function tryEditSprite(
  dataService: IAdminDataService,
  storage: IStorage,
  logger: ILogger,
  newPath: string,
  oldPath: string | undefined,
  spritesRef: IDataReference<ISpritesheets>
): Promise<ISprite> {
  const seed = uuidv4();

  // Create a new sprite record, and the new spritesheet that goes with it
  const { oldSprite, newSprite, newSheetPaths } = await getNewSpritesheetRecord(
    dataService, newPath, oldPath, spritesRef, seed
  );
  if (newSprite === undefined || newSheetPaths === undefined) {
    if (oldSprite !== undefined) {
      // This edit would be meaningless
      return oldSprite;
    } else {
      throw Error("No sprites at all?");
    }
  }

  // Create the new spritesheet
  const spriteSheetRef = await createSpritesheet(storage, newSprite, newSheetPaths);

  // If the transaction fails, I want to delete it again to save space:
  try {
    return await dataService.runTransaction(tr => commitSpritesheet(
      tr, newPath, oldPath, spritesRef, seed, newSprite.id
    ));
  } catch (e) {
    await spriteSheetRef.delete();
    throw e;
  }
}

// Adds or edits a sprite.
export async function editSprite(
  dataService: IAdminDataService,
  storage: IStorage,
  logger: ILogger,
  adventureId: string,
  newPath: string,
  oldPath: string | undefined
): Promise<ISprite> {
  const spritesRef = dataService.getSpritesRef(adventureId);

  // We can't use the Firestore transaction mechanism here because we need to clean up
  // unused spritesheets in between failed tries.  Therefore, we roll our own retry loop:
  const tries = 5;
  let exception: SpriteEditException | undefined = undefined;
  for (let i = 0; i < tries; ++i) {
    try {
      return await tryEditSprite(dataService, storage, logger, newPath, oldPath, spritesRef);
    } catch (e) {
      if (e instanceof SpriteEditException) {
        exception = e;
      } else {
        throw e;
      }
    }
  }

  throw exception;
}