import { IUser } from './interfaces';

import * as firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/functions';

import { clearFirestoreData, initializeTestApp } from '@firebase/rules-unit-testing';

describe('test functions', () => {
  // We must use a fixed project ID here, it seems
  const projectId = 'hexland-test';
  const region = 'europe-west2';
  const emul: { [uid: string]: firebase.app.App } = {};

  function initializeEmul(auth: IUser) {
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
      await emul[uid].delete();
      delete emul[uid];
    }

    await clearFirestoreData({ projectId: projectId });
  });

  test('invoke hello world function', async () => {
    // TODO #64 Remove this when some "real" functions are working :)
    const functions = emul['owner'].functions(region);
    functions.useFunctionsEmulator('http://localhost:5001');
    const hello = functions.httpsCallable('helloWorld');
    const result = await hello();
    expect(result.data).toBe('Hello from Firebase!');
  });
});