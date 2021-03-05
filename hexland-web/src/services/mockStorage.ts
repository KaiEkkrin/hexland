import { IStorage, IStorageReference, IWebDAV } from './interfaces';
import { MockStorageReference } from './mockStorageReference';
import { createWebDAV } from './webdav';

// A mock storage service for the use of the local `run_docker.sh` deployment.

export class MockStorage implements IStorage {
  private readonly _webdav: IWebDAV;

  constructor(location: string) {
    this._webdav = createWebDAV(location);
  }

  protected get webdav() { return this._webdav; }

  ref(path: string): IStorageReference {
    return new MockStorageReference(this._webdav, path);
  }
}