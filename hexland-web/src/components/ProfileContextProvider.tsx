import React, { useEffect, useState, useContext } from 'react';

import { IProfile } from '../data/profile';

import { UserContext } from './FirebaseContextProvider';
import { IContextProviderProps } from './interfaces';

export const ProfileContext = React.createContext<IProfile | undefined>(undefined);

// This provides the profile context, and can be wrapped around individual components
// for unit testing.
function ProfileContextProvider(props: IContextProviderProps) {
  const userContext = useContext(UserContext);
  const [profile, setProfile] = useState<IProfile | undefined>(undefined);

  // Watch the user's profile:
  useEffect(() => {
    var d = userContext.dataService?.getProfileRef();
    if (d !== undefined) {
      return userContext.dataService?.watch(d,
        p => setProfile(p),
        e => console.error("Failed to watch profile:", e)
      );
    } else {
      setProfile(undefined);
    }
  }, [userContext]);

  return (
    <ProfileContext.Provider value={profile}>
      {props.children}
    </ProfileContext.Provider>
  );
}

export default ProfileContextProvider;