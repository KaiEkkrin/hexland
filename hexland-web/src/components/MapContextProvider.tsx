import React, { useEffect, useMemo, useState, useContext, useReducer } from 'react';

import { trackChanges } from '../data/changeTracking';
import { IAdventureIdentified } from '../data/identified';
import { IMap } from '../data/map';
import lcm from '../models/mapLifecycleManager';
import { createDefaultState, IMapState, MapStateMachine } from '../models/mapStateMachine';
import { networkStatusTracker } from '../models/networkStatusTracker';
import { registerMapAsRecent, removeMapFromRecent, watchChangesAndConsolidate } from '../services/extensions';

import { AdventureContext } from './AdventureContextProvider';
import { AnalyticsContext } from './AnalyticsContextProvider';
import { IContextProviderProps, IMapContext } from './interfaces';
import { ProfileContext } from './ProfileContextProvider';
import { StatusContext } from './StatusContextProvider';
import { UserContext } from './UserContextProvider';

import { useHistory, useLocation } from 'react-router-dom';
import { from } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

// Providing the map state machine like this allows us to ensure cleanup
// despite React Router shenanigans where it appears to drop components on
// the floor ignoring any useEffect cleanups.

export const MapContext = React.createContext<IMapContext>({
  mapState: createDefaultState()
});

function MapContextProvider(props: IContextProviderProps) {
  const { analytics, logError, logEvent } = useContext(AnalyticsContext);
  const { dataService, functionsService, storageService, user } = useContext(UserContext);
  const profile = useContext(ProfileContext);
  const { toasts } = useContext(StatusContext);
  const { spriteManager } = useContext(AdventureContext);

  const history = useHistory();
  const location = useLocation();

  const [map, setMap] = useState<IAdventureIdentified<IMap> | undefined>(undefined);
  const [mapState, setMapState] = useState<IMapState>(createDefaultState());

  // This reducer lets us unmount previous state machines when we get a new one
  const [stateMachine, setStateMachine] = useReducer(
    (state: MapStateMachine | undefined, action: MapStateMachine | undefined) => {
      state?.setMount(undefined);
      return action;
    }, undefined
  );

  // Watch the map when it changes
  useEffect(() => {
    const matches = /^\/adventure\/([^/]+)\/map\/([^/]+)$/.exec(location?.pathname);
    if (!dataService || !matches) {
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

    // Check this map exists and can be fetched (the watch doesn't do this for us)
    dataService.get(mapRef)
      .then(r => {
        if (r === undefined) {
          couldNotLoad('That map does not exist.');
        }
      })
      .catch(e => {
        logError("Error checking for map " + mapId + ": ", e);
        couldNotLoad(e.message);
      });

    analytics?.logEvent("select_content", {
      "content_type": "map",
      "item_id": mapId
    });

    return dataService.watch<IMap>(
      mapRef, m => setMap(m === undefined ? undefined : {
        adventureId: adventureId,
        id: mapId,
        record: m
      }),
      e => logError("Error watching map " + mapId, e)
    );
  }, [analytics, dataService, history, location, logError, setMap, toasts, user]);

  // Track changes to the map.
  // We don't start watching until we have an initialised state machine (which means the
  // consolidate is done).
  useEffect(() => {
    async function openMap(): Promise<MapStateMachine | undefined> {
      const uid = user?.uid;
      if (
        dataService === undefined ||
        functionsService === undefined ||
        storageService === undefined ||
        map === undefined ||
        uid === undefined ||
        profile === undefined ||
        spriteManager?.adventureId !== map.adventureId
      ) {
        return undefined;
      }

      const { adventureId, id, record } = map;
      console.log(`opening map: ${adventureId}/${id}`);

      // These two calls are both done on a best-effort basis, because failing shouldn't
      // preclude us from opening the map (although hopefully they will succeed)
      try {
        await registerMapAsRecent(dataService, uid, adventureId, id, record);
      } catch (e) {
        logError("Error registering map " + adventureId + "/" + id + " as recent", e);
      }

      try {
        console.log(`consolidating map changes for ${adventureId}/${id}`);
        await functionsService.consolidateMapChanges(adventureId, id, false);
      } catch (e) {
        logError("Error consolidating map " + adventureId + "/" + id + " changes", e);
      }

      return lcm.getStateMachine(dataService, logError, storageService, uid, map, profile, spriteManager);
    }

    const sub = from(openMap()).subscribe(setStateMachine);
    return () => {
      sub.unsubscribe();
      setStateMachine(undefined);
    };
  }, [
    logError, map, profile, dataService, functionsService, storageService,
    user, setStateMachine, spriteManager
  ]);

  useEffect(() => {
    if (stateMachine === undefined) {
      return undefined;
    }

    // Watch for map changes
    console.log("Watching changes to map " + stateMachine.map.id);
    networkStatusTracker.clear();
    const stopWatching = watchChangesAndConsolidate(
      dataService, functionsService,
      stateMachine.map.adventureId, stateMachine.map.id,
      chs => {
        networkStatusTracker.onChanges(chs);
        return trackChanges(stateMachine.map.record, stateMachine.changeTracker, chs.chs, chs.user);
      },
      () => stateMachine.changeTracker.clear(),
      logEvent,
      e => logError("Error watching map changes", e));

    // Provide a feed of the map state
    const sub = stateMachine.state.subscribe(setMapState);
    return () => {
      sub.unsubscribe();
      stopWatching?.();
    };
  }, [logError, logEvent, setMapState, stateMachine, dataService, functionsService]);

  const mapContext: IMapContext = useMemo(
    () => ({ map: map, mapState: mapState, stateMachine: stateMachine }),
    [map, mapState, stateMachine]
  );

  return (
    <MapContext.Provider value={mapContext}>
      {props.children}
    </MapContext.Provider>
  );
}

export default MapContextProvider;