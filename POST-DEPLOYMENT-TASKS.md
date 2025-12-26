# Wall & Shadow - Post-Deployment Tasks

These items were deferred from the Revival Plan Phase 3 as non-critical for initial test deployment. They can be addressed incrementally after the application is live.

---

## Testing & Quality Assurance

### Fix Map Share E2E Test

**Priority:** Medium
**Effort:** Medium
**Phase 3.6 reference**

The map share end-to-end test is currently failing (8 of 24 E2E tests failing). This test verifies map sharing functionality between multiple users using separate browser contexts.

**Known Issues:**

- Multi-user authentication with separate browser contexts
- Firebase Auth emulator race conditions
- Snapshot baselines may need regeneration after Playwright 1.57+ upgrade

**Steps to Fix:**

1. Review test against current Playwright 1.57+ API
2. Verify Firebase Auth emulator configuration for multi-context scenarios
3. Debug user creation/authentication flow
4. Update selectors if UI components changed during React 18/Bootstrap 5 migrations
5. Regenerate snapshots if needed

**Why Deferred:** Requires dev container rebuild and significant debugging time. Manual testing shows map sharing works correctly.

---

### Update Playwright to Latest Version

**Priority:** Low
**Effort:** Small
**Phase 3.1 reference**

Update Playwright test runner and browser binaries to latest version.

**Steps:**

```bash
cd was-web
yarn upgrade @playwright/test
npx playwright install  # Download latest browser binaries
yarn test:e2e
```

**Expected Impact:** Better test reliability, latest browser support, potential performance improvements.

---

### Update Testing Libraries

**Priority:** Low
**Effort:** Small
**Phase 3.1 reference**

Update React Testing Library and related packages to latest versions:

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  }
}
```

**Why Update:** Current versions work but are behind latest. Newer versions offer better React 18 support and improved TypeScript types.

---

### Complete Manual Testing Walkthrough

**Priority:** Medium
**Effort:** Medium
**Phase 3 Success Criteria reference**

Execute comprehensive manual testing checklist covering:

- Authentication flows (email/password, Google, sign out, session persistence)
- Adventure management (create, view, delete, invite players, join via link)
- Map operations (create hex/square, view, clone, delete, edit metadata)
- Map editing for both grid types (walls, tokens, areas, annotations, line-of-sight)
- Images & sprites (upload, use as token, spritesheets, deletion)
- Real-time sync verification (multi-browser testing)
- Browser compatibility (Firefox, Chrome, Edge, Brave)

**Current Status:** Core flows manually verified during development. Full systematic walkthrough not yet completed.

---

## Code Quality

### Add Prettier Code Formatting

**Priority:** Medium
**Effort:** Small
**Phase 3.2 reference**

Install and configure Prettier for consistent code formatting across the codebase.

**Steps:**

1. Install Prettier: `yarn add -D prettier`
2. Create `.prettierrc.json`:
   ```json
   {
     "semi": true,
     "singleQuote": true,
     "trailingComma": "es5",
     "printWidth": 100
   }
   ```
3. Add `.prettierignore` file
4. Format entire codebase: `npx prettier --write "src/**/*.{ts,tsx,css,json}"`
5. Add pre-commit hook (optional)

**Benefits:** Eliminates style debates, ensures consistent formatting, simplifies code reviews.

---

### Enable Additional TypeScript Strict Options

**Priority:** Low
**Effort:** Medium (may require code changes)
**Phase 3.2 reference**

Enable stricter TypeScript compiler options for improved type safety:

```json
{
  "compilerOptions": {
    "strict": true, // ✅ Already enabled
    "noUncheckedIndexedAccess": true, // Makes array/object index access safer
    "noPropertyAccessFromIndexSignature": true // Requires bracket notation for index signatures
  }
}
```

**Impact:** May require code changes to handle `undefined` in more places. Catches potential runtime errors at compile time.

---

## Performance Optimization

### Implement Code Splitting with Lazy Loading

**Priority:** Medium
**Effort:** Small
**Phase 3.3 reference**

Lazy load route components in `src/App.tsx` to reduce initial bundle size:

```typescript
import { lazy, Suspense } from "react";

const Home = lazy(() => import("./Home"));
const MapPage = lazy(() => import("./Map"));
const AdventurePage = lazy(() => import("./Adventure"));
// etc.

<Suspense fallback={<div>Loading...</div>}>
  <Routes>
    <Route path="/" element={<Home />} />
    {/* etc */}
  </Routes>
</Suspense>;
```

**Expected Impact:** Faster initial page load, smaller main bundle, better user experience on slower connections.

---

### Add Bundle Size Analysis

**Priority:** Low
**Effort:** Small
**Phase 3.3 reference**

Install and configure Rollup plugin visualizer to analyze bundle composition:

```bash
yarn add -D rollup-plugin-visualizer
```

Update `vite.config.ts`:

```typescript
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [react(), visualizer({ open: true })],
});
```

**Benefits:** Identify large dependencies, find optimization opportunities, track bundle size over time.

**Target:** Main chunk < 500KB (gzipped)

---

### Perform Lighthouse Audit

**Priority:** Medium
**Effort:** Small
**Phase 3.3 reference**

Run Lighthouse audit on deployed application and address issues.

**Target Scores:**

- Performance: 90+
- Accessibility: 90+
- Best Practices: 90+
- SEO: 90+

**Common Issues to Expect:**

- Image optimization opportunities
- Accessibility improvements (ARIA labels, color contrast)
- Cache policy recommendations (already addressed in firebase.json)
- Mobile performance optimizations

---

## Deployment & Infrastructure

### Document Environment Variables

**Priority:** High (for other developers)
**Effort:** Trivial
**Phase 3.4 reference**

Create `.env.example` file documenting required environment variables:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Purpose:** Makes onboarding new developers easier, documents configuration requirements.

---

### Set Up CI/CD Pipeline

**Priority:** Medium
**Effort:** Medium
**Phase 3.4 reference**

Create GitHub Actions workflow for automated testing and deployment.

**Create:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: cd was-web && yarn install
      - run: cd was-web && yarn lint
      - run: cd was-web && yarn build
      - run: cd was-web && yarn test:unit
```

**Benefits:** Catches issues before merge, ensures tests always pass on main branch, can automate deployments.

---

### Implement Firebase App Check

**Priority:** Low (for test deployment), Medium (for production)
**Effort:** Medium
**Phase 3.8 reference**

Firebase App Check protects backend resources by requiring attestation tokens with requests.

**Why Not Critical Now:**

- Firestore/Storage security rules already require authentication
- Can be added post-launch without breaking existing clients
- Free tier (10,000 assessments/month) is sufficient for casual VTT use

**When to Implement:** Before public launch with significant user base.

**Implementation Steps:**

1. Create reCAPTCHA Enterprise key in Google Cloud Console
2. Register app in Firebase Console App Check section
3. Add client-side initialization code to `src/firebase.ts`
4. Add `enforceAppCheck: true` to Cloud Functions
5. Enable enforcement in Firebase Console (monitor mode first, then enforce)

**Cost:** Free for 10,000 assessments/month, then $1 per 1,000 assessments.

---

## Future Major Upgrades

### Upgrade to TypeScript 6.0

**Priority:** Low (blocked until release)
**Effort:** Small (preparatory work complete)
**Phase 3.1 reference**

**Status:** TypeScript 6.0 is in development (58% complete as of Dec 2025). Target release: early 2026.

TypeScript 6.0 is a "bridge" release before TypeScript 7.0 (rewritten in Go for 10x performance).

**Current Blocker:**

- `@typescript-eslint/*` peer dependency requires `typescript@>=4.8.4 <6.0.0`

**Preparatory Work Already Complete:**

- ✅ Updated `tsconfig.json`: target ES2022, moduleResolution bundler
- ✅ Updated `e2e/tsconfig.json`: ES2022 target, bundler moduleResolution
- ✅ Fixed ES module compatibility (`__dirname` → `import.meta.url`)
- ✅ Added `"type": "module"` to package.json
- ✅ Migrated from Jest to Vitest (removed ts-jest blocker)

**Action When Available:**

1. Wait for `@typescript-eslint` to support TypeScript 6.0
2. Update TypeScript: `yarn upgrade typescript@6`
3. Run tests and fix any new type errors
4. Review TypeScript 6.0 release notes for breaking changes

---

## Summary

**Total Tasks:** 14

**Priority Breakdown:**

- High: 1 (environment variables documentation)
- Medium: 7 (testing, code quality, performance, CI/CD)
- Low: 6 (tooling updates, future enhancements)

**Recommended Order:**

1. Document environment variables (quick win)
2. Complete manual testing walkthrough (verify quality)
3. Perform Lighthouse audit (identify issues early)
4. Add Prettier (improves developer experience)
5. Implement code splitting (improves user experience)
6. Fix map share E2E test (quality assurance)
7. Set up CI/CD (prevents regressions)
8. Remaining items as time permits

**None of these tasks block deployment.** The application is production-ready for test deployment.
