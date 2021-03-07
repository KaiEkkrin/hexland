import { MapType } from './data/map';
import * as Policy from './data/policy';
import { AdminDataService } from './services/adminDataService';
import * as Extensions from './services/extensions';
import functionLogger from './services/functionLogger';
import * as ImageExtensions from './services/imageExtensions';
import { IStorage } from './services/interfaces';
import { MockStorage } from './services/mockStorage';
import * as Req from './services/request';
import * as SpriteExtensions from './services/spriteExtensions';
import { Storage } from './services/storage';

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const region = 'europe-west2';

// Extract our configuration and create an admin data service
const FIREBASE_CONFIG = process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG);
functions.logger.info("initializing admin SDK with projectId: " + FIREBASE_CONFIG.projectId);
const app = admin.initializeApp(FIREBASE_CONFIG);
const dataService = new AdminDataService(app);

const emulatorFunctionsDisabled = process.env.IS_LOCAL_DEV !== 'true';
if (emulatorFunctionsDisabled) {
  functionLogger.logInfo("Emulator-only functions disabled");
} else {
  functionLogger.logWarning("Emulator-only functions enabled");
}

const storage: IStorage = emulatorFunctionsDisabled ? new Storage(app) :
  new MockStorage('http://mock-storage');

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = functions.region(region).https.onRequest((request, response) => {
//   corsHandler(request, response, () => {
//     functions.logger.info("Hello logs!", {structuredData: true});
//     response.json({ result: "Hello from Firebase!" });
//   });
// });

// == CALLABLE FUNCTIONS ==

// Creates an adventure, checking for cap.

async function createAdventure(uid: string, request: Req.CreateAdventureRequest) {
  if (!request.name || !request.description) {
    throw new functions.https.HttpsError('invalid-argument', 'Name and description required');
  }

  return await Extensions.createAdventure(dataService, uid, request.name, request.description);
}

// Creates a map, checking for cap.

async function createMap(uid: string, request: Req.CreateMapRequest) {
  if (!request.adventureId || !request.name || !request.description || !request.ty) {
    throw new functions.https.HttpsError('invalid-argument', 'Not all required parameters supplied');
  }

  return await Extensions.createMap(
    dataService, uid, request.adventureId, request.name, request.description,
    request.ty === MapType.Hex ? MapType.Hex : MapType.Square,
    request.ffa === true
  );
}

// Clones a map into a new one in the same adventure.

async function cloneMap(uid: string, request: Req.CloneMapRequest) {
  if (!request.adventureId || !request.mapId || !request.name || !request.description) {
    throw new functions.https.HttpsError('invalid-argument', 'Not all required parameters supplied');
  }

  return await Extensions.cloneMap(
    dataService, functionLogger, admin.firestore.FieldValue.serverTimestamp,
    uid, request.adventureId, request.mapId, request.name, request.description
  );
}

// Consolidates map changes.

async function consolidateMapChanges(uid: string, request: Req.ConsolidateMapChangesRequest) {
  if (!request.adventureId || !request.mapId) {
    throw new functions.https.HttpsError('invalid-argument', 'No adventure or map id supplied');
  }

  const mapRef = dataService.getMapRef(request.adventureId, request.mapId);
  const map = await dataService.get(mapRef);
  if (map === undefined) {
    throw new functions.https.HttpsError('not-found', 'No such map');
  }

  await Extensions.consolidateMapChanges(
    dataService,
    functionLogger,
    admin.firestore.FieldValue.serverTimestamp,
    request.adventureId,
    request.mapId,
    map,
    request.resync === true
  );
}

  // For testing purposes, the next functions accept alternative policy parameters.
  // It will only let you shorten the policy, however, not lengthen it!
function getInviteExpiryPolicy(request?: Policy.IInviteExpiryPolicy): Policy.IInviteExpiryPolicy {
  if (!request?.timeUnit || String(request.timeUnit) !== 'second') {
    return Policy.defaultInviteExpiryPolicy;
  }

  const policy: Policy.IInviteExpiryPolicy = { ...Policy.defaultInviteExpiryPolicy, timeUnit: "second" };
  parseAndApply(request?.recreate, v => policy.recreate = v);
  parseAndApply(request?.expiry, v => policy.expiry = v);
  parseAndApply(request?.deletion, v => policy.deletion = v);
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

async function inviteToAdventure(uid: string, request: Req.InviteToAdventureRequest) {
  if (!request.adventureId) {
    throw new functions.https.HttpsError('invalid-argument', 'No adventure id supplied');
  }

  const adventureRef = dataService.getAdventureRef(request.adventureId);
  const adventure = await dataService.get(adventureRef);
  if (adventure?.owner !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the adventure owner can create invites');
  }

  return await Extensions.inviteToAdventure(
    dataService,
    admin.firestore.FieldValue.serverTimestamp,
    { id: request.adventureId, ...adventure },
    getInviteExpiryPolicy(request.policy)
  );
}

// Joins an adventure (with invite validation.)
// Returns the id of the adventure you joined.

async function joinAdventure(uid: string, request: Req.JoinAdventureRequest) {
  if (!request.inviteId) {
    throw new functions.https.HttpsError('invalid-argument', 'No adventure or map id supplied');
  }

  return await Extensions.joinAdventure(
    dataService,
    uid,
    request.inviteId,
    getInviteExpiryPolicy(request.policy)
  );
}

// Deletes an image.

async function deleteImage(uid: string, request: Req.DeleteImageRequest) {
  if (!request.path) {
    throw new functions.https.HttpsError('invalid-argument', 'No path supplied');
  }

  await ImageExtensions.deleteImage(dataService, storage, functionLogger, uid, request.path);
}

// == EMULATOR ONLY ==

async function handleMockStorageUpload(uid: string, request: Req.HandleMockStorageUploadRequest) {
  if (emulatorFunctionsDisabled) {
    // This function is only valid in a local development environment -- allowing it
    // in the real system would be a security hole :)
    throw new functions.https.HttpsError('permission-denied', 'Nope');
  }

  if (!request.imageId || !request.name) {
    throw new functions.https.HttpsError('invalid-argument', 'No image id or name supplied');
  }

  functions.logger.info(`Adding image ${request.imageId} with name ${request.name}`);
  await ImageExtensions.addImage(
    dataService, storage, functionLogger, request.name, request.imageId
  );
}

// Handles most calls. Allocated a small amount of memory.
// (Using a single Function rather than multiple reduces deployment time and hopefully,
// also reduces the number of cold spin-up delays, without having significant other penalty
// because they're all sharing back-end modules anyway.)

export const interact = functions.region(region).https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (uid === undefined) {
    throw new functions.https.HttpsError('unauthenticated', 'No uid found');
  }

  const request = data as Req.FunctionRequest;
  switch (request.verb)
  {
    case 'cloneMap': return await cloneMap(uid, request);
    case 'consolidateMapChanges': await consolidateMapChanges(uid, request); return true;
    case 'createAdventure': return await createAdventure(uid, request);
    case 'createMap': return await createMap(uid, request);
    case 'deleteImage': await deleteImage(uid, request); return true;
    case 'handleMockStorageUpload': await handleMockStorageUpload(uid, request); return true;
    case 'inviteToAdventure': return await inviteToAdventure(uid, request);
    case 'joinAdventure': return await joinAdventure(uid, request);
    default: throw new functions.https.HttpsError('invalid-argument', 'Unrecognised verb');
  }
});

// Adds sprites.
// This seems to chew a lot of memory, hence the higher memory limit setting.  Hopefully
// this won't turn out overly expensive!

export const addSprites = functions.region(region).runWith({ memory: '1GB' }).https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (uid === undefined) {
    throw new functions.https.HttpsError('unauthenticated', 'No uid found');
  }

  const adventureId = data['adventureId'];
  const geometry = data['geometry'];
  const sources = data['sources'];
  if (!adventureId || !sources) {
    throw new functions.https.HttpsError('invalid-argument', 'No adventure id or sources supplied');
  }

  const sourceList = Array.isArray(sources) ? sources.map(s => String(s)) : [];
  if (sourceList.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'No sources supplied');
  }

  return await SpriteExtensions.addSprites(
    dataService, functionLogger, storage, uid, String(adventureId), String(geometry),
    sourceList, admin.firestore.Timestamp.now
  );
})

// == TRIGGER FUNCTIONS ==

export const onUpload = functions.region(region).storage.object().onFinalize(async (object) => {
  if (object.name === undefined) {
    functions.logger.warn("Found unnamed object");
    return;
  }

  if (object.contentType === undefined || !/^image\//.test(object.contentType)) {
    functions.logger.warn(`Found unrecognised object ${object.name} -- deleting`);
    await storage.ref(object.name).delete();
    return;
  }

  const name = String(object.metadata?.originalName);
  await ImageExtensions.addImage(
    dataService, storage, functionLogger, name, object.name
  );
});
