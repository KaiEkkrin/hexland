import { IAdventureIdentified } from "../data/identified";
import { IMap, MapType } from "../data/map";
import { getUserPolicy } from "../data/policy";
import { IProfile } from "../data/profile";
import { getTokenGeometry } from "../data/tokenGeometry";
import { IDataService, ISpriteManager, IStorage } from "../services/interfaces";

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
  // We maintain a map state machine for each geometry:
  private readonly _stateMachines = new Map<MapType, MapStateMachine>();

  // Gets a map state machine
  getStateMachine(
    dataService: IDataService | undefined,
    logError: ((message: string, e: any) => void) | undefined,
    storage: IStorage | undefined,
    uid: string | undefined,
    map: IAdventureIdentified<IMap>,
    profile: IProfile,
    spriteManager: ISpriteManager | undefined
  ): MapStateMachine | undefined {
    if (
      dataService === undefined ||
      logError === undefined ||
      storage === undefined ||
      uid === undefined ||
      spriteManager === undefined
    ) {
      return undefined;
    }

    const userPolicy = map.record.owner === uid ? getUserPolicy(profile.level) : undefined;
    const already = this._stateMachines.get(map.record.ty);
    if (already !== undefined) {
      already.configure(map, spriteManager, userPolicy);
      return already;
    }

    const newStateMachine = new MapStateMachine(
      dataService,
      map,
      uid,
      map.record.ty === MapType.Hex ? hexGridGeometry : squareGridGeometry,
      map.record.ty === MapType.Hex ? hexTokenGeometry : squareTokenGeometry,
      standardColours,
      userPolicy,
      logError,
      spriteManager
    );
    this._stateMachines.set(map.record.ty, newStateMachine);
    return newStateMachine;
  }
}

const mapLifecycleManager = new MapLifecycleManager();
export default mapLifecycleManager;