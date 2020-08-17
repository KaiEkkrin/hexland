import { DataService } from './dataService';
import { ensureProfile, editAdventure } from './extensions';

import * as firebase from 'firebase/app';
import 'firebase/firestore';

import { clearFirestoreData, initializeTestApp } from '@firebase/testing';

import { v4 as uuidv4 } from 'uuid';

describe('test extensions as owner', () => {
  const ids: string[] = [];
  const emul: firebase.app.App[] = [];

  beforeEach(() => {
    const id = uuidv4();
    ids.push(id);
    emul.push(initializeTestApp({
      projectId: id,
      auth: {
        displayName: 'Owner',
        email: 'owner@example.com',
        uid: 'owner'
      }
    }));
  });

  afterEach(async () => {
    await emul.pop()?.delete();
  });

  afterAll(async () => {
    // TODO move this cleanup, and managing test databases, into a mock of
    // the Firebase context provider
    await Promise.all(ids.map(id => clearFirestoreData({ projectId: id })));
  })

  test('create a new profile entry', async () => {
    const db = emul[0].firestore();
    const dataService = new DataService(db, firebase.firestore.FieldValue.serverTimestamp, 'owner');
    const profile = await ensureProfile(dataService, {
      displayName: 'Owner',
      email: 'owner@example.com',
      uid: 'owner'
    });

    expect(profile?.name).toBe('Owner');

    // If we fetch it, it should not get re-created or updated (changing their Hexland display
    // name should be a Hexland UI feature, it shouldn't sync with the provider's idea of it)
    const profile2 = await ensureProfile(dataService, {
      displayName: 'fish',
      email: 'owner@example.com',
      uid: 'owner'
    });

    expect(profile2?.name).toBe('Owner');
  });

  test('create and edit adventures', async () => {
    const db = emul[0].firestore();
    const dataService = new DataService(db, firebase.firestore.FieldValue.serverTimestamp, 'owner');
    var profile = await ensureProfile(dataService, {
      displayName: 'Owner',
      email: 'owner@example.com',
      uid: 'owner'
    });

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
    await editAdventure(dataService, true, { id: a1Id, ...a1 }, { maps: [], ...a1 });

    // And another
    const a2Id = uuidv4();
    const a2 = {
      name: 'Adventure Two',
      description: 'Second adventure',
      owner: 'owner',
      ownerName: 'Owner'
    };
    await editAdventure(dataService, true, { id: a2Id, ...a2 }, { maps: [], ...a2 });

    // Edit the first adventure (we don't need to supply the whole record for a description change)
    a1.description = "Edited adventure";
    await editAdventure(dataService, false, { id: a1Id, ...a1 }, undefined);

    // If we fetch the adventure records the descriptions should be as expected
    const a1Record = await dataService.get(dataService.getAdventureRef(a1Id));
    expect(a1Record?.description).toBe("Edited adventure");

    const a2Record = await dataService.get(dataService.getAdventureRef(a2Id));
    expect(a2Record?.description).toBe("Second adventure");

    // And they should both appear in the user's profile
    profile = await dataService.get(dataService.getProfileRef());
    expect(profile?.adventures).toHaveLength(2);
    expect(profile?.adventures?.find(a => a.description === "Second adventure")).toBeTruthy();
    expect(profile?.adventures?.find(a => a.description === "Edited adventure")).toBeTruthy();
  });
});