import { IAnnotation } from "./annotation";
import { IChange, ChangeCategory, ChangeType, IAreaAdd, IAreaRemove, ITokenAdd, IWallAdd, IWallRemove, ITokenRemove, ITokenMove, INoteAdd, INoteRemove } from "./change";
import { IGridCoord, IGridEdge } from "./coord";
import { IFeature, IToken, IFeatureDictionary } from "./feature";
import { IMap } from "./map";

export interface IChangeTracker {
  areaAdd: (feature: IFeature<IGridCoord>) => boolean;
  areaRemove: (position: IGridCoord) => IFeature<IGridCoord> | undefined;
  tokenAdd: (map: IMap, user: string, feature: IToken, oldPosition: IGridCoord | undefined) => boolean;
  tokenRemove: (map: IMap, user: string, position: IGridCoord) => IToken | undefined;
  wallAdd: (feature: IFeature<IGridEdge>) => boolean;
  wallRemove: (position: IGridEdge) => IFeature<IGridEdge> | undefined;
  noteAdd: (feature: IAnnotation) => boolean;
  noteRemove: (position: IGridCoord) => IAnnotation | undefined;

  // Called after a batch of changes has been completed, before any redraw
  changesApplied(): void;

  // Gets a minimal collection of changes to add everything in this tracker.
  getConsolidated: () => IChange[];
}

// A simple implementation for testing, etc.
export class SimpleChangeTracker implements IChangeTracker {
  private readonly _areas: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>;
  private readonly _tokens: IFeatureDictionary<IGridCoord, IToken>;
  private readonly _walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>;
  private readonly _notes: IFeatureDictionary<IGridCoord, IAnnotation>;

  constructor(
    areas: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    tokens: IFeatureDictionary<IGridCoord, IToken>,
    walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    notes: IFeatureDictionary<IGridCoord, IAnnotation>
  ) {
    this._areas = areas;
    this._tokens = tokens;
    this._walls = walls;
    this._notes = notes;
  }

  areaAdd(feature: IFeature<IGridCoord>) {
    return this._areas.add(feature);
  }

  areaRemove(position: IGridCoord) {
    return this._areas.remove(position);
  }

  tokenAdd(map: IMap, user: string, feature: IToken, oldPosition: IGridCoord | undefined) {
    return this._tokens.add(feature);
  }

  tokenRemove(map: IMap, user: string, position: IGridCoord) {
    return this._tokens.remove(position);
  }

  wallAdd(feature: IFeature<IGridEdge>) {
    return this._walls.add(feature);
  }

  wallRemove(position: IGridEdge) {
    return this._walls.remove(position);
  }

  noteAdd(feature: IAnnotation) {
    return this._notes.add(feature);
  }

  noteRemove(position: IGridCoord) {
    return this._notes.remove(position);
  }

  changesApplied() {
  }

  getConsolidated(): IChange[] {
    var all: IChange[] = [];
    this._areas.forEach(f => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Area,
      feature: f
    } as IAreaAdd));
    
    this._tokens.forEach(f => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: f
    } as ITokenAdd));

    this._walls.forEach(f => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Wall,
      feature: f
    } as IWallAdd));

    this._notes.forEach(f => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Note,
      feature: f
    } as INoteAdd));

    return all;
  }
}

// Handles a whole collection of (ordered) changes in one go, either applying or rejecting all.
export function trackChanges(map: IMap, tracker: IChangeTracker, chs: IChange[], user: string): boolean {
  // Begin applying each change (in practice, this does all the removes.)
  var applications: (IChangeApplication[]) = [];
  for (var i = 0; i < chs.length; ++i) {
    var a = trackChange(map, tracker, chs[i], user);
    if (a === undefined) {
      // Changes failed -- revert any previously applied and return with an error
      revertChanges(applications);
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
  return false;
}

function continueApplications(applications: IChangeApplication[]): boolean {
  var revertFunctions: IRevert[] = [];
  for (var i = 0; i < applications.length; ++i) {
    var revert = applications[i].continue();
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
    var r = revertFunctions.pop();
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
  revert() {}
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
      var chAdd = ch as IAreaAdd;
      return {
        revert: function () { },
        continue: function () {
          var added = tracker.areaAdd(chAdd.feature);
          return added ? {
            revert: function () {
              tracker.areaRemove(chAdd.feature.position);
            }
          } : undefined;
        }
      };

    case ChangeType.Remove:
      var chRemove = ch as IAreaRemove;
      var removed = tracker.areaRemove(chRemove.position);
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
      var chAdd = ch as ITokenAdd;
      return canDoAnything(map, user) ? {
        revert: function () {},
        continue: function () {
          var added = tracker.tokenAdd(map, user, chAdd.feature, undefined);
          return added ? {
            revert: function () {
              tracker.tokenRemove(map, user, chAdd.feature.position);
            }
          } : undefined;
        }
      } : undefined;

    case ChangeType.Remove:
      if (!canDoAnything(map, user)) {
        return undefined;
      }
      var chRemove = ch as ITokenRemove;
      var removed = tracker.tokenRemove(map, user, chRemove.position);
      return removed === undefined ? undefined : {
        revert: function () {
          if (removed !== undefined) { tracker.tokenAdd(map, user, removed, undefined); }
        },
        continue: function () { return doNothing; }
      }

    case ChangeType.Move:
      var chMove = ch as ITokenMove;
      var moved = tracker.tokenRemove(map, user, chMove.oldPosition);
      return moved === undefined ? undefined : {
        revert: function () {
          if (moved !== undefined) { tracker.tokenAdd(map, user, moved, undefined); }
        },
        continue: function () {
          // Check whether this user is allowed to move this token
          if (!canDoAnything(map, user) && moved?.players.find(p => p === user) === undefined) {
            return undefined;
          }

          // The Object.assign() jiggle here should ensure we retain any extra properties
          // of the existing object as we create the moved one
          var toAdd = {};
          Object.assign(toAdd, moved);
          (toAdd as IToken).position = chMove.newPosition;
          var added = tracker.tokenAdd(map, user, toAdd as IToken, chMove.oldPosition);
          return added ? {
            revert: function revert() {
              tracker.tokenRemove(map, user, chMove.newPosition);
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
      var chAdd = ch as IWallAdd;
      return {
        revert: function () {},
        continue: function () {
          var added = tracker.wallAdd(chAdd.feature);
          return added ? {
            revert: function () {
              tracker.wallRemove(chAdd.feature.position);
            }
          } : undefined;
        }
      }

    case ChangeType.Remove:
      var chRemove = ch as IWallRemove;
      var removed = tracker.wallRemove(chRemove.position);
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
      var chAdd = ch as INoteAdd;
      return {
        revert: function () {},
        continue: function () {
          var added = tracker.noteAdd(chAdd.feature);
          return added ? {
            revert: function () {
              tracker.noteRemove(chAdd.feature.position);
            }
          } : undefined;
        }
      }

    case ChangeType.Remove:
      var chRemove = ch as INoteRemove;
      var removed = tracker.noteRemove(chRemove.position);
      return removed === undefined ? undefined : {
        revert: function () {
          if (removed !== undefined) { tracker.noteAdd(removed); }
        },
        continue: function () { return doNothing; }
      }

    default: return undefined;
  }
}