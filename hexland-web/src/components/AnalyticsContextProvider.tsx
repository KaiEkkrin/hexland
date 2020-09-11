import React, { useContext, useEffect, useState, useMemo } from 'react';

import { FirebaseContext } from './FirebaseContextProvider';
import { IAnalyticsContext, IContextProviderProps } from './interfaces';
import { IAnalytics } from '../services/interfaces';

export const AnalyticsContext = React.createContext<IAnalyticsContext>({
  analytics: undefined,
  enabled: false,
  setEnabled: (enabled: boolean) => {}
});

const enabledKey = "analyticsEnabled";

// This provides a context for Google Analytics -- whether it is enabled, the interface
// to use it through, etc.
// The enabled setting is stored not in the user profile but in local storage.
function AnalyticsContextProvider(props: IContextProviderProps) {
  const firebaseContext = useContext(FirebaseContext);

  const [enabled, setEnabled] = useState(false);
  const [analytics, setAnalytics] = useState<IAnalytics | undefined>(undefined);
  const analyticsContext = useMemo(() => ({
    analytics: analytics,
    enabled: enabled,
    setEnabled: setEnabled
  }), [analytics, enabled, setEnabled]);

  // On load, fetch any current enabled value from local storage
  useEffect(() => {
    const isEnabled = localStorage.getItem(enabledKey);
    if (isEnabled !== null) {
      setEnabled(/true/i.test(isEnabled));
    }
  }, [setEnabled]);

  // When the setting is changed, save its value back to local storage
  useEffect(() => {
    localStorage.setItem(enabledKey, enabled ? "true" : "false");
    if (enabled) {
      console.log("Enabling Google Analytics");
      setAnalytics(firebaseContext.createAnalytics?.());
    } else {
      console.log("Disabling Google Analytics");
      setAnalytics(undefined);
    }
  }, [enabled, firebaseContext.createAnalytics, setAnalytics]);

  return (
    <AnalyticsContext.Provider value={analyticsContext}>
      {props.children}
    </AnalyticsContext.Provider>
  );
}

export default AnalyticsContextProvider;