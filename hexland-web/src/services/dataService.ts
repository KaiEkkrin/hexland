import * as firebase from 'firebase/app';

import * as Convert from './converter';
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
  private readonly _converter: Convert.IConverter<T>

  constructor(
    dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>,
    converter: Convert.IConverter<T>
  ) {
    this._dref = dref;
    this._converter = converter;
  }

  get dref(): firebase.firestore.DocumentReference<firebase.firestore.DocumentData> {
    return this._dref;
  }

  get id(): string {
    return this._dref.id;
  }

  convert(rawData: any): T {
    return this._converter.convert(rawData);
  }
}

class DataAndReference<T> extends DataReference<T> implements IDataAndReference<T> {
  private readonly _data: firebase.firestore.DocumentData;

  constructor(
    dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>,
    data: firebase.firestore.DocumentData,
    converter: Convert.IConverter<T>
  ) {
    super(dref, converter);
    this._data = data;
  }

  get data(): T {
    return this.convert(this._data);
  }
}

// This service is for datastore-related operations for the current user.
export class DataService implements IDataService {
  private readonly _db: firebase.firestore.Firestore;
  private readonly _timestampProvider: () => firebase.firestore.FieldValue | number;

  constructor(
    db: firebase.firestore.Firestore,
    timestampProvider: () => firebase.firestore.FieldValue | number
  ) {
    this._db = db;
    this._timestampProvider = timestampProvider;
  }

  // IDataView implementation

  delete<T>(r: IDataReference<T>): Promise<void> {
    let dref = (r as DataReference<T>).dref;
    return dref.delete();
  }

  async get<T>(r: IDataReference<T>): Promise<T | undefined> {
    let dref = (r as DataReference<T>).dref;
    let result = await dref.get();
    return result.exists ? r.convert(result.data()) : undefined;
  }

  set<T>(r: IDataReference<T>, value: T): Promise<void> {
    let dref = (r as DataReference<T>).dref;
    return dref.set(value);
  }

  update<T>(r: IDataReference<T>, changes: any): Promise<void> {
    let dref = (r as DataReference<T>).dref;
    return dref.update(changes);
  }

  // IDataService implementation

  async addChanges(adventureId: string, uid: string, mapId: string, chs: IChange[]): Promise<void> {
    await this._db.collection(adventures).doc(adventureId).collection(maps).doc(mapId).collection(changes).add({
      chs: chs,
      timestamp: this._timestampProvider(),
      incremental: true,
      user: uid
    });
  }

  getAdventureRef(id: string): IDataReference<IAdventure> {
    let d = this._db.collection(adventures).doc(id);
    return new DataReference<IAdventure>(d, Convert.adventureConverter);
  }

  getInviteRef(adventureId: string, id: string): IDataReference<IInvite> {
    let d = this._db.collection(adventures).doc(adventureId).collection(invites).doc(id);
    return new DataReference<IInvite>(d, Convert.inviteConverter);
  }

  async getLatestInviteRef(adventureId: string): Promise<IDataAndReference<IInvite> | undefined> {
    let s = await this._db.collection(adventures).doc(adventureId).collection(invites)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();
    return (s.empty || s.docs.length === 0) ? undefined :
      new DataAndReference(s.docs[0].ref, s.docs[0].data(), Convert.inviteConverter);
  }

  getMapRef(adventureId: string, id: string): IDataReference<IMap> {
    let d = this._db.collection(adventures).doc(adventureId).collection(maps).doc(id);
    return new DataReference<IMap>(d, Convert.mapConverter);
  }

  getMapBaseChangeRef(adventureId: string, id: string): IDataReference<IChanges> {
    let d = this._db.collection(adventures).doc(adventureId)
      .collection(maps).doc(id).collection(changes).doc(baseChange);
    return new DataReference<IChanges>(d, Convert.changesConverter);
  }

  async getMapIncrementalChangesRefs(adventureId: string, id: string, limit: number): Promise<IDataAndReference<IChanges>[] | undefined> {
    let s = await this._db.collection(adventures).doc(adventureId)
      .collection(maps).doc(id).collection(changes)
      .where("incremental", "==", true)
      .orderBy("timestamp")
      .limit(limit)
      .get();
    return s.empty ? undefined : s.docs.map(d => new DataAndReference(d.ref, d.data(), Convert.changesConverter));
  }

  async getMyAdventures(uid: string): Promise<IDataAndReference<IAdventure>[]> {
    const a = await this._db.collection(adventures).where("owner", "==", uid).get();
    return a.docs.map(d => new DataAndReference(
      d.ref, Convert.adventureConverter.convert(d.data()), Convert.adventureConverter
    ));
  }

  async getMyPlayerRecords(uid: string): Promise<IDataAndReference<IPlayer>[]> {
    const p = await this._db.collectionGroup(players).where("playerId", "==", uid).get();
    return p.docs.map(d => new DataAndReference(
      d.ref, Convert.playerConverter.convert(d.data()), Convert.playerConverter
    ));
  }

  getPlayerRef(adventureId: string, uid: string): IDataReference<IPlayer> {
    let d = this._db.collection(adventures).doc(adventureId).collection(players).doc(uid);
    return new DataReference<IPlayer>(d, Convert.playerConverter);
  }

  async getPlayerRefs(adventureId: string): Promise<IDataAndReference<IPlayer>[]> {
    let s = await this._db.collection(adventures).doc(adventureId).collection(players).get();
    return s.docs.map(d => new DataAndReference(
      d.ref, Convert.playerConverter.convert(d.data()), Convert.playerConverter));
  }

  getProfileRef(uid: string): IDataReference<IProfile> {
    let d = this._db.collection(profiles).doc(uid);
    return new DataReference<IProfile>(d, Convert.profileConverter);
  }

  runTransaction<T>(fn: (dataView: IDataView) => Promise<T>): Promise<T> {
    return this._db.runTransaction(tr => {
      let tdv = new TransactionalDataView(tr);
      return fn(tdv);
    });
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
    uid: string,
    onNext: (adventures: IIdentified<IAdventure>[]) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ) {
    return this._db.collection(adventures).where("owner", "==", uid)
      .orderBy("name")
      .onSnapshot(s => {
        let adventures: IIdentified<IAdventure>[] = [];
        s.forEach((d) => {
          let data = d.data();
          if (data !== null) {
            let adventure = Convert.adventureConverter.convert(data);
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
    return this._db.collection(adventures).doc(adventureId)
      .collection(maps).doc(mapId).collection(changes)
      .orderBy("incremental") // base change must always be first even if it has a later timestamp
      .orderBy("timestamp")
      .onSnapshot(s => {
        s.docChanges().forEach(d => {
          // We're only interested in newly added documents -- these are new
          // changes to the map
          if (d.doc.exists && d.oldIndex === -1) {
            let chs = Convert.changesConverter.convert(d.doc.data());
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
    return this._db.collection(adventures).doc(adventureId).collection(players).onSnapshot(s => {
      onNext(s.docs.map(d => Convert.playerConverter.convert(d.data())));
    }, onError, onCompletion);
  }

  watchSharedAdventures(
    uid: string,
    onNext: (adventures: IPlayer[]) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ) {
    return this._db.collectionGroup(players).where("playerId", "==", uid).onSnapshot(s => {
      onNext(s.docs.map(d => Convert.playerConverter.convert(d.data())));
    }, onError, onCompletion);
  }
}

class TransactionalDataView implements IDataView {
  private _tr: firebase.firestore.Transaction;

  constructor(tr: firebase.firestore.Transaction) {
    this._tr = tr;
  }

  async delete<T>(r: IDataReference<T>): Promise<void> {
    let dref = (r as DataReference<T>).dref;
    this._tr = this._tr.delete(dref);
  }

  async get<T>(r: IDataReference<T>): Promise<T | undefined> {
    let dref = (r as DataReference<T>).dref;
    let result = await this._tr.get(dref);
    return result.exists ? r.convert(result.data()) : undefined;
  }

  async set<T>(r: IDataReference<T>, value: T): Promise<void> {
    let dref = (r as DataReference<T>).dref;
    this._tr = this._tr.set(dref, value);
  }

  async update<T>(r: IDataReference<T>, changes: any): Promise<void> {
    let dref = (r as DataReference<T>).dref;
    this._tr = this._tr.update(dref, changes);
  }
}