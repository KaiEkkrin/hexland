import { AdminDataService } from './services/adminDataService';

import * as functions from 'firebase-functions';
import * as CORS from 'cors';

const corsHandler = CORS({
  origin: [
    'http://localhost'
  ]
});

const region = 'europe-west2';

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = functions.region(region).https.onRequest((request, response) => {
  corsHandler(request, response, () => {
    functions.logger.info("Hello logs!", {structuredData: true});
    response.json({ result: "Hello from Firebase!" });
  });
});

// Second test: check that I can fetch the given map record, via the Admin SDK.

export const getMap = functions.region(region).https.onRequest(async (request, response) => {
  corsHandler(request, response, async () => {
    const adventureId = request.params['adventureId'];
    const mapId = request.params['mapId'];
    const dataService = new AdminDataService();
    const mapRef = dataService.getMapRef(adventureId, mapId);
    const map = await dataService.get(mapRef);
    response.json({ result: map });
  });
});