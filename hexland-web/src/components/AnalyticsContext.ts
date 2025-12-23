import { createContext } from 'react';

import { IAnalyticsContext } from './interfaces';

export const AnalyticsContext = createContext<IAnalyticsContext>({
  analytics: undefined,
  enabled: undefined,
  setEnabled: (_enabled: boolean | undefined) => {},
  logError: (_message: string, _e: unknown, _fatal?: boolean | undefined) => {},
  logEvent: (_event: string, _parameters: unknown) => {}
});
