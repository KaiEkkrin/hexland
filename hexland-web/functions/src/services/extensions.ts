import { IAdventure, IPlayer, summariseAdventure } from '../data/adventure';
import { IAnnotation } from '../data/annotation';
import { Change, Changes } from '../data/change';
import { SimpleChangeTracker, trackChanges } from '../data/changeTracking';
import { GridCoord, GridEdge, coordString, edgeString } from '../data/coord';
import { FeatureDictionary, IFeature, ITokenDictionary, PlayerArea } from '../data/feature';
import { IdDictionary } from '../data/identified';
import { IMapImage } from '../data/image';
import { IInvite } from '../data/invite';
import { IMap, MapType, summariseMap } from '../data/map';
import { getUserPolicy, IInviteExpiryPolicy } from '../data/policy';
import { IAdventureSummary, IProfile } from '../data/profile';
import { getTokenGeometry } from '../data/tokenGeometry';
import { Tokens, SimpleTokenDrawing } from '../data/tokens';

import * as Convert from './converter';
import { IAdminDataService } from './extraInterfaces';
import { updateProfileAdventures, updateProfileMaps, updateAdventureMaps } from './helpers';
import { IDataService, IDataView, IDataReference, IDataAndReference, ILogger } from './interfaces';

import * as dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

// For HttpsError.  It's a bit abstraction-breaking, but very convenient...
import * as functions from 'firebase-functions';

async function createAdventureTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  currentAdventures: IDataAndReference<IAdventure>[],
  name: string,
  description: string,
  newAdventureRef: IDataReference<IAdventure>,
  newPlayerRef: IDataReference<IPlayer>
): Promise<void> {
  // Get this user's level from their profile
  const profile = await view.get(profileRef);
  if (profile === undefined) {
    throw new functions.https.HttpsError('permission-denied', 'No profile available');
  }

  const policy = getUserPolicy(profile.level);
  if (currentAdventures.length >= policy.adventures) {
    throw new functions.https.HttpsError('permission-denied', 'You already have the maximum number of adventures.');
  }

  // OK, we're good -- go about doing the creation
  const record: IAdventure = {
    name: name,
    description: description,
    owner: profileRef.id,
    ownerName: profile.name,
    maps: [],
    imagePath: ""
  };

  await view.set(newAdventureRef, record);
  await view.set(newPlayerRef, {
    ...record,
    id: newAdventureRef.id,
    playerId: profileRef.id,
    playerName: profile.name,
    allowed: true,
    characters: []
  });

  // Add it to the user's profile as a recent adventure
  const adventures = updateProfileAdventures(profile.adventures, summariseAdventure(newAdventureRef.id, record));
  if (adventures !== undefined) {
    await view.update(profileRef, { adventures: adventures });
  }
}

export async function createAdventure(dataService: IDataService, uid: string, name: string, description: string): Promise<string> {
  // I'm going to need this user's profile and all their current adventures:
  const profileRef = dataService.getProfileRef(uid);
  const currentAdventures = await dataService.getMyAdventures(uid);

  // ...and a ref for the new one, along with the new owner's player record
  const id = uuidv4();
  const newAdventureRef = dataService.getAdventureRef(id);
  const newPlayerRef = dataService.getPlayerRef(id, uid);
  await dataService.runTransaction(tr => createAdventureTransaction(
    tr, profileRef, currentAdventures, name, description, newAdventureRef, newPlayerRef
  ));

  return id;
}

async function createMapTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  newMapRef: IDataReference<IMap>,
  newMapRecord: IMap,
  newBaseChangeRef?: IDataReference<Changes> | undefined,
  changes?: Changes | undefined
): Promise<void> {
  // Fetch things
  const profile = await view.get(profileRef);
  if (profile === undefined) {
    throw new functions.https.HttpsError('permission-denied', 'No profile available');
  }

  const adventure = await view.get(adventureRef);
  if (adventure === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'No such adventure');
  }

  // Check they haven't exceeded their map quota in this adventure
  const policy = getUserPolicy(profile.level);
  if (adventure.maps.length >= policy.maps) {
    throw new functions.https.HttpsError('permission-denied', 'You already have the maximum number of maps in this adventure.');
  }

  // If we reach here we can safely create that map:
  const record: IMap = {
    ...newMapRecord,
    adventureName: adventure.name,
    owner: profileRef.id,
  };
  await view.set(newMapRef, record);

  // Update the adventure record to include this map
  const summary = summariseMap(adventureRef.id, newMapRef.id, record);
  const allMaps = updateAdventureMaps(adventure.maps, summary);
  await view.update(adventureRef, { maps: allMaps });

  // Update the profile to include this map
  const latestMaps = updateProfileMaps(profile.latestMaps, summary);
  if (latestMaps !== undefined) {
    await view.update(profileRef, { latestMaps: latestMaps });
  }

  // If an initial base change was supplied, add it now
  if (newBaseChangeRef !== undefined && changes !== undefined) {
    await view.set(newBaseChangeRef, changes);
  }
}

export async function createMap(
  dataService: IDataService,
  uid: string,
  adventureId: string,
  name: string,
  description: string,
  ty: MapType,
  ffa: boolean
): Promise<string> {
  // I'll need to edit the user's profile and the adventure record as well as
  // create the map itself:
  const profileRef = dataService.getProfileRef(uid);
  const adventureRef = dataService.getAdventureRef(adventureId);

  const id = uuidv4();
  const newMapRef = dataService.getMapRef(adventureId, id);
  await dataService.runTransaction(tr => createMapTransaction(
    tr, profileRef, adventureRef, newMapRef, {
      adventureName: "", // to be replaced by the transaction
      owner: uid,
      name: name,
      description: description,
      ty: ty,
      ffa: ffa,
      imagePath: ""
    }
  ));

  return id;
}

// Clones a map as a new map (by the same user, in the same adventure, for now.)
export async function cloneMap(
  dataService: IDataService,
  logger: ILogger,
  timestampProvider: () => FirebaseFirestore.FieldValue,
  uid: string,
  adventureId: string,
  mapId: string,
  name: string,
  description: string
): Promise<string> {
  // I'll need to edit the user's profile and the adventure record as well as
  // create the map itself:
  const profileRef = dataService.getProfileRef(uid);
  const adventureRef = dataService.getAdventureRef(adventureId);
  const existingMapRef = dataService.getMapRef(adventureId, mapId);

  const id = uuidv4();
  const newMapRef = dataService.getMapRef(adventureId, id);

  const existingMap = await dataService.get(existingMapRef);
  if (existingMap === undefined) {
    throw new functions.https.HttpsError('not-found', 'Existing map not found.');
  }

  // We're going to need the consolidated base change from the existing map:
  const baseChange = await consolidateMapChanges(
    dataService, logger, timestampProvider, adventureId, mapId, existingMap, false
  );

  // Now we can create the new map:
  const converter = Convert.createChangesConverter();
  const baseChangeRef = dataService.getMapBaseChangeRef(adventureId, id, converter);
  await dataService.runTransaction(
    tr => createMapTransaction(tr, profileRef, adventureRef, newMapRef, {
      ...existingMap,
      name: name,
      description: description
    }, baseChangeRef, baseChange)
  );

  return id;
}

interface IConsolidateMapChangesResult {
  baseChange: Changes | undefined,
  isNew: boolean // true if we wrote something, false if we just returned what was already there
}

async function consolidateMapChangesTransaction(
  view: IDataView,
  logger: ILogger,
  timestampProvider: () => FirebaseFirestore.FieldValue | number,
  baseChange: Changes | undefined,
  baseChangeRef: IDataReference<Changes>,
  incrementalChanges: IDataAndReference<Changes>[],
  consolidated: Change[],
  uid: string,
  resync: boolean
): Promise<IConsolidateMapChangesResult> {
  // Check that the base change hasn't changed since we did the query.
  // If it has, we'll simply abort -- someone else has done this recently
  const latestBaseChange = await view.get(baseChangeRef);
  if (baseChange !== undefined && latestBaseChange !== undefined) {
    if (
      typeof(latestBaseChange.timestamp) !== 'number' ||
      typeof(baseChange.timestamp) !== 'number'
    ) {
      // This should be fine, because they shouldn't be mixed within one application;
      // real application always uses the firestore field value, tests always use number
      const latestTimestamp = latestBaseChange.timestamp as FirebaseFirestore.FieldValue;
      const baseTimestamp = baseChange.timestamp as FirebaseFirestore.FieldValue;
      if (!latestTimestamp.isEqual(baseTimestamp)) {
        logger.logWarning("Map changes for " + baseChangeRef.id + " have already been consolidated");
        return { baseChange: latestBaseChange, isNew: false };
      }
    } else {
      if (latestBaseChange.timestamp !== baseChange.timestamp) {
        logger.logWarning("Map changes for " + baseChangeRef.id + " have already been consolidated");
        return { baseChange: latestBaseChange, isNew: false };
      }
    }
  }

  // Update the base change
  const newBaseChange = {
    chs: consolidated,
    timestamp: timestampProvider(),
    incremental: false,
    user: uid,
    resync: resync
  };
  await view.set<Changes>(baseChangeRef, newBaseChange);

  // Delete all the others
  await Promise.all(incrementalChanges.map(c => view.delete(c)));
  return { baseChange: newBaseChange, isNew: true };
}

// If the `isNew` field of the return value is false, we've finished -- otherwise, there is more
// to be done.
async function tryConsolidateMapChanges(
  dataService: IDataService,
  logger: ILogger,
  timestampProvider: () => FirebaseFirestore.FieldValue | number,
  adventureId: string,
  mapId: string,
  m: IMap,
  resync: boolean,
  syncChanges?: (tokenDict: ITokenDictionary) => void
): Promise<IConsolidateMapChangesResult> {
  // Fetch all the current changes for this map, along with their refs.
  // It's important to use the same converter for the base and incremental changes so that any
  // legacy maps with the same kinds of context-dependent things needing converting in both get
  // rolled through properly.
  const converter = Convert.createChangesConverter();
  const baseChangeRef = await dataService.getMapBaseChangeRef(adventureId, mapId, converter);
  const baseChange = await dataService.get(baseChangeRef); // undefined in case of the first consolidate
  const incrementalChanges = await dataService.getMapIncrementalChangesRefs(adventureId, mapId, 499, converter);
  if (incrementalChanges === undefined || incrementalChanges.length === 0) {
    // No changes to consolidate
    return { baseChange: baseChange, isNew: false };
  }

  // Fetch the map owner's profile so I can figure out their user policy
  const ownerProfile = await dataService.get(dataService.getProfileRef(m.owner));
  if (ownerProfile === undefined) {
    throw new functions.https.HttpsError('invalid-argument', 'No profile found for map owner');
  }

  // Consolidate all of that.
  // #64: I'm no longer including a map colouring here.  It's a bit unsafe (a player could
  // technically cheat and non-owners would believe them), but it will save huge amounts of
  // CPU time (especially valuable if this is going to be called in a Firebase Function.)
  const ownerPolicy = getUserPolicy(ownerProfile.level);
  const tokenDict = new Tokens(getTokenGeometry(m.ty), new SimpleTokenDrawing());
  const outlineTokenDict = new Tokens(getTokenGeometry(m.ty), new SimpleTokenDrawing());
  const tracker = new SimpleChangeTracker(
    new FeatureDictionary<GridCoord, IFeature<GridCoord>>(coordString),
    new FeatureDictionary<GridCoord, PlayerArea>(coordString),
    tokenDict,
    outlineTokenDict,
    new FeatureDictionary<GridEdge, IFeature<GridEdge>>(edgeString),
    new FeatureDictionary<GridCoord, IAnnotation>(coordString),
    new IdDictionary<IMapImage>(),
    ownerPolicy
    // new MapColouring(m.ty === MapType.Hex ? new HexGridGeometry(1, 1) : new SquareGridGeometry(1, 1))
  );
  if (baseChange !== undefined) {
    trackChanges(m, tracker, baseChange.chs, baseChange.user);
  }

  // If any of the incremental changes fail we should mark this as a resync, because our
  // clients might be confused
  let isResync = resync;
  incrementalChanges.forEach(c => {
    const success = trackChanges(m, tracker, c.data.chs, c.data.user)
    if (success === false) {
      isResync = true;
    }
  });

  // Make any synchronous changes at this point
  syncChanges?.(tokenDict);
  const consolidated = tracker.getConsolidated();

  // Apply it
  return await dataService.runTransaction(view =>
    consolidateMapChangesTransaction(
      view, logger, timestampProvider, baseChange, baseChangeRef, incrementalChanges ?? [], consolidated, m.owner, isResync
    )
  );
}

export async function consolidateMapChanges(
  dataService: IDataService,
  logger: ILogger,
  timestampProvider: () => FirebaseFirestore.FieldValue,
  adventureId: string,
  mapId: string,
  m: IMap,
  resync: boolean,
  syncChanges?: (tokenDict: ITokenDictionary) => void
): Promise<Changes | undefined> {
  // Because we can consolidate at most 499 changes in one go due to the write limit,
  // we do this in a loop until we can't find any more:
  while (true) {
    const result = await tryConsolidateMapChanges(
      dataService, logger, timestampProvider, adventureId, mapId, m, resync, syncChanges
    );
    if (result.isNew === false) {
      return result.baseChange;
    }
  }
}

// Checks whether this invite is still in date; deletes super-out-of-date ones.
async function isValidInvite(
  dataService: IDataService,
  invite: IDataAndReference<IInvite>,
  policy: IInviteExpiryPolicy
): Promise<boolean> {
  if (typeof(invite.data.timestamp) === 'number') {
    return true;
  }

  const inviteDate = dayjs((invite.data.timestamp as FirebaseFirestore.Timestamp).toDate());
  const age = dayjs().diff(inviteDate, policy.timeUnit);
  if (age >= policy.deletion) {
    try {
      await dataService.delete(invite);
    } catch (e) {
      // It's going to be really hard to diagnose this one...
      functions.logger.error("Failed to delete expired invite " + invite.id, e);
    }
  }

  // We check for the recreate date not the actual expiry, checked by `joinAdventure`.
  // This is because we want to create new invites a bit before then to avoid expired
  // ones knocking around too much!
  return age <= policy.recreate;
}

// Either creates an invite record for an adventure and returns it, or returns
// the existing one if it's still valid.  Returns the invite ID.
export async function inviteToAdventure(
  dataService: IAdminDataService,
  timestampProvider: () => FirebaseFirestore.FieldValue,
  adventure: IAdventureSummary,
  policy: IInviteExpiryPolicy
): Promise<string | undefined> {
  // Fetch any current invite
  const latestInvite = await dataService.getLatestInviteRef(adventure.id);
  if (latestInvite !== undefined && (await isValidInvite(dataService, latestInvite, policy)) === true) {
    return latestInvite.id;
  }

  // If we couldn't, make a new one and return that
  const id = uuidv4();
  const inviteRef = dataService.getInviteRef(id);
  await dataService.set(inviteRef, {
    adventureId: adventure.id,
    adventureName: adventure.name,
    owner: adventure.owner,
    ownerName: adventure.ownerName,
    timestamp: timestampProvider()
  });

  return id;
}

async function joinAdventureTransaction(
  view: IDataView,
  adventureRef: IDataReference<IAdventure>,
  playerRef: IDataReference<IPlayer>,
  otherPlayers: IDataAndReference<IPlayer>[],
  profileRef: IDataReference<IProfile>,
  ownerProfileRef: IDataReference<IProfile>
): Promise<string> {
  const ownerProfile = await view.get(ownerProfileRef);
  if (ownerProfile === undefined) {
    throw new functions.https.HttpsError('not-found', 'No profile for the adventure owner');
  }

  // When counting joined players, blocked ones don't count.
  const ownerPolicy = getUserPolicy(ownerProfile.level);
  if (otherPlayers.filter(p => p.data.allowed !== false).length >= ownerPolicy.players) {
    throw new functions.https.HttpsError('permission-denied', 'This adventure already has the maximum number of players');
  }

  const adventure = await view.get(adventureRef);
  if (adventure === undefined) {
    throw new functions.https.HttpsError('not-found', 'No such adventure');
  }

  const profile = await view.get(profileRef);
  if (profile === undefined) {
    throw new functions.https.HttpsError('not-found', 'No profile for this user');
  }

  // Create or update the player record, and return that
  const player = await view.get(playerRef);
  if (player === undefined) {
    // remember this is an adventure summary plus player details
    const newPlayer: IPlayer = {
      ...summariseAdventure(adventureRef.id, adventure),
      playerId: playerRef.id,
      playerName: profile.name,
      allowed: true,
      characters: []
    };
    await view.set<IPlayer>(playerRef, newPlayer);
  } else {
    // Update that record in case there are changes
    if (
      player.name !== adventure.name ||
      player.description !== adventure.description ||
      player.ownerName !== adventure.ownerName ||
      player.imagePath !== adventure.imagePath ||
      player.playerName !== profile.name
    ) {
      player.name = adventure.name;
      player.description = adventure.description;
      player.ownerName = adventure.ownerName;
      player.imagePath = adventure.imagePath;
      player.playerName = profile.name;
      await view.update(playerRef, {
        name: adventure.name,
        description: adventure.description,
        ownerName: adventure.ownerName,
        imagePath: adventure.imagePath,
        playerName: profile.name
      });
    }
  }

  // Make this a recent adventure in the user's profile
  const adventures = updateProfileAdventures(profile.adventures, summariseAdventure(adventureRef.id, adventure));
  if (adventures !== undefined) {
    await view.update(profileRef, { adventures: adventures });
  }

  return adventureRef.id;
}

export async function joinAdventure(
  dataService: IDataService,
  uid: string,
  inviteId: string,
  policy: IInviteExpiryPolicy
): Promise<string> {
  const inviteRef = dataService.getInviteRef(inviteId);
  const profileRef = dataService.getProfileRef(uid);

  // We need to fetch and verify the invite so that we can get the adventure id
  const invite = await dataService.get(inviteRef);
  if (invite === undefined) {
    throw new functions.https.HttpsError('not-found', 'No such invite');
  }

  if (typeof(invite.timestamp) !== 'number') {
    const inviteDate = dayjs((invite.timestamp as FirebaseFirestore.Timestamp).toDate());
    const age = dayjs().diff(inviteDate, policy.timeUnit);
    if (age >= policy.expiry) {
      throw new functions.https.HttpsError('deadline-exceeded', 'Invite has expired');
    }
  }

  const adventureRef = dataService.getAdventureRef(invite.adventureId);
  const playerRef = dataService.getPlayerRef(invite.adventureId, uid);

  // Before going any further we need to fish up what players are currently
  // joined to that adventure, so that we can make the policy decision of
  // whether to allow another.
  // We can't do this in the transaction as it stands: I think it's okay
  // to have a small window for a race condition here for now.  In future I
  // can sync this with the adventures record or even merge the player list
  // into the adventures record entirely, instead.
  const otherPlayers = await dataService.getPlayerRefs(invite.adventureId);

  const adventure = await dataService.get(adventureRef);
  if (adventure === undefined) {
    throw new functions.https.HttpsError('not-found', 'No such adventure');
  }

  const ownerProfileRef = dataService.getProfileRef(adventure?.owner)
  return await dataService.runTransaction(tr => joinAdventureTransaction(
    tr, adventureRef, playerRef, otherPlayers, profileRef, ownerProfileRef
  ));
}