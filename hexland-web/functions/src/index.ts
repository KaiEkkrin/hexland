import * as Policy from './data/policy';
import { AdminDataService } from './services/adminDataService';
import * as Extensions from './services/extensions';
import functionLogger from './services/functionLogger';

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const region = 'europe-west2';

// Extract our configuration and create an admin data service
const FIREBASE_CONFIG = process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG);
functions.logger.info("initializing admin SDK with projectId: " + FIREBASE_CONFIG.projectId);
const app = admin.initializeApp(FIREBASE_CONFIG);
const dataService = new AdminDataService(app);

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = functions.region(region).https.onRequest((request, response) => {
//   corsHandler(request, response, () => {
//     functions.logger.info("Hello logs!", {structuredData: true});
//     response.json({ result: "Hello from Firebase!" });
//   });
// });

// Creates an adventure, checking for cap.

export const createAdventure = functions.region(region).https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (uid === undefined) {
    throw new functions.https.HttpsError('unauthenticated', 'No uid found');
  }

  // Get the submitted adventure data
  const name = data['name'];
  const description = data['description'];
  if (!name || !description) {
    throw new functions.https.HttpsError('invalid-argument', 'Name and description required');
  }

  return await Extensions.createAdventure(dataService, uid, String(name), String(description));
});

// Consolidates map changes.

export const consolidateMapChanges = functions.region(region).https.onCall(async (data, context) => {
  // Fetch the map record in question
  const adventureId = data['adventureId'];
  const mapId = data['mapId'];
  const resync = data['resync'] == true;
  if (!adventureId || !mapId) {
    throw new functions.https.HttpsError('invalid-argument', 'No adventure or map id supplied');
  }

  const mapRef = dataService.getMapRef(adventureId, mapId);
  const map = await dataService.get(mapRef);
  if (map === undefined) {
    throw new functions.https.HttpsError('not-found', 'No such map');
  }

  await Extensions.consolidateMapChanges(
    dataService,
    functionLogger,
    admin.firestore.FieldValue.serverTimestamp,
    String(adventureId),
    String(mapId),
    map,
    resync
  );
});

  // For testing purposes, the next functions accept alternative policy parameters.
  // It will only let you shorten the policy, however, not lengthen it!
function getInviteExpiryPolicy(data: any): Policy.IInviteExpiryPolicy {
  const timeUnit = data['timeUnit'];
  const recreate = data['recreate'];
  const expiry = data['expiry'];
  const deletion = data['deletion'];
  if (!timeUnit || String(timeUnit) !== 'second') {
    return Policy.defaultInviteExpiryPolicy;
  }

  const policy: Policy.IInviteExpiryPolicy = { ...Policy.defaultInviteExpiryPolicy, timeUnit: "second" };
  parseAndApply(recreate, v => policy.recreate = v);
  parseAndApply(expiry, v => policy.expiry = v);
  parseAndApply(deletion, v => policy.deletion = v);
  functions.logger.info("Using invite policy: recreate " + policy.recreate + ", expiry " + policy.expiry + ", deletion " + policy.deletion);
  return policy;
}

function parseAndApply(rawValue: any, apply: (value: number) => void) {
  const secondsValue = parseInt(rawValue);
  if (secondsValue >= 0 && secondsValue < 3600) {
    apply(secondsValue);
  }
}

// Creates an adventure invite or returns an existing one.

export const inviteToAdventure = functions.region(region).https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (uid === undefined) {
    throw new functions.https.HttpsError('unauthenticated', 'No uid found');
  }

  const adventureId = data['adventureId'];
  if (!adventureId) {
    throw new functions.https.HttpsError('invalid-argument', 'No adventure id supplied');
  }

  const adventureRef = dataService.getAdventureRef(String(adventureId));
  const adventure = await dataService.get(adventureRef);
  if (adventure?.owner !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the adventure owner can create invites');
  }

  return await Extensions.inviteToAdventure(
    dataService,
    admin.firestore.FieldValue.serverTimestamp,
    { id: String(adventureId), ...adventure },
    getInviteExpiryPolicy(data)
  );
});

// Joins an adventure (with invite validation.)

export const joinAdventure = functions.region(region).https.onCall(async (data, context) => {
  // Do the authorization thing, by bearer token:
  // (Obvious sequence to pull out into a handler function!)
  const uid = context.auth?.uid;
  if (uid === undefined) {
    throw new functions.https.HttpsError('unauthenticated', 'No uid found');
  }

  // In this case, we need no further authorization for the decoded token itself;
  // we just need to check they specified a valid invite
  const adventureId = data['adventureId'];
  const inviteId = data['inviteId'];
  if (!adventureId || !inviteId) {
    throw new functions.https.HttpsError('invalid-argument', 'No adventure or map id supplied');
  }

  await Extensions.joinAdventure(dataService, uid, adventureId, inviteId, getInviteExpiryPolicy(data));
});