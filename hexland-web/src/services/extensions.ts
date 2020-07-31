import { IAdventure, IMapSummary } from '../data/adventure';
import { IAdventureSummary, IProfile } from '../data/profile';
import { IDataService, IDataView, IDataReference } from './interfaces';
import { IMap } from '../data/map';

const maxProfileEntries = 6;

function updateProfileAdventures(adventures: IAdventureSummary[] | undefined, changed: IAdventureSummary): IAdventureSummary[] {
  var existingIndex = adventures?.findIndex(a => a.id === changed.id);
  if (adventures !== undefined && existingIndex !== undefined && existingIndex >= 0) {
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
  // alter any existing entry
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
  var adventure = rec ?? (await dataService.get(adventureRef));
  var mapRefs = adventure?.maps.map(m => dataService.getMapRef(m.id)) ?? [];

  await dataService.runTransaction(view =>
    editAdventureTransaction(view, dataService.getUid(), profileRef, adventureRef, mapRefs, isNew, changed)
  );
}

export async function propagateMapDelete(dataService: IDataService | undefined, profile: IProfile | undefined, id: string): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  // TODO Delete the map record itself too.
  // (Replace this with a transaction, as above!)

  // Update the profile:
  if (profile?.latestMaps === undefined) {
    return;
  }

  var index = profile.latestMaps.findIndex(m => m.id === id);
  if (index < 0) {
    return;
  }

  profile.latestMaps = profile.latestMaps.filter(m => m.id !== id);
  return await dataService.setProfile(profile);
}

export async function propagateMapEdit(
  dataService: IDataService | undefined,
  profile: IProfile | undefined,
  a: IAdventureSummary,
  m: IMapSummary
): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  // Echo the changes into the map record itself here.
  // (TODO Do it as a transaction!)
  await updateMapFromSummary(dataService, a, m);

  // Update the profile to include this as a latest map:
  await registerMapAsRecent(dataService, profile, m);
}

export async function registerMapAsRecent(dataService: IDataService | undefined, profile: IProfile | undefined, m: IMapSummary): Promise<void> {
  if (dataService === undefined || profile === undefined) {
    return;
  }

  var already = profile.latestMaps?.find(r => r.id === m.id);
  if (already !== undefined) {
    if (already.id === m.id && already.name === m.name && already.description === m.description) {
      return;
    }

    already.id = m.id;
    already.name = m.name;
    already.description = m.description;
  } else {
    var newMaps = [{
      id: m.id,
      name: m.name,
      description: m.description
    } as IMapSummary];
    if (profile.latestMaps !== undefined) {
      newMaps.push(...profile.latestMaps.slice(0, maxProfileEntries - 1));
    }

    profile.latestMaps = newMaps;
  }

  return await dataService.setProfile(profile);
}

async function updateMapFromSummary(
  dataService: IDataService,
  a: IAdventureSummary,
  m: IMapSummary
): Promise<void> {
  var record = await dataService.getMap(m.id);
  if (record !== undefined) {
    if (record.name === m.name && record.description === m.description && record.ty === m.ty) {
      return;
    }

    record.name = m.name;
    record.description = m.description;
    record.ty = m.ty;
  } else {
    record = {
      adventureId: a.id,
      adventureName: a.name,
      name: m.name,
      description: m.description,
      owner: dataService.getUid(),
      ty: m.ty,
      areas: [],
      tokens: [],
      walls: []
    } as IMap;
  }

  await dataService.setMap(m.id, record);
}