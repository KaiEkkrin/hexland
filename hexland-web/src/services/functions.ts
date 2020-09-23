import { IFunctionsService } from "./interfaces";
import * as firebase from 'firebase/app';

export class FunctionsService implements IFunctionsService {
  private readonly _consolidateMapChanges: firebase.functions.HttpsCallable;
  private readonly _joinAdventure: firebase.functions.HttpsCallable;

  constructor(functions: firebase.functions.Functions) {
    this._consolidateMapChanges = functions.httpsCallable('consolidateMapChanges');
    this._joinAdventure = functions.httpsCallable('joinAdventure');
  }

  async consolidateMapChanges(adventureId: string, mapId: string) {
    await this._consolidateMapChanges({ adventureId: adventureId, mapId: mapId });
  }

  async joinAdventure(adventureId: string, inviteId: string) {
    await this._joinAdventure({ adventureId: adventureId, inviteId: inviteId });
  }
}