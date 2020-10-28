import { getSpritePathFromId, ISprite, ISpritesheet } from "../data/sprite";
import { IDataAndReference, IDataService, ISpriteManager, ISpritesheetEntry, IStorage } from "./interfaces";

import { from, Observable } from 'rxjs';
import { concatMap, shareReplay, switchMap } from 'rxjs/operators';

export class SpriteManager implements ISpriteManager {
  private readonly _adventureId: string;
  private _unsub: (() => void) | undefined;

  private _published: Observable<{ sheet: ISpritesheet, url: string }[]>;
  private _isDisposed = false;

  constructor(
    dataService: IDataService,
    storage: IStorage,
    adventureId: string,
  ) {
    console.log(`subscribing to spritesheets of ${adventureId}`);
    this._adventureId = adventureId;
    const ssFeed = new Observable<IDataAndReference<ISpritesheet>[]>(sub => {
      this._unsub = dataService.watchSpritesheets(
        adventureId, ss => {
          sub.next(ss.filter(s => s.data.supersededBy === ""));
        }, e => sub.error(e)
      );
    });

    // We assume we'll want all download URLs at some point, and resolve them as
    // they come in:
    async function createEntry(s: IDataAndReference<ISpritesheet>) {
      const url = await storage.ref(getSpritePathFromId(s.id)).getDownloadURL();
      return { sheet: s.data, url: url };
    }

    this._published = ssFeed.pipe(switchMap(
      ss => from(Promise.all(ss.map(createEntry)))
    ), shareReplay(1));
  }

  get adventureId() { return this._adventureId; }

  lookup(sprite: ISprite): Observable<ISpritesheetEntry> {
    return this._published.pipe(concatMap(
      entries => {
        return from(
          entries.filter(e => e.sheet.sprites.indexOf(sprite.source) >= 0)
          .map(e => ({ ...e, position: e.sheet.sprites.indexOf(sprite.source) }))
        );
      }
    ));
  }

  dispose() {
    if (!this._isDisposed) {
      console.log(`unsubscribing from spritesheets`);
      this._unsub?.();
      this._isDisposed = true;
    }
  }
}