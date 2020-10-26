import { IAdventureIdentified } from "../data/identified";
import { IMap, MapType } from "../data/map";
import { getUserPolicy } from "../data/policy";
import { IProfile } from "../data/profile";
import { getTokenGeometry } from "../data/tokenGeometry";
import { IDataService, ISpritesheetCache, IStorage } from "../services/interfaces";
import { SpritesheetCache } from "../services/spritesheetCache";

import { standardColours } from "./featureColour";
import { HexGridGeometry } from "./hexGridGeometry";
import { MapStateMachine } from './mapStateMachine';
import { SquareGridGeometry } from "./squareGridGeometry";

const spacing = 75.0;
const tileDim = 12;

const hexGridGeometry = new HexGridGeometry(spacing, tileDim);
const squareGridGeometry = new SquareGridGeometry(spacing, tileDim);

const hexTokenGeometry = getTokenGeometry(MapType.Hex);
const squareTokenGeometry = getTokenGeometry(MapType.Square);

// Helps us avoid re-creating expensive resources (WebGL etc) as we navigate
// around maps, switch users etc.
class MapLifecycleManager {
  // We retain a spritesheet cache per adventure:
  private readonly _ssCaches = new Map<string, SpritesheetCache>();

  // We maintain a map state machine for each geometry:
  private readonly _stateMachines = new Map<MapType, MapStateMachine>();

  // So we can flush everything when the uid changes
  private _lastUid: string | undefined = undefined;

  private checkUid(uid: string | undefined) {
    if (uid !== this._lastUid) {
      // Our cached stuff is now invalid
      this._ssCaches.forEach(c => c.dispose());
      this._ssCaches.clear();

      this._stateMachines.forEach(sm => sm.dispose());
      this._stateMachines.clear();
    }

    this._lastUid = uid;
  }

  // Gets a spritesheet cache
  getSpritesheetCache(
    dataService: IDataService | undefined,
    logError: ((message: string, e: any) => void) | undefined,
    uid: string | undefined,
    adventureId: string
  ): ISpritesheetCache | undefined {
    this.checkUid(uid);
    const already = this._ssCaches.get(adventureId);
    if (already !== undefined) {
      return already;
    }

    if (dataService === undefined || logError === undefined) {
      return undefined;
    }

    const newCache = new SpritesheetCache(dataService, adventureId, logError);
    this._ssCaches.set(adventureId, newCache);
    return newCache;
  }

  // Gets a map state machine
  getStateMachine(
    dataService: IDataService | undefined,
    logError: ((message: string, e: any) => void) | undefined,
    storage: IStorage | undefined,
    uid: string | undefined,
    map: IAdventureIdentified<IMap>,
    profile: IProfile
  ): MapStateMachine | undefined {
    const ssCache = this.getSpritesheetCache(dataService, logError, uid, map.adventureId); // checks uid
    if (
      dataService === undefined ||
      logError === undefined ||
      storage === undefined ||
      uid === undefined ||
      ssCache === undefined
    ) {
      return undefined;
    }

    const userPolicy = map.record.owner === uid ? getUserPolicy(profile.level) : undefined;
    const already = this._stateMachines.get(map.record.ty);
    if (already !== undefined) {
      already.configure(map, ssCache, userPolicy);
      return already;
    }

    const newStateMachine = new MapStateMachine(
      dataService,
      storage,
      map,
      uid,
      map.record.ty === MapType.Hex ? hexGridGeometry : squareGridGeometry,
      map.record.ty === MapType.Hex ? hexTokenGeometry : squareTokenGeometry,
      standardColours,
      userPolicy,
      logError,
      ssCache
    );
    this._stateMachines.set(map.record.ty, newStateMachine);
    return newStateMachine;
  }
}

const mapLifecycleManager = new MapLifecycleManager();
export default mapLifecycleManager;