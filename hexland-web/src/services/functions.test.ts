import * as Convert from './converter';
import { DataService } from './dataService';
import { editAdventure, editMap, ensureProfile } from './extensions';
import { IUser } from './interfaces';
import { ChangeCategory, ChangeType, IChanges, ITokenAdd, ITokenMove, IWallAdd } from '../data/change';
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

  function initializeEmul(auth: IUser) {
    if (auth.uid in emul) {
      return emul[auth.uid];
    }

    const e = initializeTestApp({
      projectId: projectId,
      auth: auth
    });

    const db = e.firestore();
    const functions = e.functions(region);
    emul[auth.uid] = { app: e, db: db, functions: functions };
    return e;
  }

  beforeAll(() => {
    initializeEmul({
      displayName: 'Owner',
      email: 'owner@example.com',
      providerId: 'google.com',
      uid: 'owner'
    });
  });

  afterAll(async () => {
    const toDelete: string[] = [];
    for (var uid in emul) {
      toDelete.push(uid);
    }

    for (var uid of toDelete) {
      await emul[uid].app.delete();
      delete emul[uid];
    }

    // Erk!  We *mustn't* do this, or the emulator goes "stale" and
    // stops responding.  Hopefully, it will clean up properly on restart.
    // await clearFirestoreData({ projectId: projectId });
  });

  test('invoke hello world function', async () => {
    // TODO #64 Remove this when some "real" functions are working :)
    const functions = emul['owner'].functions;
    functions.useFunctionsEmulator('http://localhost:5001');
    const hello = functions.httpsCallable('helloWorld');
    const result = await hello();
    expect(result.data).toBe('Hello from Firebase!');
  });

  test('create a map and consolidate some simple changes', async () => {
    const functions = emul['owner'].functions;
    functions.useFunctionsEmulator('http://localhost:5001');

    // make sure my user is set up
    const db = emul['owner'].db;
    const dataService = new DataService(db, firebase.firestore.FieldValue.serverTimestamp);
    const profile = await ensureProfile(dataService, {
      displayName: 'Owner',
      email: 'owner@example.com',
      providerId: 'google.com',
      uid: 'owner'
    }, undefined);
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

    // Get the map record with the function.  It should be the same.
    // TODO #64 remove this when I'm happy.
    const getMap = functions.httpsCallable('getMap');
    const getMapResult = await getMap({ adventureId: a1Id, mapId: m1Id });
    const m1Returned = Convert.mapConverter.convert(getMapResult.data);
    expect(m1Returned?.name).toBe('Map One');
    expect(m1Returned?.adventureName).toBe('Adventure One');
    expect(m1Returned?.description).toBe('First map');
    expect(m1Returned?.owner).toBe('owner');
    expect(m1Returned?.ty).toBe(MapType.Hex);
    expect(m1Returned?.ffa).toBeFalsy();

    // Add a few simple changes:
    const addToken1: ITokenAdd = {
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: {
        position: { x: 0, y: 0 },
        colour: 1,
        id: 'token1',
        players: ['owner'],
        text: 'ONE',
        note: 'token one',
        noteVisibleToPlayers: true
      }
    };

    const moveToken1: ITokenMove = {
      ty: ChangeType.Move,
      cat: ChangeCategory.Token,
      tokenId: 'token1',
      oldPosition: { x: 0, y: 0 },
      newPosition: { x: 2, y: 1 }
    }; // should merge with `addToken1` on consolidate

    const addWall1: IWallAdd = {
      ty: ChangeType.Add,
      cat: ChangeCategory.Wall,
      feature: {
        position: { x: 0, y: 0, edge: 0 },
        colour: 0
      }
    };

    await dataService.addChanges(a1Id, 'owner', m1Id, [addToken1]);
    await dataService.addChanges(a1Id, 'owner', m1Id, [moveToken1]);
    await dataService.addChanges(a1Id, 'owner', m1Id, [addWall1]);

    // Check that the changes went in successfully and we can read them back:
    var refs = await dataService.getMapChangesRefs(a1Id, m1Id);
    expect(refs).toHaveLength(3);

    // Call the consolidate function:
    const consolidateMapChanges = functions.httpsCallable('consolidateMapChanges');
    const consolidateResult = await consolidateMapChanges({ adventureId: a1Id, mapId: m1Id });
    expect(consolidateResult).toBeTruthy();

    // After doing that, we should have only one changes record, thus:
    refs = await dataService.getMapChangesRefs(a1Id, m1Id);
    expect(refs).toHaveLength(1);
    expect(refs?.[0].data.user).toBe('owner');

    // with just an add token and an add wall:
    expect(refs?.[0].data.chs).toHaveLength(2);

    const addTokenRecord = refs?.[0].data.chs.find(ch => ch.cat === ChangeCategory.Token);
    expect(addTokenRecord?.ty).toBe(ChangeType.Add);
    expect((addTokenRecord as ITokenAdd).feature.id).toBe('token1');
    expect((addTokenRecord as ITokenAdd).feature.position.x).toBe(2);
    expect((addTokenRecord as ITokenAdd).feature.position.y).toBe(1);

    const addWallRecord = refs?.[0].data.chs.find(ch => ch.cat === ChangeCategory.Wall);
    expect(addWallRecord?.ty).toBe(ChangeType.Add);
    expect((addWallRecord as IWallAdd).feature.position.x).toBe(0);
    expect((addWallRecord as IWallAdd).feature.position.y).toBe(0);
    expect((addWallRecord as IWallAdd).feature.colour).toBe(0);
  });
});