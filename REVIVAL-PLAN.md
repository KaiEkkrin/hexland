# Wall & Shadow Revival Plan

**Project**: Wall & Shadow (codename: Hexland)
**Document Version**: 2.0
**Date**: December 2025
**Status**: Phase 1 & 2 complete, Phase 3 in progress
**Last Updated**: Phase 3.2 ESLint and tsconfig modernization complete

---

## Progress Summary

### ✅ Phase 0: Emergency Fix (Complete)
Fixed Node.js 14 → 20 compatibility for Firebase Functions (commit `0c87280`).

### ✅ Phase 1: Stabilization (Complete)
Updated to maintained dependency versions without major refactoring:

| Component | Before | After |
|-----------|--------|-------|
| firebase-admin | 9.3.0 | 13.6.0 |
| firebase-functions | 3.20.0 | 6.3.2 |
| TypeScript (functions) | 4.2.3 | 5.7.3 |
| TSLint | 6.1.3 | → ESLint 9.x |
| TypeScript (web) | 4.5.5 | 5.7.x |
| RxJS | 6.6.7 | 7.8.x |
| Playwright | 1.10.0 | 1.57.x |
| @types/node | 14.x | 20.x |

### ✅ Phase 2: Modernization (Complete)
Major migrations to modern tooling:

| Migration | Summary |
|-----------|---------|
| **2.1: Firebase SDK** | v8 → v11 modular API (no compat layer), ~80% smaller bundle |
| **2.2: Bootstrap** | 4.5 → 5.3, react-bootstrap 1.5 → 2.10 |
| **2.3: React** | 17 → 18 (createRoot API), React Router 5 → 6 |
| **2.4: Build Tool** | Create React App → Vite 7.3.0 |
| **2.5: Three.js** | 0.137.5 → 0.163.0 (fixed ShapeGeometry, sRGB color management) |

**Current State**:
- All 96 unit tests passing
- 2 of 3 E2E tests passing (map share test deferred to Phase 3.6)
- Manual testing successful

### 📋 Phase 3: Polish (In Progress)
- Performance optimization
- Code quality improvements
- Security vulnerability fixes
- Map share E2E test fix (end of phase)

---

## Current Dependency Status

### Web Application (`hexland-web/package.json`)

| Dependency | Version | Status |
|------------|---------|--------|
| React | 18.3.1 | ✅ Current |
| Vite | 7.3.0 | ✅ Current |
| Firebase SDK | 11.x | ✅ Current |
| TypeScript | 5.7.x | ✅ Current (6.0 not yet released) |
| Three.js | 0.163.0 | ✅ Current |
| React Router | 6.28.0 | ✅ Current |
| Bootstrap | 5.3.0 | ✅ Current |
| RxJS | 7.8.x | ✅ Current |

### Firebase Functions (`hexland-web/functions/package.json`)

| Dependency | Version | Status |
|------------|---------|--------|
| Node.js | 20 | ✅ Current |
| firebase-admin | 13.6.0 | ✅ Current |
| firebase-functions | 6.3.2 | ✅ Current |
| TypeScript | 5.7.3 | ✅ Current |

---

## Phase 3: Polish

**Duration**: 1-2 weeks
**Goal**: Final updates, optimizations, deployment readiness

---

### 3.1: Remaining Dependency Updates

#### TypeScript 6.0 (Deferred - Not Yet Released)

**Status**: TypeScript 6.0 is in development (58% complete as of Dec 2025). Target release: early 2026.

TypeScript 6.0 is a "bridge" release between 5.x and the native TypeScript 7.0 (rewritten in Go for 10x performance).

**Blockers**:
- `ts-jest` peer dependency: `>=4.3 <6` (no TS6 support)
- `@typescript-eslint/*` peer dependency: `>=4.8.4 <6.0.0` (no TS6 support)

**Breaking changes to prepare for**:
- ~~`moduleResolution: "node"` → `"bundler"` (web) or `"nodenext"` (functions)~~ ✅ Already updated
- `--strict` becomes default (already enabled - no impact)
- ~~`--target es5` removed (already using es6/ES2022 - no impact)~~ ✅ Now using ES2022

**Action**: Wait for TS 6.0 release and ecosystem support before upgrading. Consider upgrading Jest 26 → 29 as preparatory work.

**Completed preparatory work**:
- ✅ Updated `tsconfig.json`: `target` es6 → ES2022, `moduleResolution` node → bundler
- ✅ Updated `e2e/tsconfig.json`: Added ES2022 target and bundler moduleResolution
- ✅ Fixed ES module compatibility (`__dirname` → `import.meta.url` in e2e/oob.ts)
- ✅ Added `"type": "module"` to package.json
- ✅ Renamed Jest config files to `.cjs` for CommonJS compatibility

#### Playwright (Latest)

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

---

### 3.2: Code Quality

#### ✅ ESLint 9.x (Complete)

Added ESLint 9.39.2 to web application with flat config:

```json
{
  "devDependencies": {
    "eslint": "^9.39.2",
    "@eslint/js": "^9.39.2",
    "globals": "^16.2.0",
    "typescript-eslint": "^8.50.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.26"
  }
}
```

- ✅ Created `eslint.config.js` with ESLint 9 flat config
- ✅ Added `yarn lint` script
- ✅ Functions already had ESLint 9.x configured
- ⚠️ 275 lint issues (141 errors, 134 warnings) - mostly `no-explicit-any` and `no-unused-vars`

#### Prettier (Add if not present)

```json
{
  "devDependencies": {
    "prettier": "^3.0.0"
  }
}
```

**File**: `.prettierrc.json`

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

#### ✅ TypeScript Strict Mode (Already Enabled)

`tsconfig.json` already has `"strict": true`. Additional strict options available but not yet enabled:
```json
{
  "compilerOptions": {
    "strict": true,  // ✅ Already enabled
    "noUncheckedIndexedAccess": true,  // Optional: stricter index access
    "noPropertyAccessFromIndexSignature": true  // Optional: require bracket notation
  }
}
```

---

### 3.3: Performance Optimization

#### Code Splitting

**Lazy load routes** in `src/App.tsx`:

```typescript
import { lazy, Suspense } from 'react';

const Home = lazy(() => import('./Home'));
const MapPage = lazy(() => import('./Map'));
const AdventurePage = lazy(() => import('./Adventure'));
// etc.

<Suspense fallback={<div>Loading...</div>}>
  <Routes>
    <Route path="/" element={<Home />} />
    {/* etc */}
  </Routes>
</Suspense>
```

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
    visualizer({ open: true })
  ],
});
```

#### Lighthouse Audit

**Target**:
- Performance: 90+
- Accessibility: 90+
- Best Practices: 90+
- SEO: 90+

---

### 3.4: Deployment Preparation

#### Firebase Hosting Optimization

**File**: `firebase.json`

```json
{
  "hosting": {
    "public": "build",
    "headers": [
      {
        "source": "/static/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000" }]
      }
    ],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

#### Firebase Functions Deployment

```bash
firebase use staging
firebase deploy --only functions
```

**Verify**: Functions deploy with Node.js 20 runtime, cold start <2s.

#### Environment Variables

**Create** `.env.example`:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

#### CI/CD Setup (Optional)

**File**: `.github/workflows/ci.yml`

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
```

---

### 3.5: Fix Package Vulnerabilities

**Priority**: HIGH (security)

#### Current Vulnerabilities (from `yarn audit`)

| Package | Severity | Issue | Resolution |
|---------|----------|-------|------------|
| `@google-cloud/firestore` (4.2.0) | Moderate | Key logging (CVE-2023-6460) | Upgrade to 6.1.0+ or remove |
| `node-forge` (transitive) | Critical/High | Multiple ASN.1 issues | Via @google-cloud/firestore upgrade |
| `protobufjs` (transitive) | Critical | Prototype pollution | Via @google-cloud/firestore upgrade |
| `axios` (via webdav) | Moderate | XSRF token exposure | Upgrade webdav to 5.x+ |
| `fast-xml-parser` (via webdav) | Moderate | Prototype pollution | Upgrade webdav to 5.x+ |

#### Step 1: Assess @google-cloud/firestore Usage

```bash
grep -r "@google-cloud/firestore" hexland-web/functions/src/
```

Options:
1. **Upgrade to v7+** - Requires code changes
2. **Remove if unused** - Check if `adminDataService.ts` is actively used
3. **Accept risk** - Document and monitor

#### Step 2: Upgrade webdav Package

```json
{
  "dependencies": {
    "webdav": "^5.8.0"
  }
}
```

**Test**: WebDAV image upload and retrieval still work.

#### Step 3: Run Final Audit

```bash
yarn audit
```

**Target**: No high/critical vulnerabilities in production dependencies.

---

### 3.6: Fix Map Share E2E Test

**Complexity**: MEDIUM
**Reason for Deferral**: Requires dev container rebuild

#### Background

The map share E2E test tests sharing maps between users. Needs fixes for Playwright 1.57+.

#### Known Issues

1. Multi-user authentication with separate browser contexts
2. Firebase Auth emulator race conditions
3. Snapshot baselines may need regeneration

#### Steps to Fix

1. Review test against current Playwright API
2. Verify Firebase Auth emulator configuration
3. Debug user creation/authentication flow
4. Update selectors if UI changed
5. Regenerate snapshots if needed

---

### Success Criteria - Phase 3 Complete

- [ ] **All dependencies at latest stable** (TypeScript 6.0 deferred until release)
- [ ] **Code quality**:
  - [x] ESLint 9.x configured (275 issues to fix)
  - [ ] Prettier formatting applied
  - [x] TypeScript strict mode enabled
- [ ] **Performance**:
  - [ ] Routes lazy-loaded
  - [ ] Bundle size optimized (<500KB main chunk)
  - [ ] Lighthouse score 90+
- [ ] **Security** (3.5):
  - [ ] No critical/high vulnerabilities
  - [ ] `yarn audit` clean
- [ ] **Deployment**:
  - [ ] Can deploy to Firebase Hosting
  - [ ] Can deploy to Firebase Functions (Node.js 20)
  - [ ] Environment variables documented
- [ ] **All tests pass** (3.6):
  - [x] Unit tests (96 passing)
  - [ ] E2E tests (16 passing, 8 failing - map share test)
- [ ] **Manual full walkthrough**

---

## Testing Checklists

### Per-Update Testing

1. `yarn build` - must succeed
2. `yarn test:unit` - all tests pass
3. `yarn test:e2e` - all tests pass
4. Manual smoke test

### Comprehensive Manual Test Checklist

#### Authentication
- [ ] Sign up / Sign in (email/password, Google)
- [ ] Sign out
- [ ] Session persistence

#### Adventures
- [ ] Create / View / Delete adventure
- [ ] Invite player (generate invite link)
- [ ] Join adventure via invite link

#### Maps
- [ ] Create hex / square map
- [ ] View / Clone / Delete map
- [ ] Edit map name/description

#### Map Editing - Hex Grid
- [ ] Draw / Erase walls
- [ ] Place / Move / Resize / Rotate / Delete token
- [ ] Draw / Delete area
- [ ] Add annotation
- [ ] Test line-of-sight (LOS)

#### Map Editing - Square Grid
- [ ] Same as hex grid

#### Images & Sprites
- [ ] Upload image
- [ ] Use image as token
- [ ] Create / Use spritesheet
- [ ] Delete image

#### Real-Time Sync (Critical)
- [ ] Open same map in two browsers
- [ ] Browser A: Add wall → appears in Browser B
- [ ] Browser B: Move token → appears in Browser A
- [ ] No duplicate listeners

#### Browser Compatibility
- [ ] Firefox (latest)
- [ ] Chrome (latest)
- [ ] Chromium-based (Edge, Brave)

---

## Deployment

### Staging

```bash
cd hexland-web
yarn build
firebase use staging
firebase deploy
```

### Production

```bash
firebase use production
yarn build
firebase deploy
```

### Rollback

Each phase has a git tag for quick rollback:
- `v1.3.10-phase0`, `v1.3.10-phase1`
- `v1.4.0-phase2`, `v1.4.0-phase3-complete`

---

## References

- [Firebase v9 Upgrade Guide](https://firebase.google.com/docs/web/modular-upgrade)
- [React 18 Upgrade Guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)
- [React Router v6 Migration](https://reactrouter.com/en/main/upgrading/v5)
- [Vite Guide](https://vitejs.dev/guide/)
- [Bootstrap 5 Migration](https://getbootstrap.com/docs/5.3/migration/)
- [Three.js Migration Guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)

---

**End of Revival Plan**
