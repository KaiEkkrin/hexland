import { db, timestampProvider } from '../firebase';

import { IDataService, IDataReference, IDataView, IDataAndReference } from './interfaces';
import { IAdventure, IPlayer } from '../data/adventure';
import { IChange, IChanges } from '../data/change';
import { IIdentified } from '../data/identified';
import { IInvite } from '../data/invite';
import { IMap } from '../data/map';
import { IProfile } from '../data/profile';

// Well-known collection names.
const profiles = "profiles";
const adventures = "adventures";
const invites = "invites";
const maps = "maps";
const changes = "changes";
const baseChange = "base";
const players = "players";

class DataReference<T> implements IDataReference<T> {
  private readonly _dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;

  constructor(dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>) {
    this._dref = dref;
  }

  get dref(): firebase.firestore.DocumentReference<firebase.firestore.DocumentData> {
    return this._dref;
  }

  get id(): string {
    return this._dref.id;
  }

  convert(rawData: any): T {
    return rawData as T;
  }
}

class DataAndReference<T> extends DataReference<T> implements IDataAndReference<T> {
  private readonly _data: firebase.firestore.DocumentData;

  constructor(
    dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>,
    data: firebase.firestore.DocumentData
  ) {
    super(dref);
    this._data = data;
  }

  get data(): T {
    return this.convert(this._data);
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

  async addChanges(adventureId: string, mapId: string, chs: IChange[]): Promise<void> {
    await db.collection(adventures).doc(adventureId).collection(maps).doc(mapId).collection(changes).add({
      chs: chs,
      timestamp: timestampProvider(),
      incremental: true,
      user: this._uid
    });
  }

  getAdventureRef(id: string): IDataReference<IAdventure> {
    var d = db.collection(adventures).doc(id);
    return new DataReference<IAdventure>(d);
  }

  getInviteRef(adventureId: string, id: string): IDataReference<IInvite> {
    var d = db.collection(adventures).doc(adventureId).collection(invites).doc(id);
    return new DataReference<IInvite>(d);
  }

  async getLatestInviteRef(adventureId: string): Promise<IDataAndReference<IInvite> | undefined> {
    var s = await db.collection(adventures).doc(adventureId).collection(invites)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();
    return (s.empty || s.docs.length === 0) ? undefined :
      new DataAndReference(s.docs[0].ref, s.docs[0].data());
  }

  async getMap(adventureId: string, id: string): Promise<IMap | undefined> {
    var d = await db.collection(adventures).doc(adventureId).collection(maps).doc(id).get();
    return d.exists ? (d.data() as IMap) : undefined;
  }

  getMapRef(adventureId: string, id: string): IDataReference<IMap> {
    var d = db.collection(adventures).doc(adventureId).collection(maps).doc(id);
    return new DataReference<IMap>(d);
  }

  getMapBaseChangeRef(adventureId: string, id: string): IDataReference<IChanges> {
    var d = db.collection(adventures).doc(adventureId)
      .collection(maps).doc(id).collection(changes).doc(baseChange);
    return new DataReference<IChanges>(d);
  }

  async getMapChangesRefs(adventureId: string, id: string): Promise<IDataAndReference<IChanges>[] | undefined> {
    var s = await db.collection(adventures).doc(adventureId)
      .collection(maps).doc(id).collection(changes)
      .orderBy("timestamp")
      .get();
    return s.empty ? undefined : s.docs.map(d => new DataAndReference(d.ref, d.data()));
  }

  getPlayerRef(adventureId: string, uid: string): IDataReference<IPlayer> {
    var d = db.collection(adventures).doc(adventureId).collection(players).doc(uid);
    return new DataReference<IPlayer>(d);
  }

  async getPlayerRefs(adventureId: string): Promise<IDataAndReference<IPlayer>[]> {
    var s = await db.collection(adventures).doc(adventureId).collection(players).get();
    return s.docs.map(d => new DataAndReference(d.ref, d.data() as IPlayer));
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

  setProfile(profile: IProfile): Promise<void> {
    return db.collection(profiles).doc(this._uid).set(profile);
  }

  watch<T>(
    d: IDataReference<T>,
    onNext: (r: T | undefined) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ) {
    return (d as DataReference<T>).dref.onSnapshot(s => {
      onNext(s.exists ? (s.data() as T) : undefined);
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

  watchChanges(
    adventureId: string,
    mapId: string,
    onNext: (chs: IChanges) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ) {
    return db.collection(adventures).doc(adventureId)
      .collection(maps).doc(mapId).collection(changes)
      .orderBy("incremental") // base change must always be first even if it has a later timestamp
      .orderBy("timestamp")
      .onSnapshot(s => {
        s.docChanges().forEach(d => {
          // We're only interested in newly added documents -- these are new
          // changes to the map
          if (d.doc.exists && d.oldIndex === -1) {
            var chs = d.doc.data() as IChanges;
            onNext(chs);
          }
        });
      }, onError, onCompletion);
  }

  watchPlayers(
    adventureId: string,
    onNext: (players: IPlayer[]) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ) {
    return db.collection(adventures).doc(adventureId).collection(players).onSnapshot(s => {
      onNext(s.docs.map(d => d.data() as IPlayer));
    }, onError, onCompletion);
  }

  watchSharedAdventures(
    onNext: (adventures: IPlayer[]) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ) {
    return db.collectionGroup(players).where("playerId", "==", this._uid).onSnapshot(s => {
      onNext(s.docs.map(d => d.data() as IPlayer));
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