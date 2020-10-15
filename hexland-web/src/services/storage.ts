import { IStorage, IStorageReference } from './interfaces';

import * as firebase from 'firebase/app';
import 'firebase/storage';

// The real Firebase storage implementation.

export class Storage implements IStorage {
  private readonly _storage: firebase.storage.Storage;

  constructor(storage: firebase.storage.Storage) {
    this._storage = storage;
  }

  ref(path: string): IStorageReference {
    return new StorageReference(this._storage.ref(path));
  }
}

export class StorageReference implements IStorageReference {
  private readonly _ref: firebase.storage.Reference;

  constructor(ref: firebase.storage.Reference) {
    this._ref = ref;
  }
  
  async delete(): Promise<void> {
    await this._ref.delete();
  }

  async download(destination: string): Promise<void> {
    throw Error("Not supported");
  }

  async getDownloadURL(): Promise<string> {
    const url = await this._ref.getDownloadURL();
    return String(url);
  }

  async put(file: Blob | Buffer, metadata: any) {
    // For now, I'll enumerate explicitly what metadata I expect here
    await this._ref.put(file, {
      customMetadata: metadata.customMetadata
    });
  }

  async upload(source: string, metadata: { contentType: string }): Promise<void> {
    throw Error("Not supported");
  }
}