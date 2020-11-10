import { IAnnotation } from "./annotation";
import { IGridCoord, IGridEdge } from "./coord";
import { IFeature, IToken } from "./feature";
import { Timestamp } from './types';

// This represents a collection of changes all made to the map at once.
export type Changes = {
  chs: Change[];
  timestamp: Timestamp | number; // initialise this to `serverTimestamp`;
                                 // use the number instead for testing only
  incremental: boolean;
  resync: boolean; // true if the recipient of this change should do a resync
                   // (only if incremental === false)
  user: string; // the uid that made these changes.
};

// This represents any change made to the map.
export type Change =
  AreaAdd | AreaRemove | TokenAdd | TokenMove | TokenRemove |
  WallAdd | WallRemove | NoteAdd | NoteRemove | NoChange;

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

export type AreaAdd = {
  ty: ChangeType.Add;
  cat: ChangeCategory.Area;
  feature: IFeature<IGridCoord>;
};

export type AreaRemove = {
  ty: ChangeType.Remove;
  cat: ChangeCategory.Area;
  position: IGridCoord;
};

export type TokenAdd = {
  ty: ChangeType.Add;
  cat: ChangeCategory.Token;
  feature: IToken;
};

export type TokenMove = {
  ty: ChangeType.Move;
  cat: ChangeCategory.Token;
  newPosition: IGridCoord;
  oldPosition: IGridCoord;
  tokenId: string; // must match what's currently there
};

export type TokenRemove = {
  ty: ChangeType.Remove;
  cat: ChangeCategory.Token;
  position: IGridCoord;
  tokenId: string; // must match what's currently there
};

export type WallAdd = {
  ty: ChangeType.Add;
  cat: ChangeCategory.Wall;
  feature: IFeature<IGridEdge>;
};

export type WallRemove = {
  ty: ChangeType.Remove;
  cat: ChangeCategory.Wall;
  position: IGridEdge;
};

export type NoteAdd = {
  ty: ChangeType.Add;
  cat: ChangeCategory.Note;
  feature: IAnnotation;
};

export type NoteRemove = {
  ty: ChangeType.Remove;
  cat: ChangeCategory.Note;
  position: IGridCoord;
};

export type NoChange = {
  ty: ChangeType.Add;
  cat: ChangeCategory.Undefined;
};

export function createAreaAdd(feature: IFeature<IGridCoord>): AreaAdd {
  return {
    ty: ChangeType.Add,
    cat: ChangeCategory.Area,
    feature: feature
  };
}

export function createAreaRemove(position: IGridCoord): AreaRemove {
  return {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Area,
    position: position
  };
}

export function createTokenAdd(feature: IToken): TokenAdd {
  return {
    ty: ChangeType.Add,
    cat: ChangeCategory.Token,
    feature: feature
  };
}

export function createTokenMove(oldPosition: IGridCoord, newPosition: IGridCoord, tokenId: string): TokenMove {
  return {
    ty: ChangeType.Move,
    cat: ChangeCategory.Token,
    oldPosition: oldPosition,
    newPosition: newPosition,
    tokenId: tokenId
  };
}

export function createTokenRemove(position: IGridCoord, tokenId: string): TokenRemove {
  return {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Token,
    position: position,
    tokenId: tokenId
  };
}

export function createWallAdd(feature: IFeature<IGridEdge>): WallAdd {
  return {
    ty: ChangeType.Add,
    cat: ChangeCategory.Wall,
    feature: feature
  };
}

export function createWallRemove(position: IGridEdge): WallRemove {
  return {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Wall,
    position: position
  };
}

export function createNoteAdd(feature: IAnnotation): NoteAdd {
  return {
    ty: ChangeType.Add,
    cat: ChangeCategory.Note,
    feature: feature
  };
}

export function createNoteRemove(position: IGridCoord): NoteRemove {
  return {
    ty: ChangeType.Remove,
    cat: ChangeCategory.Note,
    position: position
  };
}