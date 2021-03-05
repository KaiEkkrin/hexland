import { createContext } from 'react';
import { Subject } from 'rxjs';

import { IStatusContext, IContextProviderProps, IToast } from './interfaces';
import { IIdentified } from '../data/identified';

const value = {
  toasts: new Subject<IIdentified<IToast | undefined>>()
};

export const StatusContext = createContext<IStatusContext>(value);

function StatusContextProvider(props: IContextProviderProps) {
  return (
    <StatusContext.Provider value={value}>
      {props.children}
    </StatusContext.Provider>
  );
}

export default StatusContextProvider;