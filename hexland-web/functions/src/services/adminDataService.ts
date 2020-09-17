import * as admin from 'firebase-admin';
import * as firebase from 'firebase/app';

import * as Convert from './converter';
import { IDataService, IDataReference, IDataView, IDataAndReference } from './interfaces';
import { IAdventure, IPlayer } from '../data/adventure';
import { IChange, IChanges } from '../data/change';
import { IIdentified } from '../data/identified';
import { IInvite } from '../data/invite';
import { IMap } from '../data/map';
import { IProfile } from '../data/profile';

// This data services is like the one in the web application, but uses the Admin SDK instead.

// Well-known collection names.
const profiles = "profiles";
const adventures = "adventures";
const invites = "invites";
const maps = "maps";
const changes = "changes";
const baseChange = "base";
const players = "players";

class DataReference<T> implements IDataReference<T> {
  private readonly _dref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
  private readonly _converter: Convert.IConverter<T>

  constructor(
    dref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
    converter: Convert.IConverter<T>
  ) {
    this._dref = dref;
    this._converter = converter;
  }

  get dref(): FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> {
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
    dref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
    data: FirebaseFirestore.DocumentData,
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
export class AdminDataService implements IDataService {
  private readonly _db: FirebaseFirestore.Firestore;
  private readonly _timestampProvider: () => firebase.firestore.FieldValue | number;
  private readonly _uid: string;

  constructor() {
    this._db = admin.firestore();
    this._timestampProvider = admin.firestore.Timestamp.now;
    this._uid = "owner"; // TODO #64 Remove the uid from the data service entirely
  }

  // IDataView implementation

  async delete<T>(r: IDataReference<T>): Promise<void> {
    var dref = (r as DataReference<T>).dref;
    await dref.delete();
  }

  async get<T>(r: IDataReference<T>): Promise<T | undefined> {
    var dref = (r as DataReference<T>).dref;
    var result = await dref.get();
    return result.exists ? r.convert(result.data()) : undefined;
  }

  async set<T>(r: IDataReference<T>, value: T): Promise<void> {
    var dref = (r as DataReference<T>).dref;
    await dref.set(value);
  }

  async update<T>(r: IDataReference<T>, changes: any): Promise<void> {
    var dref = (r as DataReference<T>).dref;
    await dref.update(changes);
  }

  // IDataService implementation

  async addChanges(adventureId: string, mapId: string, chs: IChange[]): Promise<void> {
    await this._db.collection(adventures).doc(adventureId).collection(maps).doc(mapId).collection(changes).add({
      chs: chs,
      timestamp: this._timestampProvider(),
      incremental: true,
      user: this._uid
    });
  }

  getAdventureRef(id: string): IDataReference<IAdventure> {
    var d = this._db.collection(adventures).doc(id);
    return new DataReference<IAdventure>(d, Convert.adventureConverter);
  }

  getInviteRef(adventureId: string, id: string): IDataReference<IInvite> {
    var d = this._db.collection(adventures).doc(adventureId).collection(invites).doc(id);
    return new DataReference<IInvite>(d, Convert.inviteConverter);
  }

  async getLatestInviteRef(adventureId: string): Promise<IDataAndReference<IInvite> | undefined> {
    var s = await this._db.collection(adventures).doc(adventureId).collection(invites)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();
    return (s.empty || s.docs.length === 0) ? undefined :
      new DataAndReference(s.docs[0].ref, s.docs[0].data(), Convert.inviteConverter);
  }

  getMapRef(adventureId: string, id: string): IDataReference<IMap> {
    var d = this._db.collection(adventures).doc(adventureId).collection(maps).doc(id);
    return new DataReference<IMap>(d, Convert.mapConverter);
  }

  getMapBaseChangeRef(adventureId: string, id: string): IDataReference<IChanges> {
    var d = this._db.collection(adventures).doc(adventureId)
      .collection(maps).doc(id).collection(changes).doc(baseChange);
    return new DataReference<IChanges>(d, Convert.changesConverter);
  }

  async getMapChangesRefs(adventureId: string, id: string): Promise<IDataAndReference<IChanges>[] | undefined> {
    var s = await this._db.collection(adventures).doc(adventureId)
      .collection(maps).doc(id).collection(changes)
      .orderBy("timestamp")
      .get();
    return s.empty ? undefined : s.docs.map(d => new DataAndReference(d.ref, d.data(), Convert.changesConverter));
  }

  async getMyAdventures(): Promise<IDataAndReference<IAdventure>[]> {
    const a = await this._db.collection(adventures).where("owner", "==", this._uid).get();
    return a.docs.map(d => new DataAndReference(
      d.ref, Convert.adventureConverter.convert(d.data()), Convert.adventureConverter
    ));
  }

  async getMyPlayerRecords(): Promise<IDataAndReference<IPlayer>[]> {
    const p = await this._db.collectionGroup(players).where("playerId", "==", this._uid).get();
    return p.docs.map(d => new DataAndReference(
      d.ref, Convert.playerConverter.convert(d.data()), Convert.playerConverter
    ));
  }

  getPlayerRef(adventureId: string, uid: string): IDataReference<IPlayer> {
    var d = this._db.collection(adventures).doc(adventureId).collection(players).doc(uid);
    return new DataReference<IPlayer>(d, Convert.playerConverter);
  }

  async getPlayerRefs(adventureId: string): Promise<IDataAndReference<IPlayer>[]> {
    var s = await this._db.collection(adventures).doc(adventureId).collection(players).get();
    return s.docs.map(d => new DataAndReference(
      d.ref, Convert.playerConverter.convert(d.data()), Convert.playerConverter));
  }

  getProfileRef(): IDataReference<IProfile> {
    var d = this._db.collection(profiles).doc(this._uid);
    return new DataReference<IProfile>(d, Convert.profileConverter);
  }

  getUid(): string {
    return this._uid;
  }

  runTransaction<T>(fn: (dataView: IDataView) => Promise<T>): Promise<T> {
    return this._db.runTransaction(tr => {
      var tdv = new TransactionalDataView(tr);
      return fn(tdv);
    });
  }

  watch<T>(
    d: IDataReference<T>,
    onNext: (r: T | undefined) => void,
    onError?: ((error: Error) => void) | undefined
  ) {
    return (d as DataReference<T>).dref.onSnapshot(s => {
      onNext(s.exists ? (s.data() as T) : undefined);
    }, onError);
  }

  watchAdventures(
    onNext: (adventures: IIdentified<IAdventure>[]) => void,
    onError?: ((error: Error) => void) | undefined
  ) {
    return this._db.collection(adventures).where("owner", "==", this._uid)
      .orderBy("name")
      .onSnapshot(s => {
        var adventures: IIdentified<IAdventure>[] = [];
        s.forEach((d) => {
          var data = d.data();
          if (data !== null) {
            var adventure = Convert.adventureConverter.convert(data);
            adventures.push({ id: d.id, record: adventure });
          }
        });
        onNext(adventures);
      }, onError);
  }

  watchChanges(
    adventureId: string,
    mapId: string,
    onNext: (chs: IChanges) => void,
    onError?: ((error: Error) => void) | undefined
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
            var chs = Convert.changesConverter.convert(d.doc.data());
            onNext(chs);
          }
        });
      }, onError);
  }

  watchPlayers(
    adventureId: string,
    onNext: (players: IPlayer[]) => void,
    onError?: ((error: Error) => void) | undefined
  ) {
    return this._db.collection(adventures).doc(adventureId).collection(players).onSnapshot(s => {
      onNext(s.docs.map(d => Convert.playerConverter.convert(d.data())));
    }, onError);
  }

  watchSharedAdventures(
    onNext: (adventures: IPlayer[]) => void,
    onError?: ((error: Error) => void) | undefined
  ) {
    return this._db.collectionGroup(players).where("playerId", "==", this._uid).onSnapshot(s => {
      onNext(s.docs.map(d => Convert.playerConverter.convert(d.data())));
    }, onError);
  }
}

class TransactionalDataView implements IDataView {
  private _tr: FirebaseFirestore.Transaction;

  constructor(tr: FirebaseFirestore.Transaction) {
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