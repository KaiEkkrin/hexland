import { IStorageReference, IWebDAV } from './interfaces';

import * as fs from 'fs';

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

  protected resolveFile(file: any): Promise<any> {
    // This method included so it can be overridden in *Web only* to detect Blobs
    // and do the right thing
    // (That code won't compile in node)
    return Promise.resolve(file);
  }

  async delete(): Promise<void> {
    const webDAVPath = this.getWebDAVPath();
    console.log(`deleting file at path ${webDAVPath}...`);
    await this._webdav.deleteFile(webDAVPath);
  }

  download(destination: string): Promise<void> {
    const webDAVPath = this.getWebDAVPath();
    console.log(`downloading file at path ${webDAVPath} to ${destination}...`);

    // I'm going to try to be a bit careful about making sure the local
    // file has closed before continuing:
    const readStream = this._webdav.createReadStream(webDAVPath);
    const writeStream = fs.createWriteStream(destination, { autoClose: true });
    return new Promise((resolve, reject) => {
      function safeReject(e: any) {
        console.log(`download of ${webDAVPath} failed`, e);
        reject(e);
      }

      readStream.on('data', (d: any) => writeStream.write(d));
      readStream.on('end', () => {
        writeStream.end();
        console.log(`download of ${webDAVPath} successful`);
        resolve();
      });
      readStream.on('error', safeReject);
      writeStream.on('error', safeReject);
    });
  }

  getDownloadURL(): Promise<string> {
    return Promise.resolve(this._webdav.getFileDownloadLink(this.getWebDAVPath()));
  }

  async put(file: any, metadata: any): Promise<void> {
    const name = metadata?.customMetadata?.originalName;
    const webDAVPath = this.getWebDAVPath();
    console.log(`uploading file ${name} to path ${webDAVPath}...`);
    const buffer = await this.resolveFile(file);
    await this._webdav.putFileContents(webDAVPath, buffer);
  }

  async upload(source: string, metadata: { contentType: string }): Promise<void> {
    const webDAVPath = this.getWebDAVPath();
    console.log(`uploading file at path ${webDAVPath}...`);

    // I'm going to try to be a bit careful about making sure the local
    // file has closed before continuing:
    const readStream = fs.createReadStream(source, { autoClose: true });
    const writeStream = this._webdav.createWriteStream(webDAVPath, {
      extraHeaders: { 'Content-Type': metadata.contentType }
    });
    return new Promise((resolve, reject) => {
      function safeReject(e: any) {
        readStream.close();
        reject(e);
      }

      readStream.on('data', (d: any) => writeStream.write(d));
      readStream.on('end', () => {
        writeStream.end();
        resolve();
      });
      readStream.on('error', safeReject);
      writeStream.on('error', safeReject);
    });
  }
}