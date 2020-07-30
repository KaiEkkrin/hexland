import { db } from '../firebase';

import { IDataService } from './interfaces';
import { IAdventure } from '../data/adventure';
import { IIdentified } from '../data/identified';
import { IMap } from '../data/map';
import { IProfile } from '../data/profile';

// Well-known collection names.
const profiles = "profiles";
const adventures = "adventures";
const maps = "maps";

// This service is for datastore-related operations for the current user.
export class DataService implements IDataService {
  private readonly _uid: string;

  constructor(uid: string) {
    this._uid = uid;
  }

  async getAdventure(id: string): Promise<IAdventure | undefined> {
    var d = await db.collection(adventures).doc(id).get();
    return d.exists ? (d.data() as IAdventure) : undefined;
  }

  async getMap(id: string): Promise<IMap | undefined> {
    var d = await db.collection(maps).doc(id).get();
    return d.exists ? (d.data() as IMap) : undefined;
  }

  async getProfile(): Promise<IProfile | undefined> {
    var d = await db.collection(profiles).doc(this._uid).get();
    return d.exists ? (d.data() as IProfile) : undefined;
  }

  getUid(): string {
    return this._uid;
  }

  setAdventure(id: string, adventure: IAdventure): Promise<void> {
    return db.collection(adventures).doc(id).set(adventure);
  }

  setMap(id: string, map: IMap): Promise<void> {
    return db.collection(maps).doc(id).set(map);
  }

  setProfile(profile: IProfile): Promise<void> {
    return db.collection(profiles).doc(this._uid).set(profile);
  }
  
  watchAdventure(
    id: string,
    onNext: (adventure: IAdventure) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ) {
    return db.collection("adventures").doc(id)
      .onSnapshot(s => {
        if (s.exists) {
          onNext(s.data() as IAdventure);
        }
      }, onError, onCompletion);
  }

  watchAdventures(
    onNext: (adventures: IIdentified<IAdventure>[]) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ) {
    return db.collection(adventures).where("owner", "==", this._uid)
      .orderBy("name")
      .onSnapshot(s => {
        var adventures: IIdentified<IAdventure>[] = [];
        s.forEach((d) => {
          var data = d.data();
          if (data !== null) {
            var adventure = data as IAdventure;
            adventures.push({ id: d.id, record: adventure });
          }
        });
        onNext(adventures);
      }, onError, onCompletion);
  }
}
