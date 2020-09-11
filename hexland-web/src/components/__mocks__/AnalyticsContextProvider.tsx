import React, { useEffect, useState, useMemo } from 'react';

import { IAnalyticsContext, IContextProviderProps } from '../interfaces';

export const AnalyticsContext = React.createContext<IAnalyticsContext>({
  analytics: undefined,
  enabled: false,
  setEnabled: (enabled: boolean) => {}
});

// Our mock analytics provider will use this flag:
var isAnalyticsEnabled = false;

function AnalyticsContextProvider(props: IContextProviderProps) {
  const [enabled, setEnabled] = useState(false);

  // TODO Provide some mock analytics
  const analyticsContext = useMemo(() => ({
    analytics: undefined,
    enabled: enabled,
    setEnabled: setEnabled
  }), [enabled, setEnabled]);

  // On load, fetch the global value
  useEffect(() => {
    setEnabled(isAnalyticsEnabled);
  }, [setEnabled]);

  // When the setting is changed, write the global value
  useEffect(() => {
    isAnalyticsEnabled = enabled;
  }, [enabled]);

  return (
    <AnalyticsContext.Provider value={analyticsContext}>
      {props.children}
    </AnalyticsContext.Provider>
  );
}

export default AnalyticsContextProvider;