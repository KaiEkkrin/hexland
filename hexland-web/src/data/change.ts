import { IAnnotation } from "./annotation";
import { IGridCoord, IGridEdge } from "./coord";
import { IFeature, IToken } from "./feature";
import { Timestamp } from './types';

// This represents a collection of changes all made to the map at once.
export interface IChanges {
  chs: IChange[];
  timestamp: Timestamp | number; // initialise this to `serverTimestamp`;
                                 // use the number instead for testing only
  incremental: boolean;
  resync: boolean; // true if the recipient of this change should do a resync
                   // (only if incremental === false)
  user: string; // the uid that made these changes.
}

// This represents any change made to the map.
export interface IChange {
  ty: ChangeType;
  cat: ChangeCategory;
}

export enum ChangeType {
  Add = 1,
  Move = 2, // only applies to tokens
  Remove = 3
}

export enum ChangeCategory {
  Undefined = 0, // included so we can provide a default change that does nothing
  Area = 1,
  Token = 2,
  Wall = 3,
  Note = 4,
}

// We'll cast to one of these depending on the values of `ty` and `cat`
export interface IAreaAdd extends IChange {
  feature: IFeature<IGridCoord>;
}

export interface IAreaRemove extends IChange {
  position: IGridCoord;
}

export interface ITokenAdd extends IChange {
  feature: IToken<IGridCoord>;
}

export interface ITokenMove extends IChange {
  newPosition: IGridCoord;
  oldPosition: IGridCoord;
  tokenId: string | undefined; // must match what's currently there
}

export interface ITokenRemove extends IChange {
  position: IGridCoord;
  tokenId: string | undefined; // must match what's currently there
}

export interface IWallAdd extends IChange {
  feature: IFeature<IGridEdge>;
}

export interface IWallRemove extends IChange {
  position: IGridEdge;
}

export interface INoteAdd extends IChange {
  feature: IAnnotation;
}

export interface INoteRemove extends IChange {
  position: IGridCoord;
}

export function createAreaAdd(feature: IFeature<IGridCoord>): IAreaAdd {
  return {
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: feature
  };
}

export function createAreaRemove(position: IGridCoord): IAreaRemove {
  return {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: position
  };
}

export function createTokenAdd(feature: IToken<IGridCoord>): ITokenAdd {
  return {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: feature
  };
}

export function createTokenMove(oldPosition: IGridCoord, newPosition: IGridCoord, tokenId: string | undefined): ITokenMove {
  return {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    oldPosition: oldPosition,
    newPosition: newPosition,
    tokenId: tokenId
  };
}

export function createTokenRemove(position: IGridCoord, tokenId: string | undefined): ITokenRemove {
  return {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: position,
    tokenId: tokenId
  };
}

export function createWallAdd(feature: IFeature<IGridEdge>): IWallAdd {
  return {
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: feature
  };
}

export function createWallRemove(position: IGridEdge): IWallRemove {
  return {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: position
  };
}

export function createNoteAdd(feature: IAnnotation): INoteAdd {
  return {
    ty: ChangeType.Add,
    cat: ChangeCategory.Note,
    feature: feature
  };
}

export function createNoteRemove(position: IGridCoord): INoteRemove {
  return {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Note,
    position: position
  };
}