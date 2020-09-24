import { IFunctionsService } from "./interfaces";
import * as firebase from 'firebase/app';
import { IInviteExpiryPolicy } from "../data/policy";

export class FunctionsService implements IFunctionsService {
  private readonly _consolidateMapChanges: firebase.functions.HttpsCallable;
  private readonly _inviteToAdventure: firebase.functions.HttpsCallable;
  private readonly _joinAdventure: firebase.functions.HttpsCallable;

  constructor(functions: firebase.functions.Functions) {
    this._consolidateMapChanges = functions.httpsCallable('consolidateMapChanges');
    this._inviteToAdventure = functions.httpsCallable('inviteToAdventure');
    this._joinAdventure = functions.httpsCallable('joinAdventure');
  }

  async consolidateMapChanges(adventureId: string, mapId: string, resync: boolean) {
    await this._consolidateMapChanges({ adventureId: adventureId, mapId: mapId, resync: resync });
  }

  async inviteToAdventure(
    adventureId: string,
    policy?: IInviteExpiryPolicy | undefined // for testing purposes only
  ) {
    const result = await this._inviteToAdventure({ adventureId: adventureId, ...policy });
    return String(result.data);
  }

  async joinAdventure(
    adventureId: string,
    inviteId: string,
    policy?: IInviteExpiryPolicy | undefined // for testing purposes only
  ) {
    await this._joinAdventure({
      adventureId: adventureId,
      inviteId: inviteId,
      ...policy
    });
  }
}