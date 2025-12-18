# Wall & Shadow Revival Plan

**Project**: Wall & Shadow (codename: Hexland)
**Document Version**: 1.2
**Date**: December 2025
**Status**: Revival in progress - Phase 1 complete, ready for Phase 2

## Progress Summary

### ✅ Completed
- **Phase 0**: Node.js 20 compatibility resolved (commit `0c87280`)
- **Dev Environment**: WSL2 dev container with GPU support fully configured
- **Playwright Migration**: Updated from v1.10 to v1.57 (commit `36aee46`)
- **E2E Tests**: 2 of 3 tests passing with regenerated snapshots
- **Phase 1.1**: Functions stabilization complete ✅
  - TSLint → ESLint 9.x migration
  - firebase-admin 9.3.0 → 13.6.0
  - firebase-functions 3.20.0 → 6.3.2
  - TypeScript 4.2.3 → 5.7.3
  - All 96 unit tests passing
- **Phase 1.2**: Web app stabilization complete ✅
  - TypeScript 4.5.5 → 5.7.x
  - RxJS 6.6.7 → 7.8.x (migrated all `toPromise()` → `firstValueFrom()`)
  - Three.js 0.137.0 → 0.137.5 (patch update)
  - @types/three 0.126.0 → 0.137.0 (aligned with Three.js)
  - @types/node 14.x → 20.x (aligned with Node.js 20)
  - Fixed TypeScript 5.x compatibility issues (variable shadowing, generic type inference)
  - Fixed CORS/region handling for Firebase Functions (emulator vs production)
  - All 96 unit tests passing
  - 2 of 3 E2E tests passing (map share test deferred to Phase 2)
- **Phase 1.3**: Dependency consolidation complete ✅
  - Three.js aligned: 0.137.5 in both web and functions
  - @types/three aligned: 0.137.0 in both web and functions
  - RxJS aligned: 7.8.x in both web and functions
  - Functions build and lint pass

### 📋 Not Started
- **Phase 2**: Modernization (Firebase v11, React 18, Router v6, Vite, Three.js 0.170)
  - ⚠️ Map share E2E test fix moved here (end of phase)
- **Phase 3**: Polish (Bootstrap 5, performance optimization)

## Recent Improvements (Since Plan Creation)

### Dev Container Enhancements
The development environment has been significantly improved for WSL2 and GPU support:

- **WSL2 Optimization** (`e245daf`) - Configured dev container for optimal WSL2 performance
- **GPU Support** (`e8d8e10`, `783ba6a`) - Added NVIDIA/AMD GPU support for better rendering
- **Volume Management** (`c11f543`, `3eb5c96`) - Fixed ownership and persistence of Docker volumes
- **Runtime Fixes** (`e204696`, `e296fc8`) - Resolved runtime errors for local development
- **Documentation** (`481ad15`, `9a0033c`) - Updated README with dev container workflow

These improvements ensure the dev environment is production-ready for the modernization phases ahead.

## Next Steps (Recommended Order)

1. **Begin Phase 2** - Major modernization efforts (Firebase v11, React 18, Router v6, Vite)
2. **Fix Map Share E2E Test** - At end of Phase 2 (requires dev container rebuild, deferred)

---

## Executive Summary

Wall & Shadow is a React-based virtual tabletop (VTT) application built on Firebase, featuring real-time collaborative map editing with Three.js-powered 3D rendering. The codebase is solid but relies entirely on deprecated and end-of-life dependencies.

### Revival Strategy

**Four-phase approach** to modernize the stack while maintaining functionality at every checkpoint:

1. **Phase 0: Emergency Fix** (1 day) - Resolve immediate Node.js version conflict
2. **Phase 1: Stabilization** (1-2 weeks) - Update to maintained versions without major refactoring
3. **Phase 2: Modernization** (3-4 weeks) - Migrate to modern tooling (Vite, Firebase v9, React 18)
4. **Phase 3: Polish** (1-2 weeks) - Bootstrap 5, performance optimization, deployment readiness

**Timeline**: 8 weeks (conservative, with thorough testing between phases)
**Risk Level**: Medium-High (complex Firebase and rendering migrations)
**Expected Outcome**: Fully deployable, production-ready application on modern stack

### Key Improvements

- **Performance**: ~80% smaller Firebase bundle, faster builds with Vite
- **Security**: All dependencies receiving security patches
- **Developer Experience**: Modern tooling, faster HMR, better TypeScript support
- **Maintainability**: Active ecosystem support for all dependencies

### Platform Support

**Primary Target**: Desktop browsers only
- **Firefox** (latest 2 versions)
- **Chrome** (latest 2 versions)
- **Chromium-based browsers** (Edge, Brave, Vivaldi, etc.)

**Deferred**: Safari, mobile (iOS/Android), and tablet support will be addressed post-revival. These platforms can be inventoried for issues during testing, but fixes are out of scope for this plan.

---

## Current State Assessment

### Dependency Inventory

#### Web Application (`hexland-web/package.json`)

| Dependency | Current | Target | Status | Impact |
|------------|---------|--------|--------|--------|
| React | 17.0.1 | 18.3.x | 🔴 Superseded | New root API required |
| react-scripts (CRA) | 4.0.3 | N/A (→Vite) | 🔴 **Deprecated Feb 2025** | Complete build system change |
| Firebase SDK | 8.0.0 | 11.x | 🔴 Superseded | Modular API, 80% smaller bundle |
| TypeScript | 4.2.3 | 5.7.x | 🟡 Behind | Smooth upgrade path |
| Three.js | 0.137.0 | 0.170.x | 🟡 Behind | Rendering pipeline testing critical |
| React Router | 5.2.0 | 6.28.x | 🔴 Superseded | Significant API changes |
| Bootstrap | 4.5.0 | 5.3.x | 🟡 Behind | jQuery removed, class name changes |
| RxJS | 6.6.6 | 7.8.x | 🟡 Behind | Minimal breaking changes |
| Playwright | 1.10.0 | 1.57.x | 🔴 Very outdated | 40+ versions behind |
| Testing Library | 9.3.2 | 16.x | 🔴 Outdated | React 18 compatibility |

#### Firebase Functions (`hexland-web/functions/package.json`)

| Dependency | Current | Target | Status | Impact |
|------------|---------|--------|--------|--------|
| Node.js | 14 | 20/22 | 🔴 **Decommissioned** | Critical - deployment disabled |
| firebase-admin | 9.3.0 | 13.x | 🔴 Outdated | Drop Node 14/16, require Node 18+ |
| firebase-functions | 3.13.0 | 6.x | 🔴 Outdated | API updates |
| TypeScript | 4.2.3 | 5.7.x | 🟡 Behind | Same as web app |
| TSLint | 6.1.3 | N/A (→ESLint) | 🔴 **Deprecated 2019** | Automated migration available |
| RxJS | 7.3.0 | 7.8.x | 🟢 Good | Minor update only |

🔴 = Critical / Deprecated
🟡 = Needs update
🟢 = Acceptable

### Critical Architecture Components

#### 1. Three.js Rendering Pipeline (`src/models/three/`)

**20+ custom rendering files** implementing:
- Abstract grid geometry system (hex & square grids)
- Instanced mesh rendering for performance
- Line-of-sight calculations with raycasting
- Shader-based filters and effects
- Token rendering with sprite support

**Risk**: Three.js API changes between 0.137 → 0.170 could break rendering
**Mitigation**: Comprehensive E2E snapshot testing, visual inspection

**Critical Files**:
- `gridGeometry.ts`, `hexGridGeometry.ts`, `squareGridGeometry.ts` - Grid abstraction
- `drawing.ts`, `drawingOrtho.ts` - Main rendering orchestration
- `instancedFeatures.ts` - Performance-critical instanced rendering
- `los.ts`, `losFilter.ts` - Line-of-sight calculations
- `walls.ts`, `tokenDrawingOrtho.ts` - Core visual elements

#### 2. Firebase Real-Time Sync (`src/services/`, `src/models/mapChangeTracker.ts`)

**Change-tracking system** for real-time collaboration:
- Base state in `maps/{id}/changes/base` document
- Incremental changes in `maps/{id}/changes/{changeId}` documents
- Client-side merge with conflict detection
- Optimistic updates with rollback

**Risk**: Firebase v8→v9 migration breaks Firestore listeners/converters
**Mitigation**: Direct migration with thorough testing of multi-user scenarios

**Critical Files**:
- `services/dataService.ts` - Core Firestore abstraction (Repository pattern)
- `services/converter.ts` - Data marshalling for Firestore
- `models/mapChangeTracker.ts` - Change tracking logic
- `models/mapStateMachine.ts` - Map interaction state machine

#### 3. Context Provider Chain (`src/App.tsx`)

**Nested dependency injection** via React Context:

```
FirebaseContextProvider (SDK initialization)
  └─ UserContextProvider (auth, dataService)
      └─ AnalyticsContextProvider (Google Analytics)
          └─ ProfileContextProvider (user profile data)
              └─ StatusContextProvider (network status, toasts)
                  └─ AdventureContextProvider (current adventure, players)
                      └─ MapContextProvider (current map, state machine)
```

**Risk**: React 18 Strict Mode double-mounting may cause duplicate subscriptions
**Mitigation**: Audit all `useEffect` cleanup functions

### Test Coverage

#### E2E Tests (`e2e/`)
- **Framework**: Playwright 1.10.0 (→1.57.x)
- **Method**: Visual regression with image snapshots
- **Coverage**: Map rendering output across browsers (Chromium, Firefox, WebKit)
- **Devices**: Desktop, laptop, iPhone 7, Pixel 2
- **Critical**: Must pass before declaring any phase complete

#### Unit Tests (`unit/`)
- **Framework**: Jest + ts-jest
- **Coverage**: Data models, services, business logic
- **Integration**: Firebase emulator for Firestore testing
- **Risk**: Testing Library version jump (9 → 16)

### Build Environment ✅ WORKING

#### Dev Container (`.devcontainer/`) ✅
- **Node.js**: 20 LTS with `NODE_OPTIONS=--openssl-legacy-provider` workaround
- **Firebase**: Emulators pre-configured (Firestore, Auth, Functions, Hosting)
- **Volumes**: Named Docker volume for performance (`hexland_workspace`)
- **Services**: Mock WebDAV storage on port 7000
- **GPU**: Support for NVIDIA/AMD GPUs for better rendering performance (commits `e8d8e10`, `783ba6a`)

**Status**: Dev container fully configured for WSL2 development with GPU support and optimized for local debugging (commits `e245daf`, `c11f543`, `e204696`).

#### Immediate Issue ✅ RESOLVED
**Functions package requires Node.js 14, dev environment uses Node.js 20** - ✅ Resolved in Phase 0 (commit `0c87280`).

---

## Phase 0: Emergency Fix ✅ COMPLETE

**Duration**: 1 day
**Goal**: Resolve Node.js version conflict so project builds in current dev environment
**Completed**: December 2025 (commit `0c87280`)

### Background

Firebase Functions v3.x required Node.js 14, which was decommissioned in early 2025. The dev container uses Node.js 20. This causes immediate build failures:

```
error functions@1.3.9: The engine "node" is incompatible with this module.
Expected version "14". Got "20.19.6"
```

### Tasks

#### 1. Update Functions Node.js Version

**File**: `/workspaces/hexland/hexland-web/functions/package.json`

```json
{
  "engines": {
    "node": "20"  // Changed from "14"
  }
}
```

**Rationale**: [Firebase Functions now supports Node.js 20 and 22](https://firebase.google.com/docs/functions/manage-functions), with Node.js 14/16 decommissioned.

#### 2. Verify Dev Environment

```bash
cd hexland-web/functions
yarn install
yarn build  # Should complete without errors
```

```bash
cd hexland-web
yarn install
yarn start  # Should start React dev server + Firebase emulators
```

#### 3. Test Basic Functionality

1. Navigate to http://localhost:5000
2. Create account (Firebase Auth emulator)
3. Create adventure
4. Create map (hex or square)
5. Verify map renders

### Success Criteria ✅

- [x] No Node.js version conflicts
- [x] `yarn build` succeeds in both `hexland-web/` and `hexland-web/functions/`
- [x] Application starts locally without errors
- [x] Firebase emulators functional
- [x] Can authenticate and create basic adventure/map

### Rollback Point

**Git commit**: `Phase 0: Fix Node.js 20 compatibility`

If issues arise, revert this commit and investigate further.

---

## Phase 1: Stabilization 🚧 IN PROGRESS

**Duration**: 1-2 weeks
**Goal**: Update to maintained versions without major refactoring
**Status**: Phase 1.2 partially complete (Playwright updated), Phase 1.1 and 1.3 not started

### Strategy

Update dependencies to latest **within their current major versions** where possible, or to minimally-breaking newer versions. Focus on getting security patches and stable foundations before Phase 2's major migrations.

### Recent Commits
- `36aee46` - Migrate Playwright e2e tests from v1.10 to v1.57
- `ea6449d` - Fix playwright launch options and login link selector
- `4f5dacc` - Make the throttling test more robust
- `e9e983c` - Add new e2e snapshots
- `709bc58` - Partial fixes and debugging for third playwright test (map share test still needs work)

---

### 1.1: Functions Stabilization

#### Dependencies

| Package | Current | Target | Notes |
|---------|---------|--------|-------|
| firebase-admin | 9.3.0 | 13.x | [Requires Node.js 18+](https://firebase.google.com/support/release-notes/admin/node) |
| firebase-functions | 3.13.0 | 6.x | Latest major version |
| TypeScript | 4.2.3 | 5.7.x | Smooth upgrade path |
| TSLint | 6.1.3 | → ESLint 9.x | [Deprecated since 2019](https://github.com/palantir/tslint/issues/4534) |

#### Step 1: Migrate TSLint → ESLint

**Why**: TSLint was deprecated in 2019 and stopped receiving updates in 2020.

**Tool**: [`tslint-to-eslint-config`](https://www.npmjs.com/package/tslint-to-eslint-config)

```bash
cd hexland-web/functions
npx tslint-to-eslint-config
```

**Manual Steps**:

1. Review generated `.eslintrc.js`
2. Align with web app's ESLint config (both should use `react-app` base)
3. Update `package.json`:
   ```json
   {
     "scripts": {
       "lint": "eslint --ext .ts src"
     },
     "devDependencies": {
       "@typescript-eslint/eslint-plugin": "^7.0.0",
       "@typescript-eslint/parser": "^7.0.0",
       "eslint": "^9.0.0"
     }
   }
   ```
4. Remove `tslint.json` and `tslint` from dependencies
5. Run `yarn lint` - fix any errors

**Reference**: [VS Code TSLint to ESLint Migration](https://code.visualstudio.com/api/advanced-topics/tslint-eslint-migration)

#### Step 2: Update Firebase Admin SDK

```json
{
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0"
  }
}
```

**Breaking Changes to Review**:
- **v10**: Introduced modular API (but backwards compatible)
- **v11**: Dropped Node.js 12, required Node.js 14+
- **v12**: Dropped Node.js 14/16, required Node.js 18+
- **v13**: Latest stable ([Release notes](https://github.com/firebase/firebase-admin-node/releases))

**Most imports should remain compatible**, but check:
- `admin.firestore()` still works (non-modular API is fine for Functions)
- Storage operations in `functions/src/services/storage.ts`
- Admin data service in `functions/src/services/adminDataService.ts`

**Test**: Deploy to Functions emulator, trigger test function

#### Step 3: Update TypeScript

```json
{
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Configuration Updates** (`functions/tsconfig.json`):
- Review for deprecated `compilerOptions`
- Modern recommendation: `target: "ES2022"` (Node.js 20 supports it)
- Keep `module: "commonjs"` (required for Firebase Functions)

**Fix Type Errors**:
- Stricter inference may catch previously missed errors
- Fix as needed (likely minimal changes)

**Test**: `yarn build` with no TypeScript errors

#### Success Criteria - Phase 1.1

- [ ] ESLint replaces TSLint, `yarn lint` passes
- [ ] Firebase Admin SDK v13.x installed
- [ ] Firebase Functions SDK v6.x installed
- [ ] TypeScript 5.7.x compiles without errors
- [ ] Functions deploy successfully to emulator
- [ ] Can call functions from web app (test image upload function)

**Files Modified**:
- `/workspaces/hexland/hexland-web/functions/package.json`
- `/workspaces/hexland/hexland-web/functions/tslint.json` → `.eslintrc.js`
- `/workspaces/hexland/hexland-web/functions/tsconfig.json`
- `/workspaces/hexland/hexland-web/functions/src/**/*.ts` (type fixes as needed)

---

### 1.2: Web App Stabilization ✅ COMPLETE

#### Dependencies (Conservative Updates)

| Package | Current | Target | Status |
|---------|---------|--------|--------|
| TypeScript | 4.5.5 | 5.7.x | ✅ Complete |
| Playwright | 1.10.0 | 1.57.x | ✅ Complete |
| Three.js | 0.137.0 | 0.137.5 | ✅ Complete |
| @types/three | 0.126.0 | 0.137.0 | ✅ Complete |
| RxJS | 6.6.7 | 7.8.x | ✅ Complete |
| @types/node | 14.x | 20.x | ✅ Complete |

#### Step 1: Update TypeScript

```json
{
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^20.0.0"
  }
}
```

**Configuration Updates** (`tsconfig.json`):
- Modern `target: "ES6"` can stay (handled by build tool)
- Verify React 17 types still compatible

**Test**: `yarn build` compiles successfully

#### Step 2: Update Playwright ✅ COMPLETE

**Completed**: December 2025 (commit `36aee46`)

```json
{
  "devDependencies": {
    "playwright": "^1.57.0",
    "@types/jest-image-snapshot": "^4.1.3"
  }
}
```

**API Changes** ([Release notes](https://github.com/microsoft/playwright/releases)):
- `npx playwright install` to download new browser binaries
- Review `e2e/jest.config.js` for any deprecated config
- Update `expect-playwright` if needed

**Critical**: Re-run all E2E tests, may need to regenerate snapshots:

```bash
cd hexland-web
yarn test:e2e
```

If visual differences appear, **manually verify** rendering is correct, then update snapshots:

```bash
yarn test:e2e -u  # Update snapshots
```

**Status**: ✅ Playwright migrated, snapshots regenerated. 2 of 3 tests passing (map share test still needs work).

#### Step 3: Update RxJS 6 → 7

```json
{
  "dependencies": {
    "rxjs": "^7.8.0"
  }
}
```

**Breaking Changes** ([RxJS 7 Migration](https://rxjs.dev/6-to-7-change-summary)):
- `toPromise()` deprecated → use `lastValueFrom()` or `firstValueFrom()`
- Import paths: operators can now import from `rxjs` directly (not required, but available)
- Stricter types (TypeScript 4.2+ required ✓)

**Files to Review**:
- Search for `toPromise()`: `grep -r "toPromise" src/`
- Replace with `lastValueFrom()` or `firstValueFrom()` from `rxjs`

**Example**:
```typescript
// Before (RxJS 6)
import { Observable } from 'rxjs';
const result = await observable.toPromise();

// After (RxJS 7)
import { Observable, lastValueFrom } from 'rxjs';
const result = await lastValueFrom(observable);
```

**Test**: Data service subscriptions work correctly, no console warnings

#### Step 4: Update Three.js (Patch)

```json
{
  "dependencies": {
    "three": "^0.137.5",
    "@types/three": "^0.137.5"
  }
}
```

**Why Patch Only**: Staying in 0.137.x minimizes risk while getting security fixes. Phase 2.5 will do the major update to 0.170.x.

**Security Context**: [CVE-2022-0177](https://github.com/advisories/GHSA-7vvq-7r29-5vg3) was fixed in 0.137.0, so we're already patched. Patch updates ensure no regressions.

**Test**:
- Run E2E tests (rendering snapshots)
- Visual inspection: hex grid, square grid, tokens, walls, LOS

#### Success Criteria - Phase 1.2 ✅

- [x] TypeScript 5.7.x compiles web app without errors
- [x] Playwright 1.57.x tests pass (snapshots may need regeneration) - **2 of 3 tests passing** (map share test deferred)
- [x] RxJS 7.x subscriptions work, no `toPromise()` deprecation warnings
- [x] Three.js rendering identical (E2E snapshots pass)
- [x] `yarn build` succeeds (with `NODE_OPTIONS=--openssl-legacy-provider`)
- [x] `yarn test:unit` passes (96 tests)

**Files Modified**:
- `/workspaces/hexland/hexland-web/package.json` - Updated dependencies
- `/workspaces/hexland/hexland-web/src/services/objectCache.ts` - RxJS 7 migration (3 instances)
- `/workspaces/hexland/hexland-web/unit/services/functions.test.ts` - RxJS 7 migration (5 instances)
- `/workspaces/hexland/hexland-web/src/components/MapContextProvider.tsx` - Fixed variable shadowing
- `/workspaces/hexland/hexland-web/src/models/three/textCreator.ts` - Fixed Three.js Font import
- `/workspaces/hexland/hexland-web/src/services/dataService.ts` - Fixed generic type casting
- `/workspaces/hexland/hexland-web/src/components/FirebaseContextProvider.tsx` - Fixed CORS/region handling

---

### 1.3: Consolidate Dependencies ✅ COMPLETE

**Goal**: Ensure shared dependencies are aligned between web and functions.

| Dependency | Web | Functions | Status |
|------------|-----|-----------|--------|
| RxJS | 7.8.x | 7.8.x | ✅ Aligned |
| TypeScript | 5.7.x | 5.7.x | ✅ Aligned |
| Three.js | 0.137.5 | 0.137.5 | ✅ Aligned |
| @types/three | 0.137.0 | 0.137.0 | ✅ Aligned |

**Test**: `cd hexland-web/functions && yarn build` ✅ Passes

---

### Success Criteria - Phase 1 Complete ✅

- [x] All dependencies on **maintained versions** (receiving security patches)
- [x] No webpack deprecation warnings (note: `NODE_OPTIONS=--openssl-legacy-provider` still required)
- [x] Both web and functions build successfully: `yarn build`
- [x] Unit tests pass: `yarn test:unit` (96 tests)
- [x] E2E tests pass: `yarn test:e2e` - **2 of 3 tests passing** (map share test deferred to Phase 2)
- [x] **Manual testing** (critical) - verify before starting Phase 2:
  - [x] Create adventure
  - [x] Create hex map
  - [x] Create square map
  - [x] Draw walls on both grid types
  - [x] Place tokens
  - [x] Move tokens
  - [x] Test line-of-sight
  - [x] Upload image
  - [x] Create sprite
  - [x] Test real-time sync (open map in two browsers, verify changes sync)

### Risk Assessment - Phase 1

**Medium Risk**:
- **Playwright 1.10 → 1.57**: 40+ major versions, significant API evolution
  - *Mitigation*: Small test suite, manual updates manageable
- **Three.js rendering**: Even patch updates can affect visual output
  - *Mitigation*: E2E snapshot tests catch differences

**Low Risk**:
- **TypeScript 4.2 → 5.7**: Excellent backwards compatibility
- **RxJS 6 → 7**: Well-documented breaking changes, minimal impact
- **Firebase Admin**: Good API stability, mostly additive changes

### Rollback Point

**Git commit**: `Phase 1: Stabilize on maintained dependencies`

**Git tag**: `v1.3.10-phase1`

---

## Phase 2: Modernization

**Duration**: 3-4 weeks
**Goal**: Migrate to modern tooling and APIs (major refactoring phase)

### Overview

This phase involves the most significant changes:
1. Firebase SDK v8 → v11 (modular API, direct migration)
2. React 17 → 18 (new root API)
3. React Router v5 → v6 (route syntax overhaul)
4. Create React App → Vite (complete build system change)
5. Three.js 0.137 → 0.170 (API updates)

**Strategy**: Tackle in order of dependency (Firebase first, then React, then build tool).

---

### 2.1: Firebase v8 → v11 Modular SDK

**Complexity**: HIGH (touches 50+ files)
**Duration**: 1-2 weeks
**Approach**: **Direct migration** (per user preference - no compat layer)

#### Background

Firebase v9 introduced a modular API that enables tree-shaking, resulting in [~80% smaller bundles](https://firebase.google.com/docs/web/modular-upgrade). The migration requires refactoring all Firebase imports and calls.

**v8 (Old)**:
```typescript
import firebase from 'firebase/app';
import 'firebase/firestore';

const db = firebase.firestore();
const docRef = db.collection('adventures').doc(id);
```

**v11 (Modular)**:
```typescript
import { getFirestore, collection, doc } from 'firebase/firestore';

const db = getFirestore();
const docRef = doc(collection(db, 'adventures'), id);
```

#### Step 1: Update Dependencies

```json
{
  "dependencies": {
    "firebase": "^11.0.0"
  }
}
```

**Remove**: `@firebase/rules-unit-testing` (v1.x doesn't work with v11, update or use new version)

#### Step 2: Migrate Firebase Initialization

**File**: `/workspaces/hexland/hexland-web/src/components/FirebaseContextProvider.tsx`

**Changes**:
```typescript
// Old v8
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/storage';
import 'firebase/functions';

firebase.initializeApp(config);

// New v11
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Provide via context
```

**Reference**: [Firebase v9 Upgrade Guide](https://firebase.google.com/docs/web/modular-upgrade)

#### Step 3: Migrate Authentication

**File**: `/workspaces/hexland/hexland-web/src/services/auth.ts`

**Common changes**:
```typescript
// Old
import firebase from 'firebase/app';
firebase.auth().signInWithEmailAndPassword(email, password);
firebase.auth().signOut();
firebase.auth().onAuthStateChanged(callback);

// New
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
const auth = getAuth();
signInWithEmailAndPassword(auth, email, password);
signOut(auth);
onAuthStateChanged(auth, callback);
```

**Reference**: [Auth Modular API](https://firebase.google.com/docs/auth/web/start)

#### Step 4: Migrate Firestore (Critical)

**File**: `/workspaces/hexland/hexland-web/src/services/dataService.ts`

This is the **most complex migration** - it abstracts Firestore for the entire app.

**Key Changes**:
```typescript
// Old v8
import firebase from 'firebase/app';
const db = firebase.firestore();
const docRef = db.collection('adventures').doc(id);
docRef.onSnapshot(callback);
docRef.set(data);

// New v11
import { getFirestore, collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
const db = getFirestore();
const docRef = doc(db, 'adventures', id);
onSnapshot(docRef, callback);
setDoc(docRef, data);
```

**Converter Migration**:
```typescript
// Old v8
docRef.withConverter(converter);

// New v11
const docRef = doc(db, 'adventures', id).withConverter(converter);
```

**Reference**: [Firestore Modular API](https://firebase.google.com/docs/firestore/query-data/get-data)

**Files to Update** (Firestore-heavy):
- `src/services/dataService.ts` - Core abstraction **[CRITICAL]**
- `src/services/converter.ts` - Data marshalling **[CRITICAL]**
- `src/models/mapChangeTracker.ts` - Real-time sync **[CRITICAL]**
- All context providers using Firestore

**Test After Each File**:
- [ ] Adventures load
- [ ] Maps load
- [ ] Real-time updates work (two browsers)
- [ ] Change tracking doesn't break

#### Step 5: Migrate Storage

**File**: `/workspaces/hexland/hexland-web/src/services/storage.ts`

```typescript
// Old v8
import firebase from 'firebase/app';
const ref = firebase.storage().ref(path);
ref.put(file);

// New v11
import { getStorage, ref, uploadBytes } from 'firebase/storage';
const storage = getStorage();
const storageRef = ref(storage, path);
uploadBytes(storageRef, file);
```

**Reference**: [Storage Modular API](https://firebase.google.com/docs/storage/web/start)

#### Step 6: Migrate Functions

**File**: `/workspaces/hexland/hexland-web/src/services/functions.ts`

```typescript
// Old v8
import firebase from 'firebase/app';
const callable = firebase.functions().httpsCallable('functionName');
callable(data);

// New v11
import { getFunctions, httpsCallable } from 'firebase/functions';
const functions = getFunctions();
const callable = httpsCallable(functions, 'functionName');
callable(data);
```

#### Step 7: Update Timestamp Handling

**File**: `/workspaces/hexland/hexland-web/src/data/types.ts`

```typescript
// Old v8
import firebase from 'firebase/app';
export type Timestamp = firebase.firestore.FieldValue;

// New v11
import { Timestamp } from 'firebase/firestore';
export type { Timestamp };
```

#### Step 8: Bundle Size Validation

**Before migration**:
```bash
yarn build
ls -lh build/static/js/main.*.js  # Record size
```

**After migration**:
```bash
yarn build
ls -lh build/static/js/main.*.js  # Should be ~80% smaller
```

**Expected**: Main bundle reduction from ~2MB → ~400KB (Firebase portion)

#### Success Criteria - Phase 2.1

- [ ] All Firebase imports use modular API (`firebase/firestore`, etc.)
- [ ] No v8 imports remaining: `grep -r "from 'firebase/app'" src/` returns nothing
- [ ] Authentication works (sign in, sign out, session persistence)
- [ ] Adventures load and can be created
- [ ] Maps load and can be created
- [ ] **Real-time sync works** (critical test):
  - [ ] Open same map in two browsers
  - [ ] Add wall in browser A → appears in browser B
  - [ ] Move token in browser B → appears in browser A
- [ ] Image upload works
- [ ] Firebase Functions callable from web app
- [ ] Bundle size reduced by ~70-80%
- [ ] All unit tests pass
- [ ] All E2E tests pass

**Files Modified** (Major):
- `/workspaces/hexland/hexland-web/src/components/FirebaseContextProvider.tsx`
- `/workspaces/hexland/hexland-web/src/services/dataService.ts` **[CRITICAL]**
- `/workspaces/hexland/hexland-web/src/services/converter.ts` **[CRITICAL]**
- `/workspaces/hexland/hexland-web/src/services/auth.ts`
- `/workspaces/hexland/hexland-web/src/services/functions.ts`
- `/workspaces/hexland/hexland-web/src/services/storage.ts`
- `/workspaces/hexland/hexland-web/src/data/types.ts`
- All components using Firebase contexts (30+ files)

**Reference**: [Refactor React app with Firebase v9](https://blog.logrocket.com/refactor-react-app-firebase-v9-web-sdk/)

---

### 2.2: React 17 → React 18

**Complexity**: MEDIUM
**Duration**: 3-5 days

#### Background

[React 18](https://react.dev/blog/2022/03/08/react-18-upgrade-guide) introduced concurrent rendering, automatic batching, and new APIs. The migration is mostly straightforward with a few breaking changes.

#### Breaking Changes

1. **New Root API** (required):
   - `ReactDOM.render()` → `createRoot()`
2. **Automatic Batching**:
   - State updates in promises/setTimeout now batched (usually good)
3. **Strict Mode Changes**:
   - Development mode mounts/unmounts/remounts components twice
   - Ensures proper cleanup functions
4. **TypeScript Types**:
   - `@types/react` and `@types/react-dom` include breaking changes

#### Step 1: Update Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

#### Step 2: Update Entry Point

**File**: `/workspaces/hexland/hexland-web/src/index.tsx`

```typescript
// Old React 17
import ReactDOM from 'react-dom';
import App from './App';

ReactDOM.render(
  <StrictMode>
    <App />
  </StrictMode>,
  document.getElementById('root')
);

// New React 18
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

#### Step 3: Audit Context Providers

React 18 Strict Mode in development will **mount → unmount → remount** every component to detect side effects.

**Check all context providers** in `/workspaces/hexland/hexland-web/src/components/*ContextProvider.tsx`:

```typescript
// Ensure all useEffect hooks have cleanup
useEffect(() => {
  const unsubscribe = firebase.onSnapshot(callback);

  return () => unsubscribe(); // CRITICAL: cleanup function
}, []);
```

**Files to audit**:
- `FirebaseContextProvider.tsx`
- `UserContextProvider.tsx`
- `ProfileContextProvider.tsx`
- `AdventureContextProvider.tsx`
- `MapContextProvider.tsx`

**Test**: Open/close maps multiple times, check for memory leaks (Firebase listener count shouldn't grow).

#### Step 4: Review Automatic Batching

React 18 batches state updates in promises, setTimeout, and native events (React 17 only batched in React events).

**Most apps benefit** from this, but check if any code relies on synchronous state updates:

```typescript
// If you need to opt-out (rare):
import { flushSync } from 'react-dom';

flushSync(() => {
  setState(value);
}); // Forces synchronous update
```

**Likely not needed** for this app, but be aware if behavior changes.

#### Success Criteria - Phase 2.2

- [ ] React 18 root API in use (`createRoot`)
- [ ] No console warnings about deprecated APIs
- [ ] All context providers initialize correctly
- [ ] No duplicate Firebase listeners (check in dev tools)
- [ ] State updates behave correctly (test form inputs, modal dialogs)
- [ ] No memory leaks when opening/closing maps repeatedly
- [ ] All unit tests pass
- [ ] All E2E tests pass

**Files Modified**:
- `/workspaces/hexland/hexland-web/package.json`
- `/workspaces/hexland/hexland-web/src/index.tsx`
- Review all `src/components/*ContextProvider.tsx` files

**Reference**: [React 18 Upgrade Guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)

---

### 2.3: React Router v5 → v6

**Complexity**: MEDIUM-HIGH
**Duration**: 1 week

#### Background

[React Router v6](https://reactrouter.com/en/main/upgrading/v5) is a complete rewrite with significant API changes. However, this app has only 7 routes, making direct migration feasible.

#### Breaking Changes

1. `<Switch>` → `<Routes>`
2. `<Route component={...}>` → `<Route element={<...>}>`
3. `useHistory()` → `useNavigate()`
4. `match.params` → `useParams()`
5. Nested routes use different syntax
6. Path syntax: wildcards only at end of path

#### Step 1: Update Dependencies

```json
{
  "dependencies": {
    "react-router-dom": "^6.28.0",
    "react-router-bootstrap": "^0.26.0"
  },
  "devDependencies": {
    // Remove @types/react-router-dom (types now built-in)
  }
}
```

#### Step 2: Update Route Definitions

**File**: `/workspaces/hexland/hexland-web/src/App.tsx`

```typescript
// Old v5
import { Route, Switch } from 'react-router-dom';

<Switch>
  <Route exact path="/" component={Home} />
  <Route exact path="/adventure/:adventureId" component={AdventurePage} />
  <Route exact path="/adventure/:adventureId/map/:mapId" component={MapPage} />
  <Route exact path="/invite/:inviteId" component={InvitePage} />
  <Route exact path="/login" component={Login} />
  <Route exact path="/shared" component={Shared} />
  <Route exact path="/all" component={All} />
</Switch>

// New v6
import { Route, Routes } from 'react-router-dom';

<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/adventure/:adventureId" element={<AdventurePage />} />
  <Route path="/adventure/:adventureId/map/:mapId" element={<MapPage />} />
  <Route path="/invite/:inviteId" element={<InvitePage />} />
  <Route path="/login" element={<Login />} />
  <Route path="/shared" element={<Shared />} />
  <Route path="/all" element={<All />} />
</Routes>
```

**Note**: `exact` is no longer needed (v6 matches exactly by default).

#### Step 3: Update Navigation Hooks

**Find all `useHistory` usage**:
```bash
grep -r "useHistory" src/
```

**Replace with `useNavigate`**:
```typescript
// Old v5
import { useHistory } from 'react-router-dom';
const history = useHistory();
history.push('/path');
history.replace('/path');
history.goBack();

// New v6
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();
navigate('/path');
navigate('/path', { replace: true });
navigate(-1); // go back
```

#### Step 4: Update Route Parameters

**Old v5**:
```typescript
import { useRouteMatch } from 'react-router-dom';
const match = useRouteMatch<{ adventureId: string }>();
const { adventureId } = match.params;
```

**New v6**:
```typescript
import { useParams } from 'react-router-dom';
const { adventureId } = useParams<{ adventureId: string }>();
```

#### Step 5: Update React Router Bootstrap

Check if [react-router-bootstrap v0.26](https://www.npmjs.com/package/react-router-bootstrap) is compatible with v6.

**Usage**: Search for `LinkContainer` and similar components, ensure they still work.

#### Success Criteria - Phase 2.3

- [ ] All routes render correctly
- [ ] Navigation works (links, programmatic navigation)
- [ ] URL parameters accessible via `useParams()`
- [ ] Browser back/forward buttons work
- [ ] No v5 imports remaining: `grep -r "react-router-dom" src/` shows only v6 APIs
- [ ] All unit tests pass
- [ ] All E2E tests pass

**Files Modified**:
- `/workspaces/hexland/hexland-web/package.json`
- `/workspaces/hexland/hexland-web/src/App.tsx`
- `/workspaces/hexland/hexland-web/src/components/Routing.tsx`
- All components using `useHistory`, `useParams`, `useLocation` (grep to find)

**Reference**: [React Router v6 Migration Guide](https://reactrouter.com/en/main/upgrading/v5)

---

### 2.4: Create React App → Vite

**Complexity**: HIGH (complete build system change)
**Duration**: 1-2 weeks

#### Background

[Create React App was deprecated in February 2025](https://react.dev/blog/2025/02/14/sunsetting-create-react-app). The React team recommends migrating to frameworks (Next.js) or build tools ([Vite](https://vitejs.dev/)).

**Why Vite**:
- ✅ Faster dev server (ESBuild-powered)
- ✅ Faster production builds (Rollup)
- ✅ Better HMR (Hot Module Replacement)
- ✅ Smaller bundles
- ✅ Official React + TypeScript template
- ✅ Active development

#### Step 1: Install Vite

```bash
cd hexland-web
yarn add -D vite @vitejs/plugin-react
```

#### Step 2: Create Vite Config

**File**: `/workspaces/hexland/hexland-web/vite.config.ts` (new)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
  },
  build: {
    outDir: 'build',
  },
});
```

#### Step 3: Move HTML Entry Point

**Move**: `public/index.html` → `index.html` (root)

**Update** `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wall & Shadow</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <!-- Add script tag for Vite entry point -->
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
```

**Update asset paths**: Vite serves from `/` root, not `/public/`:
- `/logo192.png` → `/logo192.png` (stays same)
- `%PUBLIC_URL%` → remove (not needed in Vite)

#### Step 4: Update Environment Variables

**Vite uses `import.meta.env` instead of `process.env`**:

```bash
grep -r "process.env.REACT_APP" src/
```

**Replace**:
```typescript
// Old CRA
const apiKey = process.env.REACT_APP_API_KEY;

// New Vite
const apiKey = import.meta.env.VITE_API_KEY;
```

**Rename environment files**:
- `.env` variables: `REACT_APP_*` → `VITE_*`

**Add TypeScript types** for `import.meta.env`:

**File**: `/workspaces/hexland/hexland-web/src/vite-env.d.ts` (new)

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  // Add other env vars here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

#### Step 5: Update Package Scripts

**File**: `/workspaces/hexland/hexland-web/package.json`

```json
{
  "scripts": {
    "start": "run-p --race dev:firebase dev:vite",
    "dev:firebase": "firebase serve -p 3400",
    "dev:vite": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "jest",
    "test:unit": "jest --config ./unit/jest.config.js --watchAll",
    "test:e2e": "jest --config ./e2e/jest.config.js --watchAll"
  }
}
```

**Note**: Changed `dev:react` to `dev:vite`.

#### Step 6: Configure Jest for Vite

Jest doesn't understand Vite's module resolution by default.

**Option 1: Keep Jest with transformation**:

```bash
yarn add -D vite-jest
```

**Update** `unit/jest.config.js`:
```javascript
module.exports = {
  preset: 'vite-jest',
  testEnvironment: 'node',
  // ... rest of config
};
```

**Option 2: Migrate to Vitest** (Vite-native, recommended):

```bash
yarn add -D vitest @vitest/ui
```

**Update** scripts:
```json
{
  "scripts": {
    "test:unit": "vitest --config ./unit/vitest.config.ts"
  }
}
```

**Recommendation**: Keep Jest initially for stability, migrate to Vitest in Phase 3 if desired.

#### Step 7: Fix Import Extensions

Vite is stricter about import paths. **May** need explicit extensions in some cases:

```typescript
// If Vite complains:
import logo from './logo.svg?url'; // Explicit URL import
```

**Most imports should work as-is**, but check if Vite dev server shows errors.

#### Step 8: Update ESLint Config

CRA embedded ESLint config won't work. **Extract to standalone file**:

**File**: `/workspaces/hexland/hexland-web/.eslintrc.js` (new)

```javascript
module.exports = {
  extends: ['react-app', 'react-app/jest'],
  rules: {
    // Custom rules if any
  },
};
```

#### Step 9: Remove Create React App

**Uninstall**:
```bash
yarn remove react-scripts
```

**Remove**:
- `browserslist` from `package.json` (Vite uses modern defaults)
- `eslintConfig` from `package.json` (now in `.eslintrc.js`)

#### Step 10: Test Vite Build

```bash
yarn dev:vite  # Should start on http://localhost:5000
```

**Check**:
- App loads
- HMR works (edit a file, see instant update)
- No console errors

```bash
yarn build  # Should output to build/
yarn preview  # Serve production build
```

#### Success Criteria - Phase 2.4

- [ ] Vite dev server runs on port 5000
- [ ] Hot Module Replacement (HMR) works
- [ ] Production build succeeds: `yarn build`
- [ ] Built app runs correctly: `yarn preview`
- [ ] Bundle size smaller than CRA (measure with `ls -lh build/static/js`)
- [ ] All imports resolve correctly
- [ ] Environment variables work (`import.meta.env.VITE_*`)
- [ ] Firebase emulators still run in parallel
- [ ] Unit tests pass (Jest or Vitest)
- [ ] E2E tests pass
- [ ] **Full app walkthrough** (auth, adventures, maps, tokens, walls, LOS)

**Files Created**:
- `/workspaces/hexland/hexland-web/vite.config.ts`
- `/workspaces/hexland/hexland-web/src/vite-env.d.ts`
- `/workspaces/hexland/hexland-web/.eslintrc.js`
- `/workspaces/hexland/hexland-web/index.html` (moved from public/)

**Files Modified**:
- `/workspaces/hexland/hexland-web/package.json`
- All files with `process.env.REACT_APP_*`

**Files Deleted**:
- `/workspaces/hexland/hexland-web/public/index.html` (moved to root)

**References**:
- [Vite Guide](https://vitejs.dev/guide/)
- [Vite + React](https://vitejs.dev/guide/features.html#react)
- [Migrating to Vite](https://blog.logrocket.com/create-react-app-alternatives/)

---

### 2.5: Three.js 0.137 → 0.170

**Complexity**: MEDIUM

#### Background

Three.js has evolved significantly from r137 (April 2021) to r170 (December 2024). The migration requires testing the entire rendering pipeline.

#### Breaking Changes (r137 → r170)

**Major changes** ([Three.js Releases](https://github.com/mrdoob/three.js/releases)):
- **r150+**: Import paths changed for examples/addons
- **r155+**: Some geometry/material APIs updated
- **r160+**: WebGPU renderer added (not used in this app)
- **r165+**: Further API refinements

**Most breaking changes don't affect this app** as it uses core Three.js, not examples/addons.

#### Step 1: Update Dependencies

```json
{
  "dependencies": {
    "three": "^0.170.0",
    "@types/three": "^0.170.0"
  }
}
```

#### Step 2: Review Import Paths

If using examples/jsm (unlikely based on codebase review):

```typescript
// Old r137
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// New r150+
import { OrbitControls } from 'three/addons/controls/OrbitControls';
```

**Check**: `grep -r "three/examples" src/` (likely returns nothing)

#### Step 3: Test Rendering Pipeline

**Critical files** to test:
- `/workspaces/hexland/hexland-web/src/models/three/drawing.ts`
- `/workspaces/hexland/hexland-web/src/models/three/gridGeometry.ts`
- `/workspaces/hexland/hexland-web/src/models/three/hexGridGeometry.ts`
- `/workspaces/hexland/hexland-web/src/models/three/squareGridGeometry.ts`
- `/workspaces/hexland/hexland-web/src/models/three/instancedFeatures.ts`
- `/workspaces/hexland/hexland-web/src/models/three/los.ts`
- `/workspaces/hexland/hexland-web/src/models/three/walls.ts`
- `/workspaces/hexland/hexland-web/src/models/three/tokenDrawingOrtho.ts`

**Run E2E tests** (image snapshots will catch visual changes):
```bash
yarn test:e2e
```

**If snapshots fail**:
1. **Visually inspect** rendering differences
2. If rendering is **correct** (just minor precision changes): `yarn test:e2e -u` to update snapshots
3. If rendering is **broken**: investigate API changes

**Manual Testing** (comprehensive):
- [ ] Hex grid renders correctly
- [ ] Square grid renders correctly
- [ ] Tokens render (sprites, outlines)
- [ ] Walls render on edges
- [ ] Areas render (filled regions)
- [ ] Line-of-sight (LOS) calculations work
- [ ] Token highlighting works
- [ ] Map images display
- [ ] Annotations render
- [ ] Pan/zoom/rotate (if supported)

#### Step 4: Check for Deprecation Warnings

**Run app in dev mode**, open console:
```bash
yarn start
```

Look for Three.js deprecation warnings. Fix any deprecated API usage.

**Common**:
- `Geometry` → `BufferGeometry` (likely already done)
- Material parameter changes (check Three.js migration guide if warnings appear)

#### Success Criteria - Phase 2.5

- [ ] Three.js 0.170.x installed
- [ ] No import errors
- [ ] E2E tests pass (snapshots may need regeneration)
- [ ] **Visual inspection**:
  - [ ] Hex grid rendering identical
  - [ ] Square grid rendering identical
  - [ ] Tokens render correctly (sprites, outlines, highlighting)
  - [ ] Walls render on grid edges
  - [ ] LOS calculations work
  - [ ] No visual regressions
- [ ] No Three.js deprecation warnings in console
- [ ] Performance acceptable (FPS similar to before)

**Files to Monitor**:
- All files in `/workspaces/hexland/hexland-web/src/models/three/`

**Reference**: [Three.js Migration Guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)

---

### 2.6: Fix Map Share E2E Test (Deferred from Phase 1.2)

**Complexity**: MEDIUM
**Reason for Deferral**: Requires dev container rebuild and environment troubleshooting

#### Background

The map share E2E test (`e2e/map-share.test.ts`) tests sharing maps between users. It was working in the original Playwright 1.10 setup but needs fixes for the new Playwright 1.57+ environment.

#### Known Issues

1. **Multi-user authentication**: Test requires two separate browser contexts with different Firebase Auth users
2. **Emulator timing**: Firebase Auth emulator may have race conditions with rapid user creation
3. **Snapshot baselines**: May need regeneration after dev container updates

#### Steps to Fix

1. Review test implementation against current Playwright API
2. Verify Firebase Auth emulator configuration
3. Debug user creation/authentication flow
4. Update selectors if UI changed
5. Regenerate snapshots if needed

#### Success Criteria

- [ ] Map share E2E test passes consistently
- [ ] All 3 E2E tests (smoke, throttling, map share) pass
- [ ] Tests work in CI environment

---

### Success Criteria - Phase 2 Complete

- [ ] **Firebase v11 modular SDK**:
  - [ ] All imports use modular API
  - [ ] Bundle size reduced by ~70-80%
  - [ ] Real-time sync works perfectly (two-browser test)
- [ ] **React 18**:
  - [ ] New root API (`createRoot`)
  - [ ] No memory leaks (repeated map open/close)
- [ ] **React Router v6**:
  - [ ] All routes work
  - [ ] Navigation functional
- [ ] **Vite**:
  - [ ] Dev server fast
  - [ ] HMR instant
  - [ ] Production build succeeds
- [ ] **Three.js 0.170**:
  - [ ] Rendering pixel-perfect
  - [ ] E2E snapshots pass
- [ ] **Map Share E2E Test** (deferred from Phase 1.2):
  - [ ] Test passes consistently
  - [ ] Multi-user authentication works
- [ ] **All tests pass**:
  - [ ] Unit tests
  - [ ] E2E tests (all 3 tests)
- [ ] **Manual full walkthrough**:
  - [ ] Authentication
  - [ ] Create/join adventures
  - [ ] Create/edit maps (both grid types)
  - [ ] Draw walls
  - [ ] Place/move tokens
  - [ ] Test LOS
  - [ ] Upload images
  - [ ] Create sprites
  - [ ] Test on Chrome, Firefox, Safari

### Risk Assessment - Phase 2

**High Risk**:
- **Firebase v9 migration**: Most complex, touches 50+ files
  - *Mitigation*: Direct migration, thorough testing, multi-user scenarios
- **CRA→Vite**: Complete build system change
  - *Mitigation*: Parallel branch, can revert if needed
- **Three.js**: Visual rendering changes
  - *Mitigation*: E2E snapshots, extensive manual testing

**Medium Risk**:
- **React 18 Strict Mode**: Double-mounting can reveal cleanup bugs
  - *Mitigation*: Audit all useEffect cleanup functions
- **React Router v6**: API changes
  - *Mitigation*: Small route count, straightforward migration

### Rollback Point

**Git commit**: `Phase 2: Modernize to Vite, React 18, Firebase v11`

**Git tag**: `v1.4.0-phase2`

---

## Phase 3: Polish

**Duration**: 1-2 weeks
**Goal**: Final updates, optimizations, deployment readiness

---

### 3.1: Bootstrap 4 → 5

**Complexity**: MEDIUM
**Duration**: 3-5 days

#### Background

[Bootstrap 5](https://getbootstrap.com/docs/5.3/migration/) removed jQuery and introduced significant class name changes.

#### Breaking Changes

**Major**:
1. **jQuery removed** - all JavaScript now vanilla
2. **Class names changed**:
   - `ml-*` / `mr-*` → `ms-*` / `me-*` (start/end for RTL support)
   - `.no-gutters` → `.g-0`
   - `.btn-block` → `.d-grid`
   - `.form-group` → utility classes
3. **Popper.js v1 → v2**
4. **Grid changes**: New `xxl` breakpoint, gutter utilities
5. **Color contrast**: WCAG 2.2 AA compliance (4.5:1 ratio)

#### Step 1: Update Dependencies

```json
{
  "dependencies": {
    "bootstrap": "^5.3.0",
    "react-bootstrap": "^2.10.0"
  }
}
```

**Note**: `react-bootstrap` v2.x is compatible with Bootstrap 5.

#### Step 2: Find/Replace Class Names

**Automated tool** (if available):
```bash
# Search for common patterns
grep -r "ml-\|mr-" src/
grep -r "no-gutters" src/
grep -r "btn-block" src/
```

**Manual replacements**:
- `ml-*` → `ms-*` (margin-left → margin-start)
- `mr-*` → `me-*` (margin-right → margin-end)
- `pl-*` → `ps-*` (padding-left → padding-start)
- `pr-*` → `pe-*` (padding-right → padding-end)
- `.no-gutters` → `.g-0`
- `.btn-block` → wrap in `.d-grid` container
- `.form-group` → use margin utilities (`mb-3`)

#### Step 3: Update React Bootstrap Components

Check [React Bootstrap v2 docs](https://react-bootstrap.github.io/) for component API changes.

**Common changes**:
- Form components may have slightly different props
- `variant` prop standardization
- Some components removed/renamed

**Test each component type used**:
- Navbar
- Modal
- Card
- Button
- Form controls
- Alert/Toast

#### Step 4: Update Custom CSS

**File**: Search all `.css` files for Bootstrap class usage:
```bash
grep -r "bootstrap\|ml-\|mr-\|pl-\|pr-" src/
```

Update any custom CSS that relies on Bootstrap classes.

#### Step 5: Visual Regression Testing

**Screenshot comparison**:
- Before migration: Take screenshots of key pages
- After migration: Compare visually

**Key pages to check**:
- Home page
- Login page
- Adventure list
- Map view
- Modals (token editor, map editor, character editor)
- Forms (adventure creation, map creation)

**Desktop testing** (responsive design deferred):
- Standard desktop (1920x1080)
- Laptop (1366x768)

**Note**: Tablet and mobile layouts can be inventoried for issues but fixes deferred until after revival.

#### Success Criteria - Phase 3.1

- [ ] Bootstrap 5.3.x installed
- [ ] No jQuery dependency
- [ ] All class names updated to Bootstrap 5 syntax
- [ ] React Bootstrap v2.x components work
- [ ] **Visual inspection** (desktop only):
  - [ ] Navigation bars render correctly
  - [ ] Modals appear correctly
  - [ ] Forms styled properly
  - [ ] Buttons have correct variants
  - [ ] Cards and layouts unchanged
  - [ ] Desktop layout functional (responsive breakpoints can be reviewed post-revival)
- [ ] No Bootstrap-related console warnings
- [ ] E2E tests pass (may need snapshot updates)

**Files Modified**:
- `/workspaces/hexland/hexland-web/package.json`
- All `.tsx` files with Bootstrap component usage
- All `.css` files with Bootstrap class usage

**References**:
- [Bootstrap 5 Migration Guide](https://getbootstrap.com/docs/5.3/migration/)
- [React Bootstrap v2](https://react-bootstrap.github.io/)

---

### 3.2: Remaining Dependency Updates

#### TypeScript (if newer version available)

If TypeScript 6.x is stable:

```json
{
  "devDependencies": {
    "typescript": "^6.0.0"
  }
}
```

**Review**: [TypeScript Breaking Changes](https://github.com/microsoft/TypeScript/wiki/Breaking-Changes)

**Test**: `yarn build` for both web and functions

#### Playwright (Latest)

```json
{
  "devDependencies": {
    "playwright": "^1.49.0"  // Or latest
  }
}
```

```bash
npx playwright install  # Download latest browsers
yarn test:e2e
```

#### Update Testing Libraries

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  }
}
```

**API changes**: Review [Testing Library docs](https://testing-library.com/docs/react-testing-library/intro/) for v16.

**Update test syntax** if needed (likely minimal changes).

---

### 3.3: Code Quality

#### ESLint 9.x

```json
{
  "devDependencies": {
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
  }
}
```

**Update** `.eslintrc.js` for ESLint 9 flat config if needed.

**Run**:
```bash
yarn lint
```

**Fix all warnings** (or disable specific rules if justified).

#### Prettier (Add if not present)

```json
{
  "devDependencies": {
    "prettier": "^3.0.0"
  }
}
```

**File**: `/workspaces/hexland/hexland-web/.prettierrc.json` (new)

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**Format entire codebase**:
```bash
npx prettier --write "src/**/*.{ts,tsx,css,json}"
```

**Add to scripts**:
```json
{
  "scripts": {
    "format": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css,json}\""
  }
}
```

#### TypeScript Strict Mode

**Update** `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,  // Already enabled
    "noUncheckedIndexedAccess": true,  // Additional strictness
    "noPropertyAccessFromIndexSignature": true
  }
}
```

**Fix any new errors** revealed by stricter settings.

---

### 3.4: Performance Optimization

#### Code Splitting

**Lazy load routes**:

**File**: `/workspaces/hexland/hexland-web/src/App.tsx`

```typescript
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./Home'));
const MapPage = lazy(() => import('./Map'));
const AdventurePage = lazy(() => import('./Adventure'));
const Login = lazy(() => import('./Login'));
const All = lazy(() => import('./All'));
const Shared = lazy(() => import('./Shared'));
const InvitePage = lazy(() => import('./Invite'));

// In JSX:
<Suspense fallback={<div>Loading...</div>}>
  <Routes>
    <Route path="/" element={<Home />} />
    {/* etc */}
  </Routes>
</Suspense>
```

**Benefit**: Each route in a separate chunk, faster initial load.

#### Bundle Analysis

```bash
yarn add -D rollup-plugin-visualizer
```

**Update** `vite.config.ts`:
```typescript
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true })  // Opens bundle analysis after build
  ],
});
```

```bash
yarn build
```

**Analyze**:
- Largest dependencies
- Opportunities for lazy loading
- Tree-shaking effectiveness

#### Lighthouse Audit

```bash
yarn build
yarn preview
```

**Run Lighthouse** (Chrome DevTools):
1. Open http://localhost:4173
2. DevTools → Lighthouse
3. Run audit

**Target**:
- Performance: 90+
- Accessibility: 90+
- Best Practices: 90+
- SEO: 90+

**Fix major issues** (images not optimized, accessibility issues, etc.).

---

### 3.5: Deployment Preparation

#### Firebase Hosting Optimization

**File**: `/workspaces/hexland/hexland-web/firebase.json`

```json
{
  "hosting": {
    "public": "build",
    "headers": [
      {
        "source": "/static/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000"
          }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

#### Firebase Functions Deployment

**Test deployment** (not just emulator):

```bash
firebase use staging  # Or your test project
firebase deploy --only functions
```

**Verify**:
- Functions deploy successfully
- Node.js 20 runtime used
- Cold start times acceptable (<2s for HTTP functions)

**Monitor logs**:
```bash
firebase functions:log
```

#### Environment Variables

**Create** `.env.example`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Optional: Analytics
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Document** in README or deployment docs.

#### CI/CD Setup (Optional)

**File**: `.github/workflows/ci.yml` (new)

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: cd hexland-web && yarn install
      - run: cd hexland-web && yarn lint
      - run: cd hexland-web && yarn build
      - run: cd hexland-web && yarn test:unit
      # E2E tests require Firebase emulators, may need additional setup

  deploy-staging:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/master'
    needs: test
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: cd hexland-web && yarn install
      - run: cd hexland-web && yarn build
      - run: npx firebase-tools deploy --only hosting --project staging
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

**Setup**:
1. Create Firebase token: `firebase login:ci`
2. Add as GitHub secret: `FIREBASE_TOKEN`

---

### Success Criteria - Phase 3 Complete

- [ ] **Bootstrap 5**:
  - [ ] UI renders correctly
  - [ ] No jQuery dependency
  - [ ] Responsive design works
- [ ] **All dependencies at latest stable**:
  - [ ] TypeScript latest
  - [ ] Playwright latest
  - [ ] Testing libraries latest
- [ ] **Code quality**:
  - [ ] ESLint 9.x passing with no warnings
  - [ ] Prettier formatting applied
  - [ ] TypeScript strict mode enabled
- [ ] **Performance**:
  - [ ] Routes lazy-loaded
  - [ ] Bundle size optimized (<500KB main chunk)
  - [ ] Lighthouse score 90+ across all metrics
- [ ] **Deployment**:
  - [ ] Can deploy to Firebase Hosting
  - [ ] Can deploy to Firebase Functions (Node.js 20)
  - [ ] Environment variables documented
  - [ ] CI/CD setup (optional)
- [ ] **All tests pass**:
  - [ ] Unit tests
  - [ ] E2E tests
- [ ] **Manual full walkthrough** (final check)

### Rollback Point

**Git commit**: `Phase 3: Polish and deployment readiness`

**Git tag**: `v1.4.0-phase3-complete`

---

## Testing Strategy

### Per-Phase Testing Checklist

**After Each Dependency Update**:
1. ✅ `yarn build` - must succeed (both web and functions)
2. ✅ `yarn test:unit` - all tests pass
3. ✅ `yarn test:e2e` - all tests pass (regenerate snapshots if needed)
4. ✅ Manual smoke test - basic functionality works

### Comprehensive Manual Test Checklist

**Run after each phase**:

#### Authentication
- [ ] Sign up with email/password
- [ ] Sign in with email/password
- [ ] Sign in with Google
- [ ] Sign out
- [ ] Password reset (if implemented)
- [ ] Session persistence (refresh page, still logged in)

#### Adventures
- [ ] Create new adventure
- [ ] View adventure list
- [ ] Invite player to adventure (generate invite link)
- [ ] Join adventure via invite link (in incognito browser)
- [ ] Delete adventure

#### Maps
- [ ] Create hex map
- [ ] Create square map
- [ ] View map list
- [ ] Clone existing map
- [ ] Delete map
- [ ] Map name/description editing

#### Map Editing - Hex Grid
- [ ] Draw walls (on hex edges)
- [ ] Erase walls
- [ ] Place token
- [ ] Move token
- [ ] Resize token (1, 2, 3, 4 hexes)
- [ ] Rotate token
- [ ] Delete token
- [ ] Draw area
- [ ] Delete area
- [ ] Add annotation (text)
- [ ] Test line-of-sight (LOS)

#### Map Editing - Square Grid
- [ ] Draw walls (on square edges)
- [ ] Erase walls
- [ ] Place token
- [ ] Move token
- [ ] Resize token (1x1, 2x2, 3x3, 4x4)
- [ ] Delete token
- [ ] Draw area
- [ ] Delete area
- [ ] Add annotation
- [ ] Test line-of-sight (LOS)

#### Images & Sprites
- [ ] Upload image to library
- [ ] Use uploaded image as token
- [ ] Create spritesheet
- [ ] Use sprite as token
- [ ] Delete image

#### Real-Time Sync (Critical)
- [ ] Open same map in two browsers (Firefox + Chrome, or two Firefox/Chrome windows)
- [ ] Browser A: Add wall → appears in Browser B
- [ ] Browser B: Move token → appears in Browser A
- [ ] Browser A: Delete token → disappears in Browser B
- [ ] Verify no duplicate listeners (check Firebase console/network tab)

#### WebDAV Storage (If Configured)
- [ ] Upload image via WebDAV
- [ ] Image appears in library
- [ ] Can use as token

#### Browser Compatibility (Desktop Only)
- [ ] Test on Firefox (latest)
- [ ] Test on Chrome (latest)
- [ ] Test on Chromium-based browsers (Edge, Brave, etc.)

**Note**: Safari, tablet, and mobile support deferred until after revival complete.

### Automated Test Updates

#### Unit Tests

**Likely updates needed**:
- **Phase 2.1** (Firebase v9): Update mocks for modular API
- **Phase 3.2** (Testing Library v16): Update test syntax

**Strategy**:
- Fix tests as they break
- Ensure 100% pass rate before moving to next phase

#### E2E Tests

**Snapshot updates**:
- **Phase 1.2** (Playwright update): May need regeneration
- **Phase 2.5** (Three.js update): Likely need regeneration
- **Phase 3.1** (Bootstrap 5): Likely need regeneration

**Process**:
1. Run `yarn test:e2e`
2. If snapshots fail, **visually inspect** diffs
3. If rendering correct: `yarn test:e2e -u` to update
4. If rendering broken: investigate and fix

### Performance Benchmarking

**Baseline Metrics** (record before Phase 2):

```bash
yarn build
ls -lh build/static/js/main.*.js  # Record size
```

**Lighthouse**:
- Open http://localhost:5000 in Chrome
- Run Lighthouse audit
- Record: Performance, FCP, LCP, TTI scores

**After Each Phase**:
- Compare bundle size
- Compare Lighthouse scores
- Investigate any regressions

**Expected improvements**:
- **Phase 2.1** (Firebase v9): ~80% smaller Firebase bundle
- **Phase 2.4** (Vite): Faster builds, smaller total bundle
- **Phase 3.4** (Optimization): Improved Lighthouse scores

---

## Risk Assessment & Mitigation

### Critical Risks

#### 1. Firebase Real-Time Sync Breaking

**Risk**: Firebase v8→v11 migration breaks change-tracking system
**Impact**: 🔴 HIGH - Core feature, multi-user collaboration broken
**Probability**: MEDIUM

**Mitigation**:
- Direct migration with thorough understanding of modular API
- Test with two browsers simultaneously
- Test conflict resolution (edit same token in both browsers)
- Keep Phase 1 backup (can revert to v8 if critical bug found)

**Test Plan**:
1. Open map in Browser A and Browser B
2. Browser A: Add wall → verify appears in Browser B within 1s
3. Browser B: Move token → verify appears in Browser A
4. Both browsers: Edit same token simultaneously → verify conflict handled
5. Disconnect Browser A's network → make changes → reconnect → verify sync resumes

#### 2. Three.js Rendering Regression

**Risk**: Visual bugs in map rendering after Three.js update
**Impact**: 🔴 HIGH - Core feature, maps unusable
**Probability**: MEDIUM

**Mitigation**:
- E2E snapshot tests catch visual changes automatically
- Manual side-by-side comparison (old vs new)
- Test all grid types, all token sizes, all rendering features

**Test Plan**:
1. Run full E2E suite (snapshots)
2. If snapshots differ: manually inspect each difference
3. Create test maps with:
   - Hex grid with walls, tokens, areas, LOS
   - Square grid with walls, tokens, areas, LOS
4. Compare rendering visually before/after update
5. Stress test: 100+ tokens on map, verify performance

#### 3. CRA→Vite Build Failure

**Risk**: Vite build fails or produces runtime errors
**Impact**: 🔴 HIGH - Blocks deployment
**Probability**: MEDIUM

**Mitigation**:
- Develop Vite migration in parallel branch
- Keep CRA working until Vite proven successful
- Test production build thoroughly before merging
- Rollback to CRA if critical blocker found

**Test Plan**:
1. Vite dev server works: `yarn dev:vite`
2. Production build succeeds: `yarn build`
3. Preview production build: `yarn preview`
4. Full app walkthrough on production build
5. Deploy to staging Firebase, test deployed version
6. Only merge to main after 100% confidence

---

### Medium Risks

#### 4. React 18 Strict Mode Issues

**Risk**: Double-mounting reveals subscription leaks
**Impact**: 🟡 MEDIUM - Memory leaks, duplicate Firebase listeners
**Probability**: MEDIUM

**Mitigation**:
- Audit all `useEffect` cleanup functions in context providers
- Test opening/closing maps repeatedly (10+ times)
- Monitor Firebase listener count in dev tools

**Test Plan**:
1. Open map
2. Close map
3. Repeat 10 times
4. Check Firebase console: listener count should not grow
5. Check browser memory: should not grow unbounded

#### 5. React Router v6 Navigation

**Risk**: Broken links, navigation issues
**Impact**: 🟡 MEDIUM - UX degradation, some pages unreachable
**Probability**: LOW

**Mitigation**:
- Small route count (7 routes) makes migration straightforward
- Test every route, every link
- Use TypeScript to catch compile-time errors

**Test Plan**:
1. Navigate to every route manually
2. Click every link on every page
3. Test browser back/forward buttons
4. Test programmatic navigation (redirects after login, etc.)
5. Test URL parameters (adventure ID, map ID)

#### 6. Bootstrap 5 Visual Regressions

**Risk**: UI looks broken after Bootstrap 5 migration
**Impact**: 🟡 MEDIUM - UX/brand impact, but not blocking
**Probability**: MEDIUM

**Mitigation**:
- Screenshot comparison before/after
- Manual visual review of all pages
- E2E snapshot tests

**Test Plan**:
1. Before migration: Screenshot every page
2. After migration: Compare screenshots
3. Check responsive design (desktop, tablet, mobile)
4. Verify all modals, forms, buttons styled correctly

---

### Low Risks

#### 7. TypeScript 4.2→5.7

**Risk**: Type errors prevent compilation
**Impact**: 🟢 LOW - Compile-time only, fixable
**Probability**: LOW

**Mitigation**: TypeScript has excellent backwards compatibility

**Test Plan**: `yarn build` - fix any errors that appear

#### 8. Playwright 1.10→1.57

**Risk**: Test API changes break E2E suite
**Impact**: 🟢 LOW - Test infrastructure only
**Probability**: LOW

**Mitigation**: Small test suite, manual updates manageable

**Test Plan**: `yarn test:e2e` - update API calls if needed

---

## Deployment Considerations

### Environment Requirements

#### Development
- **Node.js**: 20 LTS (via dev container)
- **Docker Desktop**: For dev container support
- **Firebase CLI**: `npm install -g firebase-tools`
- **Firebase Project**: With Firestore, Auth, Functions, Storage, Hosting enabled

#### Production
- **Firebase Blaze Plan**: Required for Cloud Functions
- **Node.js 20 Runtime**: For Cloud Functions
- **Firebase Hosting**: For SPA deployment
- **CORS Configuration**: For Storage bucket (see `hexland-web/cors.json`)

### Deployment Process

#### Staging Deployment (After Each Phase)

1. **Create staging Firebase project** (if not exists):
   ```bash
   firebase projects:create hexland-staging
   firebase use hexland-staging
   ```

2. **Deploy**:
   ```bash
   cd hexland-web
   yarn build
   firebase deploy
   ```

3. **Smoke test against staging**:
   - Navigate to https://hexland-staging.web.app
   - Run manual test checklist (abbreviated version)
   - Monitor logs for errors: `firebase functions:log`

4. **Verify Functions runtime**:
   - Firebase Console → Functions
   - Check Node.js 20 runtime listed

#### Production Deployment

1. **Final testing on staging**:
   - Run full manual test checklist
   - Check Lighthouse scores
   - Verify no console errors

2. **Create release branch**:
   ```bash
   git checkout -b release/v1.4.0
   git push origin release/v1.4.0
   ```

3. **Tag version**:
   ```bash
   git tag -a v1.4.0 -m "Release v1.4.0: Modernization complete"
   git push origin v1.4.0
   ```

4. **Deploy to production**:
   ```bash
   firebase use production
   yarn build
   firebase deploy
   ```

5. **Post-deployment monitoring**:
   - Monitor Analytics (user sessions, errors)
   - Monitor Functions logs: `firebase functions:log`
   - Check error rate in Firebase Crashlytics (if enabled)
   - Monitor first 24 hours closely

6. **Rollback if needed**:
   - Firebase allows deploying previous functions version
   - Hosting can revert to previous build
   - Keep previous git tag for quick rollback

### Rollback Strategy

#### Per-Phase Rollback

Each phase ends with a git commit and tag:
- **Phase 0**: `v1.3.10-phase0`
- **Phase 1**: `v1.3.10-phase1`
- **Phase 2**: `v1.4.0-phase2`
- **Phase 3**: `v1.4.0-phase3-complete`

**If critical bug found in Phase N**:
1. Identify failing phase
2. Revert: `git reset --hard v1.3.10-phase{N-1}`
3. Redeploy immediately
4. Debug in separate branch

#### Emergency Production Rollback

1. **Identify issue** (error spike, feature broken)

2. **Immediate rollback**:
   ```bash
   git checkout v1.3.9  # Previous stable version
   cd hexland-web
   yarn build
   firebase deploy
   ```

3. **Communicate** to users (if public):
   - Status page update
   - Tweet/social media
   - In-app banner (if mechanism exists)

4. **Post-mortem**:
   - What went wrong?
   - Why didn't tests catch it?
   - How to prevent in future?

---

## Timeline Estimates

### Conservative Timeline (8 weeks)

**Week 1**: Phase 0 + Phase 1.1
- **Days 1**: Emergency fix (Node.js version)
- **Days 2-5**: Functions stabilization (ESLint migration, Firebase Admin/Functions updates, TypeScript)

**Week 2**: Phase 1.2-1.3
- **Days 1-3**: Web app stabilization (TypeScript, Playwright, RxJS, Three.js)
- **Days 4-5**: Dependency consolidation, comprehensive manual testing

**✅ Checkpoint**: All tests passing, project builds cleanly, all dependencies maintained

---

**Week 3**: Phase 2.1 (Part 1)
- **Days 1-2**: Firebase SDK update, initialization migration
- **Days 3-5**: Auth and Firestore service migration (dataService.ts, converter.ts)

**Week 4**: Phase 2.1 (Part 2)
- **Days 1-2**: MapChangeTracker migration (critical real-time sync)
- **Days 3-5**: Storage, Functions, remaining Firebase migrations, testing

**✅ Checkpoint**: Firebase v11 fully integrated, real-time sync working, bundle size reduced

---

**Week 5**: Phase 2.2-2.3
- **Days 1-2**: React 17→18 migration (new root API, strict mode audit)
- **Days 3-5**: React Router v5→v6 migration (routes, navigation hooks)

**✅ Checkpoint**: React 18 rendering correctly, navigation working, no memory leaks

---

**Week 6**: Phase 2.4 (Vite)
- **Days 1-3**: Vite setup, config, HTML entry point, env vars
- **Days 4-5**: Testing, build verification, HMR testing

**Week 7**: Phase 2.5 + Testing
- **Days 1-2**: Three.js 0.137→0.170 update, rendering tests
- **Days 3-5**: Comprehensive Phase 2 testing (all features, E2E, manual)

**✅ Checkpoint**: Vite build working, Three.js rendering perfect, all Phase 2 complete

---

**Week 8**: Phase 3
- **Days 1-2**: Bootstrap 4→5 migration
- **Day 3**: Final dependency updates, ESLint/Prettier
- **Days 4-5**: Performance optimization, deployment prep, final testing

**✅ Checkpoint**: Production ready, all tests passing, Lighthouse 90+, deployment successful

---

### Aggressive Timeline (6 weeks)

**Combine phases**:
- **Weeks 1-2**: Phase 0 + Phase 1 (all)
- **Weeks 3-4**: Phase 2.1-2.3 (Firebase, React, Router)
- **Week 5**: Phase 2.4-2.5 (Vite, Three.js)
- **Week 6**: Phase 3 (Bootstrap, polish, deployment)

**Risk**: Less testing time between phases, higher chance of issues slipping through.

**Recommendation**: Stick to 8-week conservative timeline for a mothballed project being revived - thoroughness is more important than speed.

---

## Success Metrics

### Technical Metrics

#### Code Quality
- [ ] 0 ESLint errors/warnings
- [ ] 0 TypeScript errors with strict mode enabled
- [ ] 100% test pass rate (unit + E2E)
- [ ] All dependencies on maintained versions (no EOL/deprecated packages)
- [ ] Security audit clean: `yarn audit` shows 0 high/critical vulnerabilities

#### Performance
- [ ] **Bundle size reduced by 50%+** (Firebase v9 savings)
  - Before: ~2MB (estimated)
  - After: <1MB
- [ ] **Lighthouse scores** (production build):
  - Performance: 90+
  - Accessibility: 90+
  - Best Practices: 90+
  - SEO: 90+
- [ ] **Core Web Vitals**:
  - First Contentful Paint (FCP): <1.5s
  - Largest Contentful Paint (LCP): <2.5s
  - Time to Interactive (TTI): <3s
  - Cumulative Layout Shift (CLS): <0.1

#### Compatibility
- [ ] Works on Node.js 20/22 (dev environment + Firebase Functions)
- [ ] Works on **Firefox** (latest 2 versions) - Desktop
- [ ] Works on **Chrome** (latest 2 versions) - Desktop
- [ ] Works on **Chromium-based browsers** (Edge, Brave, etc.) - Desktop

**Deferred**: Safari, mobile (iOS/Android), tablet support can be addressed post-revival.

### Functional Metrics

#### Feature Completeness
- [ ] All existing features work (see manual test checklist)
- [ ] No regressions detected
- [ ] Real-time sync works with multiple users (tested)
- [ ] Three.js rendering pixel-perfect (E2E snapshots pass)
- [ ] WebDAV storage functional (if configured)

#### Deployment Success
- [ ] Can deploy to Firebase Hosting successfully
- [ ] Can deploy to Firebase Functions (Node.js 20 runtime)
- [ ] Staging deployment verified
- [ ] Production deployment verified
- [ ] No critical errors in first 24 hours post-deployment
- [ ] User analytics show normal usage patterns (no drop-off)

### Documentation
- [ ] README.md updated with new dev setup instructions
- [ ] CLAUDE.md updated (if needed)
- [ ] Environment variables documented (`.env.example`)
- [ ] Deployment process documented
- [ ] Migration notes captured (this document)

---

## Critical Files Reference

### Phase 0-1: Stabilization

| File | Purpose | Phase |
|------|---------|-------|
| `/workspaces/hexland/hexland-web/functions/package.json` | Node.js version, dependencies | 0, 1.1 |
| `/workspaces/hexland/hexland-web/functions/tsconfig.json` | TypeScript configuration | 1.1 |
| `/workspaces/hexland/hexland-web/functions/tslint.json` | TSLint config (→ ESLint) | 1.1 |
| `/workspaces/hexland/hexland-web/package.json` | Web app dependencies | 1.2 |
| `/workspaces/hexland/hexland-web/tsconfig.json` | TypeScript configuration | 1.2 |
| `/workspaces/hexland/hexland-web/e2e/jest.config.js` | E2E test configuration | 1.2 |

### Phase 2: Modernization

| File | Purpose | Phase | Criticality |
|------|---------|-------|-------------|
| `/workspaces/hexland/hexland-web/src/components/FirebaseContextProvider.tsx` | Firebase v9 initialization | 2.1 | 🔴 CRITICAL |
| `/workspaces/hexland/hexland-web/src/services/dataService.ts` | Firestore abstraction | 2.1 | 🔴 CRITICAL |
| `/workspaces/hexland/hexland-web/src/services/converter.ts` | Firestore data marshalling | 2.1 | 🔴 CRITICAL |
| `/workspaces/hexland/hexland-web/src/models/mapChangeTracker.ts` | Real-time sync logic | 2.1 | 🔴 CRITICAL |
| `/workspaces/hexland/hexland-web/src/services/auth.ts` | Authentication service | 2.1 | 🟡 Important |
| `/workspaces/hexland/hexland-web/src/services/functions.ts` | Cloud Functions calls | 2.1 | 🟡 Important |
| `/workspaces/hexland/hexland-web/src/services/storage.ts` | Storage service | 2.1 | 🟡 Important |
| `/workspaces/hexland/hexland-web/src/data/types.ts` | Timestamp types | 2.1 | 🟡 Important |
| `/workspaces/hexland/hexland-web/src/index.tsx` | React 18 root API | 2.2 | 🔴 CRITICAL |
| `/workspaces/hexland/hexland-web/src/App.tsx` | React Router v6 routes | 2.3 | 🔴 CRITICAL |
| `/workspaces/hexland/hexland-web/vite.config.ts` | Vite configuration (NEW) | 2.4 | 🔴 CRITICAL |
| `/workspaces/hexland/hexland-web/index.html` | HTML entry (moved to root) | 2.4 | 🔴 CRITICAL |
| `/workspaces/hexland/hexland-web/src/vite-env.d.ts` | Vite env types (NEW) | 2.4 | 🟡 Important |
| `/workspaces/hexland/hexland-web/src/models/three/gridGeometry.ts` | Grid rendering core | 2.5 | 🔴 CRITICAL |
| `/workspaces/hexland/hexland-web/src/models/three/drawing.ts` | Rendering orchestration | 2.5 | 🔴 CRITICAL |

### Phase 3: Polish

| File | Purpose | Phase | Criticality |
|------|---------|-------|-------------|
| All `.tsx` files with Bootstrap components | Bootstrap 5 migration | 3.1 | 🟡 Important |
| `/workspaces/hexland/hexland-web/.eslintrc.js` | ESLint config (NEW) | 3.3 | 🟢 Nice to have |
| `/workspaces/hexland/hexland-web/.prettierrc.json` | Prettier config (NEW) | 3.3 | 🟢 Nice to have |
| `/workspaces/hexland/hexland-web/firebase.json` | Deployment config | 3.5 | 🟡 Important |

🔴 = Critical (breaks core functionality)
🟡 = Important (degrades functionality)
🟢 = Nice to have (improves quality)

---

## Appendix: Research References

### Official Migration Guides

1. **Firebase v8→v9**: [Upgrade to the modular Web SDK](https://firebase.google.com/docs/web/modular-upgrade)
2. **React 17→18**: [React 18 Upgrade Guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)
3. **React Router v5→v6**: [Upgrading from v5](https://reactrouter.com/en/main/upgrading/v5)
4. **CRA→Vite**: [Vite Migration Guide](https://vitejs.dev/guide/)
5. **Bootstrap 4→5**: [Migrating to v5](https://getbootstrap.com/docs/5.3/migration/)
6. **TSLint→ESLint**: [VS Code Migration Guide](https://code.visualstudio.com/api/advanced-topics/tslint-eslint-migration)

### Deprecation Notices

1. **Create React App**: [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)
2. **TSLint**: [TSLint Roadmap](https://github.com/palantir/tslint/issues/4534)
3. **Node.js 14**: [Previous Releases](https://nodejs.org/en/about/previous-releases)

### Breaking Changes & Release Notes

1. **Three.js**: [Releases](https://github.com/mrdoob/three.js/releases)
2. **Playwright**: [Release Notes](https://playwright.dev/docs/release-notes)
3. **RxJS v6→v7**: [Breaking Changes](https://rxjs.dev/deprecations/breaking-changes)
4. **Firebase Admin SDK**: [Release Notes](https://firebase.google.com/support/release-notes/admin/node)
5. **Firebase Functions**: [Node.js Support](https://firebase.google.com/docs/functions/manage-functions)
6. **TypeScript**: [Breaking Changes Wiki](https://github.com/microsoft/TypeScript/wiki/Breaking-Changes)

### Tutorials & Articles

1. **Refactor React app with Firebase v9**: [LogRocket Guide](https://blog.logrocket.com/refactor-react-app-firebase-v9-web-sdk/)
2. **CRA Alternatives 2025**: [Best Alternatives](https://blog.logrocket.com/create-react-app-alternatives/)
3. **React Testing Library v16**: [Official Docs](https://testing-library.com/docs/react-testing-library/intro/)
4. **Vite vs Webpack**: [Comparison](https://vitejs.dev/guide/why.html)

---

**End of Revival Plan**

This comprehensive plan provides a structured, phased approach to modernizing Wall & Shadow from a mothballed codebase with deprecated dependencies to a fully production-ready application on the latest stack. Each phase builds on the previous, with clear checkpoints, success criteria, and rollback points to ensure the project remains functional throughout the revival process.

**Next Step**: Begin Phase 0 - Emergency Fix (1 day)
