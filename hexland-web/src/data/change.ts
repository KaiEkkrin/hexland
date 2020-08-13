import { IAnnotation } from "./annotation";
import { IGridCoord, IGridEdge } from "./coord";
import { IFeature, IToken } from "./feature";

// This represents a collection of changes all made to the map at once.
export interface IChanges {
  chs: IChange[];
  timestamp: firebase.firestore.FieldValue; // initialise this to `serverTimestamp`
  incremental: boolean;
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
  feature: IToken;
}

export interface ITokenMove extends IChange {
  newPosition: IGridCoord;
  oldPosition: IGridCoord;
}

export interface ITokenRemove extends IChange {
  position: IGridCoord;
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