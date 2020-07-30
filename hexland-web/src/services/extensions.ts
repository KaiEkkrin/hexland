import { IMapSummary } from '../data/adventure';
import { IAdventureSummary, IProfile } from '../data/profile';
import { IDataService } from './interfaces';
import { IMap } from '../data/map';

const maxProfileEntries = 6;

export async function propagateAdventureEdit(dataService: IDataService | undefined, profile: IProfile | undefined, a: IAdventureSummary): Promise<void> {
  if (dataService === undefined || profile === undefined) {
    return;
  }

  // Here we update the profile to include that adventure as one of the recent ones:
  var already = profile.adventures?.find(r => r.id === a.id);
  if (already !== undefined) {
    if (already.id === a.id && already.name === a.name && already.description === a.description) {
      return;
    }

    already.id = a.id;
    already.name = a.name;
    already.description = a.description;
  } else {
    var newAdventures = [{
      id: a.id,
      name: a.name,
      description: a.description,
      owner: a.owner
    } as IAdventureSummary];
    if (profile.adventures !== undefined) {
      newAdventures.push(...profile.adventures.slice(0, maxProfileEntries - 1));
    }

    profile.adventures = newAdventures;
  }

  return await dataService.setProfile(profile);
}

export async function propagateMapDelete(dataService: IDataService | undefined, profile: IProfile | undefined, id: string): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  // TODO Delete the map record itself too.

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

export async function propagateMapEdit(dataService: IDataService | undefined, profile: IProfile | undefined, m: IMapSummary): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  // Echo the changes into the map record itself here.
  // (TODO Do it as a transaction!)
  await updateMapFromSummary(dataService, m);

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

async function updateMapFromSummary(dataService: IDataService, m: IMapSummary): Promise<void> {
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