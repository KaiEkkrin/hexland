import { IAdventure, IPlayer } from '../data/adventure';
import { IChange, IChanges, ChangeType, ChangeCategory, ITokenAdd, ITokenMove, ITokenRemove, IAreaAdd, IAreaRemove, INoteAdd, INoteRemove, IWallAdd, IWallRemove } from '../data/change';
import { IInvite } from '../data/invite';
import { IMap, MapType } from '../data/map';
import { IProfile } from '../data/profile';
import { IToken, defaultToken, IFeature, defaultArea, defaultWall } from '../data/feature';
import { IGridCoord, defaultGridCoord, IGridEdge, defaultGridEdge } from '../data/coord';
import { IAnnotation, defaultAnnotation } from '../data/annotation';

// Converts raw data from Firestore to data matching the given interface,
// filling in the missing properties with default values.
export interface IConverter<T> {
  convert(rawData: any): T;
}

// This is the simplest possible shallow conversion.
// Use this when we don't have any structure data that needs to be recursed
// into, or where we just don't care because the data format has never changed
class ShallowConverter<T> implements IConverter<T> {
  private readonly _defaultValue: T;

  constructor(defaultValue: T) {
    this._defaultValue = defaultValue;
  }

  convert(rawData: any): T {
    return { ...this._defaultValue, ...rawData };
  }
}

// The recursing converter helps provide special-case conversion for named fields.
class RecursingConverter<T> extends ShallowConverter<T> {
  private readonly _specialCases: { [name: string]: (converted: T, raw: any) => T };

  constructor(defaultValue: T, specialCases: { [name: string]: (converted: T, raw: any) => T }) {
    super(defaultValue);
    this._specialCases = specialCases;
  }

  convert(rawData: any): T {
    let converted = super.convert(rawData);
    for (const c in this._specialCases) {
      const raw = c in rawData ? rawData[c] : {};
      converted = this._specialCases[c](converted, raw);
    }

    return converted;
  }
}

// The change converter does different things depending on the flags.
// I've been super pedantic here, which I don't technically need to be right now
// (except for the token id), but it will prove helpful later on if I alter
// more things (and should also be good for security, because it will make a
// well-behaving client less inclined to believe a malicious one.)
class ChangeConverter extends ShallowConverter<IChange> {
  constructor() {
    super({ ty: ChangeType.Add, cat: ChangeCategory.Undefined });
  }

  private convertArea(converted: IChange, rawData: any): IChange {
    switch (converted.ty) {
      case ChangeType.Add: return areaAddConverter.convert(rawData);
      case ChangeType.Remove: return areaRemoveConverter.convert(rawData);
      default: return converted;
    }
  }

  private convertNote(converted: IChange, rawData: any): IChange {
    switch (converted.ty) {
      case ChangeType.Add: return noteAddConverter.convert(rawData);
      case ChangeType.Remove: return noteRemoveConverter.convert(rawData);
      default: return converted;
    }
  }

  private convertToken(converted: IChange, rawData: any): IChange {
    switch (converted.ty) {
      case ChangeType.Add: return tokenAddConverter.convert(rawData);
      case ChangeType.Move: return tokenMoveConverter.convert(rawData);
      case ChangeType.Remove: return tokenRemoveConverter.convert(rawData);
      default: return converted;
    }
  }

  private convertWall(converted: IChange, rawData: any): IChange {
    switch (converted.ty) {
      case ChangeType.Add: return wallAddConverter.convert(rawData);
      case ChangeType.Remove: return wallRemoveConverter.convert(rawData);
      default: return converted;
    }
  }

  convert(rawData: any): IChange {
    const converted = super.convert(rawData);
    switch (converted.cat) {
      case ChangeCategory.Area: return this.convertArea(converted, rawData);
      case ChangeCategory.Note: return this.convertNote(converted, rawData);
      case ChangeCategory.Token: return this.convertToken(converted, rawData);
      case ChangeCategory.Wall: return this.convertWall(converted, rawData);
      default: return converted;
    }
  }
}

const changeConverter = new ChangeConverter();

const areaAddConverter = new RecursingConverter<IAreaAdd>({
  ty: ChangeType.Add,
  cat: ChangeCategory.Area,
  feature: defaultArea
}, {
  "feature": (conv, raw) => {
    conv.feature = areaConverter.convert(raw);
    return conv;
  }
});

const areaRemoveConverter = new RecursingConverter<IAreaRemove>({
  ty: ChangeType.Remove,
  cat: ChangeCategory.Area,
  position: defaultGridCoord
}, {
  "position": (conv, raw) => {
    conv.position = gridCoordConverter.convert(raw);
    return conv;
  }
});

const noteAddConverter = new RecursingConverter<INoteAdd>({
  ty: ChangeType.Add,
  cat: ChangeCategory.Note,
  feature: defaultAnnotation
}, {
  "feature": (conv, raw) => {
    conv.feature = annotationConverter.convert(raw);
    return conv;
  }
});

const noteRemoveConverter = new RecursingConverter<INoteRemove>({
  ty: ChangeType.Remove,
  cat: ChangeCategory.Note,
  position: defaultGridCoord
}, {
  "position": (conv, raw) => {
    conv.position = gridCoordConverter.convert(raw);
    return conv;
  }
});

const tokenAddConverter = new RecursingConverter<ITokenAdd>({
  ty: ChangeType.Add,
  cat: ChangeCategory.Token,
  feature: defaultToken
}, {
  "feature": (conv, raw) => {
    conv.feature = tokenConverter.convert(raw);
    return conv;
  }
});

const tokenMoveConverter = new RecursingConverter<ITokenMove>({
  ty: ChangeType.Move,
  cat: ChangeCategory.Token,
  newPosition: defaultGridCoord,
  oldPosition: defaultGridCoord,
  tokenId: undefined,
}, {
  "newPosition": (conv, raw) => {
    conv.newPosition = gridCoordConverter.convert(raw);
    return conv;
  },
  "oldPosition": (conv, raw) => {
    conv.oldPosition = gridCoordConverter.convert(raw);
    return conv;
  }
});

const tokenRemoveConverter = new RecursingConverter<ITokenRemove>({
  ty: ChangeType.Remove,
  cat: ChangeCategory.Token,
  position: defaultGridCoord,
  tokenId: undefined
}, {
  "position": (conv, raw) => {
    conv.position = gridCoordConverter.convert(raw);
    return conv;
  }
});

const wallAddConverter = new RecursingConverter<IWallAdd>({
  ty: ChangeType.Add,
  cat: ChangeCategory.Wall,
  feature: defaultWall
}, {
  "feature": (conv, raw) => {
    conv.feature = wallConverter.convert(raw);
    return conv;
  }
});

const wallRemoveConverter = new RecursingConverter<IWallRemove>({
  ty: ChangeType.Remove,
  cat: ChangeCategory.Wall,
  position: defaultGridEdge
}, {
  "position": (conv, raw) => {
    conv.position = gridEdgeConverter.convert(raw);
    return conv;
  }
});

const annotationConverter = new RecursingConverter<IAnnotation>(defaultAnnotation, {
  "position": (conv, raw) => {
    conv.position = gridCoordConverter.convert(raw);
    return conv;
  },
});

const areaConverter = new RecursingConverter<IFeature<IGridCoord>>(defaultArea, {
  "position": (conv, raw) => {
    conv.position = gridCoordConverter.convert(raw);
    return conv;
  },
});

const tokenConverter = new RecursingConverter<IToken>(defaultToken, {
  "position": (conv, raw) => {
    conv.position = gridCoordConverter.convert(raw);
    return conv;
  },
});

const wallConverter = new RecursingConverter<IFeature<IGridEdge>>(defaultWall, {
  "position": (conv, raw) => {
    conv.position = gridEdgeConverter.convert(raw);
    return conv;
  },
});

const gridCoordConverter = new ShallowConverter<IGridCoord>(defaultGridCoord);
const gridEdgeConverter = new ShallowConverter<IGridEdge>(defaultGridEdge);

// *** EXPORTS ***

export const adventureConverter = new ShallowConverter<IAdventure>({
  name: "",
  description: "",
  owner: "",
  ownerName: "",
  maps: []
});

export const inviteConverter = new ShallowConverter<IInvite>({
  adventureName: "",
  owner: "",
  ownerName: "",
  timestamp: 0
});

export const mapConverter = new ShallowConverter<IMap>({
  adventureName: "",
  name: "",
  description: "",
  owner: "",
  ty: MapType.Square,
  ffa: false
});

export const playerConverter = new ShallowConverter<IPlayer>({
  id: "",
  name: "",
  description: "",
  owner: "",
  ownerName: "",
  playerId: "",
  playerName: ""
});

export const profileConverter = new ShallowConverter<IProfile>({
  name: "",
  adventures: undefined,
  latestMaps: undefined
});

export const changesConverter = new RecursingConverter<IChanges>({
  chs: [],
  timestamp: 0,
  incremental: true,
  resync: false,
  user: ""
}, {
  "chs": (conv, raw) => {
    conv.chs = Array.isArray(raw) ? raw.map(r => changeConverter.convert(r)) : [];
    return conv;
  }
});