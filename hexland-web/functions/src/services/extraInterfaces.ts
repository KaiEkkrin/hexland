import { IAdventure } from '../data/adventure';
import { IMap } from '../data/map';
import { IDataAndReference, IDataReference, IDataService } from './interfaces';

// We extend the data service with a few things that we're only going to need
// from the Functions

export interface ICollectionGroupQueryResult<T, U> extends IDataAndReference<T> {
  getParent(): IDataReference<U> | undefined;
}

export interface IAdminDataService extends IDataService {
  // Gets all the adventures with a particular image path.
  getAdventureRefsByImagePath(path: string): Promise<IDataAndReference<IAdventure>[]>;

  // Gets all the maps with a particular image path.
  getMapRefsByImagePath(path: string): Promise<ICollectionGroupQueryResult<IMap, IAdventure>[]>;
}