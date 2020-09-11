import React, { useEffect, useState, useMemo } from 'react';

import { IAnalyticsContext, IContextProviderProps } from './interfaces';

export const AnalyticsContext = React.createContext<IAnalyticsContext>({
  enabled: false,
  setEnabled: (enabled: boolean) => {}
});

const enabledKey = "analyticsEnabled";

// This provides a context for Google Analytics -- whether it is enabled, the interface
// to use it through, etc.
// The enabled setting is stored not in the user profile but in local storage.
function AnalyticsContextProvider(props: IContextProviderProps) {
  const [enabled, setEnabled] = useState(false);
  const analyticsContext = useMemo(() => ({
    enabled: enabled,
    setEnabled: setEnabled
  }), [enabled, setEnabled]);

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
  }, [enabled]);

  return (
    <AnalyticsContext.Provider value={analyticsContext}>
      {props.children}
    </AnalyticsContext.Provider>
  );
}

export default AnalyticsContextProvider;