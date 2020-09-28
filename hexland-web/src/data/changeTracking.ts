import { IAnnotation } from "./annotation";
import { IChange, ChangeCategory, ChangeType, IAreaAdd, IAreaRemove, ITokenAdd, IWallAdd, IWallRemove, ITokenRemove, ITokenMove, INoteAdd, INoteRemove, createAreaAdd, createWallAdd, createNoteAdd, createTokenAdd } from "./change";
import { IGridCoord, IGridEdge } from "./coord";
import { IFeature, IToken, IFeatureDictionary } from "./feature";
import { IMap } from "./map";
import { IUserPolicy } from "./policy";

import { v4 as uuidv4 } from 'uuid';
import fluent from "fluent-iterable";

export interface IChangeTracker {
  objectCount: number;

  areaAdd: (feature: IFeature<IGridCoord>) => boolean;
  areaRemove: (position: IGridCoord) => IFeature<IGridCoord> | undefined;
  tokenAdd: (map: IMap, user: string, feature: IToken, oldPosition: IGridCoord | undefined) => boolean;
  tokenRemove: (map: IMap, user: string, position: IGridCoord, tokenId: string | undefined) => IToken | undefined;
  wallAdd: (feature: IFeature<IGridEdge>) => boolean;
  wallRemove: (position: IGridEdge) => IFeature<IGridEdge> | undefined;
  noteAdd: (feature: IAnnotation) => boolean;
  noteRemove: (position: IGridCoord) => IAnnotation | undefined;

  // Called after a batch of changes has been completed, before any redraw.
  changesApplied(): void;

  // Called after a batch of changes is aborted
  changesAborted(): void;

  // Gets a minimal collection of changes to add everything in this tracker.
  getConsolidated: () => IChange[];
}

// A simple implementation for testing, etc.
export class SimpleChangeTracker implements IChangeTracker {
  private readonly _areas: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>;
  private readonly _tokens: IFeatureDictionary<IGridCoord, IToken>;
  private readonly _walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>;
  private readonly _notes: IFeatureDictionary<IGridCoord, IAnnotation>;
  private readonly _userPolicy: IUserPolicy | undefined;

  private _objectCount = 0;

  constructor(
    areas: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    tokens: IFeatureDictionary<IGridCoord, IToken>,
    walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    notes: IFeatureDictionary<IGridCoord, IAnnotation>,
    userPolicy: IUserPolicy | undefined
  ) {
    this._areas = areas;
    this._tokens = tokens;
    this._walls = walls;
    this._notes = notes;
    this._userPolicy = userPolicy;
  }

  private policyAdd<K extends IGridCoord, F extends IFeature<K>>(
    dict: IFeatureDictionary<K, F>,
    feature: F
  ): boolean {
    const added = dict.add(feature);
    if (added) {
      ++this._objectCount;
      if (this._userPolicy !== undefined && this._objectCount > this._userPolicy.objects) {
        // Oops
        this.policyRemove(dict, feature.position);
        return false;
      }
    }

    return added;
  }

  private policyRemove<K extends IGridCoord, F extends IFeature<K>>(
    dict: IFeatureDictionary<K, F>,
    position: K
  ): F | undefined {
    const removed = dict.remove(position);
    if (removed !== undefined) {
      --this._objectCount;
    }

    return removed;
  }

  get objectCount() { return this._objectCount; }

  areaAdd(feature: IFeature<IGridCoord>) {
    return this.policyAdd(this._areas, feature);
  }

  areaRemove(position: IGridCoord) {
    return this.policyRemove(this._areas, position);
  }

  clear() {
    this._areas.clear();
    this._tokens.clear();
    this._walls.clear();
    this._notes.clear();
    this._objectCount = 0;
  }

  tokenAdd(map: IMap, user: string, feature: IToken, oldPosition: IGridCoord | undefined) {
    return this.policyAdd(this._tokens, feature);
  }

  tokenRemove(map: IMap, user: string, position: IGridCoord, tokenId: string | undefined) {
    const removed = this.policyRemove(this._tokens, position);
    if (removed !== undefined && removed.id !== tokenId) {
      // Oops, ID mismatch, put it back!
      this.policyAdd(this._tokens, removed);
      return undefined;
    }

    return removed;
  }

  wallAdd(feature: IFeature<IGridEdge>) {
    return this.policyAdd(this._walls, feature);
  }

  wallRemove(position: IGridEdge) {
    return this.policyRemove(this._walls, position);
  }

  noteAdd(feature: IAnnotation) {
    return this.policyAdd(this._notes, feature);
  }

  noteRemove(position: IGridCoord) {
    return this.policyRemove(this._notes, position);
  }

  changesApplied() {
    return;
  }

  changesAborted() {
    return;
  }

  getConsolidated(): IChange[] {
    const all: IChange[] = [];
    this._areas.forEach(f => all.push(createAreaAdd(f)));
    
    this._tokens.forEach(f => {
      // `undefined` isn't supported in Firestore, so correct any token without
      // an id now
      if (f.id === undefined) {
        f.id = uuidv4();
      }

      return all.push(createTokenAdd(f));
    });

    this._walls.forEach(f => all.push(createWallAdd(f)));
    this._notes.forEach(f => all.push(createNoteAdd(f)));
    return all;
  }
}

// Helps work out the theoretical change in object count from a list of changes
export function netObjectCount(chs: Iterable<IChange>) {
  return fluent(chs).map(ch => {
    switch (ch.ty) {
      case ChangeType.Add: return 1;
      case ChangeType.Remove: return -1;
      default: return 0;
    }
  }).sum();
}

// Handles a whole collection of (ordered) changes in one go, either applying or rejecting all.
export function trackChanges(map: IMap, tracker: IChangeTracker, chs: Iterable<IChange>, user: string): boolean {
  // Begin applying each change (in practice, this does all the removes.)
  const applications: (IChangeApplication[]) = [];
  for (const c of chs) {
    const a = trackChange(map, tracker, c, user);
    if (a === undefined) {
      // Changes failed -- revert any previously applied and return with an error
      revertChanges(applications);
      tracker.changesAborted();
      return false;
    }

    applications.push(a);
  }

  // Complete applying all the changes
  if (continueApplications(applications) === true) {
    tracker.changesApplied();
    return true;
  }

  // If we got here, that failed and has been rolled back, but we still need to roll back
  // the first pass:
  revertChanges(applications);
  tracker.changesAborted();
  return false;
}

function continueApplications(applications: IChangeApplication[]): boolean {
  const revertFunctions: IRevert[] = [];
  for (const a of applications) {
    const revert = a.continue();
    if (revert === undefined) {
      // Changes failed -- revert any previously applied
      revertChanges(revertFunctions);
      return false;
    }

    revertFunctions.push(revert);
  }

  return true;
}

function revertChanges(revertFunctions: IRevert[]) {
  while (revertFunctions.length > 0) {
    const r = revertFunctions.pop();
    r?.revert();
  }
}

// Change tracking is a two-step process that can be reverted if any change fails at either step
// of the process.  This interface declares a change that has been accepted and that can be completed
// (returning a revert method) or reverted directly:
interface IChangeApplication extends IRevert {
  continue(): IRevert | undefined;
}

interface IRevert {
  revert(): void;
}

const doNothing: IRevert = {
  revert: () => undefined
}

// True for the map owner, or if the map is in free-for-all mode
function canDoAnything(map: IMap, user: string) {
  return map.ffa === true || user === map.owner;
}

// Interprets a change and issues the right command.  Returns a restore function in case
// we want to roll back to the previous state, or undefined if this change couldn't be applied.
// (For now, I'm going to be quite pedantic and reject even things like remove-twice, because
// I want to quickly detect any out-of-sync situations...)
function trackChange(map: IMap, tracker: IChangeTracker, ch: IChange, user: string): IChangeApplication | undefined {
  switch (ch.cat) {
    case ChangeCategory.Area: return canDoAnything(map, user) ? trackAreaChange(tracker, ch) : undefined;
    case ChangeCategory.Token: return trackTokenChange(map, tracker, ch, user);
    case ChangeCategory.Wall: return canDoAnything(map, user) ? trackWallChange(tracker, ch) : undefined;
    case ChangeCategory.Note: return canDoAnything(map, user) ? trackNoteChange(tracker, ch) : undefined;
    default: return undefined;
  }
}

function trackAreaChange(tracker: IChangeTracker, ch: IChange): IChangeApplication | undefined {
  switch (ch.ty) {
    case ChangeType.Add:
      const chAdd = ch as IAreaAdd;
      return {
        revert: () => undefined,
        continue: function () {
          const added = tracker.areaAdd(chAdd.feature);
          return added ? {
            revert: function () {
              tracker.areaRemove(chAdd.feature.position);
            }
          } : undefined;
        }
      };

    case ChangeType.Remove:
      const chRemove = ch as IAreaRemove;
      const removed = tracker.areaRemove(chRemove.position);
      return removed === undefined ? undefined : {
        revert: function () {
          if (removed !== undefined) { tracker.areaAdd(removed); }
        },
        continue: function () { return doNothing; }
      }

    default: return undefined;
  }
}

function trackTokenChange(map: IMap, tracker: IChangeTracker, ch: IChange, user: string): IChangeApplication | undefined {
  switch (ch.ty) {
    case ChangeType.Add:
      const chAdd = ch as ITokenAdd;
      return canDoAnything(map, user) ? {
        revert: () => undefined,
        continue: function () {
          const added = tracker.tokenAdd(map, user, chAdd.feature, undefined);
          return added ? {
            revert: function () {
              tracker.tokenRemove(map, user, chAdd.feature.position, chAdd.feature.id);
            }
          } : undefined;
        }
      } : undefined;

    case ChangeType.Remove:
      if (!canDoAnything(map, user)) {
        return undefined;
      }
      const chRemove = ch as ITokenRemove;
      const removed = tracker.tokenRemove(map, user, chRemove.position, chRemove.tokenId);
      return removed === undefined ? undefined : {
        revert: function () {
          if (removed !== undefined) { tracker.tokenAdd(map, user, removed, undefined); }
        },
        continue: function () { return doNothing; }
      }

    case ChangeType.Move:
      const chMove = ch as ITokenMove;
      const moved = tracker.tokenRemove(map, user, chMove.oldPosition, chMove.tokenId);
      return moved === undefined ? undefined : {
        revert: function () {
          if (moved !== undefined) { tracker.tokenAdd(map, user, moved, undefined); }
        },
        continue: function () {
          // Check whether this user is allowed to move this token
          if (!canDoAnything(map, user) && moved?.players.find(p => p === user) === undefined) {
            return undefined;
          }

          const toAdd = { ...moved, position: chMove.newPosition };
          const added = tracker.tokenAdd(map, user, toAdd as IToken, chMove.oldPosition);
          return added ? {
            revert: function revert() {
              tracker.tokenRemove(map, user, chMove.newPosition, chMove.tokenId);
            }
          } : undefined;
        }
      };

    default: return undefined;
  }
}

function trackWallChange(tracker: IChangeTracker, ch: IChange): IChangeApplication | undefined {
  switch (ch.ty) {
    case ChangeType.Add:
      const chAdd = ch as IWallAdd;
      return {
        revert: () => undefined,
        continue: function () {
          const added = tracker.wallAdd(chAdd.feature);
          return added ? {
            revert: function () {
              tracker.wallRemove(chAdd.feature.position);
            }
          } : undefined;
        }
      }

    case ChangeType.Remove:
      const chRemove = ch as IWallRemove;
      const removed = tracker.wallRemove(chRemove.position);
      return removed === undefined ? undefined : {
        revert: function () {
          if (removed !== undefined) { tracker.wallAdd(removed); }
        },
        continue: function () { return doNothing; }
      }

    default: return undefined;
  }
}

function trackNoteChange(tracker: IChangeTracker, ch: IChange): IChangeApplication | undefined {
  switch (ch.ty) {
    case ChangeType.Add:
      const chAdd = ch as INoteAdd;
      return {
        revert: () => undefined,
        continue: function () {
          const added = tracker.noteAdd(chAdd.feature);
          return added ? {
            revert: function () {
              tracker.noteRemove(chAdd.feature.position);
            }
          } : undefined;
        }
      }

    case ChangeType.Remove:
      const chRemove = ch as INoteRemove;
      const removed = tracker.noteRemove(chRemove.position);
      return removed === undefined ? undefined : {
        revert: function () {
          if (removed !== undefined) { tracker.noteAdd(removed); }
        },
        continue: function () { return doNothing; }
      }

    default: return undefined;
  }
}