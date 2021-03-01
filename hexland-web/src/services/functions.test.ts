import { createChangesConverter } from './converter';
import { DataService } from './dataService';
import { deleteAdventure, deleteCharacter, deleteMap, editAdventure, editCharacter, editMap, ensureProfile, getAllMapChanges, leaveAdventure, registerAdventureAsRecent, registerMapAsRecent, removeAdventureFromRecent, removeMapFromRecent, updateProfile, watchChangesAndConsolidate } from './extensions';
import { FunctionsService } from './functions';
import { IDataService, IUser } from './interfaces';
import { MockWebStorage } from './mockWebStorage';
import { IAnnotation } from '../data/annotation';
import { ChangeCategory, ChangeType, Changes, TokenAdd, TokenMove, WallAdd } from '../data/change';
import { SimpleChangeTracker, trackChanges } from '../data/changeTracking';
import { coordString, edgeString, GridCoord, GridEdge } from '../data/coord';
import { FeatureDictionary, IFeature, StripedArea } from '../data/feature';
import { IMap, MapType } from '../data/map';
import * as Policy from '../data/policy';
import { getTokenGeometry } from '../data/tokenGeometry';
import { SimpleTokenDrawing, Tokens } from '../data/tokens';

import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/functions';

import * as fs from 'fs';
import { initializeTestApp } from '@firebase/rules-unit-testing';
import * as http from 'http';
import { Subject } from 'rxjs';
import { filter, first } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import md5 from 'crypto-js/md5';
import { IdDictionary } from '../data/identified';
import { IMapImage } from '../data/image';

import adminCredentials from '../../firebase-admin-credentials.json';

export function createTestUser(
  displayName: string | null,
  email: string | null,
  providerId: string,
  emailVerified?: boolean | undefined,
): IUser {
  return {
    displayName: displayName,
    email: email,
    emailMd5: email ? md5(email).toString() : null,
    emailVerified: emailVerified ?? true,
    providerId: providerId,
    uid: uuidv4(),
    changePassword: jest.fn(),
    sendEmailVerification: jest.fn(),
    updateProfile: jest.fn()
  };
}

interface IEmul {
  app: firebase.app.App;
  db: firebase.firestore.Firestore;
  functions: firebase.functions.Functions;
}

interface IChangesEvent {
  changes: Changes;
  accepted: boolean;
}

describe('test functions', () => {
  // We must use a fixed project ID here, it seems
  const projectId = String(adminCredentials?.projectId ?? 'hexland-test');
  const region = 'europe-west2';
  const emul: { [uid: string]: IEmul } = {};

  function initializeEmul(auth: IUser): IEmul {
    if (auth.uid in emul) {
      return emul[auth.uid];
    }

    const e = initializeTestApp({
      projectId: projectId,
      auth: { ...auth, email: auth.email ?? undefined }
    });

    const db = e.firestore();
    const functions = e.functions(region);
    functions.useEmulator('localhost', 5001);
    emul[auth.uid] = { app: e, db: db, functions: functions };
    return emul[auth.uid];
  }

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

  test('create and edit adventures and maps', async () => {
    const user = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(user);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    let profile = await ensureProfile(dataService, user, undefined);

    // There should be no adventures in the profile now
    expect(profile?.adventures).toHaveLength(0);

    // Add a new adventure
    const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');
    const a1 = await dataService.get(dataService.getAdventureRef(a1Id));

    // And another
    const a2Id = await functionsService.createAdventure('Adventure Two', 'Second adventure');

    // Edit the first adventure (we don't need to supply the whole record for a description change)
    if (a1 !== undefined) {
      a1.description = "Edited adventure";
      await editAdventure(dataService, user.uid, { id: a1Id, ...a1 });
    }

    // If we fetch the adventure records the descriptions should be as expected
    let a1Record = await dataService.get(dataService.getAdventureRef(a1Id));
    expect(a1Record?.description).toBe("Edited adventure");

    let a2Record = await dataService.get(dataService.getAdventureRef(a2Id));
    expect(a2Record?.description).toBe("Second adventure");

    // And they should both appear in the user's profile
    profile = await dataService.get(dataService.getProfileRef(user.uid));
    expect(profile?.adventures).toHaveLength(2);
    expect(profile?.adventures?.find(a => a.description === "Second adventure")).toBeTruthy();
    expect(profile?.adventures?.find(a => a.description === "Edited adventure")).toBeTruthy();

    // We should be able to add a map
    const m1Id = await functionsService.createMap(
      a1Id, 'Map One', 'First map', MapType.Square, false
    );

    // And another
    const m2Id = await functionsService.createMap(
      a2Id, 'Map Two', 'Second map', MapType.Hex, true
    );

    // Edit the second map
    const m2 = await dataService.get(dataService.getMapRef(a2Id, m2Id));
    expect(m2).not.toBeUndefined();
    if (m2 !== undefined) {
      m2.description = 'Edited map';
      await editMap(dataService, a2Id, m2Id, m2);
    }

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
    profile = await dataService.get(dataService.getProfileRef(user.uid));
    expect(profile?.latestMaps).toHaveLength(2);
    expect(profile?.latestMaps?.find(m => m.name === 'Map One')).toBeTruthy();
    expect(profile?.latestMaps?.find(m => m.description === 'Edited map')).toBeTruthy();

    // Delete a map and it should vanish from these places
    await deleteMap(dataService, user.uid, a2Id, m2Id);

    m2Record = await dataService.get(dataService.getMapRef(a2Id, m2Id));
    expect(m2Record).toBeUndefined();

    a2Record = await dataService.get(dataService.getAdventureRef(a2Id));
    expect(a2Record?.maps).toHaveLength(0);

    profile = await dataService.get(dataService.getProfileRef(user.uid));
    expect(profile?.latestMaps).toHaveLength(1);
    expect(profile?.latestMaps?.find(m => m.name === 'Map One')).toBeTruthy();
    expect(profile?.latestMaps?.find(m => m.description === 'Edited map')).toBeFalsy();

    // Delete an adventure and it, too, should vanish
    await deleteAdventure(dataService, user.uid, a2Id);

    a2Record = await dataService.get(dataService.getAdventureRef(a2Id));
    expect(a2Record).toBeUndefined();

    profile = await dataService.get(dataService.getProfileRef(user.uid));
    expect(profile?.adventures).toHaveLength(1);
    expect(profile?.adventures?.find(a => a.name === 'Adventure One')).toBeTruthy();
    expect(profile?.adventures?.find(a => a.name === 'Adventure Two')).toBeFalsy();
  });

  // Some functions to help the consolidate and clone tests
  function createAddToken1(uid: string): TokenAdd {
    return {
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: {
        position: { x: 0, y: 3 },
        colour: 1,
        id: 'token1',
        players: [uid],
        size: '1',
        text: 'ONE',
        note: 'token one',
        noteVisibleToPlayers: true,
        characterId: "",
        sprites: [],
        outline: true
      }
    };
  }

  function createMoveToken1(x: number): TokenMove {
    // This function keeps moving the token along, generating lots of moves.
    return {
      ty: ChangeType.Move,
      cat: ChangeCategory.Token,
      tokenId: 'token1',
      oldPosition: { x: x, y: 3 },
      newPosition: { x: x + 1, y: 3 }
    };
  }

  function createAddWall1(): WallAdd {
    return {
      ty: ChangeType.Add,
      cat: ChangeCategory.Wall,
      feature: {
        position: { x: 0, y: 0, edge: 0 },
        colour: 0
      }
    };
  }

  async function verifyBaseChangesRecord(
    dataService: IDataService,
    uid: string,
    a1Id: string,
    m1Id: string,
    expectedX: number
  ) {
    // Verifies that the token created with createAddToken1 and moved with createMoveToken1 (above)
    // was moved to the expected place
    let changes = await getAllMapChanges(dataService, a1Id, m1Id, 499);
    expect(changes).toHaveLength(1);
    expect(changes?.[0].user).toBe(uid);

    // with just an add token and an add wall:
    expect(changes?.[0].chs).toHaveLength(2);

    const addTokenRecord = changes?.[0].chs.find(ch => ch.cat === ChangeCategory.Token);
    expect(addTokenRecord?.ty).toBe(ChangeType.Add);
    expect((addTokenRecord as TokenAdd).feature.id).toBe('token1');
    expect((addTokenRecord as TokenAdd).feature.position.x).toBe(expectedX);
    expect((addTokenRecord as TokenAdd).feature.position.y).toBe(3);

    const addWallRecord = changes?.[0].chs.find(ch => ch.cat === ChangeCategory.Wall);
    expect(addWallRecord?.ty).toBe(ChangeType.Add);
    expect((addWallRecord as WallAdd).feature.position.x).toBe(0);
    expect((addWallRecord as WallAdd).feature.position.y).toBe(0);
    expect((addWallRecord as WallAdd).feature.colour).toBe(0);
  }

  async function testConsolidate(moveCount: number) {
    // make sure my user is set up
    const user = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(user);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    const profile = await ensureProfile(dataService, user, undefined);
    expect(profile?.name).toBe('Owner');

    // create an adventure
    const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');

    // create a map
    const m1Id = await functionsService.createMap(
      a1Id, 'Map One', 'First map', MapType.Hex, false
    );

    // Get the map record with the data service
    const m1Record = await dataService.get(dataService.getMapRef(a1Id, m1Id));
    expect(m1Record?.name).toBe('Map One');
    expect(m1Record?.adventureName).toBe('Adventure One');
    expect(m1Record?.description).toBe('First map');
    expect(m1Record?.owner).toBe(user.uid);
    expect(m1Record?.ty).toBe(MapType.Hex);
    expect(m1Record?.ffa).toBeFalsy();

    // Add a few simple changes:
    const addToken1 = createAddToken1(user.uid);
    const addWall1 = createAddWall1();

    await dataService.addChanges(a1Id, user.uid, m1Id, [addToken1]);
    for (let i = 0; i < moveCount; ++i) {
      await dataService.addChanges(a1Id, user.uid, m1Id, [createMoveToken1(i)]);
    }

    await dataService.addChanges(a1Id, user.uid, m1Id, [addWall1]);

    // Check that the changes went in successfully and we can read them back:
    let changes = await getAllMapChanges(dataService, a1Id, m1Id, 2 + moveCount);
    expect(changes).toHaveLength(2 + moveCount);

    // Call the consolidate function:
    await functionsService.consolidateMapChanges(a1Id, m1Id, false);

    // After doing that, we should have only one changes record, thus:
    await verifyBaseChangesRecord(dataService, user.uid, a1Id, m1Id, moveCount);

    // Now that I've consolidated once, I should be able to make some more changes and
    // consolidate again (which is different, because there is now a base change:)
    for (let i = moveCount; i < moveCount * 2; ++i) {
      await dataService.addChanges(a1Id, user.uid, m1Id, [createMoveToken1(i)]);
    }

    await functionsService.consolidateMapChanges(a1Id, m1Id, false);
    await verifyBaseChangesRecord(dataService, user.uid, a1Id, m1Id, moveCount * 2);
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

  // Put the long tests in their own describe blocks to avoid destabilising things by
  // running them in parallel with other stuff (the Firebase emulator is quite slow)
  describe('200-long test', () => {
    test('create a map and consolidate 200 moves', async () => {
      await testConsolidate(200);
    });
  });

  describe('600-long test', () => {
    test('create a map and consolidate 600 moves', async () => {
      await testConsolidate(600);
    });
  });

  test('join and leave an adventure', async () => {
    const owner = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(owner);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    await ensureProfile(dataService, owner, undefined);

    // Add a new adventure
    const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');

    // We should be able to add a map
    const m1Id = await functionsService.createMap(
      a1Id, 'Map One', 'First map', MapType.Square, false
    );

    // Create an invite to that adventure
    const invite = await functionsService.inviteToAdventure(a1Id);
    expect(invite).not.toBeUndefined();

    // Get myself a profile as a different user
    const user = createTestUser('User 1', 'user1@example.com', 'google.com');
    const userEmul = initializeEmul(user);
    const userDataService = new DataService(userEmul.db, firebase.firestore.FieldValue.serverTimestamp);
    const userFunctionsService = new FunctionsService(userEmul.functions);
    let userProfile = await ensureProfile(userDataService, user, undefined);

    // If I try to fetch that map without being invited I should get an error
    try {
      await userDataService.get(userDataService.getMapRef(a1Id, m1Id));
      fail("Fetched map in un-joined adventure");
    } catch {}

    // Join the adventure.
    let joinedId = await userFunctionsService.joinAdventure(invite ?? "");
    expect(joinedId).toBe(a1Id);

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

    await registerAdventureAsRecent(userDataService, user.uid, a1Id, a1Record);
    await registerMapAsRecent(userDataService, user.uid, a1Id, m1Id, m1Record);

    userProfile = await userDataService.get(userDataService.getProfileRef(user.uid));
    expect(userProfile?.adventures?.find(a => a.id === a1Id)).not.toBeUndefined();
    expect(userProfile?.latestMaps?.find(m => m.id === m1Id)).not.toBeUndefined();

    // Check I can unregister those as recent as well:
    await removeAdventureFromRecent(userDataService, user.uid, a1Id);
    await removeMapFromRecent(userDataService, user.uid, m1Id);

    userProfile = await userDataService.get(userDataService.getProfileRef(user.uid));
    expect(userProfile?.adventures?.find(a => a.id === a1Id)).toBeUndefined();
    expect(userProfile?.latestMaps?.find(m => m.id === m1Id)).toBeUndefined();

    // If I join the adventure a second time, it shouldn't barf:
    // (it should update some fields, but verifying that is fiddly, and not the
    // most important thing)
    joinedId = await userFunctionsService.joinAdventure(invite ?? "");
    expect(joinedId).toBe(a1Id);

    await registerAdventureAsRecent(userDataService, user.uid, a1Id, a1Record);
    await registerMapAsRecent(userDataService, user.uid, a1Id, m1Id, m1Record);

    userProfile = await userDataService.get(userDataService.getProfileRef(user.uid));
    expect(userProfile?.adventures?.find(a => a.id === a1Id)).not.toBeUndefined();
    expect(userProfile?.latestMaps?.find(m => m.id === m1Id)).not.toBeUndefined();

    // Leave the adventure
    await leaveAdventure(userDataService, user.uid, a1Id);

    // It should now be gone from my profile
    userProfile = await userDataService.get(userDataService.getProfileRef(user.uid));
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
    const user1 = createTestUser('User 1', 'user1@example.com', 'google.com');
    const user1Emul = initializeEmul(user1);
    const user1DataService = new DataService(user1Emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const user1FunctionsService = new FunctionsService(user1Emul.functions);
    let user1Profile = await ensureProfile(user1DataService, user1, undefined);

    // Ensure we have our default name (since we'll change it later)
    await updateProfile(user1DataService, user1.uid, 'User 1');

    // Add a new adventure and make it one of our latest
    const a1Id = await user1FunctionsService.createAdventure('Adventure OneA', 'First adventure');

    // As another user, also create an adventure
    const user2 = createTestUser('User 2', 'user2@example.com', 'google.com');
    const user2Emul = initializeEmul(user2);
    const user2DataService = new DataService(user2Emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const user2FunctionsService = new FunctionsService(user2Emul.functions);
    await ensureProfile(user2DataService, user2, undefined);

    const a2Id = await user2FunctionsService.createAdventure('Adventure TwoA', 'Second adventure');

    // ...with an invite...
    const invite = await user2FunctionsService.inviteToAdventure(a2Id);
    expect(invite).not.toBeUndefined();

    // As user 1, join user 2's adventure (which will make it recent)
    const user1Functions = new FunctionsService(user1Emul.functions);
    let joinedId = await user1Functions.joinAdventure(invite ?? "");
    expect(joinedId).toBe(a2Id);
    const a2 = await user1DataService.get(user1DataService.getAdventureRef(a2Id));

    // Now, change our display name
    await updateProfile(user1DataService, user1.uid, "New Name");

    // We should be renamed in our adventure:
    const a1Record = await user1DataService.get(user1DataService.getAdventureRef(a1Id));
    expect(a1Record?.ownerName).toBe("New Name");

    // in our player record in user 2's adventure:
    let p2Record = await user1DataService.get(user1DataService.getPlayerRef(a2Id, user1.uid));
    expect(p2Record?.name).toBe("Adventure TwoA"); // this is the adventure name
    expect(p2Record?.ownerName).toBe("User 2"); // this is the owner's name
    expect(p2Record?.playerName).toBe("New Name"); // this is our name

    // ...and in the adventure summary in our profile:
    user1Profile = await user1DataService.get(user1DataService.getProfileRef(user1.uid));
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
    if (a2 !== undefined) {
      await editAdventure(user2DataService, user2.uid,
        { id: a2Id, ...a2, name: "Renamed Adventure" }
      );
    }

    // Then, user 1 should see it has changed in their player record:
    p2Record = await user1DataService.get(user1DataService.getPlayerRef(a2Id, user1.uid));
    expect(p2Record?.name).toBe("Renamed Adventure"); // this is the adventure name
    expect(p2Record?.ownerName).toBe("User 2"); // this is the owner's name
    expect(p2Record?.playerName).toBe("New Name"); // this is our name

    // and it will rename itself in their profile if they visit it
    let a2Record = await user1DataService.get(user1DataService.getAdventureRef(a2Id));
    expect(a2Record?.name).toBe("Renamed Adventure");
    if (a2Record === undefined) return; // should have failed already
    await registerAdventureAsRecent(user1DataService, user1.uid, a2Id, { ...a2Record });

    user1Profile = await user1DataService.get(user1DataService.getProfileRef(user1.uid));
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

  test('block a user from an adventure', async () => {
    const owner = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(owner);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    await ensureProfile(dataService, owner, undefined);

    // Add a new adventure
    const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');

    // We should be able to add a map
    const m1Id = await functionsService.createMap(
      a1Id, 'Map One', 'First map', MapType.Square, false
    );

    // Create an invite to that adventure
    const invite = await functionsService.inviteToAdventure(a1Id);
    expect(invite).not.toBeUndefined();

    // Get myself a profile as a different user
    const user = createTestUser('User 1', 'user1@example.com', 'google.com');
    const userEmul = initializeEmul(user);
    const userDataService = new DataService(userEmul.db, firebase.firestore.FieldValue.serverTimestamp);
    const userFunctionsService = new FunctionsService(userEmul.functions);
    await ensureProfile(userDataService, user, undefined);

    // If I try to fetch that map without being invited I should get an error
    try {
      await userDataService.get(userDataService.getMapRef(a1Id, m1Id));
      fail("Fetched map in un-joined adventure");
    } catch {}

    // Join the adventure.
    let joinedId = await userFunctionsService.joinAdventure(invite ?? "");
    expect(joinedId).toBe(a1Id);

    // Check I can fetch that map now
    let m1Record = await userDataService.get(userDataService.getMapRef(a1Id, m1Id));
    expect(m1Record).not.toBeUndefined();
    expect(m1Record?.description).toBe("First map");

    // As the map owner I can block that player
    let playerRef = dataService.getPlayerRef(a1Id, user.uid);
    await dataService.update(playerRef, { allowed: false });

    // As the player, I can no longer see that map
    try {
      await userDataService.get(userDataService.getMapRef(a1Id, m1Id));
      fail("Fetched map when blocked");
    } catch {}

    // ...and I can't unblock myself...
    try {
      playerRef = userDataService.getPlayerRef(a1Id, user.uid);
      await userDataService.update(playerRef, { allowed: true });
      fail("Unblocked myself");
    } catch {}

    // As a blocked player, I can't leave an adventure, because that would delete
    // the record that I was blocked (and I could simply re-join)
    try {
      await leaveAdventure(userDataService, user.uid, a1Id);
      fail("Left an adventure I was blocked in")
    } catch {}

    // The owner *can* unblock me, though, and then I see it again
    playerRef = dataService.getPlayerRef(a1Id, user.uid);
    await dataService.update(playerRef, { allowed: true });

    m1Record = await userDataService.get(userDataService.getMapRef(a1Id, m1Id));
    expect(m1Record).not.toBeUndefined();
    expect(m1Record?.description).toBe("First map");
  });

  test('invites expire', async () => {
    // As the owner, create an adventure
    const owner = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(owner);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    await ensureProfile(dataService, owner, undefined);

    // Add a new adventure
    const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');

    // Create an invite to that adventure that expires after 4 seconds
    const testPolicy: Policy.IInviteExpiryPolicy = {
      timeUnit: 'second',
      recreate: 2,
      expiry: 3,
      deletion: 15
    };

    const invite = await functionsService.inviteToAdventure(a1Id, testPolicy);
    expect(invite).not.toBeUndefined();

    // If I try to re-issue it right away I should get the same invite back:
    const invite2 = await functionsService.inviteToAdventure(a1Id, testPolicy);
    expect(invite2).toBe(invite);

    // Get myself a profile as a different user
    const user = createTestUser('User 1', 'user1@example.com', 'google.com');
    const userEmul = initializeEmul(user);
    const userDataService = new DataService(userEmul.db, firebase.firestore.FieldValue.serverTimestamp);
    const userFunctionsService = new FunctionsService(userEmul.functions);
    await ensureProfile(userDataService, user, undefined);

    // Join the adventure.
    let joinedId = await userFunctionsService.joinAdventure(invite ?? "", testPolicy);
    expect(joinedId).toBe(a1Id);

    // Having done that, I can open it and see my player record in it:
    let a1Record = await userDataService.get(userDataService.getAdventureRef(a1Id));
    expect(a1Record).not.toBeUndefined();
    expect(a1Record?.description).toBe("First adventure");

    const p1Record = await userDataService.get(userDataService.getPlayerRef(a1Id, user.uid));
    expect(p1Record).not.toBeUndefined();
    expect(p1Record?.playerId).toBe(user.uid);
    expect(p1Record?.playerName).toBe('User 1');
    expect(p1Record?.description).toBe('First adventure');

    // Register another user
    const user2 = createTestUser('User 2', 'user2@example.com', 'google.com');
    const user2Emul = initializeEmul(user2);
    const user2DataService = new DataService(user2Emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const user2FunctionsService = new FunctionsService(user2Emul.functions);
    await ensureProfile(user2DataService, user2, undefined);

    // Wait long enough for that invite to have expired
    await new Promise(r => setTimeout(r, 4000));
    try {
      await user2FunctionsService.joinAdventure(invite ?? "", testPolicy);
      fail('Invite should have expired');
    } catch (e) {
      expect(e.message).toMatch(/expired/i);
    }

    // That should *not* have joined user 2:
    // (as determined by the player record; adventure records are public right now)
    let p2Record = await user2DataService.get(user2DataService.getPlayerRef(a1Id, user2.uid));
    expect(p2Record).toBeUndefined();

    // However, if I create a new invite, another user should be able to join with that:
    const invite3 = await functionsService.inviteToAdventure(a1Id, testPolicy);
    expect(invite3).not.toBe(invite);

    joinedId = await user2FunctionsService.joinAdventure(invite3 ?? "", testPolicy);
    expect(joinedId).toBe(a1Id);
    p2Record = await user2DataService.get(user2DataService.getPlayerRef(a1Id, user2.uid));
    expect(p2Record).not.toBeUndefined();
    expect(p2Record?.playerId).toBe(user2.uid);
    expect(p2Record?.playerName).toBe('User 2');
    expect(p2Record?.description).toBe('First adventure');
  }, 10000);

  // Having this in a nested describe block stops jest from parallelising it with the rest
  describe('resync', () => { test('resync on conflict', async () => {
    const user = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(user);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    let profile = await ensureProfile(dataService, user, undefined);

    // There should be no adventures in the profile now
    expect(profile?.adventures).toHaveLength(0);

    // Add a new adventure
    const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');

    // Add a new map
    const m1Id = await functionsService.createMap(
      a1Id, 'Map One', 'First map', MapType.Square, false
    );

    const mapRecord = await dataService.get(dataService.getMapRef(a1Id, m1Id));
    expect(mapRecord).not.toBeUndefined();

    // Watch changes, mocking up the handlers:
    const tokens = new Tokens(getTokenGeometry(MapType.Square), new SimpleTokenDrawing());
    const outlineTokens = new Tokens(getTokenGeometry(MapType.Square), new SimpleTokenDrawing());
    const changeTracker = new SimpleChangeTracker(
      new FeatureDictionary<GridCoord, StripedArea>(coordString),
      new FeatureDictionary<GridCoord, StripedArea>(coordString),
      tokens,
      outlineTokens,
      new FeatureDictionary<GridEdge, IFeature<GridEdge>>(edgeString),
      new FeatureDictionary<GridCoord, IAnnotation>(coordString),
      new IdDictionary<IMapImage>(),
      undefined
    );

    let changesSeen = new Subject<IChangesEvent>();
    function onNext(changes: Changes) {
      const accepted = trackChanges(mapRecord as IMap, changeTracker, changes.chs, user.uid);
      changesSeen.next({ changes: changes, accepted: accepted });
      return accepted;
    }

    let resetCount = 0;
    const onReset = jest.fn(() => {
      changeTracker.clear();
      ++resetCount;
    });
    const onEvent = jest.fn();
    const onError = jest.fn();

    // We test with a 1 second resync interval because we want to hit it a few times
    const finish = watchChangesAndConsolidate(
      dataService, functionsService, a1Id, m1Id, onNext, onReset, onEvent, onError, 1000
    );
    expect(finish).not.toBeUndefined();
    try {
      // Push in a first change and wait for it -- it should be accepted.
      const addToken1: TokenAdd = {
        ty: ChangeType.Add,
        cat: ChangeCategory.Token,
        feature: {
          position: { x: 0, y: 0 },
          colour: 0,
          id: '1',
          players: [],
          size: '1',
          text: 'ONE',
          note: '',
          noteVisibleToPlayers: false,
          characterId: "",
          sprites: [],
          outline: false
        }
      };
      const addOnePromise = changesSeen.pipe(first()).toPromise();
      await dataService.addChanges(a1Id, user.uid, m1Id, [addToken1]);
      const addOne = await addOnePromise;

      // This should be an incremental change; we don't have a base change yet
      expect(addOne.accepted).toBeTruthy();
      expect(addOne.changes.incremental).toBeTruthy();
      expect(addOne.changes.user).toBe(user.uid);
      expect(addOne.changes.chs).toHaveLength(1);
      expect(addOne.changes.chs[0].cat).toBe(ChangeCategory.Token);
      expect(onReset).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();

      // Push in another good change and make sure it's accepted
      const moveToken1: TokenMove = {
        ty: ChangeType.Move,
        cat: ChangeCategory.Token,
        tokenId: '1',
        oldPosition: { x: 0, y: 0 },
        newPosition: { x: -1, y: -2 }
      };
      const moveOnePromise = changesSeen.pipe(first()).toPromise();
      await dataService.addChanges(a1Id, user.uid, m1Id, [moveToken1]);
      const moveOne = await moveOnePromise;

      // This should also be an incremental change and be good
      expect(moveOne.accepted).toBeTruthy();
      expect(moveOne.changes.incremental).toBeTruthy();
      expect(moveOne.changes.user).toBe(user.uid);
      expect(moveOne.changes.chs).toHaveLength(1);
      expect(moveOne.changes.chs[0].cat).toBe(ChangeCategory.Token);
      expect((moveOne.changes.chs[0] as TokenMove).newPosition.x).toBe(-1);
      expect((moveOne.changes.chs[0] as TokenMove).newPosition.y).toBe(-2);
      expect(onReset).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();

      // Push in a bad change, setting ourselves up to reject it.
      // This should cause a resync
      const badMoveToken1: TokenMove = {
        ty: ChangeType.Move,
        cat: ChangeCategory.Token,
        tokenId: '1',
        oldPosition: { x: 0, y: 0 },
        newPosition: { x: 3, y: 4 }
      };
      const resyncPromise = changesSeen.pipe(filter(chs => chs.changes.resync === true), first()).toPromise();
      await dataService.addChanges(a1Id, user.uid, m1Id, [badMoveToken1]);
      const resync = await resyncPromise;

      // ...which should contain the good change not the bad, and we expect a reset to have happened
      expect(resync.accepted).toBeTruthy();
      expect(resync.changes.incremental).toBeFalsy();
      expect(resync.changes.user).toBe(user.uid);
      expect(resync.changes.chs).toHaveLength(1);
      expect(resync.changes.chs[0].cat).toBe(ChangeCategory.Token);
      expect(resync.changes.chs[0].ty).toBe(ChangeType.Add);
      expect((resync.changes.chs[0] as TokenAdd).feature.position.x).toBe(-1);
      expect((resync.changes.chs[0] as TokenAdd).feature.position.y).toBe(-2);
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();

      // Wait a couple of seconds; that should be enough for anything else to flush through
      await new Promise(r => setTimeout(r, 3000));

      // To exercise throttling behaviour, I'll now iterate over (bad change, bad change,
      // good change) a few times in quick succession -- we should avoid doing a resync
      // every time!
      const badMoveToken2 = { ...badMoveToken1, tokenId: '2' };
      const badMoveToken3 = { ...badMoveToken1, tokenId: '3' };
      for (let i = 0; i < 5; ++i) {
        const moveTokenAgain: TokenMove = {
          ty: ChangeType.Move,
          cat: ChangeCategory.Token,
          tokenId: '1',
          oldPosition: { x: -1, y: -2 + i },
          newPosition: { x: -1, y: -2 + i + 1 }
        };

        // We can expect that good move in either an incremental change or a resync, so
        // we'll inspect the token dictionary instead (easier)
        const movedAgainPromise = changesSeen.pipe(filter(chs => {
          if (!chs.accepted) {
            return false;
          }
          return tokens.get({ x: -1, y: -2 + i + 1 })?.id === '1';
        }), first()).toPromise();

        // Upon the first iteration we'll wait for that resync to fire as well
        const resyncAgainPromise = i === 0 ?
          changesSeen.pipe(filter(chs => chs.changes.resync === true), first()).toPromise() :
          undefined;

        await dataService.addChanges(a1Id, user.uid, m1Id, [badMoveToken2]);
        await dataService.addChanges(a1Id, user.uid, m1Id, [badMoveToken3]);
        await dataService.addChanges(a1Id, user.uid, m1Id, [moveTokenAgain]);

        const movedAgain = await movedAgainPromise;
        expect(movedAgain.accepted).toBeTruthy();

        if (resyncAgainPromise !== undefined) {
          const resyncAgain = await resyncAgainPromise;
          expect(resyncAgain.accepted).toBeTruthy();
        }
      }

      // Wait a couple of seconds; that should be enough for anything else to flush through
      await new Promise(r => setTimeout(r, 3000));

      // We should have only received or two more resets, and not another five, and
      // no actual errors
      const resetCountAfterIteration = resetCount;
      expect(resetCountAfterIteration).toBeLessThanOrEqual(4);
      expect(onError).not.toHaveBeenCalled();
    } finally {
      finish?.();
    }
  }, 10000); });

  test('clone a map', async () => {
    const moveCount = 5;

    // make sure my user is set up
    const user = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(user);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    const profile = await ensureProfile(dataService, user, undefined);
    expect(profile?.name).toBe('Owner');

    // create an adventure
    const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');

    // create a map
    const m1Id = await functionsService.createMap(
      a1Id, 'Map One', 'First map', MapType.Hex, false
    );

    // Clone the map.
    const m2Id = await functionsService.cloneMap(
      a1Id, m1Id, "Clone of Map One", "First map cloned"
    );

    // Open the map records and check they match
    const m1Record = await dataService.get(dataService.getMapRef(a1Id, m1Id));
    const m2Record = await dataService.get(dataService.getMapRef(a1Id, m2Id));
    expect(m1Record?.name).toBe("Map One");
    expect(m1Record?.description).toBe("First map");

    expect(m2Record?.name).toBe("Clone of Map One");
    expect(m2Record?.description).toBe("First map cloned");

    expect(m1Record?.adventureName).toBe(m2Record?.adventureName);
    expect(m1Record?.ty).toBe(m2Record?.ty);
    expect(m1Record?.ffa).toBe(m2Record?.ffa);

    // Add a few simple changes to map 1:
    // (These are copied from the consolidate test)
    const addToken1 = createAddToken1(user.uid);
    const addWall1 = createAddWall1();

    await dataService.addChanges(a1Id, user.uid, m1Id, [addToken1]);
    for (let i = 0; i < moveCount; ++i) {
      await dataService.addChanges(a1Id, user.uid, m1Id, [createMoveToken1(i)]);
    }

    await dataService.addChanges(a1Id, user.uid, m1Id, [addWall1]);

    // Check that the changes went in successfully and we can read them back:
    let changes = await getAllMapChanges(dataService, a1Id, m1Id, 2 + moveCount);
    expect(changes).toHaveLength(2 + moveCount);

    // Clone map 1 again:
    const m3Id = await functionsService.cloneMap(
      a1Id, m1Id, "Second clone", "First map cloned with changes"
    );

    // Check the clone is okay
    const m3Record = await dataService.get(dataService.getMapRef(a1Id, m3Id));
    expect(m3Record?.name).toBe("Second clone");
    expect(m3Record?.description).toBe("First map cloned with changes");
    expect(m3Record?.owner).toBe(user.uid);
    expect(m3Record?.adventureName).toBe(m1Record?.adventureName);
    expect(m3Record?.ty).toBe(m1Record?.ty);
    expect(m3Record?.ffa).toBe(m1Record?.ffa);

    // Both map 1 and map 3 should have the same consolidated changes now
    await verifyBaseChangesRecord(dataService, user.uid, a1Id, m1Id, moveCount);
    await verifyBaseChangesRecord(dataService, user.uid, a1Id, m3Id, moveCount);

    // Map 2 should have no changes, because it was cloned before any were made
    const converter = createChangesConverter();
    const m2BaseChange = await dataService.get(dataService.getMapBaseChangeRef(a1Id, m2Id, converter));
    expect(m2BaseChange).toBeUndefined();

    const m2IncrementalChanges = await dataService.getMapIncrementalChangesRefs(a1Id, m2Id, 500, converter);
    if (m2IncrementalChanges !== undefined) {
      expect(m2IncrementalChanges).toHaveLength(0);
    }
  });

  async function createAndDeleteCharacters(dataService: IDataService, adventureId: string, uid: string) {
    const [c1Id, c2Id] = [uuidv4(), uuidv4()];
    await editCharacter(dataService, adventureId, uid, {
      id: c1Id,
      name: "One",
      text: "ONE",
      sprites: []
    });

    await editCharacter(dataService, adventureId, uid, {
      id: c2Id,
      name: "Two",
      text: "TWO",
      sprites: []
    });

    // They should appear in the player record
    let player = await dataService.get(dataService.getPlayerRef(adventureId, uid));
    if (player?.characters === undefined) {
      fail('No character list');
    }

    expect(player.characters.length).toBe(2);

    let c1 = player.characters.find(c => c.id === c1Id);
    expect(c1).not.toBeUndefined();
    if (c1 !== undefined) {
      expect(c1.name).toBe("One");
      expect(c1.text).toBe("ONE");
    }

    let c2 = player.characters.find(c => c.id === c2Id);
    expect(c2).not.toBeUndefined();
    if (c2 !== undefined) {
      expect(c2.name).toBe("Two");
      expect(c2.text).toBe("TWO");
    }

    // Edit one
    await editCharacter(dataService, adventureId, uid, {
      id: c2Id,
      name: "Two (edited)",
      text: "TW2",
      sprites: []
    });

    // Fetch and observe changes
    player = await dataService.get(dataService.getPlayerRef(adventureId, uid));
    if (player?.characters === undefined) {
      fail('No character list');
    }

    expect(player.characters.length).toBe(2);

    c1 = player.characters.find(c => c.id === c1Id);
    expect(c1).not.toBeUndefined();
    if (c1 !== undefined) {
      expect(c1.name).toBe("One");
      expect(c1.text).toBe("ONE");
    }

    c2 = player.characters.find(c => c.id === c2Id);
    expect(c2).not.toBeUndefined();
    if (c2 !== undefined) {
      expect(c2.name).toBe("Two (edited)");
      expect(c2.text).toBe("TW2");
    }

    // Delete one
    await deleteCharacter(dataService, adventureId, uid, c1Id);

    // Fetch and observe changes
    player = await dataService.get(dataService.getPlayerRef(adventureId, uid));
    if (player?.characters === undefined) {
      fail('No character list');
    }

    expect(player.characters.length).toBe(1);

    c2 = player.characters.find(c => c.id === c2Id);
    expect(c2).not.toBeUndefined();
    if (c2 !== undefined) {
      expect(c2.name).toBe("Two (edited)");
      expect(c2.text).toBe("TW2");
    }
  }

  test('create and delete characters as the map owner', async () => {
    // make sure my user is set up
    const user = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(user);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    const profile = await ensureProfile(dataService, user, undefined);
    expect(profile?.name).toBe('Owner');

    // create an adventure
    const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');

    // Exercise character functions
    await createAndDeleteCharacters(dataService, a1Id, user.uid);
  });

  test('create and delete characters as a joining player', async () => {
    // make sure my user is set up
    const owner = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(owner);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    const profile = await ensureProfile(dataService, owner, undefined);
    expect(profile?.name).toBe('Owner');

    // create an adventure
    const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');

    // Get myself a profile as a different user
    const user = createTestUser('User 1', 'user1@example.com', 'google.com');
    const userEmul = initializeEmul(user);
    const userDataService = new DataService(userEmul.db, firebase.firestore.FieldValue.serverTimestamp);
    const userFunctionsService = new FunctionsService(userEmul.functions);
    await ensureProfile(userDataService, user, undefined);

    // Issue an invite to that adventure
    const invite = await functionsService.inviteToAdventure(a1Id, Policy.defaultInviteExpiryPolicy);
    expect(invite).not.toBeUndefined();

    // Join the adventure.
    await userFunctionsService.joinAdventure(invite ?? "");

    // Exercise character functions
    await createAndDeleteCharacters(userDataService, a1Id, user.uid);
  });

  // I expect this will be a bit heavy too
  describe('test images', () => {
    const storageLocation = 'http://mock-storage';
    const testImages = [
      './test-images/st01.png',
      './test-images/st02.png',
      './test-images/st03.png',
      './test-images/st04.png',
      './test-images/st05.png',
      './test-images/st06.png',
      './test-images/st07.png',
      './test-images/st08.png',
      './test-images/st09.png',
      './test-images/st10.png',
      './test-images/st11.png',
      './test-images/st12.png',
      './test-images/st13.png',
      './test-images/st14.png',
      './test-images/st15.png',
      './test-images/st16.png',
    ];

    function downloadImage(url: string): Promise<Buffer> {
      return new Promise((resolve, reject) => {
        http.get(url, res => {
          res.setEncoding('binary');
          const array: Uint8Array[] = [];
          res.on('data', data => {
            array.push(Buffer.from(data, 'binary'));
          }).on('end', () => {
            resolve(Buffer.concat(array));
          }).on('error', err => {
            reject(err);
          });
        });
      })
    }

    test('add and delete one image', async () => {
      const owner = createTestUser('Owner', 'owner@example.com', 'google.com');
      const emul = initializeEmul(owner);
      const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
      const functionsService = new FunctionsService(emul.functions);
      const storage = new MockWebStorage(functionsService, storageLocation);

      // Make sure the user has a profile
      await ensureProfile(dataService, owner, undefined);

      // Add a new adventure
      const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');
      let a1 = await dataService.get(dataService.getAdventureRef(a1Id));
      expect(a1).not.toBeUndefined();
      expect(a1?.imagePath).toBe("");

      // Upload an image for it
      const buffer = fs.readFileSync(testImages[0]);
      const path = `images/${owner.uid}/one`;
      await storage.ref(path).put(buffer, { customMetadata: { originalName: 'st01.png' } });

      // I should now find it has an images entry:
      const imagesRef = dataService.getImagesRef(owner.uid);
      const images = await dataService.get(imagesRef);
      expect(images?.images).toHaveLength(1);
      expect(images?.images[0].name).toBe('st01.png');
      expect(images?.images[0].path).toBe(path);

      // Attach that image to the adventure
      if (a1 !== undefined) {
        await editAdventure(dataService, owner.uid, { id: a1Id, ...a1, imagePath: path });
      }

      // The image should appear in the adventure and profile records now
      a1 = await dataService.get(dataService.getAdventureRef(a1Id));
      expect(a1?.imagePath).toBe(path);

      let profile = await dataService.get(dataService.getProfileRef(owner.uid));
      expect(profile?.adventures).toHaveLength(1);
      expect(profile?.adventures?.[0].name).toBe(a1?.name);
      expect(profile?.adventures?.[0].imagePath).toBe(path);

      // I should be able to download it via the URL
      const url = await storage.ref(path).getDownloadURL();
      const downloaded = await downloadImage(url);
      expect(downloaded.compare(buffer)).toBe(0);

      // If I delete it, it should correctly disappear from the adventure
      await functionsService.deleteImage(path);

      a1 = await dataService.get(dataService.getAdventureRef(a1Id));
      expect(a1?.imagePath).toBe("");
    });

    test('attach an image to multiple adventures and maps', async () => {
      const owner = createTestUser('Owner', 'owner@example.com', 'google.com');
      const emul = initializeEmul(owner);
      const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
      const functionsService = new FunctionsService(emul.functions);
      const storage = new MockWebStorage(functionsService, storageLocation);

      // Make sure the user has a profile
      await ensureProfile(dataService, owner, undefined);

      // Set up this arrangement of adventure, map, image
      //
      // Adventure   Image
      // -----------------
      // A1          st01
      // A2          st02
      // A3          st01
      //
      // Adventure   Map   Image
      // -----------------------
      // A1          M11   st02
      // A1          M12   st01
      // A2          M21   st01
      // A2          M22   st01

      const a1Id = await functionsService.createAdventure('A1', 'First adventure');
      const a2Id = await functionsService.createAdventure('A2', 'Second adventure');
      const a3Id = await functionsService.createAdventure('A3', 'Third adventure');

      const m11Id = await functionsService.createMap(a1Id, 'M11', 'Map 11', MapType.Square, false);
      const m12Id = await functionsService.createMap(a1Id, 'M12', 'Map 12', MapType.Square, false);
      const m21Id = await functionsService.createMap(a2Id, 'M21', 'Map 21', MapType.Square, false);
      const m22Id = await functionsService.createMap(a2Id, 'M22', 'Map 22', MapType.Square, false);

      // Upload both images
      const buffer01 = fs.readFileSync(testImages[0]);
      const path01 = `images/${owner.uid}/one`;
      await storage.ref(path01).put(buffer01, { customMetadata: { originalName: 'st01.png' } });

      const buffer02 = fs.readFileSync(testImages[1]);
      const path02 = `images/${owner.uid}/two`;
      await storage.ref(path02).put(buffer02, { customMetadata: { originalName: 'st02.png' } });

      // Sanity check
      const [d01, d02] = await Promise.all([path01, path02].map(async p => {
        const url = await storage.ref(p).getDownloadURL();
        return await downloadImage(url);
      }));

      expect(d01.compare(buffer01)).toBe(0);
      expect(d02.compare(buffer02)).toBe(0);
      expect(d01.compare(d02)).not.toBe(0);

      // Visit the adventures and edit them into that arrangement
      const adventures = await Promise.all([a1Id, a2Id, a3Id].map(async id => {
        const record = await dataService.get(dataService.getAdventureRef(id));
        if (record === undefined) {
          throw Error("Couldn't load adventure " + id);
        } else {
          await registerAdventureAsRecent(dataService, owner.uid, id, record);
          return record;
        }
      }));

      const mapRefs = [
        dataService.getMapRef(a1Id, m11Id),
        dataService.getMapRef(a1Id, m12Id),
        dataService.getMapRef(a2Id, m21Id),
        dataService.getMapRef(a2Id, m22Id)
      ];
      const maps = await Promise.all(mapRefs.map(async r => {
        const record = await dataService.get(r);
        const adventureRef = r.getParent();
        if (record === undefined || adventureRef === undefined) {
          throw Error("Couldn't load map " + r.id);
        } else {
          await registerMapAsRecent(dataService, owner.uid, adventureRef.id, r.id, record);
          return record;
        }
      }));

      // Edit in the images
      await editAdventure(dataService, owner.uid, {
        id: a1Id, ...adventures[0], imagePath: path01
      });
      await editAdventure(dataService, owner.uid, {
        id: a2Id, ...adventures[1], imagePath: path02
      });
      await editAdventure(dataService, owner.uid, {
        id: a3Id, ...adventures[2], imagePath: path01
      });

      await editMap(dataService, a1Id, m11Id, { ...maps[0], imagePath: path02 });
      await editMap(dataService, a1Id, m12Id, { ...maps[1], imagePath: path01 });
      await editMap(dataService, a2Id, m21Id, { ...maps[2], imagePath: path01 });
      await editMap(dataService, a2Id, m22Id, { ...maps[3], imagePath: path02 });

      // Delete image 1
      await functionsService.deleteImage(path01);

      // Now if I visit the adventures and maps again, the ones with `path02` should
      // still have it, and the ones with `path01` should have their image path reset
      const adventures2 = await Promise.all([a1Id, a2Id, a3Id].map(
        id => dataService.get(dataService.getAdventureRef(id))
      ));

      expect(adventures2[0]?.imagePath).toBe("");
      expect(adventures2[1]?.imagePath).toBe(path02);
      expect(adventures2[2]?.imagePath).toBe("");

      const maps2 = await Promise.all(mapRefs.map(r => dataService.get(r)));
      expect(maps2[0]?.imagePath).toBe(path02);
      expect(maps2[1]?.imagePath).toBe("");
      expect(maps2[2]?.imagePath).toBe("");
      expect(maps2[3]?.imagePath).toBe(path02);
    });

    test('create a sprite', async () => {
      const owner = createTestUser('Owner', 'owner@example.com', 'google.com');
      const emul = initializeEmul(owner);
      const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
      const functionsService = new FunctionsService(emul.functions);
      const storage = new MockWebStorage(functionsService, storageLocation);

      // Make sure the user has a profile
      await ensureProfile(dataService, owner, undefined);

      // Add a new adventure
      const a1Id = await functionsService.createAdventure('Adventure One', 'First adventure');
      let a1 = await dataService.get(dataService.getAdventureRef(a1Id));
      expect(a1).not.toBeUndefined();
      expect(a1?.imagePath).toBe("");

      // Upload an image for it
      const buffer = fs.readFileSync(testImages[0]);
      const path = `images/${owner.uid}/one`;
      await storage.ref(path).put(buffer, { customMetadata: { originalName: 'st01.png' } });

      // Create a sprite of that image
      const sprite = await functionsService.addSprites(a1Id, "4x4", [path]);
      expect(sprite).toHaveLength(1);
      expect(sprite[0].source).toBe(path);
      expect(sprite[0].geometry).toBe("4x4");

      // A spritesheet should have appeared
      let spritesheets = await dataService.getSpritesheetsBySource(a1Id, "4x4", [path]);
      expect(spritesheets).toHaveLength(1);
      expect(spritesheets?.[0].data.sprites).toHaveLength(1);
      expect(spritesheets?.[0].data.sprites).toContain(path);
      expect(spritesheets?.[0].data.geometry).toBe("4x4");
      expect(spritesheets?.[0].data.freeSpaces).toBe(15);

      // Upload another image
      const buffer2 = fs.readFileSync(testImages[1]);
      const path2 = `images/${owner.uid}/two`;
      await storage.ref(path2).put(buffer2, { customMetadata: { originalName: 'st02.png' } });

      // Create a sprite of it
      // `addSprites` may return other sprites that it moved to a new spritesheet while
      // doing this.
      const sprite2 = await functionsService.addSprites(a1Id, "4x4", [path2]);
      const sr2 = sprite2.find(r => r.source === path2);
      expect(sr2).not.toBeUndefined();
      expect(sr2?.geometry).toBe("4x4");

      // That image should have gone into a new spritesheet replacing the old one, because it
      // had free space
      spritesheets = await dataService.getSpritesheetsBySource(a1Id, "4x4", [path, path2]);
      expect(spritesheets).toHaveLength(1);
      expect(spritesheets?.[0].data.sprites).toHaveLength(2);
      expect(spritesheets?.[0].data.sprites).toContain(path);
      expect(spritesheets?.[0].data.sprites).toContain(path2);
      expect(spritesheets?.[0].data.geometry).toBe("4x4");
      expect(spritesheets?.[0].data.freeSpaces).toBe(14);

      // TODO #149 Plenty more to test here.  Filling the sheet so it starts another;
      // deleting images and having their spaces re-used.
    });
  });
});