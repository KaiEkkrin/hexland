import { IFunctionsService } from "./interfaces";
import * as firebase from 'firebase/app';

export class FunctionsService implements IFunctionsService {
  private readonly _consolidateMapChanges: firebase.functions.HttpsCallable;

  constructor(functions: firebase.functions.Functions) {
    this._consolidateMapChanges = functions.httpsCallable('consolidateMapChanges');
  }

  // Consolidates changes in the given map.
  async consolidateMapChanges(adventureId: string, mapId: string) {
    await this._consolidateMapChanges({ adventureId: adventureId, mapId: mapId });
  }
}