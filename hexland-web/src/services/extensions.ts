import { IAdventure, IPlayer } from '../data/adventure';
import { IChanges } from '../data/change';
import { IMap, summariseMap } from '../data/map';
import { UserLevel } from '../data/policy';
import { IAdventureSummary, IProfile } from '../data/profile';
import * as Convert from './converter';
import { updateProfileAdventures, updateAdventureMaps, updateProfileMaps } from './helpers';
import { IDataService, IDataView, IDataReference, IDataAndReference, IUser, IAnalytics, IFunctionsService } from './interfaces';

import { interval, Subject } from 'rxjs';
import { throttle } from 'rxjs/operators';

export async function ensureProfile(
  dataService: IDataService | undefined,
  user: IUser | undefined,
  analytics: IAnalytics | undefined,
  displayName?: string | undefined
): Promise<IProfile | undefined> {
  if (dataService === undefined || user === undefined) {
    return undefined;
  }

  const profileRef = dataService.getProfileRef(user.uid);
  return await dataService.runTransaction(async view => {
    let profile = await view.get(profileRef);
    if (profile !== undefined) {
      analytics?.logEvent("login", { "method": user.providerId });

      // Keep the user's email in sync if required
      if (profile.email !== user.email && user.email !== null) {
        await view.update(profileRef, { email: user.email });
        profile.email = user.email;
      }

      return profile;
    }

    // If we get here, we need to create a new profile
    profile = {
      name: displayName ?? user.displayName ?? "Unnamed user",
      email: user.email ?? "",
      level: UserLevel.Standard,
      adventures: [],
      latestMaps: []
    };

    analytics?.logEvent("sign_up", { "method": user.providerId });
    await view.set(profileRef, profile);
    return profile;
  });
}

async function updateProfileTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  myAdventures: IDataAndReference<IAdventure>[],
  myPlayerRecords: IDataAndReference<IPlayer>[],
  name: string
) {
  const profile = await view.get(profileRef);
  if (profile === undefined) {
    return;
  }

  if (profile.name === name) {
    // TODO Still need to commit any other changes, but we can skip the big edits
    return;
  }

  // Update my profile so that it has the new name (of course!) and so that my
  // adventures in the profile are changed
  await view.update(profileRef, {
    name: name,
    adventures: profile.adventures?.map(a => {
      if (a.owner !== profileRef.id) {
        return a;
      }

      return { ...a, ownerName: name };
    }),
  });

  // Update all my adventures so they have the new owner name
  await Promise.all(myAdventures.map(async a => {
    await view.update(a, { ownerName: name });
  }));

  // Update all my player records so they have the new player name
  await Promise.all(myPlayerRecords.map(async p => {
    await view.update(p, { playerName: name });
  }));
}

export async function updateProfile(dataService: IDataService | undefined, uid: string | undefined, name: string): Promise<void> {
  if (dataService === undefined || uid === undefined) {
    return;
  }

  // When the user's display name changes we should reflect that
  // change across their adventures, maps, player records, and of course their own profile.
  // (Of course it's possible this could race with the same player creating a new record.
  // I think that's not really something to worry about, though :> )
  // I'm deliberately not going to go around editing any outstanding invites.  It would
  // be annoying (they're supposed to be transient things anyway and should expire) and
  // it would require an extra security rule to allow arbitrarily listing them, which
  // defeats the point of being invited requiring the identifier.
  const profileRef = dataService.getProfileRef(uid);
  const myAdventures = await dataService.getMyAdventures(uid);
  const myPlayerRecords = await dataService.getMyPlayerRecords(uid);
  await dataService.runTransaction(view => updateProfileTransaction(
    view, profileRef, myAdventures, myPlayerRecords, name
  ));
}

async function editAdventureTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  mapRefs: IDataReference<IMap>[],
  playerRefs: IDataAndReference<IPlayer>[],
  changed: IAdventureSummary
): Promise<void> {
  // Fetch the profile, which we'll want to edit (maybe)
  let profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No profile available");
  }

  let players = await Promise.all(playerRefs.map(r => view.get(r)));
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

  // Update the profile to include this adventure if it didn't already, or
  // alter any existing entry, and fix any map entries too
  // I can't update other players' profiles, but they should get the update
  // when they next click the adventure, it's best effort :)
  let updated = updateProfileAdventures(profile.adventures, changed);
  if (updated !== undefined) {
    await view.update(profileRef, { adventures: updated });
  }

  // Update any maps associated with it
  await Promise.all(mapRefs.map(m => view.update(m, { adventureName: changed.name })));
}

export async function editAdventure(
  dataService: IDataService | undefined,
  uid: string | undefined,
  changed: IAdventureSummary,
  rec?: IAdventure | undefined
): Promise<void> {
  if (dataService === undefined || uid === undefined) {
    return;
  }
  
  // Get the references to all the relevant stuff.
  // There's a chance this could be slightly out of sync, but it's low, so I'll
  // go with it.
  const profileRef = dataService.getProfileRef(uid);
  const adventureRef = dataService.getAdventureRef(changed.id);
  const adventure = rec ?? (await dataService.get(adventureRef));
  const mapRefs = adventure?.maps.map(m => dataService.getMapRef(changed.id, m.id)) ?? [];
  const playerRefs = await dataService.getPlayerRefs(changed.id);

  await dataService.runTransaction(view =>
    editAdventureTransaction(
      view,
      profileRef,
      adventureRef,
      mapRefs,
      playerRefs,
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
  let profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No profile available");
  }

  // Fetch the adventure, so I can complain if it still had maps
  let adventure = await view.get(adventureRef);
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

export async function deleteAdventure(dataService: IDataService | undefined, uid: string | undefined, adventureId: string) {
  if (dataService === undefined || uid === undefined) {
    return;
  }

  const profileRef = dataService.getProfileRef(uid);
  const adventureRef = dataService.getAdventureRef(adventureId);
  const playerRefs = await dataService.getPlayerRefs(adventureId);
  await dataService.runTransaction(view =>
    deleteAdventureTransaction(view, profileRef, adventureRef, playerRefs));
}

async function editMapTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  mapRef: IDataReference<IMap>,
  changed: IMap
): Promise<void> {
  // Fetch the profile, which we'll want to edit (maybe)
  const profile = await view.get(profileRef);

  // Fetch the adventure, which we'll certainly want to edit
  const adventure = await view.get(adventureRef);
  if (adventure === undefined) {
    throw Error("Adventure not found");
  }

  // Fetch the map as well
  const existingMap = await view.get(mapRef);
  if (existingMap === undefined) {
    throw Error("Map not found");
  }

  // Don't trust the adventure name in the changed record, update it ourselves
  changed.adventureName = adventure.name;

  // Create the new map summary, for the benefit of other records
  const summary = summariseMap(adventureRef.id, mapRef.id, changed);

  // Update the profile to include this map if it didn't already, or
  // alter any existing entry
  if (profile !== undefined) {
    let latestMaps = updateProfileMaps(profile.latestMaps, summary);
    if (latestMaps !== undefined) {
      await view.update(profileRef, { latestMaps: latestMaps });
    }
  }

  // Update the adventure record with the new summary
  let allMaps = updateAdventureMaps(adventure.maps, summary);
  await view.update(adventureRef, { maps: allMaps });

  // Update the map record itself
  // We can only update some fields after the fact
  await view.update(mapRef, {
    adventureName: changed.adventureName,
    name: changed.name,
    description: changed.description,
    ffa: changed.ffa
  });
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

  let profileRef = dataService.getProfileRef(changed.owner);
  let adventureRef = dataService.getAdventureRef(adventureId);
  let mapRef = dataService.getMapRef(adventureId, mapId);
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
  let profile = await view.get(profileRef);

  // Fetch the adventure, which we'll certainly want to edit
  let adventure = await view.get(adventureRef);
  if (adventure === undefined) {
    throw Error("Adventure not found");
  }

  // Update the profile to omit this map
  if (profile?.latestMaps?.find(m => m.id === mapId) !== undefined) {
    let latestMaps = profile.latestMaps.filter(m => m.id !== mapId);
    await view.update(profileRef, { latestMaps: latestMaps });
  }

  // Update the adventure record to omit this map
  let allMaps = adventure.maps.filter(m => m.id !== mapId);
  await view.update(adventureRef, { maps: allMaps });

  // TODO: We also need to remove the sub-collection of changes.
  // Maybe, write a Function to do this deletion instead?
  // https://firebase.google.com/docs/firestore/manage-data/delete-data

  // Remove the map record itself
  await view.delete(mapRef);
}

export async function deleteMap(
  dataService: IDataService | undefined,
  uid: string | undefined,
  adventureId: string,
  mapId: string
): Promise<void> {
  if (dataService === undefined || uid === undefined) {
    return;
  }

  let profileRef = dataService.getProfileRef(uid);
  let adventureRef = dataService.getAdventureRef(adventureId);
  let mapRef = dataService.getMapRef(adventureId, mapId);

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
  let profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No such profile");
  }

  let updated = updateProfileAdventures(profile.adventures, {
    id: id,
    name: a.name,
    description: a.description,
    owner: a.owner,
    ownerName: a.ownerName
  });
  if (updated !== undefined) {
    view.update(profileRef, { adventures: updated });
  }
}

export async function registerAdventureAsRecent(
  dataService: IDataService | undefined,
  uid: string,
  id: string,
  a: IAdventure
) {
  if (dataService === undefined) {
    return;
  }

  let profileRef = dataService.getProfileRef(uid);
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
  let profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No such profile");
  }

  let updated = updateProfileMaps(profile.latestMaps, {
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
  uid: string,
  adventureId: string,
  id: string,
  m: IMap
): Promise<void> {
  if (dataService === undefined) {
    return;
  }

  let profileRef = dataService.getProfileRef(uid);
  await dataService.runTransaction(view =>
    registerMapAsRecentTransaction(view, profileRef, adventureId, id, m)
  );
}

async function removeAdventureFromRecentTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  id: string
) {
  let profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No such profile");
  }

  if (profile.adventures === undefined) {
    return;
  }

  let excepted = profile.adventures?.filter(a => a.id !== id);
  if (excepted.length !== profile.adventures.length) {
    view.update(profileRef, { adventures: excepted });
  }
}

export async function removeAdventureFromRecent(
  dataService: IDataService | undefined,
  uid: string,
  id: string
) {
  if (dataService === undefined) {
    return;
  }

  let profileRef = dataService.getProfileRef(uid);
  await dataService.runTransaction(
    view => removeAdventureFromRecentTransaction(view, profileRef, id)
  );
}

async function removeMapFromRecentTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  id: string
) {
  let profile = await view.get(profileRef);
  if (profile === undefined) {
    throw Error("No such profile");
  }

  if (profile.latestMaps === undefined) {
    return;
  }

  let excepted = profile.latestMaps?.filter(a => a.id !== id);
  if (excepted.length !== profile.latestMaps.length) {
    view.update(profileRef, { latestMaps: excepted });
  }
}

export async function removeMapFromRecent(
  dataService: IDataService | undefined,
  uid: string,
  id: string
) {
  if (dataService === undefined) {
    return;
  }

  let profileRef = dataService.getProfileRef(uid);
  await dataService.runTransaction(
    view => removeMapFromRecentTransaction(view, profileRef, id)
  );
}

// A simple helper to fetch all map changes instantaneously -- useful for testing; the
// live application should probably be watching changes instead
export async function getAllMapChanges(
  dataService: IDataService | undefined,
  adventureId: string,
  mapId: string,
  limit: number
) {
  if (dataService === undefined) {
    return;
  }

  const converter = Convert.createChangesConverter();
  const baseChangeRef = dataService.getMapBaseChangeRef(adventureId, mapId, converter);
  const baseChange = await dataService.get(baseChangeRef);
  const incrementalChanges = await dataService.getMapIncrementalChangesRefs(adventureId, mapId, limit, converter);

  let changes = [];
  if (baseChange !== undefined) {
    changes.push(baseChange);
  }

  if (incrementalChanges !== undefined) {
    changes.push(...incrementalChanges.map(c => c.convert(c.data)));
  }

  return changes;
}

// Watches map changes and automatically consolidates at a suitable interval.
export function watchChangesAndConsolidate(
  dataService: IDataService | undefined,
  functionsService: IFunctionsService | undefined,
  adventureId: string,
  mapId: string,
  onNext: (chs: IChanges) => boolean, // applies changes and returns true if successful, else false
  onReset: () => void, // reset the map state to blank (expect an onNext() right after)
  onEvent: (event: string, parameters: any) => void, // GA events delegate
  onError?: ((message: string, ...params: any) => void) | undefined,
  resyncIntervalMillis?: number | undefined
) {
  if (dataService === undefined || functionsService === undefined) {
    return undefined;
  }

  // This creates the changes interval that non-resync consolidates are done on.
  function createConsolidateInterval() {
    // We want to consolidate before 500 incremental changes (so it can all
    // be done in one transaction), and randomly, so that clients don't all
    // try to consolidate at once
    const i = Math.floor(100 + Math.random() * 350);
    console.log("next consolidate after " + i + " changes");
    return i;
  }

  let changesBeforeConsolidate = createConsolidateInterval();

  // This mechanism should throttle resync calls to at most the given time interval.
  const resyncSubject = new Subject<void>();
  const resyncSub = resyncSubject.pipe(throttle(() => interval(resyncIntervalMillis ?? 5000)))
    .subscribe(() => {
      console.log("lost sync -- trying to consolidate");
      onEvent("desync", { "adventureId": adventureId, "mapId": mapId });
      changesBeforeConsolidate = createConsolidateInterval();
      functionsService.consolidateMapChanges(adventureId, mapId, true)
        .catch(e => onError?.("Consolidate call failed", e));
    });

  let seenBaseChange = false;
  const stopWatching = dataService.watchChanges(
    adventureId, mapId,
    (chs: IChanges) => {
      // If this isn't a resync and we've seen the base change already, we can
      // safely skip this; there shouldn't be any new information
      if (chs.incremental === false && chs.resync === false && seenBaseChange === true) {
        console.log("skipping non-resync base change");
        return;
      }

      if (chs.incremental === false) {
        // This is a first base change or a resync.  Reset the map state before this one
        console.log("accepting base change");
        onReset();
        seenBaseChange = true;
      }

      if (onNext(chs) === false) {
        if (chs.incremental === false) {
          // An invalid base change is fatal.
          onError?.("Invalid base change -- map corrupt");
          throw Error("Invalid base change -- map corrupt");
        }

        // An invalid incremental change suggests we might be confused; trigger a resync.
        resyncSubject.next();
      } else if (--changesBeforeConsolidate <= 0) {
        // Issue regular consolidate on interval to reduce the number of in-flight changes
        // users opening the map have to handle
        console.log("consolidating map changes upon counted interval");
        changesBeforeConsolidate = createConsolidateInterval();
        functionsService.consolidateMapChanges(adventureId, mapId, false)
          .catch(e => onError?.("Consolidate call failed", e));
      }
    },
    (e: Error) => onError?.("Watch changes failed for map " + mapId, e)
  );

  return () => {
    stopWatching();
    resyncSub.unsubscribe();
  }
}

async function leaveAdventureTransaction(
  view: IDataView,
  profileRef: IDataReference<IProfile>,
  adventureRef: IDataReference<IAdventure>,
  playerRef: IDataReference<IPlayer>
): Promise<void> {
  // Fetch the profile and adventure
  const profile = await view.get(profileRef);
  if (profile === undefined) {
    return;
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
  uid: string | undefined,
  adventureId: string
): Promise<void> {
  if (dataService === undefined || uid === undefined) {
    return;
  }

  let profileRef = dataService.getProfileRef(uid);
  let adventureRef = dataService.getAdventureRef(adventureId);
  let playerRef = dataService.getPlayerRef(adventureId, uid);
  await dataService.runTransaction(tr => leaveAdventureTransaction(tr, profileRef, adventureRef, playerRef));
}