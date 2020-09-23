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

// Consolidates map changes.

export const consolidateMapChanges = functions.region(region).https.onCall(async (data, context) => {
  // Fetch the map record in question
  const adventureId = data['adventureId'];
  const mapId = data['mapId'];
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
    map
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

  const inviteRef = dataService.getInviteRef(String(adventureId), String(inviteId));
  const invite = await dataService.get(inviteRef);
  if (invite === undefined) {
    throw new functions.https.HttpsError('not-found', 'No such invite found');
  }

  // TODO Check against the invite's expiry here
  await Extensions.joinAdventure(dataService, uid, adventureId);
});