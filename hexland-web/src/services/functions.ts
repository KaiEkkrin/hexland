import { MapType } from "../data/map";
import { IInviteExpiryPolicy } from "../data/policy";
import { ISprite } from "../data/sprite";
import { IFunctionsService } from "./interfaces";

import * as firebase from 'firebase/app';
import { spriteConverter } from "./converter";

export class FunctionsService implements IFunctionsService {
  private readonly _createAdventure: firebase.functions.HttpsCallable;
  private readonly _createMap: firebase.functions.HttpsCallable;
  private readonly _cloneMap: firebase.functions.HttpsCallable;
  private readonly _consolidateMapChanges: firebase.functions.HttpsCallable;
  private readonly _deleteImage: firebase.functions.HttpsCallable;
  private readonly _editSprite: firebase.functions.HttpsCallable;
  private readonly _handleMockStorageUpload: firebase.functions.HttpsCallable;
  private readonly _inviteToAdventure: firebase.functions.HttpsCallable;
  private readonly _joinAdventure: firebase.functions.HttpsCallable;

  constructor(functions: firebase.functions.Functions) {
    this._createAdventure = functions.httpsCallable('createAdventure');
    this._createMap = functions.httpsCallable('createMap');
    this._cloneMap = functions.httpsCallable('cloneMap');
    this._consolidateMapChanges = functions.httpsCallable('consolidateMapChanges');
    this._deleteImage = functions.httpsCallable('deleteImage');
    this._editSprite = functions.httpsCallable('editSprite');
    this._handleMockStorageUpload = functions.httpsCallable('handleMockStorageUpload');
    this._inviteToAdventure = functions.httpsCallable('inviteToAdventure');
    this._joinAdventure = functions.httpsCallable('joinAdventure');
  }

  async createAdventure(name: string, description: string): Promise<string> {
    const result = await this._createAdventure({ name: name, description: description });
    return String(result.data);
  }

  async createMap(adventureId: string, name: string, description: string, ty: MapType, ffa: boolean): Promise<string> {
    const result = await this._createMap({
      adventureId: adventureId,
      name: name,
      description: description,
      ty: ty,
      ffa: ffa
    });
    return String(result.data);
  }

  async cloneMap(adventureId: string, mapId: string, name: string, description: string): Promise<string> {
    const result = await this._cloneMap({
      adventureId: adventureId,
      mapId: mapId,
      name: name,
      description: description
    });
    return String(result.data);
  }

  async consolidateMapChanges(adventureId: string, mapId: string, resync: boolean) {
    await this._consolidateMapChanges({ adventureId: adventureId, mapId: mapId, resync: resync });
  }

  async handleMockStorageUpload(imageId: string, name: string): Promise<void> {
    await this._handleMockStorageUpload({
      imageId: imageId,
      name: name
    });
  }

  async deleteImage(path: string): Promise<void> {
    await this._deleteImage({ path: path });
  }

  async editSprite(adventureId: string, newPath: string, oldPath?: string | undefined): Promise<ISprite> {
    const result = await this._editSprite({ adventureId: adventureId, newPath: newPath, oldPath: oldPath });
    return spriteConverter.convert(result.data);
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