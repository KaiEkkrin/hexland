import { IAdventure } from '../data/adventure';
import { IIdentified } from '../data/identified';
import { IMap } from '../data/map';
import { IProfile } from '../data/profile';

// This service is for datastore-related operations.
export interface IDataService {
  // Gets an adventure.
  getAdventure(id: string): Promise<IAdventure | undefined>;

  // Gets a map.
  getMap(id: string): Promise<IMap | undefined>;

  // Gets the user's profile.
  getProfile(): Promise<IProfile | undefined>;

  // Gets the current user id.
  getUid(): string;

  // Creates or edits an adventure.
  setAdventure(id: string, adventure: IAdventure): Promise<void>;

  // Creates or edits a map.
  setMap(id: string, map: IMap): Promise<void>;

  // Creates or edits the user's profile.
  setProfile(profile: IProfile): Promise<void>;

  // Watches a particular adventure.  Call the returned function to stop.
  watchAdventure(
    id: string,
    onNext: (adventure: IAdventure) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;

  // Watches all the user's adventures.  Call the returned function to stop.
  watchAdventures(
    onNext: (adventures: IIdentified<IAdventure>[]) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;
}