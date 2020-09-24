import { DataService } from './dataService';
import { editAdventure, editMap, ensureProfile, getAllMapChanges, leaveAdventure, registerAdventureAsRecent, registerMapAsRecent, removeAdventureFromRecent, removeMapFromRecent, updateProfile, watchChangesAndConsolidate } from './extensions';
import { FunctionsService } from './functions';
import { IUser } from './interfaces';
import { IAnnotation } from '../data/annotation';
import { ChangeCategory, ChangeType, IChanges, ITokenAdd, ITokenMove, IWallAdd } from '../data/change';
import { SimpleChangeTracker, trackChanges } from '../data/changeTracking';
import { coordString, edgeString, IGridCoord, IGridEdge } from '../data/coord';
import { FeatureDictionary, IFeature, IToken } from '../data/feature';
import { IMap, MapType } from '../data/map';
import * as Policy from '../data/policy';

import * as firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/functions';

import { initializeTestApp } from '@firebase/rules-unit-testing';
import { Subject } from 'rxjs';
import { filter, first } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

export function createTestUser(
  displayName: string | null,
  email: string | null,
  providerId: string,
  emailVerified?: boolean | undefined,
): IUser {
  return {
    displayName: displayName,
    email: email,
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
  changes: IChanges;
  accepted: boolean;
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
    // make sure my user is set up
    const user = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(user);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    const profile = await ensureProfile(dataService, user, undefined);
    expect(profile?.name).toBe('Owner');

    // create an adventure
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure One',
      description: 'First adventure',
      owner: user.uid,
      ownerName: 'Owner',
    };
    await editAdventure(dataService, user.uid, true, { id: a1Id, ...a1 }, { maps: [], ...a1 });

    // create a map
    const m1Id = uuidv4();
    const m1 = {
      adventureName: 'this will be overwritten',
      name: 'Map One',
      description: 'First map',
      owner: user.uid,
      ty: MapType.Hex,
      ffa: false
    };
    await editMap(dataService, a1Id, m1Id, m1);

    // Get the map record with the data service
    const m1Record = await dataService.get(dataService.getMapRef(a1Id, m1Id));
    expect(m1Record?.name).toBe('Map One');
    expect(m1Record?.adventureName).toBe('Adventure One');
    expect(m1Record?.description).toBe('First map');
    expect(m1Record?.owner).toBe(user.uid);
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
        players: [user.uid],
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
    async function verifyBaseChangesRecord(expectedX: number) {
      let changes = await getAllMapChanges(dataService, a1Id, m1Id, 499);
      expect(changes).toHaveLength(1);
      expect(changes?.[0].user).toBe(user.uid);

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
      await dataService.addChanges(a1Id, user.uid, m1Id, [createMoveToken1(i)]);
    }

    await functionsService.consolidateMapChanges(a1Id, m1Id, false);
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
    const owner = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(owner);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    await ensureProfile(dataService, owner, undefined);

    // Add a new adventure
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure One',
      description: 'First adventure',
      owner: owner.uid,
      ownerName: 'Owner',
    };
    await editAdventure(dataService, owner.uid, true, { id: a1Id, ...a1 }, { maps: [], ...a1 });

    // We should be able to add a map
    const m1Id = uuidv4();
    const m1 = {
      adventureName: 'this will be overwritten',
      name: 'Map One',
      description: 'First map',
      owner: owner.uid,
      ty: MapType.Square,
      ffa: false
    };
    await editMap(dataService, a1Id, m1Id, m1);

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
    await userFunctionsService.joinAdventure(a1Id, invite ?? "");

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
    let user1Profile = await ensureProfile(user1DataService, user1, undefined);

    // Ensure we have our default name (since we'll change it later)
    await updateProfile(user1DataService, user1.uid, 'User 1');

    // Add a new adventure and make it one of our latest
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure OneA',
      description: 'First adventure',
      owner: user1.uid,
      ownerName: 'User 1',
    };
    await editAdventure(user1DataService, user1.uid, true, { id: a1Id, ...a1 }, { maps: [], ...a1 });
    await registerAdventureAsRecent(user1DataService, user1.uid, a1Id, { maps: [], ...a1 });

    // As another user, also create an adventure
    const user2 = createTestUser('User 2', 'user2@example.com', 'google.com');
    const user2Emul = initializeEmul(user2);
    const user2DataService = new DataService(user2Emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const user2FunctionsService = new FunctionsService(user2Emul.functions);
    await ensureProfile(user2DataService, user2, undefined);

    // Add a new adventure
    const a2Id = uuidv4();
    const a2 = {
      name: 'Adventure TwoA',
      description: 'Second adventure',
      owner: user2.uid,
      ownerName: 'User 2',
    };
    await editAdventure(user2DataService, user2.uid, true, { id: a2Id, ...a2 }, { maps: [], ...a2 });

    // ...with an invite...
    const invite = await user2FunctionsService.inviteToAdventure(a2Id);
    expect(invite).not.toBeUndefined();

    // As user 1, join user 2's adventure and add that as one of our recent adventures too
    const user1Functions = new FunctionsService(user1Emul.functions);
    await user1Functions.joinAdventure(a2Id, invite ?? "");
    await registerAdventureAsRecent(user1DataService, user1.uid, a2Id, { maps: [], ...a2 });

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
    await editAdventure(user2DataService, user2.uid, false,
      { id: a2Id, ...a2, name: "Renamed Adventure" },
      { ...a2, maps: [], name: "Renamed Adventure"}
    );

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

  test('invites expire', async () => {
    // As the owner, create an adventure
    const owner = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(owner);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    await ensureProfile(dataService, owner, undefined);

    // Add a new adventure
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure One',
      description: 'First adventure',
      owner: owner.uid,
      ownerName: 'Owner',
    };
    await editAdventure(dataService, owner.uid, true, { id: a1Id, ...a1 }, { maps: [], ...a1 });

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
    await userFunctionsService.joinAdventure(a1Id, invite ?? "", testPolicy);

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
      await user2FunctionsService.joinAdventure(a1Id, invite ?? "", testPolicy);
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

    await user2FunctionsService.joinAdventure(a1Id, invite3 ?? "", testPolicy);
    p2Record = await user2DataService.get(user2DataService.getPlayerRef(a1Id, user2.uid));
    expect(p2Record).not.toBeUndefined();
    expect(p2Record?.playerId).toBe(user2.uid);
    expect(p2Record?.playerName).toBe('User 2');
    expect(p2Record?.description).toBe('First adventure');
  }, 10000);

  test('resync on conflict', async () => {
    const user = createTestUser('Owner', 'owner@example.com', 'google.com');
    const emul = initializeEmul(user);
    const dataService = new DataService(emul.db, firebase.firestore.FieldValue.serverTimestamp);
    const functionsService = new FunctionsService(emul.functions);
    let profile = await ensureProfile(dataService, user, undefined);

    // There should be no adventures in the profile now
    expect(profile?.adventures).toHaveLength(0);

    // Add a new adventure
    const a1Id = uuidv4();
    const a1 = {
      name: 'Adventure One',
      description: 'First adventure',
      owner: user.uid,
      ownerName: 'Owner',
    };
    await editAdventure(dataService, user.uid, true, { id: a1Id, ...a1 }, { maps: [], ...a1 });

    // Add a new map
    const m1Id = uuidv4();
    const m1 = {
      adventureName: 'this will be overwritten',
      name: 'Map One',
      description: 'First map',
      owner: user.uid,
      ty: MapType.Square,
      ffa: false
    };
    await editMap(dataService, a1Id, m1Id, m1);
    const mapRecord = await dataService.get(dataService.getMapRef(a1Id, m1Id));
    expect(mapRecord).not.toBeUndefined();

    // Watch changes, mocking up the handlers:
    const tokens = new FeatureDictionary<IGridCoord, IToken>(coordString);
    const changeTracker = new SimpleChangeTracker(
      new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),
      tokens,
      new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString),
      new FeatureDictionary<IGridCoord, IAnnotation>(coordString)
    );

    let changesSeen = new Subject<IChangesEvent>();
    function onNext(changes: IChanges) {
      const accepted = trackChanges(mapRecord as IMap, changeTracker, changes.chs, user.uid);
      changesSeen.next({ changes: changes, accepted: accepted });
      return accepted;
    }

    let resetCount = 0;
    const onReset = jest.fn(() => {
      changeTracker.clear();
      ++resetCount;
    });
    const onError = jest.fn();

    // We test with a 1 second resync interval because we want to hit it a few times
    const finish = watchChangesAndConsolidate(
      dataService, functionsService, a1Id, m1Id, onNext, onReset, onError, 1000
    );
    expect(finish).not.toBeUndefined();
    try {
      // Push in a first change and wait for it -- it should be accepted.
      const addToken1: ITokenAdd = {
        ty: ChangeType.Add,
        cat: ChangeCategory.Token,
        feature: {
          position: { x: 0, y: 0 },
          colour: 0,
          id: '1',
          players: [],
          text: 'ONE',
          note: '',
          noteVisibleToPlayers: false
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
      const moveToken1: ITokenMove = {
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
      expect((moveOne.changes.chs[0] as ITokenMove).newPosition.x).toBe(-1);
      expect((moveOne.changes.chs[0] as ITokenMove).newPosition.y).toBe(-2);
      expect(onReset).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();

      // Push in a bad change, setting ourselves up to reject it.
      // This should cause a resync
      const badMoveToken1: ITokenMove = {
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
      expect((resync.changes.chs[0] as ITokenAdd).feature.position.x).toBe(-1);
      expect((resync.changes.chs[0] as ITokenAdd).feature.position.y).toBe(-2);
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();

      // Wait a couple of seconds; that should be enough for anything else to flush through
      await new Promise(r => setTimeout(r, 2000));

      // To exercise throttling behaviour, I'll now iterate over (bad change, bad change,
      // good change) a few times in quick succession -- we should avoid doing a resync
      // every time!
      const badMoveToken2 = { ...badMoveToken1, tokenId: '2' };
      const badMoveToken3 = { ...badMoveToken1, tokenId: '3' };
      for (let i = 0; i < 5; ++i) {
        const moveTokenAgain: ITokenMove = {
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
      await new Promise(r => setTimeout(r, 2000));

      // We should have only received or two more resets, and not another five, and
      // no actual errors
      const resetCountAfterIteration = resetCount;
      expect(resetCountAfterIteration).toBeLessThanOrEqual(3);
      expect(onError).not.toHaveBeenCalled();
    } finally {
      finish?.();
    }
  }, 10000);
});