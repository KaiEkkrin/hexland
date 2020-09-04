import { IAdventure, IMapSummary, IPlayer } from '../data/adventure';
import { IAnnotation } from '../data/annotation';
import { IChange, IChanges } from '../data/change';
import { trackChanges } from '../data/changeTracking';
import { FeatureDictionary, IToken, IFeature } from '../data/feature';
import { IMap, MapType } from '../data/map';
import { IAdventureSummary, IProfile } from '../data/profile';
import { IDataService, IDataView, IDataReference, IDataAndReference, IUser } from './interfaces';

import { MapChangeTracker } from '../models/mapChangeTracker';
import { IGridCoord, IGridEdge, coordString, edgeString } from '../data/coord';
import { MapColouring } from '../models/colouring';
import { HexGridGeometry } from '../models/hexGridGeometry';
import { SquareGridGeometry } from '../models/squareGridGeometry';

import * as firebase from 'firebase/app';

import { v4 as uuidv4 } from 'uuid';

const maxProfileEntries = 7;

export async function ensureProfile(dataService: IDataService | undefined, user: IUser | undefined): Promise<IProfile | undefined> {
  if (dataService === undefined || user === undefined) {
    return undefined;
  }

  const profileRef = dataService.getProfileRef();
  return await dataService.runTransaction(async view => {
    var profile = await view.get(profileRef);
    if (profile !== undefined) {
      return profile;
    }

    // If we get here, we need to create a new profile
    // TODO maybe on first login, always display a "new user" screen and
    // let them customise?
    profile = {
      name: user.displayName ?? "Unknown user",
      adventures: [],
      latestMaps: []
    };

    await view.set(profileRef, profile);
    return profile;
  });
}

function updateProfileAdventures(adventures: IAdventureSummary[] | undefined, changed: IAdventureSummary): IAdventureSummary[] | undefined {
  var existingIndex = adventures?.findIndex(a => a.id === changed.id) ?? -1;
  if (adventures !== undefined && existingIndex >= 0) {
    var existing = adventures[existingIndex];
    if (existing.name === changed.name && existing.description === changed.description &&
      existing.ownerName === changed.ownerName) {
      // No change to make
      return undefined;
    }

    var updated = [...adventures];
    updated[existingIndex].name = changed.name;
    updated[existingIndex].description = changed.description;
    updated[existingIndex].ownerName = changed.ownerName;
    return updated;
  } else {
    var created = [changed];
    if (adventures !== undefined) {
      created.push(...adventures.slice(0, maxProfileEntries - 1));
    }

    return created;
  }
}

async function editAdventureTransaction(
  view: IDataView,
  uid: string,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  mapRefs: IDataReference<IMap>[],
  playerRefs: IDataAndReference<IPlayer>[],
  newPlayerRef: IDataReference<IPlayer> | undefined,
  changed: IAdventureSummary
): Promise<void> {
  // Fetch the profile, which we'll want to edit (maybe)
  var profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No profile available");
  }

  // Update the adventure record itself, and the players associated with it
  if (newPlayerRef !== undefined) { // it's new
    await view.set<IAdventure>(adventureRef, {
      name: changed.name,
      description: changed.description,
      owner: uid,
      ownerName: changed.ownerName,
      maps: []
    });

    await view.set<IPlayer>(newPlayerRef, {
      id: changed.id,
      name: changed.name,
      description: changed.description,
      owner: changed.owner,
      ownerName: changed.ownerName,
      playerId: uid,
      playerName: profile.name
    });
  } else {
    var players = await Promise.all(playerRefs.map(r => view.get(r)));
    await Promise.all(players.map(async (p, i) => {
      if (p === undefined || profile === undefined) {
        return;
      }

      if (changed.name !== p.name || changed.description !== p.description || changed.ownerName !== p.ownerName) {
        await view.update(playerRefs[i], {
          name: changed.name,
          description: changed.description,
          ownerName: changed.ownerName,
        });
      }
    }));

    await view.update(adventureRef, {
      name: changed.name,
      description: changed.description,
      ownerName: changed.ownerName
    });
  }

  // Update the profile to include this adventure if it didn't already, or
  // alter any existing entry, and fix any map entries too
  // I can't update other players' profiles, but they should get the update
  // when they next click the adventure, it's best effort :)
  var updated = updateProfileAdventures(profile.adventures, changed);
  if (updated !== undefined) {
    await view.update(profileRef, { adventures: updated });
  }

  // Update any maps associated with it
  await Promise.all(mapRefs.map(m => view.update(m, { adventureName: changed.name })));
}

export async function editAdventure(
  dataService: IDataService | undefined,
  isNew: boolean,
  changed: IAdventureSummary,
  rec?: IAdventure | undefined
): Promise<void> {
  if (dataService === undefined) {
    return;
  }
  
  // Get the references to all the relevant stuff.
  // There's a chance this could be slightly out of sync, but it's low, so I'll
  // go with it.
  var uid = dataService.getUid();
  var profileRef = dataService.getProfileRef();
  var adventureRef = dataService.getAdventureRef(changed.id);
  var mapRefs: IDataReference<IMap>[] = [];
  var playerRefs: IDataAndReference<IPlayer>[] = [];
  var newPlayerRef: IDataReference<IPlayer> | undefined = undefined;
  if (isNew === false) {
    var adventure = rec ?? (await dataService.get(adventureRef));
    mapRefs = adventure?.maps.map(m => dataService.getMapRef(changed.id, m.id)) ?? [];
    playerRefs = await dataService.getPlayerRefs(changed.id);
    newPlayerRef = undefined;
  } else {
    newPlayerRef = dataService.getPlayerRef(changed.id, uid);
  }

  await dataService.runTransaction(view =>
    editAdventureTransaction(
      view,
      uid,
      profileRef,
      adventureRef,
      mapRefs,
      playerRefs,
      newPlayerRef,
      changed
    )
  );
}

async function deleteAdventureTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  playerRefs: IDataAndReference<IPlayer>[]
) {
  // Fetch the profile, which we'll want to edit (maybe)
  var profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No profile available");
  }

  // Fetch the adventure, so I can complain if it still had maps
  var adventure = await view.get(adventureRef);
  if (adventure !== undefined && adventure.maps.length > 0) {
    throw Error("An adventure with maps cannot be deleted");
  }

  // Remove that adventure from the profile, if it's there
  if (profile.adventures !== undefined && profile.adventures.find(a => a.id === adventureRef.id) !== undefined) {
    await view.update(profileRef, {
      adventures: profile.adventures.filter(a => a.id !== adventureRef.id)
    });
  }

  // Remove the adventure record itself and any player records
  await Promise.all(playerRefs.map(p => view.delete(p)));
  await view.delete(adventureRef);
}

export async function deleteAdventure(dataService: IDataService | undefined, adventureId: string) {
  if (dataService === undefined) {
    return;
  }

  const profileRef = dataService.getProfileRef();
  const adventureRef = dataService.getAdventureRef(adventureId);
  const playerRefs = await dataService.getPlayerRefs(adventureId);
  await dataService.runTransaction(view =>
    deleteAdventureTransaction(view, profileRef, adventureRef, playerRefs));
}

function updateProfileMaps(maps: IMapSummary[] | undefined, changed: IMapSummary): IMapSummary[] | undefined {
  var existingIndex = maps?.findIndex(m => m.id === changed.id) ?? -1;
  if (maps !== undefined && existingIndex >= 0) {
    if (
      changed.name === maps[existingIndex].name &&
      changed.description === maps[existingIndex].description
    ) {
      // No change to make
      return undefined;
    }

    var updated = [...maps];
    updated[existingIndex].name = changed.name;
    updated[existingIndex].description = changed.description;
    return updated;
  } else {
    var created = [changed];
    if (maps !== undefined) {
      created.push(...maps.slice(0, maxProfileEntries - 1));
    }

    return created;
  }
}

function updateAdventureMaps(maps: IMapSummary[], changed: IMapSummary): IMapSummary[] {
  var existingIndex = maps?.findIndex(m => m.id === changed.id) ?? -1;
  var updated = [...maps];
  if (existingIndex >= 0) {
    updated[existingIndex].name = changed.name;
    updated[existingIndex].description = changed.description;
  } else {
    updated.push(changed);
    updated.sort((a, b) => a.name.localeCompare(b.name));
  }

  return updated;
}

async function editMapTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  mapRef: IDataReference<IMap>,
  changed: IMap
): Promise<void> {
  // Fetch the profile, which we'll want to edit (maybe)
  var profile = await view.get(profileRef);

  // Fetch the adventure, which we'll certainly want to edit
  var adventure = await view.get(adventureRef);
  if (adventure === undefined) {
    throw Error("Adventure not found");
  }

  // Fetch the map as well, mostly so I can check if it exists :)
  var existingMap = await view.get(mapRef);

  // Don't trust the adventure name in the changed record, update it ourselves
  changed.adventureName = adventure.name;

  // Create the new map summary, for the benefit of other records
  const summary = {
    adventureId: adventureRef.id,
    id: mapRef.id,
    name: changed.name,
    description: changed.description,
    ty: changed.ty
  };

  // Update the profile to include this map if it didn't already, or
  // alter any existing entry
  if (profile !== undefined) {
    var latestMaps = updateProfileMaps(profile.latestMaps, summary);
    if (latestMaps !== undefined) {
      await view.update(profileRef, { latestMaps: latestMaps });
    }
  }

  // Update the adventure record to include this map
  var allMaps = updateAdventureMaps(adventure.maps, summary);
  await view.update(adventureRef, { maps: allMaps });

  // Update the map record itself
  if (existingMap === undefined) {
    await view.set<IMap>(mapRef, changed);
  } else {
    // We can only update some fields after the fact
    await view.update(mapRef, {
      adventureName: changed.adventureName,
      name: changed.name,
      description: changed.description,
      ffa: changed.ffa
    });
  }
}

export async function editMap(
  dataService: IDataService | undefined,
  adventureId: string,
  mapId: string,
  changed: IMap
): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  var profileRef = dataService.getProfileRef();
  var adventureRef = dataService.getAdventureRef(adventureId);
  var mapRef = dataService.getMapRef(adventureId, mapId);

  await dataService.runTransaction(view =>
    editMapTransaction(view, profileRef, adventureRef, mapRef, changed)
  );
}

async function deleteMapTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  mapRef: IDataReference<IMap>,
  mapId: string
): Promise<void> {
  // Fetch the profile, which we'll want to edit (maybe)
  var profile = await view.get(profileRef);

  // Fetch the adventure, which we'll certainly want to edit
  var adventure = await view.get(adventureRef);
  if (adventure === undefined) {
    throw Error("Adventure not found");
  }

  // Update the profile to omit this map
  if (profile?.latestMaps?.find(m => m.id === mapId) !== undefined) {
    var latestMaps = profile.latestMaps.filter(m => m.id !== mapId);
    await view.update(profileRef, { latestMaps: latestMaps });
  }

  // Update the adventure record to omit this map
  var allMaps = adventure.maps.filter(m => m.id !== mapId);
  await view.update(adventureRef, { maps: allMaps });

  // TODO: We also need to remove the sub-collection of changes.
  // Maybe, write a Function to do this deletion instead?
  // https://firebase.google.com/docs/firestore/manage-data/delete-data

  // Remove the map record itself
  await view.delete(mapRef);
}

export async function deleteMap(
  dataService: IDataService | undefined,
  adventureId: string,
  mapId: string
): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  var profileRef = dataService.getProfileRef();
  var adventureRef = dataService.getAdventureRef(adventureId);
  var mapRef = dataService.getMapRef(adventureId, mapId);

  await dataService.runTransaction(view =>
    deleteMapTransaction(view, profileRef, adventureRef, mapRef, mapId)
  );
}

async function registerAdventureAsRecentTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  id: string,
  a: IAdventure
) {
  var profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No such profile");
  }

  var updated = updateProfileAdventures(profile.adventures, {
    id: id,
    name: a.name,
    description: a.description,
    owner: a.owner,
    ownerName: a.ownerName
  });
  if (updated !== undefined) {
    console.log("updating adventure in profile");
    view.update(profileRef, { adventures: updated });
  }
}

export async function registerAdventureAsRecent(
  dataService: IDataService | undefined,
  id: string,
  a: IAdventure
) {
  if (dataService === undefined) {
    return;
  }

  var profileRef = dataService.getProfileRef();
  await dataService.runTransaction(
    view => registerAdventureAsRecentTransaction(view, profileRef, id, a)
  );
}

async function registerMapAsRecentTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  adventureId: string,
  id: string,
  m: IMap
) {
  var profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No such profile");
  }

  var updated = updateProfileMaps(profile.latestMaps, {
    adventureId: adventureId,
    id: id,
    name: m.name,
    description: m.description,
    ty: m.ty
  });
  if (updated !== undefined) {
    view.update(profileRef, { latestMaps: updated });
  }
}

export async function registerMapAsRecent(
  dataService: IDataService | undefined,
  adventureId: string,
  id: string,
  m: IMap
): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  var profileRef = dataService.getProfileRef();
  await dataService.runTransaction(view =>
    registerMapAsRecentTransaction(view, profileRef, adventureId, id, m)
  );
}

async function consolidateMapChangesTransaction(
  view: IDataView,
  timestampProvider: () => firebase.firestore.FieldValue | number,
  baseChangeRef: IDataReference<IChanges>,
  changes: IDataAndReference<IChanges>[],
  consolidated: IChange[],
  uid: string
) {
  // Check that the base change hasn't changed since we did the query.
  // If it has, we'll simply abort -- someone else has done this recently
  var baseChanges = changes.filter(c => c.data.incremental === false);
  var baseChange = baseChanges.length > 0 ? baseChanges[0].data : undefined;

  var latestBaseChange = await view.get(baseChangeRef);
  if (baseChange !== undefined && latestBaseChange !== undefined) {
    if (
      typeof(latestBaseChange.timestamp) !== 'number' ||
      typeof(baseChange.timestamp) !== 'number'
    ) {
      // This should be fine, because they shouldn't be mixed within one application;
      // real application always uses the firestore field value, tests always use number
      const latestTimestamp = latestBaseChange.timestamp as firebase.firestore.FieldValue;
      const baseTimestamp = baseChange.timestamp as firebase.firestore.FieldValue;
      if (!latestTimestamp.isEqual(baseTimestamp)) {
        throw Error("Map changes have already been consolidated");
      }
    } else {
      if (latestBaseChange.timestamp !== baseChange.timestamp) {
        throw Error("Map changes have already been consolidated");
      }
    }
  }

  // Update the base change
  await view.set<IChanges>(baseChangeRef, {
    chs: consolidated,
    timestamp: timestampProvider(),
    incremental: false,
    user: uid
  });

  // Delete all the others
  await Promise.all(
    changes.filter(c => c.data.incremental === true).map(c => view.delete(c))
  );
}

// TODO So that things are consolidated more regularly, pick a suitable
// count and run this as a Firebase Function when that many changes are
// added to the map?
// Doing lots of deletes from a Web client is not recommended:
// https://firebase.google.com/docs/firestore/manage-data/delete-data
export async function consolidateMapChanges(
  dataService: IDataService | undefined,
  timestampProvider: (() => firebase.firestore.FieldValue | number) | undefined,
  adventureId: string,
  mapId: string,
  m: IMap
): Promise<void> {
  if (dataService === undefined || timestampProvider === undefined) {
    return;
  }

  // Don't try to consolidate if we're not the map owner
  if (dataService.getUid() !== m.owner) {
    return;
  }

  // Fetch all the current changes for this map, along with their refs
  var baseChangeRef = await dataService.getMapBaseChangeRef(adventureId, mapId);
  var changes = await dataService.getMapChangesRefs(adventureId, mapId);
  if (changes === undefined) {
    return;
  }

  // Consolidate all of that
  var tracker = new MapChangeTracker(
    new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),
    new FeatureDictionary<IGridCoord, IToken>(coordString),
    new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString),
    new FeatureDictionary<IGridCoord, IAnnotation>(coordString),
    // TODO I know the geometry parameters don't matter in this specific case right now
    // but really, they should be stored in the Map record
    new MapColouring(m.ty === MapType.Hex ? new HexGridGeometry(1, 1) : new SquareGridGeometry(1, 1))
  );
  changes.forEach(c => trackChanges(m, tracker, c.data.chs, c.data.user));
  var consolidated = tracker.getConsolidated();

  // Apply it
  await dataService.runTransaction(view =>
    consolidateMapChangesTransaction(view, timestampProvider, baseChangeRef, changes ?? [], consolidated, dataService.getUid())
  );
}

// Either creates an invite record for an adventure and returns it, or returns
// the existing one if it's still valid.  Returns the invite ID.
export async function inviteToAdventure(
  dataService: IDataService | undefined,
  timestampProvider: (() => firebase.firestore.FieldValue | number) | undefined,
  adventure: IAdventureSummary
): Promise<string | undefined> {
  if (dataService === undefined || timestampProvider === undefined) {
    return undefined;
  }

  // Fetch any current invite
  var latestInvite = await dataService.getLatestInviteRef(adventure.id);
  if (latestInvite !== undefined) {
    return latestInvite.id;
  }

  // If we couldn't, make a new one and return that
  var id = uuidv4();
  var inviteRef = dataService.getInviteRef(adventure.id, id);
  await dataService.set(inviteRef, {
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
  name: string
): Promise<void> {
  var adventure = await view.get(adventureRef);
  if (adventure === undefined) {
    throw Error("No such adventure");
  }

  var player = await view.get(playerRef);
  if (player === undefined) {
    await view.set<IPlayer>(playerRef, { // remember this is an adventure summary plus player details
      id: adventureRef.id,
      name: adventure.name,
      description: adventure.description,
      owner: adventure.owner,
      ownerName: adventure.ownerName,
      playerId: playerRef.id,
      playerName: name
    });
  } else {
    // Update that record in case there are changes
    if (player.name !== adventure.name || player.description !== adventure.description ||
      player.ownerName !== adventure.ownerName || player.playerName !== name) {
      await view.update(playerRef, {
        name: adventure.name,
        description: adventure.description,
        ownerName: adventure.ownerName,
        playerName: name
      });
    }
  }
}

export async function joinAdventure(
  dataService: IDataService | undefined,
  profile: IProfile | undefined,
  adventureId: string
): Promise<void> {
  // TODO Verify that this is a valid invite before allowing join.
  // (Really a rules thing for the most part.)
  if (dataService === undefined || profile === undefined) {
    return undefined;
  }

  var adventureRef = dataService.getAdventureRef(adventureId);
  var playerRef = dataService.getPlayerRef(adventureId, dataService.getUid());
  await dataService.runTransaction(tr => joinAdventureTransaction(tr, adventureRef, playerRef, profile.name));
}

async function leaveAdventureTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  playerRef: IDataReference<IPlayer>
) {
  // Fetch the profile and adventure
  const profile = await view.get(profileRef);
  if (profile === undefined) {
    return undefined;
  }

  const adventure = await view.get(adventureRef);
  if (adventure?.owner === profileRef.id) {
    throw Error("Cannot leave your own adventure");
  }

  // Filter that adventure and any of its maps out of our profile
  if (
    profile.adventures?.find(a => a.id === adventureRef.id) !== undefined ||
    profile.latestMaps?.find(m => m.adventureId === adventureRef.id) !== undefined
  ) {
    await view.update(profileRef, {
      adventures: profile.adventures?.filter(a => a.id !== adventureRef.id),
      latestMaps: profile.latestMaps?.filter(m => m.adventureId !== adventureRef.id)
    });
  }

  // Delete the player record
  await view.delete(playerRef);
}

export async function leaveAdventure(
  dataService: IDataService | undefined,
  profile: IProfile | undefined,
  adventureId: string
) {
  if (dataService === undefined || profile === undefined) {
    return undefined;
  }

  var profileRef = dataService.getProfileRef();
  var adventureRef = dataService.getAdventureRef(adventureId);
  var playerRef = dataService.getPlayerRef(adventureId, dataService.getUid());
  await dataService.runTransaction(tr => leaveAdventureTransaction(tr, profileRef, adventureRef, playerRef));
}