import { AdminDataService } from './services/adminDataService';
import * as Extensions from './services/extensions';

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as CORS from 'cors';

const corsHandler = CORS({
  origin: [
    'http://localhost'
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

export const helloWorld = functions.region(region).https.onRequest((request, response) => {
  corsHandler(request, response, () => {
    functions.logger.info("Hello logs!", {structuredData: true});
    response.json({ result: "Hello from Firebase!" });
  });
});

// Second test: check that I can fetch the given map record, via the Admin SDK.
// TODO #64 remove this (security: it fetches any map regardless of whether you're
// a player in that adventure or not!)

export const getMap = functions.region(region).https.onRequest(async (request, response) => {
  corsHandler(request, response, async () => {
    try {
      functions.logger.info("calling getMap...");
      const adventureId = request.body.data['adventureId'];
      const mapId = request.body.data['mapId'];
      const mapRef = dataService.getMapRef(adventureId, mapId);
      const map = await dataService.get(mapRef);
      response.json({ result: map });
    } catch (e) {
      functions.logger.error("getMap error: ", e);
      response.status(500).json({ error: e.message });
    }
  });
});

// Consolidates map changes.

export const consolidateMapChanges = functions.region(region).https.onRequest(async (request, response) => {
  corsHandler(request, response, async () => {
    try {
      // Fetch the map record in question
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

      // TODO #64: Authorize this only to map owners/players.
      await Extensions.consolidateMapChanges(
        dataService,
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