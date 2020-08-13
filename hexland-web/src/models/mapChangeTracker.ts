import { MapColouring } from "./colouring";
import { IAnnotation } from "../data/annotation";
import { SimpleChangeTracker } from "../data/changeTracking";
import { IGridCoord, IGridEdge } from "../data/coord";
import { IFeatureDictionary, IFeature, IToken } from "../data/feature";
import { IMap } from "../data/map";

// This change tracker supports all our map features.
export class MapChangeTracker extends SimpleChangeTracker {
  private readonly _colouring: MapColouring;
  private readonly _handleChangesApplied: (() => void) | undefined;

  constructor(
    areas: IFeatureDictionary<IGridCoord, IFeature<IGridCoord>>,
    tokens: IFeatureDictionary<IGridCoord, IToken>,
    walls: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>>,
    notes: IFeatureDictionary<IGridCoord, IAnnotation>,
    colouring: MapColouring,
    handleChangesApplied?: (() => void) | undefined
  ) {
    super(areas, tokens, walls, notes);
    this._colouring = colouring;
    this._handleChangesApplied = handleChangesApplied;
  }

  tokenAdd(map: IMap, user: string, feature: IToken, oldPosition: IGridCoord | undefined) {
    // If this is a move, `oldPosition` will be set.
    // In non-FFA mode, non-owners can only move a token within its bounded
    // map area (the map colour of the old position must be the same as the
    // map colour of the new)
    if (map.ffa === false && user !== map.owner && oldPosition !== undefined &&
      this._colouring.colourOf(feature.position) !== this._colouring.colourOf(oldPosition)) {
      return false;
    }

    return super.tokenAdd(map, user, feature, oldPosition);
  }

  wallAdd(feature: IFeature<IGridEdge>) {
    var added = super.wallAdd(feature);
    if (added) {
      this._colouring.setWall(feature.position, true);
    }

    return added;
  }

  wallRemove(position: IGridEdge) {
    var removed = super.wallRemove(position);
    if (removed !== undefined) {
      this._colouring.setWall(position, false);
    }

    return removed;
  }

  changesApplied() {
    super.changesApplied();
    this._colouring.recalculate();
    this._handleChangesApplied?.();
  }
}