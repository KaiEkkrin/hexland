import { IStorage, IStorageReference } from './interfaces';

import * as admin from 'firebase-admin';
import * as storage from 'firebase-admin/node_modules/@google-cloud/storage';

// The admin Firebase storage implementation.  This uses the Google Cloud
// storage API which looks kind of different to the firebase one O.o

export class Storage implements IStorage {
  private readonly _bucket: storage.Bucket;

  constructor(app: admin.app.App) {
    this._bucket = app.storage().bucket();
  }

  ref(path: string): IStorageReference {
    return new StorageReference(this._bucket, path);
  }
}

export class StorageReference implements IStorageReference {
  private readonly _bucket: storage.Bucket;
  private readonly _path: string;

  constructor(bucket: storage.Bucket, path: string) {
    this._bucket = bucket;
    this._path = path;
  }

  async delete(): Promise<void> {
    await this._bucket.file(this._path).delete();
  }

  async download(destination: string): Promise<void> {
    const file = this._bucket.file(this._path);
    await file.download({ destination: destination });
  }

  getDownloadURL(): Promise<string> {
    // I don't think I will ever need to be able to do this
    throw Error("Not supported");
  }

  put(file: Blob | Buffer, metadata: any): Promise<void> {
    // I don't think I need to be able to do this right now
    throw Error("Not supported");
  }

  async upload(source: string, metadata: { contentType: string }): Promise<void> {
    await this._bucket.upload(source, { destination: this._path, metadata: metadata });
  }
}