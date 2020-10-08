import { IFunctionsService, IStorage, IStorageReference } from './interfaces';
import { createWebDAV, IWebDAV } from './webdav';

// A mock storage service for the use of the local `run_docker.sh` deployment.

const mockStorage = "http://localhost:7000/";

export class MockStorage implements IStorage {
  private readonly _functionsService: IFunctionsService;
  private readonly _webdav: IWebDAV;

  constructor(functionsService: IFunctionsService, uid: string) {
    this._functionsService = functionsService;
    this._webdav = createWebDAV(mockStorage);
  }

  ref(path: string): IStorageReference {
    return new MockStorageReference(this._functionsService, this._webdav, path);
  }
}

export class MockStorageReference implements IStorageReference {
  private readonly _functionsService: IFunctionsService;
  private readonly _webdav: IWebDAV;
  private readonly _path: string;

  constructor(functionsService: IFunctionsService, webdav: IWebDAV, path: string) {
    this._functionsService = functionsService;
    this._webdav = webdav;
    this._path = path;
  }

  private getWebDAVPath(): string {
    return this._path[0] === '/' ? this._path : '/' + this._path;
  }

  getDownloadURL(): Promise<string> {
    return Promise.resolve(this._webdav.getFileDownloadLink(this.getWebDAVPath()));
  }

  async put(file: File, metadata: any): Promise<void> {
    const name = metadata?.customMetadata?.originalName;
    const webDAVPath = this.getWebDAVPath();
    console.log(`uploading file ${name} to path ${webDAVPath}...`);
    await this._webdav.putFileContents(webDAVPath, file);

    console.log("making functions aware of " + this._path);
    await this._functionsService.handleMockStorageUpload(this._path, name);
  }
}
