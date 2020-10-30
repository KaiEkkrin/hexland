import React, { useEffect, useState, useContext } from 'react';

import { trackChanges } from '../data/changeTracking';
import { IAdventureIdentified } from '../data/identified';
import { IMap } from '../data/map';
import lcm from '../models/mapLifecycleManager';
import { createDefaultState, MapStateMachine } from '../models/mapStateMachine';
import { networkStatusTracker } from '../models/networkStatusTracker';
import { registerMapAsRecent, removeMapFromRecent, watchChangesAndConsolidate } from '../services/extensions';

import { AdventureContext } from './AdventureContextProvider';
import { AnalyticsContext } from './AnalyticsContextProvider';
import { IContextProviderProps, IMapContext } from './interfaces';
import { ProfileContext } from './ProfileContextProvider';
import { StatusContext } from './StatusContextProvider';
import { UserContext } from './UserContextProvider';

import { useHistory, useLocation } from 'react-router-dom';
import { from, Observable } from 'rxjs';
import { first, map, scan, share, switchMap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

export const MapContext = React.createContext<IMapContext>({
  mapState: createDefaultState()
});

function MapContextProvider(props: IContextProviderProps) {
  const { analytics, logError, logEvent } = useContext(AnalyticsContext);
  const { dataService, functionsService, user } = useContext(UserContext);
  const profile = useContext(ProfileContext);
  const { toasts } = useContext(StatusContext);
  const { spriteManager } = useContext(AdventureContext);

  const history = useHistory();
  const location = useLocation();

  // Watch the map when it changes
  const [mapContext, setMapContext] = useState<IMapContext>({ mapState: createDefaultState() });
  useEffect(() => {
    const matches = /^\/adventure\/([^/]+)\/map\/([^/]+)$/.exec(location?.pathname);
    const uid = user?.uid;
    if (!dataService || !matches || !profile || !spriteManager || !uid) {
      return;
    }

    const [adventureId, mapId] = [matches[1], matches[2]];
    const mapRef = dataService.getMapRef(adventureId, mapId);

    // How to handle a map load failure.
    function couldNotLoad(message: string) {
      const uid = user?.uid;
      if (uid && mapRef) {
        removeMapFromRecent(dataService, uid, mapRef.id)
          .catch(e => logError("Error removing map from recent", e));
      }

      toasts.next({
        id: uuidv4(),
        record: { title: 'Error loading map', message: message }
      });

      history.replace('/');
    }

    // We're going to do several things with this.
    // To properly stop a published observable we need to smuggle out the
    // underlying stop function
    let stopWatchingMap: (() => void) | undefined = undefined;
    const watchMap = new Observable<IAdventureIdentified<IMap>>(sub => {
      const stopWatchingMap = dataService.watch(
        mapRef,
        m => {
          if (m === undefined) {
            sub.error("That map does not exist.");
          } else {
            analytics?.logEvent("select_content", {
              "content_type": "map",
              "item_id": mapId
            });
            sub.next({ adventureId: adventureId, id: mapId, record: m });
          }
        },
        e => sub.error(e),
        () => sub.complete()
      );
      return stopWatchingMap;
    }).pipe(share());

    // On first load, register the map as recent, and fire a consolidate.
    // Neither of these is fatal if it goes wrong
    const registerAsRecentSub = watchMap.pipe(first(), switchMap(m =>
      from(registerMapAsRecent(dataService, uid, m.adventureId, m.id, m.record))
    )).subscribe(
      () => {},
      e => logError(`Error registering map ${adventureId}/${mapId} as recent`, e)
    );

    const consolidateSub = watchMap.pipe(first(), switchMap(m =>
      from((async () => {
        console.log(`consolidating map changes for ${m.adventureId}/${m.id}`);
        await functionsService?.consolidateMapChanges(m.adventureId, m.id, false);
      })())
    )).subscribe(
      () => {},
      e => logError(`Error consolidating map ${adventureId}/${mapId} changes`, e)
    );

    // Provide the map state machine, updating its state as the map changes.
    // We update the map context all in one go like this to avoid transient states
    // (map field pointing to a different one to the state machine for example) which
    // might cause subscribers to double-execute operations.
    const watchSub = watchMap.pipe(switchMap(m => new Observable<MapStateMachine>(sub => {
      const sm = lcm.getStateMachine(
        dataService, logError, uid, m, profile, spriteManager
      );

      networkStatusTracker.clear();
      const stop = watchChangesAndConsolidate(
        dataService,
        functionsService,
        m.adventureId,
        m.id,
        chs => {
          networkStatusTracker.onChanges(chs);
          return trackChanges(m.record, sm.changeTracker, chs.chs, chs.user);
        },
        () => sm.changeTracker.clear(),
        logEvent,
        e => logError("Error watching map changes", e)
      );

      sub.next(sm);
      return stop;
    })), scan((oldSm, newSm) => {
      // When we get a new state machine, unmount the old one (the map component will
      // mount the new one if it has a mount point.)
      if (oldSm !== newSm) {
        oldSm.setMount(undefined);
      }
      return newSm;
    }), switchMap(sm => sm.state.pipe(map(st => ({
      map: sm.map, mapState: st, stateMachine: sm
    }))))).subscribe(
      setMapContext,
      e => {
        logError(`Error watching changes of map ${adventureId}/${mapId}`, e);
        couldNotLoad(String(e?.message));
      }
    );

    return () => {
      watchSub.unsubscribe();
      consolidateSub.unsubscribe();
      registerAsRecentSub.unsubscribe();
      stopWatchingMap?.();
    };
  }, [
    analytics, dataService, functionsService, history, location, logError, logEvent,
    profile, setMapContext, spriteManager, toasts, user
  ]);

  return (
    <MapContext.Provider value={mapContext}>
      {props.children}
    </MapContext.Provider>
  );
}

export default MapContextProvider;