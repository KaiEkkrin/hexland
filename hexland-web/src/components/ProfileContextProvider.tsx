import React, { useEffect, useState, useContext } from 'react';

import { IProfile } from '../data/profile';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { UserContext } from './UserContextProvider';
import { IContextProviderProps } from './interfaces';
import { ensureProfile } from '../services/extensions';
import { IDataReference } from '../services/interfaces';

export const ProfileContext = React.createContext<IProfile | undefined>(undefined);

// This provides the profile context, and can be wrapped around individual components
// for unit testing.
function ProfileContextProvider(props: IContextProviderProps) {
  const { analytics, logError } = useContext(AnalyticsContext);
  const { dataService, user } = useContext(UserContext);
  const [profile, setProfile] = useState<IProfile | undefined>(undefined);

  // Upon start, make sure the user has an up-to-date profile, then set this:
  const [profileRef, setProfileRef] = useState<IDataReference<IProfile> | undefined>(undefined);
  useEffect(() => {
    if (dataService === undefined || user === undefined || user === null) {
      setProfile(undefined);
      setProfileRef(undefined);
      return;
    }

    const uid = user.uid;
    console.log("ensuring profile of " + user.displayName);
    ensureProfile(dataService, user, analytics)
      .then(p => {
        setProfile(p);
        setProfileRef(dataService.getProfileRef(uid));
      })
      .catch(e => logError("Failed to ensure profile of user " + user?.displayName, e));
  }, [analytics, logError, setProfile, setProfileRef, dataService, user]);

  // Watch the user's profile:
  useEffect(() => {
    if (profileRef === undefined || dataService === undefined) {
      setProfile(undefined);
      return undefined;
    }

    return dataService.watch(profileRef,
        p => setProfile(p),
        e => logError("Failed to watch profile", e)
      );
  }, [logError, profileRef, setProfile, dataService]);

  return (
    <ProfileContext.Provider value={profile}>
      {props.children}
    </ProfileContext.Provider>
  );
}

export default ProfileContextProvider;