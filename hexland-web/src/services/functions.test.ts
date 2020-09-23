import { DataService } from './dataService';
import { editAdventure, editMap, ensureProfile, getAllMapChanges, inviteToAdventure, leaveAdventure, registerAdventureAsRecent, registerMapAsRecent, removeAdventureFromRecent, removeMapFromRecent, updateProfile } from './extensions';
import { createTestUser } from './extensions.test';
import { FunctionsService } from './functions';
import { IUser } from './interfaces';
import { ChangeCategory, ChangeType, ITokenAdd, ITokenMove, IWallAdd } from '../data/change';
import { MapType } from '../data/map';

import * as firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/functions';

import { initializeTestApp } from '@firebase/rules-unit-testing';
import { v4 as uuidv4 } from 'uuid';

interface IEmul {
  app: firebase.app.App;
  db: firebase.firestore.Firestore;
  functions: firebase.functions.Functions;
}

describe('test functions', () => {
  // We must use a fixed project ID here, it seems
  const projectId = 'hexland-test';
  const region = 'europe-west2';
  const emul: { [uid: string]: IEmul } = {};

  function initializeEmul(auth: IUser): IEmul {
    if (auth.uid in emul) {
      return emul[auth.uid];
    }

    const e = initializeTestApp({
      projectId: projectId,
      auth: auth
    });

    const db = e.firestore();
    const functions = e.functions(region);
    functions.useFunctionsEmulator('http://localhost:5001');
    emul[auth.uid] = { app: e, db: db, functions: functions };
    return emul[auth.uid];
  }

  beforeAll(() => {
    initializeEmul(createTestUser('Owner', 'owner@example.com', 'google.com', 'owner'));
  });

  afterAll(async () => {
    const toDelete: string[] = [];
    for (let uid in emul) {
      toDelete.push(uid);
    }

    for (let uid of toDelete) {
      await emul[uid].app.delete();
      delete emul[uid];
    }

    // Erk!  We *mustn't* do this, or the emulator goes "stale" and
    // stops responding.  Hopefully, it will clean up properly on restart.
    // await clearFirestoreData({ projectId: projectId });
  });

  // test('invoke hello world function', async () => {
  //   const functions = emul['owner'].functions;
  //   functions.useFunctionsEmulator('http://localhost:5001');
  //   const hello = functions.httpsCallable('helloWorld');
  //   const result = await hello();
  //   expect(result.data).toBe('Hello from Firebase!');
  // });

  async function testConsolidate(moveCount: number) {
    const functions = emul['owner'].functions;
    const functionsService = new FunctionsService(functions);

    // make sure my user is set up
    const db = emul['owner'].db;
    const dataService = new DataService(db, firebase.firestore.FieldValue.serverTimestamp);
    const profile = await ensureProfile(dataService, createTestUser(
      'Owner', 'owner@example.com', 'google.com', 'owner'
    ), undefined);
    expect(profile?.name).toBe('Owner');

    // create an adventure
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure One',
      description: 'First adventure',
      owner: 'owner',
      ownerName: 'Owner',
    };
    await editAdventure(dataService, 'owner', true, { id: a1Id, ...a1 }, { maps: [], ...a1 });

    // create a map
    const m1Id = uuidv4();
    const m1 = {
      adventureName: 'this will be overwritten',
      name: 'Map One',
      description: 'First map',
      owner: 'owner',
      ty: MapType.Hex,
      ffa: false
    };
    await editMap(dataService, a1Id, m1Id, m1);

    // Get the map record with the data service
    const m1Record = await dataService.get(dataService.getMapRef(a1Id, m1Id));
    expect(m1Record?.name).toBe('Map One');
    expect(m1Record?.adventureName).toBe('Adventure One');
    expect(m1Record?.description).toBe('First map');
    expect(m1Record?.owner).toBe('owner');
    expect(m1Record?.ty).toBe(MapType.Hex);
    expect(m1Record?.ffa).toBeFalsy();

    // Add a few simple changes:
    const addToken1: ITokenAdd = {
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: {
        position: { x: 0, y: 3 },
        colour: 1,
        id: 'token1',
        players: ['owner'],
        text: 'ONE',
        note: 'token one',
        noteVisibleToPlayers: true
      }
    };

    function createMoveToken1(x: number): ITokenMove {
      // This function keeps moving the token along, generating lots of moves.
      return {
        ty: ChangeType.Move,
        cat: ChangeCategory.Token,
        tokenId: 'token1',
        oldPosition: { x: x, y: 3 },
        newPosition: { x: x + 1, y: 3 }
      };
    }

    const addWall1: IWallAdd = {
      ty: ChangeType.Add,
      cat: ChangeCategory.Wall,
      feature: {
        position: { x: 0, y: 0, edge: 0 },
        colour: 0
      }
    };

    await dataService.addChanges(a1Id, 'owner', m1Id, [addToken1]);
    for (let i = 0; i < moveCount; ++i) {
      await dataService.addChanges(a1Id, 'owner', m1Id, [createMoveToken1(i)]);
    }

    await dataService.addChanges(a1Id, 'owner', m1Id, [addWall1]);

    // Check that the changes went in successfully and we can read them back:
    let changes = await getAllMapChanges(dataService, a1Id, m1Id, 2 + moveCount);
    expect(changes).toHaveLength(2 + moveCount);

    // Call the consolidate function:
    await functionsService.consolidateMapChanges(a1Id, m1Id);

    // After doing that, we should have only one changes record, thus:
    async function verifyBaseChangesRecord(expectedX: number) {
      let changes = await getAllMapChanges(dataService, a1Id, m1Id, 499);
      expect(changes).toHaveLength(1);
      expect(changes?.[0].user).toBe('owner');

      // with just an add token and an add wall:
      expect(changes?.[0].chs).toHaveLength(2);

      const addTokenRecord = changes?.[0].chs.find(ch => ch.cat === ChangeCategory.Token);
      expect(addTokenRecord?.ty).toBe(ChangeType.Add);
      expect((addTokenRecord as ITokenAdd).feature.id).toBe('token1');
      expect((addTokenRecord as ITokenAdd).feature.position.x).toBe(expectedX);
      expect((addTokenRecord as ITokenAdd).feature.position.y).toBe(3);

      const addWallRecord = changes?.[0].chs.find(ch => ch.cat === ChangeCategory.Wall);
      expect(addWallRecord?.ty).toBe(ChangeType.Add);
      expect((addWallRecord as IWallAdd).feature.position.x).toBe(0);
      expect((addWallRecord as IWallAdd).feature.position.y).toBe(0);
      expect((addWallRecord as IWallAdd).feature.colour).toBe(0);
    }
    await verifyBaseChangesRecord(moveCount);

    // Now that I've consolidated once, I should be able to make some more changes and
    // consolidate again (which is different, because there is now a base change:)
    for (let i = moveCount; i < moveCount * 2; ++i) {
      await dataService.addChanges(a1Id, 'owner', m1Id, [createMoveToken1(i)]);
    }

    await functionsService.consolidateMapChanges(a1Id, m1Id);
    await verifyBaseChangesRecord(moveCount * 2);
  }

  test('create a map and consolidate 1 move', async () => {
    await testConsolidate(1);
  });

  test('create a map and consolidate 2 moves', async () => {
    await testConsolidate(2);
  });

  test('create a map and consolidate 10 moves', async () => {
    await testConsolidate(10);
  });

  test('create a map and consolidate 200 moves', async () => {
    await testConsolidate(200);
  });

  test('create a map and consolidate 600 moves', async () => {
    await testConsolidate(600);
  });

  test('join and leave an adventure', async () => {
    // As the owner, create an adventure and a map
    const db = emul['owner'].db;
    const dataService = new DataService(db, firebase.firestore.FieldValue.serverTimestamp);
    await ensureProfile(dataService, createTestUser(
      'Owner', 'owner@example.com', 'google.com', 'owner'
    ), undefined);

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
    const user = createTestUser('User 1', 'user1@example.com', 'google.com', 'user1');
    const userEmul = initializeEmul(user);
    const userDataService = new DataService(userEmul.db, firebase.firestore.FieldValue.serverTimestamp);
    const userFunctionsService = new FunctionsService(userEmul.functions);
    let userProfile = await ensureProfile(userDataService, user, undefined);

    // If I try to fetch that map without being invited I should get an error
    try
    {
      await userDataService.get(userDataService.getMapRef(a1Id, m1Id));
      fail("Fetched map in un-joined adventure");
    }
    catch {}

    // Join the adventure.
    await userFunctionsService.joinAdventure(a1Id, invite ?? "");

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
    expect(userProfile?.adventures?.find(a => a.id === a1Id)).not.toBeUndefined();
    expect(userProfile?.latestMaps?.find(m => m.id === m1Id)).not.toBeUndefined();

    // Check I can unregister those as recent as well:
    await removeAdventureFromRecent(userDataService, 'user1', a1Id);
    await removeMapFromRecent(userDataService, 'user1', m1Id);

    userProfile = await userDataService.get(userDataService.getProfileRef('user1'));
    expect(userProfile?.adventures?.find(a => a.id === a1Id)).toBeUndefined();
    expect(userProfile?.latestMaps?.find(m => m.id === m1Id)).toBeUndefined();

    // If I join the adventure a second time, it shouldn't barf:
    // (it should update some fields, but verifying that is fiddly, and not the
    // most important thing)
    await userFunctionsService.joinAdventure(a1Id, invite ?? "");

    await registerAdventureAsRecent(userDataService, 'user1', a1Id, a1Record);
    await registerMapAsRecent(userDataService, 'user1', a1Id, m1Id, m1Record);

    userProfile = await userDataService.get(userDataService.getProfileRef('user1'));
    expect(userProfile?.adventures?.find(a => a.id === a1Id)).not.toBeUndefined();
    expect(userProfile?.latestMaps?.find(m => m.id === m1Id)).not.toBeUndefined();

    // Leave the adventure
    await leaveAdventure(userDataService, 'user1', a1Id);

    // It should now be gone from my profile
    userProfile = await userDataService.get(userDataService.getProfileRef('user1'));
    expect(userProfile?.adventures?.find(a => a.id === a1Id)).toBeUndefined();
    expect(userProfile?.latestMaps?.find(m => m.id === m1Id)).toBeUndefined();

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
    const user1 = createTestUser('User 1', 'user1@example.com', 'google.com', 'user1');
    const user1Emul = initializeEmul(user1);
    const user1DataService = new DataService(user1Emul.db, firebase.firestore.FieldValue.serverTimestamp);
    let user1Profile = await ensureProfile(user1DataService, user1, undefined);

    // Ensure we have our default name (since we'll change it later)
    await updateProfile(user1DataService, 'user1', 'User 1');

    // Add a new adventure and make it one of our latest
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure OneA',
      description: 'First adventure',
      owner: 'user1',
      ownerName: 'User 1',
    };
    await editAdventure(user1DataService, 'user1', true, { id: a1Id, ...a1 }, { maps: [], ...a1 });
    await registerAdventureAsRecent(user1DataService, 'user1', a1Id, { maps: [], ...a1 });

    // As another user, also create an adventure
    const user2 = createTestUser('User 2', 'user2@example.com', 'google.com', 'user2');
    const user2Emul = initializeEmul(user2);
    const user2DataService = new DataService(user2Emul.db, firebase.firestore.FieldValue.serverTimestamp);
    await ensureProfile(user2DataService, user2, undefined);

    // Add a new adventure
    const a2Id = uuidv4();
    const a2 = {
      name: 'Adventure TwoA',
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
    const user1Functions = new FunctionsService(user1Emul.functions);
    await user1Functions.joinAdventure(a2Id, invite ?? "");
    await registerAdventureAsRecent(user1DataService, 'user1', a2Id, { maps: [], ...a2 });

    // Now, change our display name
    await updateProfile(user1DataService, 'user1', "New Name");

    // We should be renamed in our adventure:
    const a1Record = await user1DataService.get(user1DataService.getAdventureRef(a1Id));
    expect(a1Record?.ownerName).toBe("New Name");

    // in our player record in user 2's adventure:
    let p2Record = await user1DataService.get(user1DataService.getPlayerRef(a2Id, 'user1'));
    expect(p2Record?.name).toBe("Adventure TwoA"); // this is the adventure name
    expect(p2Record?.ownerName).toBe("User 2"); // this is the owner's name
    expect(p2Record?.playerName).toBe("New Name"); // this is our name

    // ...and in the adventure summary in our profile:
    user1Profile = await user1DataService.get(user1DataService.getProfileRef('user1'));
    expect(user1Profile?.name).toBe("New Name");

    let a1Summary = user1Profile?.adventures?.find(a => a.id === a1Id);
    expect(a1Summary).not.toBeUndefined();
    expect(a1Summary?.name).toBe("Adventure OneA");
    expect(a1Summary?.ownerName).toBe("New Name");

    let a2Summary = user1Profile?.adventures?.find(a => a.id === a2Id);
    expect(a2Summary).not.toBeUndefined();
    expect(a2Summary?.name).toBe("Adventure TwoA");
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

    a1Summary = user1Profile?.adventures?.find(a => a.id === a1Id);
    expect(a1Summary).not.toBeUndefined();
    expect(a1Summary?.name).toBe("Adventure OneA");
    expect(a1Summary?.ownerName).toBe("New Name");

    a2Summary = user1Profile?.adventures?.find(a => a.id === a2Id);
    expect(a2Summary).not.toBeUndefined();
    expect(a2Summary?.name).toBe("Renamed Adventure");
    expect(a2Summary?.ownerName).toBe("User 2");
  });
});