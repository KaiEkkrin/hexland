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
  const analyticsContext = useContext(AnalyticsContext);
  const userContext = useContext(UserContext);
  const [profile, setProfile] = useState<IProfile | undefined>(undefined);

  // Upon start, make sure the user has an up-to-date profile, then set this:
  const [profileRef, setProfileRef] = useState<IDataReference<IProfile> | undefined>(undefined);
  useEffect(() => {
    if (userContext.dataService === undefined || userContext.user === undefined || userContext.user === null) {
      setProfile(undefined);
      setProfileRef(undefined);
      return;
    }

    const uid = userContext.user.uid;
    const dataService = userContext.dataService;
    console.log("ensuring profile of " + userContext.user.displayName);
    ensureProfile(userContext.dataService, userContext.user, analyticsContext.analytics)
      .then(p => {
        setProfile(p);
        setProfileRef(dataService.getProfileRef(uid));
      })
      .catch(e => analyticsContext.logError("Failed to ensure profile of user " + userContext.user?.displayName, e));
  }, [analyticsContext, setProfile, setProfileRef, userContext]);

  // Watch the user's profile:
  useEffect(() => {
    if (profileRef === undefined || userContext.dataService === undefined) {
      setProfile(undefined);
      return undefined;
    }

    return userContext.dataService.watch(profileRef,
        p => setProfile(p),
        e => analyticsContext.logError("Failed to watch profile", e)
      );
  }, [analyticsContext, profileRef, setProfile, userContext.dataService]);

  return (
    <ProfileContext.Provider value={profile}>
      {props.children}
    </ProfileContext.Provider>
  );
}

export default ProfileContextProvider;