import { IChange, ChangeCategory, ChangeType, IAreaAdd, IAreaRemove, ITokenAdd, IWallAdd, IWallRemove, ITokenRemove, ITokenMove } from "./change";
import { IGridCoord, IGridEdge, coordString, edgeString } from "./coord";
import { IFeature, IToken, FeatureDictionary } from "./feature";

export interface IChangeTracker {
  areaAdd: (feature: IFeature<IGridCoord>) => boolean;
  areaRemove: (position: IGridCoord) => IFeature<IGridCoord> | undefined;
  tokenAdd: (feature: IToken) => boolean;
  tokenRemove: (position: IGridCoord) => IToken | undefined;
  wallAdd: (feature: IFeature<IGridEdge>) => boolean;
  wallRemove: (position: IGridEdge) => IFeature<IGridEdge> | undefined;

  // Gets a minimal collection of changes to add everything in this tracker.
  getConsolidated: () => IChange[];
}

// A simple implementation for testing, etc.
export class SimpleChangeTracker implements IChangeTracker {
  private readonly _areas: FeatureDictionary<IGridCoord, IFeature<IGridCoord>>;
  private readonly _tokens: FeatureDictionary<IGridCoord, IToken>;
  private readonly _walls: FeatureDictionary<IGridEdge, IFeature<IGridEdge>>;

  constructor() {
    this._areas = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
    this._tokens = new FeatureDictionary<IGridCoord, IToken>(coordString);
    this._walls = new FeatureDictionary<IGridEdge, IFeature<IGridEdge>>(edgeString);
  }

  areaAdd(feature: IFeature<IGridCoord>) {
    return this._areas.addFeature(feature);
  }

  areaRemove(position: IGridCoord) {
    return this._areas.removeFeature(position);
  }

  tokenAdd(feature: IToken) {
    return this._tokens.addFeature(feature);
  }

  tokenRemove(position: IGridCoord) {
    return this._tokens.removeFeature(position);
  }

  wallAdd(feature: IFeature<IGridEdge>) {
    return this._walls.addFeature(feature);
  }

  wallRemove(position: IGridEdge) {
    return this._walls.removeFeature(position);
  }

  getConsolidated(): IChange[] {
    var all: IChange[] = [];
    this._areas.foreach((k, v) => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Area,
      feature: v
    } as IAreaAdd));
    
    this._tokens.foreach((k, v) => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Token,
      feature: v
    } as ITokenAdd));

    this._walls.foreach((k, v) => all.push({
      ty: ChangeType.Add,
      cat: ChangeCategory.Wall,
      feature: v
    } as IWallAdd));

    return all;
  }
}

// Handles a whole collection of (ordered) changes in one go, either applying or rejecting all.
export function trackChanges(tracker: IChangeTracker, chs: IChange[]): boolean {
  // Begin applying each change (in practice, this does all the removes.)
  var applications: (IChangeApplication[]) = [];
  for (var i = 0; i < chs.length; ++i) {
    var a = trackChange(tracker, chs[i]);
    if (a === undefined) {
      // Changes failed -- revert any previously applied and return with an error
      revertChanges(tracker, applications);
      return false;
    }

    applications.push(a);
  }

  // Complete applying all the changes
  if (continueApplications(tracker, applications) === true) {
    return true;
  }

  // If we got here, that failed and has been rolled back, but we still need to roll back
  // the first pass:
  revertChanges(tracker, applications);
  return false;
}

function continueApplications(tracker: IChangeTracker, applications: IChangeApplication[]): boolean {
  var revertFunctions: IRevert[] = [];
  for (var i = 0; i < applications.length; ++i) {
    var revert = applications[i].continue(tracker);
    if (revert === undefined) {
      // Changes failed -- revert any previously applied
      revertChanges(tracker, revertFunctions);
      return false;
    }

    revertFunctions.push(revert);
  }

  return true;
}

function revertChanges(tracker: IChangeTracker, revertFunctions: IRevert[]) {
  while (revertFunctions.length > 0) {
    var r = revertFunctions.pop();
    r?.revert(tracker);
  }
}

// Change tracking is a two-step process that can be reverted if any change fails at either step
// of the process.  This interface declares a change that has been accepted and that can be completed
// (returning a revert method) or reverted directly:
interface IChangeApplication extends IRevert {
  continue(tracker: IChangeTracker): IRevert | undefined;
}

interface IRevert {
  revert(tracker: IChangeTracker): void;
}

const doNothing: IRevert = {
  revert(tracker: IChangeTracker) {}
}

// Interprets a change and issues the right command.  Returns a restore function in case
// we want to roll back to the previous state, or undefined if this change couldn't be applied.
// (For now, I'm going to be quite pedantic and reject even things like remove-twice, because
// I want to quickly detect any out-of-sync situations...)
// TODO this is where we can reject attempts by a non-owner to change areas and walls or move
// another user's token, test for token overlaps, and all those nice things
function trackChange(tracker: IChangeTracker, ch: IChange): IChangeApplication | undefined {
  switch (ch.cat) {
    case ChangeCategory.Area: return trackAreaChange(tracker, ch);
    case ChangeCategory.Token: return trackTokenChange(tracker, ch);
    case ChangeCategory.Wall: return trackWallChange(tracker, ch);
    default: return undefined;
  }
}

function trackAreaChange(tracker: IChangeTracker, ch: IChange): IChangeApplication | undefined {
  switch (ch.ty) {
    case ChangeType.Add:
      var chAdd = ch as IAreaAdd;
      return {
        revert: function (tr: IChangeTracker) { },
        continue: function (tr: IChangeTracker) {
          var added = tr.areaAdd(chAdd.feature);
          return added ? {
            revert: function (tr2: IChangeTracker) {
              tr.areaRemove(chAdd.feature.position);
            }
          } : undefined;
        }
      };

    case ChangeType.Remove:
      var chRemove = ch as IAreaRemove;
      var removed = tracker.areaRemove(chRemove.position);
      return removed === undefined ? undefined : {
        revert: function (tr: IChangeTracker) {
          if (removed !== undefined) { tr.areaAdd(removed); }
        },
        continue: function (tr: IChangeTracker) { return doNothing; }
      }

    default: return undefined;
  }
}

function trackTokenChange(tracker: IChangeTracker, ch: IChange): IChangeApplication | undefined {
  switch (ch.ty) {
    case ChangeType.Add:
      var chAdd = ch as ITokenAdd;
      return {
        revert: function (tr: IChangeTracker) {},
        continue: function (tr: IChangeTracker) {
          var added = tr.tokenAdd(chAdd.feature);
          return added ? {
            revert: function (tr2: IChangeTracker) {
              tr.tokenRemove(chAdd.feature.position);
            }
          } : undefined;
        }
      }

    case ChangeType.Remove:
      var chRemove = ch as ITokenRemove;
      var removed = tracker.tokenRemove(chRemove.position);
      return removed === undefined ? undefined : {
        revert: function (tr: IChangeTracker) {
          if (removed !== undefined) { tr.tokenAdd(removed); }
        },
        continue: function (tr: IChangeTracker) { return doNothing; }
      }

    case ChangeType.Move:
      var chMove = ch as ITokenMove;
      var moved = tracker.tokenRemove(chMove.oldPosition);
      return moved === undefined ? undefined : {
        revert: function (tr: IChangeTracker) {
          if (moved !== undefined) { tr.tokenAdd(moved); }
        },
        continue: function (tr: IChangeTracker) {
          // The Object.assign() jiggle here should ensure we retain any extra properties
          // of the existing object as we create the moved one
          var toAdd = {};
          Object.assign(toAdd, moved);
          (toAdd as IToken).position = chMove.newPosition;
          var added = tr.tokenAdd(toAdd as IToken);
          return added ? {
            revert: function revert(tr2: IChangeTracker) {
              tr2.tokenRemove(chMove.newPosition);
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
        revert: function (tr: IChangeTracker) {},
        continue: function (tr: IChangeTracker) {
          var added = tr.wallAdd(chAdd.feature);
          return added ? {
            revert: function (tr2: IChangeTracker) {
              tr2.wallRemove(chAdd.feature.position);
            }
          } : undefined;
        }
      }

    case ChangeType.Remove:
      var chRemove = ch as IWallRemove;
      var removed = tracker.wallRemove(chRemove.position);
      return removed === undefined ? undefined : {
        revert: function (tr: IChangeTracker) {
          if (removed !== undefined) { tr.wallAdd(removed); }
        },
        continue: function (tr: IChangeTracker) { return doNothing; }
      }

    default: return undefined;
  }
}