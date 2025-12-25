import { createContext } from 'react';

import { IFirebaseContext } from './interfaces';

export const FirebaseContext = createContext<IFirebaseContext>({});
