import React, { useContext, useEffect, useState, useMemo, useCallback } from 'react';

import { FirebaseContext } from './FirebaseContextProvider';
import { IAnalyticsContext, IAnalyticsProps, IContextProviderProps } from './interfaces';
import { IAnalytics } from '../services/interfaces';

export const AnalyticsContext = React.createContext<IAnalyticsContext>({
  analytics: undefined,
  enabled: undefined,
  setEnabled: (enabled: boolean | undefined) => {},
  logError: (message: string, e: any, fatal?: boolean | undefined) => {},
  logEvent: (event: string, parameters: any) => {}
});

const enabledKey = "analyticsEnabled";

// This provides a context for Google Analytics -- whether it is enabled, the interface
// to use it through, etc.
// The enabled setting is stored not in the user profile but in local storage.
export function AnalyticsContextProvider(props: IContextProviderProps & IAnalyticsProps) {
  const firebaseContext = useContext(FirebaseContext);

  // Resolve our storage functions
  const getItem = useCallback(
    (key: string) => props.getItem?.(key) ?? localStorage.getItem(key),
    [props.getItem]
  );

  const setItem = useCallback(
    (key: string, value: string | null) => {
      if (props.setItem !== undefined) {
        props.setItem(key, value);
      } else if (value !== null) {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
    }, [props]
  );

  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
  const [analytics, setAnalytics] = useState<IAnalytics | undefined>(undefined);
  const analyticsContext = useMemo(() => ({
    analytics: enabled ? analytics : undefined,
    enabled: enabled,
    setEnabled: setEnabled,
    logError: (message: string, e: any, fatal?: boolean | undefined) => {
      console.error(message, e);
      if (enabled) {
        analytics?.logEvent("exception", {
          "exDescription": message,
          "exMessage": String(e?.message),
          "exFatal": fatal !== false
        });
      }
    },
    logEvent: (event: string, parameters: any) => {
      if (enabled) {
        analytics?.logEvent(event, parameters);
      }
    }
  }), [analytics, enabled, setEnabled]);

  // On load, fetch any current enabled value from local storage
  useEffect(() => {
    const isEnabled = getItem(enabledKey);
    if (isEnabled !== null) {
      setEnabled(/true/i.test(isEnabled));
    }
  }, [getItem, setEnabled]);

  // When the setting is changed, save its value back to local storage
  useEffect(() => {
    if (enabled === true) {
      // User chose to enable GA
      console.log("Enabling Google Analytics");
      setAnalytics(firebaseContext.createAnalytics?.());
      setItem(enabledKey, "true");
    } else if (enabled === false) {
      // User chose to disable GA
      console.log("Disabling Google Analytics");
      setAnalytics(undefined);
      setItem(enabledKey, "false");
    } else {
      // User hasn't chosen yet (default to disabled)
      console.log("Disabling Google Analytics by default");
      setAnalytics(undefined);
      setItem(enabledKey, null);
    }
  }, [enabled, firebaseContext.createAnalytics, setAnalytics, setItem]);

  return (
    <AnalyticsContext.Provider value={analyticsContext}>
      {props.children}
    </AnalyticsContext.Provider>
  );
}