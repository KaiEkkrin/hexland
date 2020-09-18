import { IAnnotation } from '../data/annotation';
import { IChange, IChanges } from '../data/change';
import { SimpleChangeTracker, trackChanges } from '../data/changeTracking';
import { IGridCoord, IGridEdge, coordString, edgeString } from '../data/coord';
import { FeatureDictionary, IToken, IFeature } from '../data/feature';
import { IMap } from '../data/map';
import { IDataService, IDataView, IDataReference, IDataAndReference, ILogger } from './interfaces';

async function consolidateMapChangesTransaction(
  view: IDataView,
  logger: ILogger,
  timestampProvider: () => FirebaseFirestore.FieldValue | number,
  baseChange: IChanges | undefined,
  baseChangeRef: IDataReference<IChanges>,
  incrementalChanges: IDataAndReference<IChanges>[],
  consolidated: IChange[],
  uid: string
) {
  // Check that the base change hasn't changed since we did the query.
  // If it has, we'll simply abort -- someone else has done this recently
  const latestBaseChange = await view.get(baseChangeRef);
  if (baseChange !== undefined && latestBaseChange !== undefined) {
    if (
      typeof(latestBaseChange.timestamp) !== 'number' ||
      typeof(baseChange.timestamp) !== 'number'
    ) {
      // This should be fine, because they shouldn't be mixed within one application;
      // real application always uses the firestore field value, tests always use number
      const latestTimestamp = latestBaseChange.timestamp as FirebaseFirestore.FieldValue;
      const baseTimestamp = baseChange.timestamp as FirebaseFirestore.FieldValue;
      if (!latestTimestamp.isEqual(baseTimestamp)) {
        logger.logWarning("Map changes for " + baseChangeRef.id + " have already been consolidated");
        return;
      }
    } else {
      if (latestBaseChange.timestamp !== baseChange.timestamp) {
        logger.logWarning("Map changes for " + baseChangeRef.id + " have already been consolidated");
        return;
      }
    }
  }

  // Update the base change
  await view.set<IChanges>(baseChangeRef, {
    chs: consolidated,
    timestamp: timestampProvider(),
    incremental: false,
    user: uid
  });

  // Delete all the others
  await Promise.all(incrementalChanges.map(c => view.delete(c)));
}

// Returns true if finished, false to continue trying (e.g. more to be done.)
async function tryConsolidateMapChanges(
  dataService: IDataService,
  logger: ILogger,
  timestampProvider: () => FirebaseFirestore.FieldValue | number,
  adventureId: string,
  mapId: string,
  m: IMap
) {
  // Fetch all the current changes for this map, along with their refs
  const baseChangeRef = await dataService.getMapBaseChangeRef(adventureId, mapId);
  const baseChange = await dataService.get(baseChangeRef); // undefined in case of the first consolidate
  const incrementalChanges = await dataService.getMapIncrementalChangesRefs(adventureId, mapId, 499);
  if (incrementalChanges === undefined || incrementalChanges.length === 0) {
    // No changes to consolidate
    return true;
  }

  // Consolidate all of that.
  // #64: I'm no longer including a map colouring here.  It's a bit unsafe (a player could
  // technically cheat and non-owners would believe them), but it will save huge amounts of
  // CPU time (especially valuable if this is going to be called in a Firebase Function.)
  const tracker = new SimpleChangeTracker(
    new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString),
    new FeatureDictionary<IGridCoord, IToken>(coordString),
    new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString),
    new FeatureDictionary<IGridCoord, IAnnotation>(coordString),
    // new MapColouring(m.ty === MapType.Hex ? new HexGridGeometry(1, 1) : new SquareGridGeometry(1, 1))
  );
  if (baseChange !== undefined) {
    trackChanges(m, tracker, baseChange.chs, baseChange.user);
  }
  incrementalChanges.forEach(c => trackChanges(m, tracker, c.data.chs, c.data.user));
  const consolidated = tracker.getConsolidated();

  // Apply it
  await dataService.runTransaction(async view => {
    await consolidateMapChangesTransaction(
      view, logger, timestampProvider, baseChange, baseChangeRef, incrementalChanges ?? [], consolidated, m.owner
    );
  });
  
  // There may be more
  return false;
}

// TODO So that things are consolidated more regularly, pick a suitable
// count and run this as a Firebase Function when that many changes are
// added to the map?
// Doing lots of deletes from a Web client is not recommended:
// https://firebase.google.com/docs/firestore/manage-data/delete-data
export async function consolidateMapChanges(
  dataService: IDataService | undefined,
  logger: ILogger,
  timestampProvider: (() => FirebaseFirestore.FieldValue | number) | undefined,
  adventureId: string,
  mapId: string,
  m: IMap
): Promise<void> {
  if (dataService === undefined || timestampProvider === undefined) {
    return;
  }

  // Because we can consolidate at most 499 changes in one go due to the write limit,
  // we do this in a loop until we can't find any more:
  while (true) {
    if (await tryConsolidateMapChanges(
      dataService, logger, timestampProvider, adventureId, mapId, m
    )) {
      break;
    }
  }
}