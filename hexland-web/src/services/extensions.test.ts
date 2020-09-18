import { DataService } from './dataService';
import { ensureProfile, editAdventure, editMap, deleteMap, deleteAdventure, inviteToAdventure, joinAdventure, registerAdventureAsRecent, registerMapAsRecent, leaveAdventure, updateProfile } from './extensions';
import { IUser } from './interfaces';
import { MapType } from '../data/map';

import * as firebase from 'firebase/app';
import 'firebase/firestore';

import { clearFirestoreData, initializeTestApp } from '@firebase/rules-unit-testing';

import { v4 as uuidv4 } from 'uuid';
import fluent from 'fluent-iterable';

describe('test extensions', () => {
  const projectIds: string[] = [];
  const emul: { [uid: string]: firebase.app.App } = {};

  function initializeEmul(auth: IUser) {
    const projectId = fluent(projectIds).last();
    if (projectId === undefined) {
      throw Error("No project");
    }

    if (auth.uid in emul) {
      return emul[auth.uid];
    }

    const e = initializeTestApp({
      projectId: projectId,
      auth: auth
    });
    emul[auth.uid] = e;
    return e;
  }

  beforeEach(() => {
    const id = uuidv4();
    projectIds.push(id);
    initializeEmul({
      displayName: 'Owner',
      email: 'owner@example.com',
      providerId: 'google.com',
      uid: 'owner'
    });
  });

  afterEach(async () => {
    const toDelete: string[] = [];
    for (let uid in emul) {
      toDelete.push(uid);
    }

    for (let uid of toDelete) {
      await emul[uid].delete();
      delete emul[uid];
    }
  });

  afterAll(async () => {
    await Promise.all(projectIds.map(id => clearFirestoreData({ projectId: id })));
  });

  test('create a new profile entry', async () => {
    const db = emul['owner'].firestore();
    const dataService = new DataService(db, firebase.firestore.FieldValue.serverTimestamp);
    const profile = await ensureProfile(dataService, {
      displayName: 'Owner',
      email: 'owner@example.com',
      providerId: 'google.com',
      uid: 'owner'
    }, undefined);

    expect(profile?.name).toBe('Owner');

    // If we fetch it, it should not get re-created or updated (changing their Hexland display
    // name should be a Hexland UI feature, it shouldn't sync with the provider's idea of it)
    const profile2 = await ensureProfile(dataService, {
      displayName: 'fish',
      email: 'owner@example.com',
      providerId: 'google.com',
      uid: 'owner'
    }, undefined);

    expect(profile2?.name).toBe('Owner');
  });

  test('create and edit adventures and maps', async () => {
    const db = emul['owner'].firestore();
    const dataService = new DataService(db, firebase.firestore.FieldValue.serverTimestamp);
    let profile = await ensureProfile(dataService, {
      displayName: 'Owner',
      email: 'owner@example.com',
      providerId: 'google.com',
      uid: 'owner'
    }, undefined);

    // There should be no adventures in the profile now
    expect(profile?.adventures).toHaveLength(0);

    // Add a new adventure
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure One',
      description: 'First adventure',
      owner: 'owner',
      ownerName: 'Owner',
    };
    await editAdventure(dataService, 'owner', true, { id: a1Id, ...a1 }, { maps: [], ...a1 });

    // And another
    const a2Id = uuidv4();
    const a2 = {
      name: 'Adventure Two',
      description: 'Second adventure',
      owner: 'owner',
      ownerName: 'Owner'
    };
    await editAdventure(dataService, 'owner', true, { id: a2Id, ...a2 }, { maps: [], ...a2 });

    // Edit the first adventure (we don't need to supply the whole record for a description change)
    a1.description = "Edited adventure";
    await editAdventure(dataService, 'owner', false, { id: a1Id, ...a1 }, undefined);

    // If we fetch the adventure records the descriptions should be as expected
    let a1Record = await dataService.get(dataService.getAdventureRef(a1Id));
    expect(a1Record?.description).toBe("Edited adventure");

    let a2Record = await dataService.get(dataService.getAdventureRef(a2Id));
    expect(a2Record?.description).toBe("Second adventure");

    // And they should both appear in the user's profile
    profile = await dataService.get(dataService.getProfileRef('owner'));
    expect(profile?.adventures).toHaveLength(2);
    expect(profile?.adventures?.find(a => a.description === "Second adventure")).toBeTruthy();
    expect(profile?.adventures?.find(a => a.description === "Edited adventure")).toBeTruthy();

    // We should be able to add a map
    const m1Id = uuidv4();
    const m1 = {
      adventureName: 'this will be overwritten',
      name: 'Map One',
      description: 'First map',
      owner: 'owner',
      ty: MapType.Square,
      ffa: false
    };
    await editMap(dataService, a1Id, m1Id, m1);

    // And another
    const m2Id = uuidv4();
    const m2 = {
      adventureName: 'this will be overwritten',
      name: 'Map Two',
      description: 'Second map',
      owner: 'owner',
      ty: MapType.Hex,
      ffa: true
    };
    await editMap(dataService, a2Id, m2Id, m2);

    // Edit the second adventure
    m2.description = 'Edited map';
    await editMap(dataService, a2Id, m2Id, m2);

    // We should be able to fetch the map records
    let m1Record = await dataService.get(dataService.getMapRef(a1Id, m1Id));
    expect(m1Record?.name).toBe('Map One');
    expect(m1Record?.adventureName).toBe('Adventure One');
    expect(m1Record?.ty).toBe(MapType.Square);
    expect(m1Record?.ffa).toBe(false);

    let m2Record = await dataService.get(dataService.getMapRef(a2Id, m2Id));
    expect(m2Record?.name).toBe('Map Two');
    expect(m2Record?.adventureName).toBe('Adventure Two');
    expect(m2Record?.ty).toBe(MapType.Hex);
    expect(m2Record?.ffa).toBe(true);

    // The adventure records should now feature these maps in their summaries
    a1Record = await dataService.get(dataService.getAdventureRef(a1Id));
    expect(a1Record?.maps).toHaveLength(1);
    expect(a1Record?.maps[0].name).toBe('Map One');
    expect(a1Record?.maps[0].description).toBe('First map');

    a2Record = await dataService.get(dataService.getAdventureRef(a2Id));
    expect(a2Record?.maps).toHaveLength(1);
    expect(a2Record?.maps[0].name).toBe('Map Two');
    expect(a2Record?.maps[0].description).toBe('Edited map');

    // And they should both appear in the user's profile
    profile = await dataService.get(dataService.getProfileRef('owner'));
    expect(profile?.latestMaps).toHaveLength(2);
    expect(profile?.latestMaps?.find(m => m.name === 'Map One')).toBeTruthy();
    expect(profile?.latestMaps?.find(m => m.description === 'Edited map')).toBeTruthy();

    // Delete a map and it should vanish from these places
    await deleteMap(dataService, 'owner', a2Id, m2Id);

    m2Record = await dataService.get(dataService.getMapRef(a2Id, m2Id));
    expect(m2Record).toBeUndefined();

    a2Record = await dataService.get(dataService.getAdventureRef(a2Id));
    expect(a2Record?.maps).toHaveLength(0);

    profile = await dataService.get(dataService.getProfileRef('owner'));
    expect(profile?.latestMaps).toHaveLength(1);
    expect(profile?.latestMaps?.find(m => m.name === 'Map One')).toBeTruthy();
    expect(profile?.latestMaps?.find(m => m.description === 'Edited map')).toBeFalsy();

    // Delete an adventure and it, too, should vanish
    await deleteAdventure(dataService, 'owner', a2Id);

    a2Record = await dataService.get(dataService.getAdventureRef(a2Id));
    expect(a2Record).toBeUndefined();

    profile = await dataService.get(dataService.getProfileRef('owner'));
    expect(profile?.adventures).toHaveLength(1);
    expect(profile?.adventures?.find(a => a.name === 'Adventure One')).toBeTruthy();
    expect(profile?.adventures?.find(a => a.name === 'Adventure Two')).toBeFalsy();
  });

  test('join and leave an adventure', async () => {
    // As the owner, create an adventure and a map
    const db = emul['owner'].firestore();
    const dataService = new DataService(db, firebase.firestore.FieldValue.serverTimestamp);
    let profile = await ensureProfile(dataService, {
      displayName: 'Owner',
      email: 'owner@example.com',
      providerId: 'google.com',
      uid: 'owner'
    }, undefined);

    // There should be no adventures in the profile now
    expect(profile?.adventures).toHaveLength(0);

    // Add a new adventure
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure One',
      description: 'First adventure',
      owner: 'owner',
      ownerName: 'Owner',
    };
    await editAdventure(dataService, 'owner', true, { id: a1Id, ...a1 }, { maps: [], ...a1 });

    // We should be able to add a map
    const m1Id = uuidv4();
    const m1 = {
      adventureName: 'this will be overwritten',
      name: 'Map One',
      description: 'First map',
      owner: 'owner',
      ty: MapType.Square,
      ffa: false
    };
    await editMap(dataService, a1Id, m1Id, m1);

    // Create an invite to that adventure
    const invite = await inviteToAdventure(
      dataService, () => 1, { id: a1Id, ...a1 }
    );
    expect(invite).not.toBeUndefined();

    // Get myself a profile as a different user
    const user = {
      displayName: "User 1",
      email: 'user1@example.com',
      providerId: 'google.com',
      uid: 'user1'
    };
    const userDb = initializeEmul(user).firestore();
    const userDataService = new DataService(userDb, firebase.firestore.FieldValue.serverTimestamp);
    let userProfile = await ensureProfile(userDataService, user, undefined);

    // There should be no adventures in that profile
    expect(userProfile?.adventures).toHaveLength(0);

    // If I try to fetch that map without being invited I should get an error
    try
    {
      await userDataService.get(userDataService.getMapRef(a1Id, m1Id));
      fail("Fetched map in un-joined adventure");
    }
    catch {}

    // Join the adventure.
    // TODO I really ought to have to redeem that invite string ...
    await joinAdventure(userDataService, userProfile, 'user1', a1Id);

    // Having done that, I can open the adventure and map, and register them as recent:
    const a1Record = await userDataService.get(userDataService.getAdventureRef(a1Id));
    expect(a1Record).not.toBeUndefined();
    expect(a1Record?.description).toBe("First adventure");

    const m1Record = await userDataService.get(userDataService.getMapRef(a1Id, m1Id));
    expect(m1Record).not.toBeUndefined();
    expect(m1Record?.description).toBe("First map");

    // If I register them as recent they should pop up in my profile
    if (a1Record === undefined || m1Record === undefined) {
      throw Error("no record fetched"); // appeases typescript
    }

    await registerAdventureAsRecent(userDataService, 'user1', a1Id, a1Record);
    await registerMapAsRecent(userDataService, 'user1', a1Id, m1Id, m1Record);

    userProfile = await userDataService.get(userDataService.getProfileRef('user1'));
    expect(userProfile?.adventures).toHaveLength(1);
    expect(userProfile?.adventures?.find(a => a.name === 'Adventure One')).not.toBeUndefined();
    expect(userProfile?.latestMaps).toHaveLength(1);
    expect(userProfile?.latestMaps?.find(m => m.name === 'Map One')).not.toBeUndefined();

    // Leave the adventure
    await leaveAdventure(userDataService, 'user1', a1Id);

    // It should now be gone from my profile
    userProfile = await userDataService.get(userDataService.getProfileRef('user1'));
    expect(userProfile?.adventures).toHaveLength(0);
    expect(userProfile?.latestMaps).toHaveLength(0);

    // ...and I should no longer be able to fetch the map
    try
    {
      await userDataService.get(userDataService.getMapRef(a1Id, m1Id));
      fail("Fetched map in un-joined adventure");
    }
    catch {}
  });

  test('change my display name', async () => {
    // As one user, create our profile and an adventure
    const user1 = {
      displayName: "User 1",
      email: 'user1@example.com',
      providerId: 'google.com',
      uid: 'user1'
    };
    const user1Db = initializeEmul(user1).firestore();
    const user1DataService = new DataService(user1Db, firebase.firestore.FieldValue.serverTimestamp);
    let user1Profile = await ensureProfile(user1DataService, user1, undefined);

    // There should be no adventures in the profile now
    expect(user1Profile?.adventures).toHaveLength(0);

    // Add a new adventure and mnake it one of our latest
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure One',
      description: 'First adventure',
      owner: 'user1',
      ownerName: 'User 1',
    };
    await editAdventure(user1DataService, 'user1', true, { id: a1Id, ...a1 }, { maps: [], ...a1 });
    await registerAdventureAsRecent(user1DataService, 'user1', a1Id, { maps: [], ...a1 });

    // As another user, also create an adventure
    const user2 = {
      displayName: "User 2",
      email: 'user2@example.com',
      providerId: 'google.com',
      uid: 'user2'
    };
    const user2Db = initializeEmul(user2).firestore();
    const user2DataService = new DataService(user2Db, firebase.firestore.FieldValue.serverTimestamp);
    let user2Profile = await ensureProfile(user2DataService, user2, undefined);

    // There should be no adventures in the profile now
    expect(user2Profile?.adventures).toHaveLength(0);

    // Add a new adventure
    const a2Id = uuidv4();
    const a2 = {
      name: 'Adventure Two',
      description: 'Second adventure',
      owner: 'user2',
      ownerName: 'User 2',
    };
    await editAdventure(user2DataService, 'user2', true, { id: a2Id, ...a2 }, { maps: [], ...a2 });

    // ...with an invite...
    const invite = await inviteToAdventure(
      user2DataService, () => 1, { id: a2Id, ...a2 }
    );
    expect(invite).not.toBeUndefined();

    // As user 1, join user 2's adventure and add that as one of our recent adventures too
    await joinAdventure(user1DataService, user1Profile, 'user1', a2Id);
    await registerAdventureAsRecent(user1DataService, 'user1', a2Id, { maps: [], ...a2 });

    // Now, change our display name
    await updateProfile(user1DataService, 'user1', "New Name");

    // We should be renamed in our adventure:
    const a1Record = await user1DataService.get(user1DataService.getAdventureRef(a1Id));
    expect(a1Record?.ownerName).toBe("New Name");

    // in our player record in user 2's adventure:
    let p2Record = await user1DataService.get(user1DataService.getPlayerRef(a2Id, 'user1'));
    expect(p2Record?.name).toBe("Adventure Two"); // this is the adventure name
    expect(p2Record?.ownerName).toBe("User 2"); // this is the owner's name
    expect(p2Record?.playerName).toBe("New Name"); // this is our name

    // ...and in the adventure summary in our profile:
    user1Profile = await user1DataService.get(user1DataService.getProfileRef('user1'));
    expect(user1Profile?.name).toBe("New Name");
    expect(user1Profile?.adventures).toHaveLength(2);

    let a1Summary = user1Profile?.adventures?.find(a => a.id === a1Id);
    expect(a1Summary).not.toBeUndefined();
    expect(a1Summary?.name).toBe("Adventure One");
    expect(a1Summary?.ownerName).toBe("New Name");

    let a2Summary = user1Profile?.adventures?.find(a => a.id === a2Id);
    expect(a2Summary).not.toBeUndefined();
    expect(a2Summary?.name).toBe("Adventure Two");
    expect(a2Summary?.ownerName).toBe("User 2");

    // If user 2 renames their adventure:
    await editAdventure(user2DataService, 'user2', false,
      { id: a2Id, ...a2, name: "Renamed Adventure" },
      { ...a2, maps: [], name: "Renamed Adventure"}
    );

    // Then, user 1 should see it has changed in their player record:
    p2Record = await user1DataService.get(user1DataService.getPlayerRef(a2Id, 'user1'));
    expect(p2Record?.name).toBe("Renamed Adventure"); // this is the adventure name
    expect(p2Record?.ownerName).toBe("User 2"); // this is the owner's name
    expect(p2Record?.playerName).toBe("New Name"); // this is our name

    // and it will rename itself in their profile if they visit it
    let a2Record = await user1DataService.get(user1DataService.getAdventureRef(a2Id));
    expect(a2Record?.name).toBe("Renamed Adventure");
    if (a2Record === undefined) return; // should have failed already
    await registerAdventureAsRecent(user1DataService, 'user1', a2Id, { ...a2Record });

    user1Profile = await user1DataService.get(user1DataService.getProfileRef('user1'));
    expect(user1Profile?.name).toBe("New Name");
    expect(user1Profile?.adventures).toHaveLength(2);

    a1Summary = user1Profile?.adventures?.find(a => a.id === a1Id);
    expect(a1Summary).not.toBeUndefined();
    expect(a1Summary?.name).toBe("Adventure One");
    expect(a1Summary?.ownerName).toBe("New Name");

    a2Summary = user1Profile?.adventures?.find(a => a.id === a2Id);
    expect(a2Summary).not.toBeUndefined();
    expect(a2Summary?.name).toBe("Renamed Adventure");
    expect(a2Summary?.ownerName).toBe("User 2");
  });
});