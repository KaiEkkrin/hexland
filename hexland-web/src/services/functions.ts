import { MapType } from "../data/map";
import { IInviteExpiryPolicy } from "../data/policy";
import { ISprite } from "../data/sprite";
import { spriteConverter } from "./converter";
import { IFunctionsService } from "./interfaces";

import * as firebase from 'firebase/app';

export class FunctionsService implements IFunctionsService {
  private readonly _addSprites: firebase.functions.HttpsCallable;
  private readonly _createAdventure: firebase.functions.HttpsCallable;
  private readonly _createMap: firebase.functions.HttpsCallable;
  private readonly _cloneMap: firebase.functions.HttpsCallable;
  private readonly _consolidateMapChanges: firebase.functions.HttpsCallable;
  private readonly _deleteImage: firebase.functions.HttpsCallable;
  private readonly _handleMockStorageUpload: firebase.functions.HttpsCallable;
  private readonly _inviteToAdventure: firebase.functions.HttpsCallable;
  private readonly _joinAdventure: firebase.functions.HttpsCallable;

  constructor(functions: firebase.functions.Functions) {
    this._addSprites = functions.httpsCallable('addSprites');
    this._createAdventure = functions.httpsCallable('createAdventure');
    this._createMap = functions.httpsCallable('createMap');
    this._cloneMap = functions.httpsCallable('cloneMap');
    this._consolidateMapChanges = functions.httpsCallable('consolidateMapChanges');
    this._deleteImage = functions.httpsCallable('deleteImage');
    this._handleMockStorageUpload = functions.httpsCallable('handleMockStorageUpload');
    this._inviteToAdventure = functions.httpsCallable('inviteToAdventure');
    this._joinAdventure = functions.httpsCallable('joinAdventure');
  }

  async addSprites(adventureId: string, mapId: string, geometry: string, sources: string[]): Promise<ISprite[]> {
    const result = await this._addSprites({
      adventureId: adventureId, mapId: mapId, geometry: geometry, sources: sources
    });
    return Array.isArray(result.data) ? result.data.map(d => spriteConverter.convert(d)) : [];
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