import * as firebase from 'firebase/app';

import * as Convert from './converter';
import { IDataService, IDataReference, IDataView, IDataAndReference, IChildDataReference } from './interfaces';
import { IAdventure, IPlayer } from '../data/adventure';
import { IChange, IChanges } from '../data/change';
import { IIdentified } from '../data/identified';
import { IImages } from '../data/image';
import { IInvite } from '../data/invite';
import { IMap } from '../data/map';
import { IProfile } from '../data/profile';

// Well-known collection names.
const profiles = "profiles";
const adventures = "adventures";
const images = "images";
const invites = "invites";
const maps = "maps";
const changes = "changes";
const baseChange = "base";
const players = "players";

// A non-generic base data reference helps our isEqual implementation.

class DataReferenceBase {
  private readonly _dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;

  constructor(
    dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>,
  ) {
    this._dref = dref;
  }

  get dref(): firebase.firestore.DocumentReference<firebase.firestore.DocumentData> {
    return this._dref;
  }

  get id(): string {
    return this._dref.id;
  }

  protected isEqualTo<T>(other: IDataReference<T>): boolean {
    return (other instanceof DataReferenceBase) ? this._dref.isEqual(other._dref) : false;
  }
}

class DataReference<T> extends DataReferenceBase implements IDataReference<T> {
  private readonly _converter: Convert.IConverter<T>

  constructor(
    dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>,
    converter: Convert.IConverter<T>
  ) {
    super(dref);
    this._converter = converter;
  }
  
  protected getParentDref<U>(converter: Convert.IConverter<U>): IDataReference<U> | undefined {
    const parent = this.dref.parent.parent;
    return parent ? new DataReference<U>(parent, converter) : undefined;
  }

  convert(rawData: any): T {
    return this._converter.convert(rawData);
  }

  isEqual(other: IDataReference<T>): boolean {
    return super.isEqualTo(other);
  }
}

class ChildDataReference<T, U> extends DataReference<T> implements IChildDataReference<T, U> {
  private readonly _parentConverter: Convert.IConverter<U>;

  constructor(
    dref: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>,
    converter: Convert.IConverter<T>,
    parentConverter: Convert.IConverter<U>
  ) {
    super(dref, converter);
    this._parentConverter = parentConverter;
  }

  getParent(): IDataReference<U> | undefined {
    return this.getParentDref(this._parentConverter);
  }
}

// TODO #149 To avoid the nasty cobweb of inheritance, instead make DataAndReference a
// double return value (reference, data).
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
  private readonly _timestampProvider: () => firebase.firestore.FieldValue;

  constructor(
    db: firebase.firestore.Firestore,
    timestampProvider: () => firebase.firestore.FieldValue
  ) {
    this._db = db;
    this._timestampProvider = timestampProvider;
  }

  // IDataView implementation

  delete<T>(r: IDataReference<T>): Promise<void> {
    const dref = (r as DataReference<T>).dref;
    return dref.delete();
  }

  async get<T>(r: IDataReference<T>): Promise<T | undefined> {
    const dref = (r as DataReference<T>).dref;
    const result = await dref.get();
    return result.exists ? r.convert(result.data()) : undefined;
  }

  set<T>(r: IDataReference<T>, value: T): Promise<void> {
    const dref = (r as DataReference<T>).dref;
    return dref.set(value);
  }

  update<T>(r: IDataReference<T>, changes: any): Promise<void> {
    const dref = (r as DataReference<T>).dref;
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

  async getAdventureMapRefs(adventureId: string): Promise<IDataAndReference<IMap>[]> {
    const m = await this._db.collection(adventures).doc(adventureId).collection(maps).get();
    return m.docs.map(d => new DataAndReference(
      d.ref, Convert.mapConverter.convert(d.data()), Convert.mapConverter
    ));
  }

  getAdventureRef(id: string): IDataReference<IAdventure> {
    const d = this._db.collection(adventures).doc(id);
    return new DataReference<IAdventure>(d, Convert.adventureConverter);
  }

  getImagesRef(uid: string): IDataReference<IImages> {
    const d = this._db.collection(images).doc(uid);
    return new DataReference<IImages>(d, Convert.imagesConverter);
  }

  getInviteRef(adventureId: string, id: string): IDataReference<IInvite> {
    const d = this._db.collection(adventures).doc(adventureId).collection(invites).doc(id);
    return new DataReference<IInvite>(d, Convert.inviteConverter);
  }

  async getLatestInviteRef(adventureId: string): Promise<IDataAndReference<IInvite> | undefined> {
    const s = await this._db.collection(adventures).doc(adventureId).collection(invites)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();
    return (s.empty || s.docs.length === 0) ? undefined :
      new DataAndReference(s.docs[0].ref, s.docs[0].data(), Convert.inviteConverter);
  }

  getMapRef(adventureId: string, id: string): IChildDataReference<IMap, IAdventure> {
    const d = this._db.collection(adventures).doc(adventureId).collection(maps).doc(id);
    return new ChildDataReference<IMap, IAdventure>(d, Convert.mapConverter, Convert.adventureConverter);
  }

  getMapBaseChangeRef(adventureId: string, id: string, converter: Convert.IConverter<IChanges>): IDataReference<IChanges> {
    const d = this._db.collection(adventures).doc(adventureId)
      .collection(maps).doc(id).collection(changes).doc(baseChange);
    return new DataReference<IChanges>(d, converter);
  }

  async getMapIncrementalChangesRefs(adventureId: string, id: string, limit: number, converter: Convert.IConverter<IChanges>): Promise<IDataAndReference<IChanges>[] | undefined> {
    const s = await this._db.collection(adventures).doc(adventureId)
      .collection(maps).doc(id).collection(changes)
      .where("incremental", "==", true)
      .orderBy("timestamp")
      .limit(limit)
      .get();
    return s.empty ? undefined : s.docs.map(d => new DataAndReference(d.ref, d.data(), converter));
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
    const d = this._db.collection(adventures).doc(adventureId).collection(players).doc(uid);
    return new DataReference<IPlayer>(d, Convert.playerConverter);
  }

  async getPlayerRefs(adventureId: string): Promise<IDataAndReference<IPlayer>[]> {
    const s = await this._db.collection(adventures).doc(adventureId).collection(players).get();
    return s.docs.map(d => new DataAndReference(
      d.ref, Convert.playerConverter.convert(d.data()), Convert.playerConverter));
  }

  getProfileRef(uid: string): IDataReference<IProfile> {
    const d = this._db.collection(profiles).doc(uid);
    return new DataReference<IProfile>(d, Convert.profileConverter);
  }

  runTransaction<T>(fn: (dataView: IDataView) => Promise<T>): Promise<T> {
    return this._db.runTransaction(tr => {
      const tdv = new TransactionalDataView(tr);
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
      onNext(s.exists ? d.convert(s.data()) : undefined);
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
        const adventures: IIdentified<IAdventure>[] = [];
        s.forEach((d) => {
          const data = d.data();
          if (data !== null) {
            const adventure = Convert.adventureConverter.convert(data);
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
    const converter = Convert.createChangesConverter();
    const baseChangeRef = this._db.collection(adventures).doc(adventureId)
      .collection(maps).doc(mapId).collection(changes).doc(baseChange);
    return this._db.collection(adventures).doc(adventureId)
      .collection(maps).doc(mapId).collection(changes)
      .orderBy("incremental") // base change must always be first even if it has a later timestamp
      .orderBy("timestamp")
      .onSnapshot(s => {
        s.docChanges().forEach(d => {
          // We're interested in the following:
          // - newly added documents -- these are new changes for the map
          // - updates to the base change *only*, to act on a resync
          if (d.doc.exists && (d.doc.ref.isEqual(baseChangeRef) || d.oldIndex === -1)) {
            const chs = converter.convert(d.doc.data());
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
    const dref = (r as DataReference<T>).dref;
    this._tr = this._tr.delete(dref);
  }

  async get<T>(r: IDataReference<T>): Promise<T | undefined> {
    const dref = (r as DataReference<T>).dref;
    const result = await this._tr.get(dref);
    return result.exists ? r.convert(result.data()) : undefined;
  }

  async set<T>(r: IDataReference<T>, value: T): Promise<void> {
    const dref = (r as DataReference<T>).dref;
    this._tr = this._tr.set(dref, value);
  }

  async update<T>(r: IDataReference<T>, changes: any): Promise<void> {
    const dref = (r as DataReference<T>).dref;
    this._tr = this._tr.update(dref, changes);
  }
}