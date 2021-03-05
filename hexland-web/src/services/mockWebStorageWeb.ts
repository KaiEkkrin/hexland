import { IFunctionsService, IStorage, IStorageReference, IWebDAV } from './interfaces';
import { MockWebStorageReference } from './mockWebStorageReference';
import { createWebDAVWeb } from './webdavweb';

// This is the browser's mock storage, communicating with Firebase Functions
// to mock the use of function triggers on the real Cloud Firestore, and using
// the browser WebDAV.

export class MockWebStorageWeb implements IStorage {
  private readonly _functionsService: IFunctionsService;
  private readonly _webdav: IWebDAV;

  constructor(functionsService: IFunctionsService, location: string) {
    this._functionsService = functionsService;
    this._webdav = createWebDAVWeb(location);
  }

  protected get webdav() { return this._webdav; }

  ref(path: string): IStorageReference {
    return new MockWebStorageReferenceWeb(this._functionsService, this.webdav, path);
  }
}

export class MockWebStorageReferenceWeb extends MockWebStorageReference {
  protected async resolveFile(file: any): Promise<any> {
    return file instanceof Blob ? (await file.arrayBuffer()) : file;
  }
}