import { IStorage, IStorageReference, IWebDAV } from './interfaces';
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

  async download(destination: string): Promise<void> {
    throw Error("TODO support me");
  }

  getDownloadURL(): Promise<string> {
    return Promise.resolve(this._webdav.getFileDownloadLink(this.getWebDAVPath()));
  }

  async put(file: Blob | Buffer, metadata: any): Promise<void> {
    const name = metadata?.customMetadata?.originalName;
    const webDAVPath = this.getWebDAVPath();
    console.log(`uploading file ${name} to path ${webDAVPath}...`);
    await this._webdav.putFileContents(webDAVPath, file);
  }

  async upload(source: string, metadata: { contentType: string }): Promise<void> {
    throw Error("TODO support me");
  }
}
