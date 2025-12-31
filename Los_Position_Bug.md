# LoSPosition Type Mismatch Bug in resetView()

## Summary

Commit `e337ea5f752b0b59a1940dcf13031af827f636ba` ("Use centre point for multi-tile tokens") introduced a bug where `resetView()` fails to properly center on a token's position when LoS is active.

## Root Cause

The commit changed `getLoSPositions()` to return `LoSPosition[]` instead of `GridCoord[]`, but didn't update `resetView()` to handle the new type.

### The LoSPosition Interface

```typescript
// was-web/src/data/losPosition.ts
export interface LoSPosition {
  centre: THREE.Vector3;  // World coordinates (x, y, z)
  radius: number;         // World space radius
}
```

### The Bug in resetView()

In `resetView()` (mapStateMachine.ts, lines ~1335-1350):

```typescript
// Line 1338 - losPositions[0] is now a LoSPosition, not GridCoord
centreOn = losPositions[0];

// Line 1343 - WRONG: LoSPosition doesn't have .x and .y directly
console.debug("resetView: centre on " + centreOn.x + ", " + centreOn.y);

// Line 1347 - WRONG: createCoordCentre expects a GridCoord, not LoSPosition
const delta = this._gridGeometry.createCoordCentre(this._scratchVector3, centreOn, 0)
```

### What Changed in the Commit

**Before (GridCoord[]):**
```typescript
private getLoSPositions() {
  // ...
  return myTokens.map(t => t.position);  // Returns GridCoord[]
}
```

**After (LoSPosition[]):**
```typescript
private getLoSPositions(): LoSPosition[] | undefined {
  // ...
  return myTokens.map(t =>
    getTokenLoSPosition(t, this._tokenGeometry, this._gridGeometry, 0)
  );  // Returns LoSPosition[]
}
```

## Impact

When `resetView()` is called and there are LoS positions (i.e., tokens to center on):
1. `centreOn` is assigned a `LoSPosition` object
2. `centreOn.x` and `centreOn.y` are `undefined` (LoSPosition has `centre.x`, not `x`)
3. `createCoordCentre(centreOn)` receives wrong data type
4. The camera translation calculation produces incorrect/undefined values
5. This causes the grid extension algorithm to search in the wrong area, potentially triggering the infinite loop

## Fix Required

The `resetView()` function needs to be updated to handle the `LoSPosition` type. Options:

### Option 1: Use the world coordinates directly
Since `LoSPosition.centre` is already in world coordinates, we can use it directly for camera translation without going through `createCoordCentre`:

```typescript
if (centreOn === undefined) {
  const losPositions = this.getLoSPositions();
  if (losPositions !== undefined && losPositions.length > 0) {
    // LoSPosition.centre is already in world coordinates
    const worldCentre = losPositions[0].centre;
    const worldToClient = getWorldToClient(this._scratchMatrix1, this._drawing);
    const clientCentre = this._scratchVector3.copy(worldCentre).applyMatrix4(worldToClient);
    this._cameraTranslation.set(clientCentre.x, -clientCentre.y, 0);
    centreOn = { x: 0, y: 0 }; // Dummy to skip the GridCoord path below
  }
}
```

### Option 2: Store the original GridCoord alongside LoSPosition
Add the original `GridCoord` to `LoSPosition` for cases where grid coordinates are needed:

```typescript
export interface LoSPosition {
  position: GridCoord;    // Original grid position (for resetView)
  centre: THREE.Vector3;  // World coordinates (x, y, z)
  radius: number;         // World space radius
}
```

### Option 3: Create a separate method for resetView centering
Keep `getLoSPositions()` returning `LoSPosition[]` for LoS rendering, but add a method that returns just the first token's `GridCoord` for centering purposes.

## Files Affected

- `was-web/src/models/mapStateMachine.ts` - `resetView()` method
- `was-web/src/data/losPosition.ts` - `LoSPosition` interface (potentially)
- `was-web/src/data/tokenGeometry.ts` - `getTokenLoSPosition()` function (potentially)

## Git Bisect Result

The bug was introduced in commit `e337ea5f752b0b59a1940dcf13031af827f636ba` and confirmed absent in the main branch prior to this commit.
