import { IDownloadUrlCache, IStorage } from "./interfaces";

// This helper resolves download URLs (only once per URL) and takes an action
// when it's done.
export class DownloadUrlCache implements IDownloadUrlCache {
  private readonly _storage: IStorage;
  private readonly _logError: (message: string, e: any) => void;

  private readonly _actions: Map<string, ((url: string) => void)[]>;
  private readonly _resolved: Map<string, string>;

  constructor(storage: IStorage, logError: (message: string, e: any) => void) {
    console.log("creating new download url cache");
    this._storage = storage;
    this._logError = logError;

    this._actions = new Map<string, ((url: string) => void)[]>();
    this._resolved = new Map<string, string>();
  }

  private onURL(path: string, url: string) {
    this._resolved.set(path, url);

    const actions = this._actions.get(path);
    if (actions === undefined) {
      return;
    }

    actions.forEach(a => a(url));
    this._actions.delete(path);
  }

  resolve(path: string, fn: (url: string) => void) {
    const url = this._resolved.get(path);
    if (url !== undefined) {
      // We can run the handler function right away
      fn(url);
      return;
    }

    // See if we've already got a handler for this path
    const actions = this._actions.get(path);
    if (actions !== undefined) {
      actions.push(fn);
      return;
    }

    // Otherwise, create a new one
    this._actions.set(path, [fn]);
    this._storage.ref(path).getDownloadURL()
      .then(url => this.onURL(path, url))
      .catch(e => this._logError(`Failed to get URL for ${url}`, e));
  }
}