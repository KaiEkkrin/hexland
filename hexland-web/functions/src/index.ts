import * as functions from 'firebase-functions';
import * as CORS from 'cors';

const corsHandler = CORS({
  origin: [
    'http://localhost'
  ]
});

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = functions.region('europe-west2').https.onRequest((request, response) => {
  corsHandler(request, response, () => {
    functions.logger.info("Hello logs!", {structuredData: true});
    response.json({ result: "Hello from Firebase!" });
  });
});
