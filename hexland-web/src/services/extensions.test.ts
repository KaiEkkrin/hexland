import { DataService } from './dataService';
import { ensureProfile } from './extensions';
import { IUser } from './interfaces';

import firebase from 'firebase/app';
import 'firebase/firestore';

import { clearFirestoreData, initializeTestApp } from '@firebase/rules-unit-testing';

import { v4 as uuidv4 } from 'uuid';
import fluent from 'fluent-iterable';
import md5 from 'crypto-js/md5';

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
    const user = createTestUser('Owner', 'owner@example.com', 'google.com');
    const db = initializeEmul(user).firestore();
    const dataService = new DataService(db, firebase.firestore.FieldValue.serverTimestamp);
    const profile = await ensureProfile(dataService, user, undefined);

    expect(profile?.name).toBe('Owner');

    // If we fetch it, it should not get re-created or updated (changing their Hexland display
    // name should be a Hexland UI feature, it shouldn't sync with the provider's idea of it)
    const profile2 = await ensureProfile(dataService, { ...user, displayName: 'fish' }, undefined);
    expect(profile2?.name).toBe('Owner');
  });
});