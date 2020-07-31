import { db } from '../firebase';

import { IDataService, IDataReference, IDataView } from './interfaces';
import { IAdventure } from '../data/adventure';
import { IIdentified } from '../data/identified';
import { IMap } from '../data/map';
import { IProfile } from '../data/profile';

// Well-known collection names.
const profiles = "profiles";
const adventures = "adventures";
const maps = "maps";

class DataReference<T> implements IDataReference<T> {
  private readonly _dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;

  constructor(dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>) {
    this._dref = dref;
  }

  get dref(): firebase.firestore.DocumentReference<firebase.firestore.DocumentData> {
    return this._dref;
  }

  convert(rawData: any): T {
    return rawData as T;
  }
}

// This service is for datastore-related operations for the current user.
export class DataService implements IDataService {
  private readonly _uid: string;

  constructor(uid: string) {
    this._uid = uid;
  }

  // IDataView implementation

  delete<T>(r: IDataReference<T>): Promise<void> {
    var dref = (r as DataReference<T>).dref;
    return dref.delete();
  }

  async get<T>(r: IDataReference<T>): Promise<T | undefined> {
    var dref = (r as DataReference<T>).dref;
    var result = await dref.get();
    return result.exists ? r.convert(result.data()) : undefined;
  }

  set<T>(r: IDataReference<T>, value: T): Promise<void> {
    var dref = (r as DataReference<T>).dref;
    return dref.set(value);
  }

  update<T>(r: IDataReference<T>, changes: any): Promise<void> {
    var dref = (r as DataReference<T>).dref;
    return dref.update(changes);
  }

  // IDataService implementation

  async getAdventure(id: string): Promise<IAdventure | undefined> {
    var d = await db.collection(adventures).doc(id).get();
    return d.exists ? (d.data() as IAdventure) : undefined;
  }

  getAdventureRef(id: string): IDataReference<IAdventure> {
    var d = db.collection(adventures).doc(id);
    return new DataReference<IAdventure>(d);
  }

  async getMap(id: string): Promise<IMap | undefined> {
    var d = await db.collection(maps).doc(id).get();
    return d.exists ? (d.data() as IMap) : undefined;
  }

  getMapRef(id: string): IDataReference<IMap> {
    var d = db.collection(maps).doc(id);
    return new DataReference<IMap>(d);
  }

  async getProfile(): Promise<IProfile | undefined> {
    var d = await db.collection(profiles).doc(this._uid).get();
    return d.exists ? (d.data() as IProfile) : undefined;
  }

  getProfileRef(): IDataReference<IProfile> {
    var d = db.collection(profiles).doc(this._uid);
    return new DataReference<IProfile>(d);
  }

  getUid(): string {
    return this._uid;
  }

  runTransaction<T>(fn: (dataView: IDataView) => Promise<T>): Promise<T> {
    return db.runTransaction(tr => {
      var tdv = new TransactionalDataView(tr);
      return fn(tdv);
    });
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

  watchProfile(
    onNext: (profile: IProfile) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ) {
    return db.collection(profiles).doc(this._uid).onSnapshot(s => {
      var profile = s.data() as IProfile;
      onNext(profile);
    }, onError, onCompletion);
  }
}

class TransactionalDataView implements IDataView {
  private _tr: firebase.firestore.Transaction;

  constructor(tr: firebase.firestore.Transaction) {
    this._tr = tr;
  }

  async delete<T>(r: IDataReference<T>): Promise<void> {
    var dref = (r as DataReference<T>).dref;
    this._tr = this._tr.delete(dref);
  }

  async get<T>(r: IDataReference<T>): Promise<T | undefined> {
    var dref = (r as DataReference<T>).dref;
    var result = await this._tr.get(dref);
    return result.exists ? r.convert(result.data()) : undefined;
  }

  async set<T>(r: IDataReference<T>, value: T): Promise<void> {
    var dref = (r as DataReference<T>).dref;
    this._tr = this._tr.set(dref, value);
  }

  async update<T>(r: IDataReference<T>, changes: any): Promise<void> {
    var dref = (r as DataReference<T>).dref;
    this._tr = this._tr.update(dref, changes);
  }
}