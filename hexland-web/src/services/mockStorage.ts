import { IStorage, IStorageReference, IWebDAV } from './interfaces';
import { createWebDAV } from './webdav';

// A mock storage service for the use of the local `run_docker.sh` deployment.

const mockStorage = "http://localhost:7000/";

export class MockStorage implements IStorage {
  private readonly _webdav: IWebDAV;

  constructor() {
    this._webdav = createWebDAV(mockStorage);
  }

  protected get webdav() { return this._webdav; }

  ref(path: string): IStorageReference {
    return new MockStorageReference(this._webdav, path);
  }
}

export class MockStorageReference implements IStorageReference {
  private readonly _webdav: IWebDAV;
  private readonly _path: string;

  constructor(webdav: IWebDAV, path: string) {
    this._webdav = webdav;
    this._path = path;
  }

  private getWebDAVPath(): string {
    return this._path[0] === '/' ? this._path : '/' + this._path;
  }

  protected get path() { return this._path; }

  async delete(): Promise<void> {
    const webDAVPath = this.getWebDAVPath();
    console.log(`deleting file at path ${webDAVPath}...`);
    await this._webdav.deleteFile(webDAVPath);
  }

  getDownloadURL(): Promise<string> {
    return Promise.resolve(this._webdav.getFileDownloadLink(this.getWebDAVPath()));
  }

  async put(file: File, metadata: any): Promise<void> {
    const name = metadata?.customMetadata?.originalName;
    const webDAVPath = this.getWebDAVPath();
    console.log(`uploading file ${name} to path ${webDAVPath}...`);
    await this._webdav.putFileContents(webDAVPath, file);
  }
}
