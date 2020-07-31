import { IAdventure, IMapSummary } from '../data/adventure';
import { IAdventureSummary, IProfile } from '../data/profile';
import { IDataService, IDataView, IDataReference } from './interfaces';
import { IMap } from '../data/map';

const maxProfileEntries = 6;

function updateProfileAdventures(adventures: IAdventureSummary[] | undefined, changed: IAdventureSummary): IAdventureSummary[] {
  var existingIndex = adventures?.findIndex(a => a.id === changed.id) ?? -1;
  if (adventures !== undefined && existingIndex >= 0) {
    var updated = [...adventures];
    updated[existingIndex].name = changed.name;
    updated[existingIndex].description = changed.description;
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
  isNew: boolean,
  changed: IAdventureSummary
): Promise<void> {
  // Fetch the profile, which we'll want to edit (maybe)
  var profile = await view.get(profileRef);

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
      maps: []
    });
  } else {
    await view.update(adventureRef, { name: changed.name, description: changed.description });
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
  var mapRefs: IDataReference<IMap>[] = [];
  if (isNew === false) {
    var adventure = rec ?? (await dataService.get(adventureRef));
    mapRefs = adventure?.maps.map(m => dataService.getMapRef(m.id)) ?? [];
  }

  await dataService.runTransaction(view =>
    editAdventureTransaction(view, dataService.getUid(), profileRef, adventureRef, mapRefs, isNew, changed)
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
  adventureId: string,
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
      adventureId: adventureId,
      adventureName: adventure.name,
      name: changed.name,
      description: changed.description,
      owner: uid,
      ty: changed.ty,
      areas: [],
      tokens: [],
      walls: []
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
  var mapRef = dataService.getMapRef(changed.id);

  await dataService.runTransaction(view =>
    editMapTransaction(view, dataService.getUid(), profileRef, adventureRef, mapRef, adventureId, isNew, changed)
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
  var mapRef = dataService.getMapRef(mapId);

  await dataService.runTransaction(view =>
    deleteMapTransaction(view, profileRef, adventureRef, mapRef, mapId)
  );
}

async function registerAdventureAsRecentTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  a: IAdventureSummary
) {
  var profile = await view.get(profileRef);
  if (profile === undefined) {
    return Promise.reject("No such profile");
  }

  var updated = updateProfileAdventures(profile.adventures, a);
  view.update(profileRef, { adventures: updated });
}

export async function registerAdventureAsRecent(
  dataService: IDataService | undefined,
  profile: IProfile | undefined,
  a: IAdventureSummary
) {
  if (dataService === undefined || profile === undefined) {
    return;
  }

  if (profile.adventures?.find(l => l.id === a.id) !== undefined) {
    return;
  }

  var profileRef = dataService.getProfileRef();
  await dataService.runTransaction(view => registerAdventureAsRecentTransaction(view, profileRef, a));
}

async function registerMapAsRecentTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  m: IMapSummary
) {
  var profile = await view.get(profileRef);
  if (profile === undefined) {
    return Promise.reject("No such profile");
  }

  var updated = updateProfileMaps(profile.latestMaps, m);
  view.update(profileRef, { latestMaps: updated });
}

export async function registerMapAsRecent(dataService: IDataService | undefined, profile: IProfile | undefined, m: IMapSummary): Promise<void> {
  if (dataService === undefined || profile === undefined) {
    return;
  }

  if (profile.latestMaps?.find(l => l.id === m.id) !== undefined) {
    return;
  }

  var profileRef = dataService.getProfileRef();
  await dataService.runTransaction(view => registerMapAsRecentTransaction(view, profileRef, m));
}