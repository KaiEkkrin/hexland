import { AdminDataService } from './services/adminDataService';
import * as Extensions from './services/extensions';
import functionLogger from './services/functionLogger';

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as CORS from 'cors';

const corsHandler = CORS({
  origin: [
    'http://localhost',
    'http://localhost:3000',
    'https://hexland.web.app',
    'https://hexland-test.web.app',
    'https://wallandshadow.io',
    'https://www.wallandshadow.io'
  ]
});

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

export const consolidateMapChanges = functions.region(region).https.onRequest(async (request, response) => {
  corsHandler(request, response, async () => {
    try {
      // Fetch the map record in question
      // TODO #70 Require authorization here (not critical, but would be good)
      const adventureId = request.body.data['adventureId'];
      const mapId = request.body.data['mapId'];
      if (!adventureId || !mapId) {
        response.status(400).json({ result: 'No adventure or map id supplied' });
        return;
      }

      const mapRef = dataService.getMapRef(adventureId, mapId);
      const map = await dataService.get(mapRef);
      if (map === undefined) {
        response.status(404).json({ result: 'No such map' });
        return;
      }

      await Extensions.consolidateMapChanges(
        dataService,
        functionLogger,
        admin.firestore.FieldValue.serverTimestamp,
        String(adventureId),
        String(mapId),
        map
      );
      response.json({ result: 'success' });
    } catch (e) {
      functions.logger.error("consolidateMapChanges error: ", e);
      response.status(500).json({ error: e.message });
    }
  });
});