import { createContext } from 'react';

import { IAdventureContext } from './interfaces';

// Providing an adventure context like this lets us maintain the same watchers
// while the user navigates between maps in the adventure, etc.

export const AdventureContext = createContext<IAdventureContext>({
  players: [],
});
