import React, { useEffect, useMemo, useState, useContext } from 'react';

import { UserContext } from './UserContextProvider';
import { AnalyticsContext } from './AnalyticsContextProvider';
import { IAdventureContext, IAdventureStateProps, IContextProviderProps } from './interfaces';

import { IAdventure, IPlayer } from '../data/adventure';
import { IIdentified } from '../data/identified';
import lcm from '../models/mapLifecycleManager';
import { registerAdventureAsRecent, removeAdventureFromRecent } from '../services/extensions';

// Providing an adventure context like this lets us maintain the same watchers
// while the user navigates between maps in the adventure, etc.

export const AdventureContext = React.createContext<IAdventureContext>({
  players: [],
});

function AdventureContextProvider(props: IContextProviderProps) {
  const { dataService, user } = useContext(UserContext);
  const { analytics, logError } = useContext(AnalyticsContext);

  const [adventureStateProps, setAdventureStateProps] = useState<IAdventureStateProps>({});
  const [adventure, setAdventure] = useState<IIdentified<IAdventure> | undefined>(undefined);
  useEffect(() => {
    const uid = user?.uid;
    const { adventureId, couldNotLoadAdventure } = adventureStateProps;
    if (uid === undefined || adventureId === undefined) {
      return undefined;
    }

    const d = dataService?.getAdventureRef(adventureId);
    const playerRef = dataService?.getPlayerRef(adventureId, uid);
    if (d === undefined || playerRef === undefined) {
      return undefined;
    }

    function couldNotLoad(message: string) {
      if (uid && d) {
        removeAdventureFromRecent(dataService, uid, d.id)
          .catch(e => logError("Error removing adventure from recent", e));
      }

      couldNotLoadAdventure?.(message);
    }

    // Check this adventure exists and can be fetched (the watch doesn't do this for us)
    // We do this by checking for the player record because that also allows us to check if
    // we're blocked; being blocked necessarily doesn't stop us from getting the adventure
    // from the db (only the maps), but showing it to the user in that state would *not*
    // be a helpful thing to do
    dataService?.get(playerRef)
      .then(r => {
        // Deliberately try not to show the player the difference between the adventure being
        // deleted and the player being blocked!  Might avoid a confrontation...
        if (r === undefined || r?.allowed === false) {
          couldNotLoad("That adventure does not exist.");
        }
      })
      .catch(e => {
        logError("Error checking for adventure " + adventureId + ": ", e);
        couldNotLoad(e.message);
      });

    analytics?.logEvent("select_content", {
      "content_type": "adventure",
      "item_id": adventureId
    });
    return dataService?.watch(d,
      a => setAdventure(a === undefined ? undefined : { id: adventureId, record: a }),
      e => logError("Error watching adventure " + adventureId + ": ", e));
  }, [dataService, user, analytics, logError, adventureStateProps]);

  // Handle a successful adventure load by watching its players, etc.
  const [players, setPlayers] = useState<IPlayer[]>([]);
  useEffect(() => {
    const uid = user?.uid;
    if (dataService === undefined || uid === undefined || adventure === undefined) {
      return undefined;
    }

    registerAdventureAsRecent(dataService, uid, adventure.id, adventure.record)
      .then(() => console.log("registered adventure " + adventure.id + " as recent"))
      .catch(e => logError("Failed to register adventure " + adventure.id + " as recent", e));

    return dataService.watchPlayers(
      adventure.id, setPlayers,
      e => logError("Failed to watch players of adventure " + adventure.id, e)
    );
  }, [adventure, dataService, logError, setPlayers, user]);

  // The lifecycle manager releases a spritesheet cache for us to publish
  const spritesheetCache = useMemo(
    () => adventureStateProps.adventureId === undefined ? undefined :
      lcm.getSpritesheetCache(dataService, logError, user?.uid, adventureStateProps.adventureId),
    [dataService, logError, user, adventureStateProps.adventureId]
  );

  const adventureContext: IAdventureContext = useMemo(
    () => ({
      adventure: adventure,
      players: players,
      spritesheetCache: spritesheetCache,
      setAdventureStateProps: setAdventureStateProps
    }),
    [adventure, players, spritesheetCache, setAdventureStateProps]
  );

  return (
    <AdventureContext.Provider value={adventureContext}>
      {props.children}
    </AdventureContext.Provider>
  );
}

export default AdventureContextProvider;