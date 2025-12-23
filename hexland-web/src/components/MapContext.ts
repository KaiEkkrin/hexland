import { createContext } from 'react';

import { createDefaultState } from '../models/mapStateMachine';
import { IMapContext } from './interfaces';

export const MapContext = createContext<IMapContext>({
  mapState: createDefaultState()
});
