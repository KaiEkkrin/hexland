import { createContext } from 'react';

import { ISignInMethodsContext } from './interfaces';

export const SignInMethodsContext = createContext<ISignInMethodsContext>({
  signInMethods: []
});
