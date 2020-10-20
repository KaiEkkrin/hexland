import { IDownloadUrlCache, IStorage } from "./interfaces";

import { ReplaySubject } from 'rxjs';
import { first } from 'rxjs/operators';

// This helper resolves download URLs (only once per URL) and takes an action
// when it's done.
export class DownloadUrlCache implements IDownloadUrlCache {
  private readonly _storage: IStorage;
  private readonly _logError: (message: string, e: any) => void;
  private readonly _requests = new Map<string, ReplaySubject<string>>();

  constructor(storage: IStorage, logError: (message: string, e: any) => void) {
    console.log("creating new download url cache");
    this._storage = storage;
    this._logError = logError;
  }

  resolve(path: string) {
    // See if we've already got a handler for this path
    const already = this._requests.get(path);
    if (already !== undefined) {
      return already.pipe(first()).toPromise();
    }

    // Otherwise, create a new one
    const fresh = new ReplaySubject<string>(1);
    this._storage.ref(path).getDownloadURL()
      .then(url => {
        // console.log(`resolved ${path} to ${url}`);
        fresh.next(url);
      })
      .catch(e => {
        this._logError(`failed to resolve path ${path}`, e);
        fresh.error(e);
      });

    this._requests.set(path, fresh);
    return fresh.pipe(first()).toPromise();
  }
}