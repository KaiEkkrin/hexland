import React, { useEffect, useMemo, useReducer, useState, useContext } from 'react';

import { trackChanges } from '../data/changeTracking';
import { IAdventureIdentified } from '../data/identified';
import { IMap } from '../data/map';
import { getUserPolicy } from '../data/policy';
import { standardColours } from '../models/featureColour';
import { createDefaultState, IMapState, MapStateMachine } from '../models/mapStateMachine';
import { networkStatusTracker } from '../models/networkStatusTracker';
import { registerMapAsRecent, removeMapFromRecent, watchChangesAndConsolidate } from '../services/extensions';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { IContextProviderProps, IMapContext, IMapStateProps } from './interfaces';
import { ProfileContext } from './ProfileContextProvider';
import { UserContext } from './UserContextProvider';

import { from } from 'rxjs';

// Providing the map state machine like this allows us to ensure cleanup
// despite React Router shenanigans where it appears to drop components on
// the floor ignoring any useEffect cleanups

export const MapContext = React.createContext<IMapContext>({
  mapState: createDefaultState()
});

function MapContextProvider(props: IContextProviderProps) {
  const { analytics, logError, logEvent } = useContext(AnalyticsContext);
  const profile = useContext(ProfileContext);
  const { dataService, functionsService, storageService, user } = useContext(UserContext);

  const [mapStateProps, setMapStateProps] = useState<IMapStateProps>({});

  const [map, setMap] = useState<IAdventureIdentified<IMap> | undefined>(undefined);
  const [mapState, setMapState] = useState<IMapState>(createDefaultState());

  // Building the map state machine like this lets us auto-dispose old ones.
  // Careful, the function may be called more than once for any given pair of
  // arguments (state, action) (wtf, React?!)
  const [stateMachine, setStateMachine] = useReducer(
    (state: MapStateMachine | undefined, action: MapStateMachine | undefined) => {
      state?.dispose();
      return action;
    }, undefined
  );

  // Watch the map when it changes
  useEffect(() => {
    const { adventureId, mapId, couldNotLoadMap } = mapStateProps;
    if (dataService === undefined || adventureId === undefined || mapId === undefined) {
      return;
    }

    const mapRef = dataService.getMapRef(adventureId, mapId);

    // How to handle a map load failure.
    function couldNotLoad(message: string) {
      const uid = user?.uid;
      if (uid && mapRef) {
        removeMapFromRecent(dataService, uid, mapRef.id)
          .catch(e => logError("Error removing map from recent", e));
      }

      couldNotLoadMap?.(message);
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
  }, [analytics, dataService, logError, mapStateProps, setMap, user]);

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
        profile === undefined
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
        console.log("consolidating map changes");
        await functionsService.consolidateMapChanges(adventureId, id, false);
      } catch (e) {
        logError("Error consolidating map " + adventureId + "/" + id + " changes", e);
      }

      const userPolicy = uid === record.owner ? getUserPolicy(profile.level) : undefined;
      return new MapStateMachine(
        dataService, storageService,
        { adventureId: adventureId, id: id, record: record },
        uid, standardColours, userPolicy, logError, setMapState
      );
    }

    const sub = from(openMap()).subscribe(setStateMachine);
    return () => {
      console.log(`unsubscribing from map`);
      sub.unsubscribe();
      setStateMachine(undefined);
    }
  }, [
    logError, map, profile, dataService, functionsService, storageService,
    user, setMapState, setStateMachine
  ]);

  useEffect(() => {
    if (stateMachine === undefined) {
      return undefined;
    }

    console.log("Watching changes to map " + stateMachine.map.id);
    networkStatusTracker.clear();
    return watchChangesAndConsolidate(
      dataService, functionsService,
      stateMachine.map.adventureId, stateMachine.map.id,
      chs => {
        networkStatusTracker.onChanges(chs);
        return trackChanges(stateMachine.map.record, stateMachine.changeTracker, chs.chs, chs.user);
      },
      () => stateMachine.changeTracker.clear(),
      logEvent,
      e => logError("Error watching map changes", e));
  }, [logError, logEvent, stateMachine, dataService, functionsService]);

  const mapContext: IMapContext = useMemo(
    () => ({ map: map, mapState: mapState, stateMachine: stateMachine, setMapStateProps: setMapStateProps }),
    [map, mapState, stateMachine, setMapStateProps]
  );

  return (
    <MapContext.Provider value={mapContext}>
      {props.children}
    </MapContext.Provider>
  );
}

export default MapContextProvider;