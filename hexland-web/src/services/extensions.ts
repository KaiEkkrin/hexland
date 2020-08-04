import { IAdventure, IMapSummary, IPlayer } from '../data/adventure';
import { IChange, IChanges } from '../data/change';
import { SimpleChangeTracker, trackChanges } from '../data/changeTracking';
import { IMap } from '../data/map';
import { IAdventureSummary, IProfile } from '../data/profile';
import { IDataService, IDataView, IDataReference, IDataAndReference } from './interfaces';
import { timestampProvider } from '../firebase';

const maxProfileEntries = 7;

function updateProfileAdventures(adventures: IAdventureSummary[] | undefined, changed: IAdventureSummary): IAdventureSummary[] {
  var existingIndex = adventures?.findIndex(a => a.id === changed.id) ?? -1;
  if (adventures !== undefined && existingIndex >= 0) {
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
  ownerPlayerRef: IDataReference<IPlayer>,
  mapRefs: IDataReference<IMap>[],
  isNew: boolean,
  changed: IAdventureSummary
): Promise<void> {
  // Fetch the profile, which we'll want to edit (maybe)
  var profile = await view.get(profileRef);

  // ...and the existing player record for the owner (if any)
  var existingOwnerPlayer = await view.get(ownerPlayerRef);

  // Update the profile to include this adventure if it didn't already, or
  // alter any existing entry, and fix any map entries too
  if (profile !== undefined) {
    var updated = updateProfileAdventures(profile.adventures, changed);
    await view.update(profileRef, { adventures: updated });
  }

  // Update the adventure record itself
  if (isNew) {
    await view.set(adventureRef, {
      name: changed.name,
      description: changed.description,
      owner: uid,
      ownerName: changed.ownerName,
      maps: []
    });
  } else {
    await view.update(adventureRef, {
      name: changed.name,
      description: changed.description,
      ownerName: changed.ownerName
    });
  }

  // Set the owner's player record if it doesn't already exist
  if (existingOwnerPlayer === undefined) {
    await view.set(ownerPlayerRef, { name: changed.ownerName });
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
  var profileRef = dataService.getProfileRef();
  var adventureRef = dataService.getAdventureRef(changed.id);
  var ownerPlayerRef = dataService.getPlayerRef(changed.id, changed.owner);
  var mapRefs: IDataReference<IMap>[] = [];
  if (isNew === false) {
    var adventure = rec ?? (await dataService.get(adventureRef));
    mapRefs = adventure?.maps.map(m => dataService.getMapRef(changed.id, m.id)) ?? [];
  }

  await dataService.runTransaction(view =>
    editAdventureTransaction(
      view,
      dataService.getUid(),
      profileRef,
      adventureRef,
      ownerPlayerRef,
      mapRefs,
      isNew,
      changed
    )
  );
}

function updateProfileMaps(maps: IMapSummary[] | undefined, changed: IMapSummary): IMapSummary[] {
  var existingIndex = maps?.findIndex(m => m.id === changed.id) ?? -1;
  if (maps !== undefined && existingIndex >= 0) {
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
  uid: string,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  mapRef: IDataReference<IMap>,
  isNew: boolean,
  changed: IMapSummary
): Promise<void> {
  // Fetch the profile, which we'll want to edit (maybe)
  var profile = await view.get(profileRef);

  // Fetch the adventure, which we'll certainly want to edit
  var adventure = await view.get(adventureRef);
  if (adventure === undefined) {
    return Promise.reject("Adventure not found");
  }

  // Update the profile to include this map if it didn't already, or
  // alter any existing entry
  if (profile !== undefined) {
    var latestMaps = updateProfileMaps(profile.latestMaps, changed);
    await view.update(profileRef, { latestMaps: latestMaps });
  }

  // Update the adventure record to include this map
  var allMaps = updateAdventureMaps(adventure.maps, changed);
  await view.update(adventureRef, { maps: allMaps });

  // Update the map record itself
  if (isNew) {
    await view.set(mapRef, {
      adventureName: adventure.name,
      name: changed.name,
      description: changed.description,
      ty: changed.ty,
    } as IMap);
  } else {
    await view.update(mapRef, { name: changed.name, description: changed.description });
  }
}

export async function editMap(
  dataService: IDataService | undefined,
  adventureId: string,
  isNew: boolean,
  changed: IMapSummary
): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  var profileRef = dataService.getProfileRef();
  var adventureRef = dataService.getAdventureRef(adventureId);
  var mapRef = dataService.getMapRef(adventureId, changed.id);

  await dataService.runTransaction(view =>
    editMapTransaction(view, dataService.getUid(), profileRef, adventureRef, mapRef, isNew, changed)
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
    return Promise.reject("Adventure not found");
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
    return Promise.reject("No such profile");
  }

  var updated = updateProfileAdventures(profile.adventures, {
    id: id,
    name: a.name,
    description: a.description,
    owner: a.owner,
    ownerName: profile.name
  });
  view.update(profileRef, { adventures: updated });
}

export async function registerAdventureAsRecent(
  dataService: IDataService | undefined,
  profile: IProfile | undefined,
  id: string,
  a: IAdventure
) {
  if (dataService === undefined || profile === undefined) {
    return;
  }

  if (profile.adventures?.find(l => l.id === id) !== undefined) {
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
    return Promise.reject("No such profile");
  }

  var updated = updateProfileMaps(profile.latestMaps, {
    adventureId: adventureId,
    id: id,
    name: m.name,
    description: m.description,
    ty: m.ty
  });
  view.update(profileRef, { latestMaps: updated });
}

export async function registerMapAsRecent(
  dataService: IDataService | undefined,
  profile: IProfile | undefined,
  adventureId: string,
  id: string,
  m: IMap
): Promise<void> {
  if (dataService === undefined || profile === undefined) {
    return;
  }

  if (profile.latestMaps?.find(l => l.id === id) !== undefined) {
    return;
  }

  var profileRef = dataService.getProfileRef();
  await dataService.runTransaction(view =>
    registerMapAsRecentTransaction(view, profileRef, adventureId, id, m)
  );
}

async function consolidateMapChangesTransaction(
  view: IDataView,
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
    if (!latestBaseChange.timestamp.isEqual(baseChange.timestamp)) {
      return Promise.reject("Map changes have already been consolidated");
    }
  }

  // Update the base change
  await view.set(baseChangeRef, {
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
  adventureId: string,
  mapId: string,
  m: IMap
): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  // Fetch all the current changes for this map, along with their refs
  var baseChangeRef = await dataService.getMapBaseChangeRef(adventureId, mapId);
  var changes = await dataService.getMapChangesRefs(adventureId, mapId);
  if (changes === undefined) {
    return;
  }

  // Consolidate all of that
  var tracker = new SimpleChangeTracker();
  changes.forEach(c => trackChanges(tracker, c.data.chs));
  var consolidated = tracker.getConsolidated();

  // Apply it
  await dataService.runTransaction(view =>
    consolidateMapChangesTransaction(view, baseChangeRef, changes ?? [], consolidated, dataService.getUid())
  );
}