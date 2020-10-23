import { fromSpriteCacheKey, ISprite, ISpritesheet, toSpriteCacheKey } from "../data/sprite";
import { ICacheLease, IDataAndReference, IDataService, ISpritesheetCache } from "./interfaces";
import { ICacheItem, ObjectCache } from "./objectCache";

export class SpriteNotFoundError {
  readonly message: string;

  constructor(message: string) {
    this.message = message;
  }
}

// A simple wrapping around ObjectCache that caches spritesheets.
export class SpritesheetCache implements ISpritesheetCache {
  private readonly _objectCache: ObjectCache<IDataAndReference<ISpritesheet>>;

  private readonly _dataService: IDataService;
  private readonly _adventureId: string;
  private readonly _mapId: string;
  private readonly _logError: (message: string, e: any) => void;

  constructor(
    dataService: IDataService,
    adventureId: string,
    mapId: string,
    logError: (message: string, e: any) => void
  ) {
    this._dataService = dataService;
    this._adventureId = adventureId;
    this._mapId = mapId;
    this._logError = logError;

    this._objectCache = new ObjectCache(logError);
    this.resolveSpritesheet = this.resolveSpritesheet.bind(this);
  }

  private async resolveSpritesheet(key: string): Promise<ICacheItem<IDataAndReference<ISpritesheet>>> {
    const sprite = fromSpriteCacheKey(key);
    if (sprite === undefined) {
      throw RangeError("Invalid sprite cache key: " + key);
    }

    // Load all spritesheets that have that image source
    const ss = await this._dataService.getSpritesheetsBySource(
      this._adventureId, this._mapId, sprite.geometry, [sprite.source]
    );

    if (ss.length === 0) {
      throw new SpriteNotFoundError("No such sprite: " + key);
    } else {
      return { value: ss[0], cleanup: () => { /* nothing to do */ } };
    }
  }

  get(spriteKey: string): ICacheLease<IDataAndReference<ISpritesheet>> | undefined {
    try {
      return this._objectCache.get(spriteKey);
    } catch (e) {
      this._logError("Failed to get sprite", e);
      return undefined;
    }
  }

  async resolve(sprite: ISprite): Promise<ICacheLease<IDataAndReference<ISpritesheet>>> {
    try {
      return await this._objectCache.resolve(toSpriteCacheKey(sprite), this.resolveSpritesheet);
    } catch (e) {
      this._logError("Failed to resolve sprite", e);
      throw e;
    }
  }

  dispose() {
    this._objectCache.dispose();
  }
}