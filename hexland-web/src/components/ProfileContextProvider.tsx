import React, { useEffect, useState, useContext } from 'react';

import { IProfile } from '../data/profile';

import { UserContext } from './UserContextProvider';
import { IContextProviderProps } from './interfaces';

export const ProfileContext = React.createContext<IProfile | undefined>(undefined);

// This provides the profile context, and can be wrapped around individual components
// for unit testing.
function ProfileContextProvider(props: IContextProviderProps) {
  const userContext = useContext(UserContext);
  const [profile, setProfile] = useState<IProfile | undefined>(undefined);

  // Watch the user's profile:
  useEffect(() => {
    const uid = userContext.user?.uid;
    let d = uid === undefined ? undefined : userContext.dataService?.getProfileRef(uid);
    if (d !== undefined) {
      return userContext.dataService?.watch(d,
        p => setProfile(p),
        e => console.error("Failed to watch profile:", e)
      );
    } else {
      setProfile(undefined);
      return undefined;
    }
  }, [userContext]);

  return (
    <ProfileContext.Provider value={profile}>
      {props.children}
    </ProfileContext.Provider>
  );
}

export default ProfileContextProvider;