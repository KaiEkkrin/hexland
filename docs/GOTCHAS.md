# Important Gotchas & Troubleshooting

This is an AI-generated document.

## Firebase Configuration

### Admin Credentials

**Required**: `was-web/firebase-admin-credentials.json`

- **Gitignored** - never commit
- Download from Firebase Console: Project Settings → Service Accounts → Generate New Private Key
- Place in `was-web/` directory
- Without this file, Firebase Functions won't work in development

### Emulator Configuration

[firebase.json](../was-web/firebase.json) binds all emulators to `0.0.0.0` for Docker compatibility.

**Ports**:

- Firestore: 8080
- Functions: 5001
- Hosting: 3400
- Emulator UI: 4000
- Auth: 9099
- Storage: 9199

### Storage CORS

CORS configuration for Storage bucket in [was-web/cors.json](../was-web/cors.json).

**If you get CORS errors**:

```bash
gsutil cors set was-web/cors.json gs://your-bucket-name.appspot.com
```

## Three.js Performance

### Memory Leaks

**CRITICAL**: Three.js objects are NOT garbage collected automatically.

**Always**:

- Call `dispose()` on geometries, materials, textures when done
- Remove objects from scene before disposing
- Use geometry pooling and reuse buffers where possible

**Check memory**:

- Browser dev tools → Performance → Memory
- Look for increasing heap size over time
- Use Chrome's heap snapshot to find retained objects

### Instanced Rendering

The rendering system uses instanced meshes for performance:

- Don't create individual meshes for each feature/token
- Use `instancedFeatureObject.ts` and `instancedFeatures.ts` patterns
- Batch updates to instance matrices

## Change Tracking System

### Critical Rules

**NEVER**:

- Write directly to Firestore for map data
- Modify `maps/{id}` documents directly
- Skip the change tracking system

**ALWAYS**:

- Use [mapChangeTracker.ts](../was-web/src/models/mapChangeTracker.ts) methods
- Apply changes through the change tracking API
- Let the system handle conflict resolution

**Why**: Direct Firestore writes will:

- Break real-time sync for other users
- Cause data conflicts
- Lose change history
- Create inconsistent state

### How It Works

1. Base state: `maps/{id}/changes/base` document
2. Incremental changes: `maps/{id}/changes/{changeId}` documents
3. Clients subscribe to change stream
4. `mapChangeTracker.ts` merges changes and detects conflicts
5. Optimistic updates with rollback on conflict

## Testing

### E2E Test Flakiness

**Issue**: Some Playwright tests have tight timeouts and may fail intermittently.

**Solution**: Increase timeout values in test declarations:

```typescript
test("my test", async ({ page }) => {
  // Increase timeout from default 30s to 60s
  test.setTimeout(60000);
  // ... test code
});
```

### Image Snapshot Failures

**Issue**: E2E tests use image snapshots that may fail due to rendering differences.

**Causes**:

- Different GPU/graphics drivers
- Font rendering differences
- Timing issues (animations not complete)

**Solution**:

```bash
# Update snapshots
yarn test:e2e --update-snapshots
```

**Review diffs** before committing updated snapshots.

### Test Data

E2E tests run against Firebase emulators with test data.

**Reset test data**:

```bash
# Stop emulators
firebase emulators:stop

# Restart (clears data)
yarn dev:firebase
```

## Build Issues

### Vite Build Failures

**Issue**: Build fails with TypeScript errors.

**Solution**:

```bash
cd was-web
yarn tsc --noEmit  # Check TypeScript errors without building
```

Fix all TypeScript errors before building.

### Firebase Deploy Failures

**Issue**: Deploy fails with "functions" errors.

**Solution**:

```bash
cd was-web/functions
yarn lint
yarn build
```

Functions must build and lint successfully before deployment.

**Check predeploy hooks** in [firebase.json](../was-web/firebase.json):

```json
"functions": {
  "predeploy": [
    "npm --prefix \"$RESOURCE_DIR\" run lint",
    "npm --prefix \"$RESOURCE_DIR\" run build"
  ]
}
```

## Firebase Admin SDK Issues

### "Cannot find module" Errors

**Issue**: Functions fail to import from `firebase-admin`.

**Cause**: Missing or incorrect Node.js version.

**Solution**:

- Use Node.js 20 (specified in [functions/package.json](../was-web/functions/package.json))
- Reinstall dependencies:

```bash
cd was-web/functions
rm -rf node_modules
yarn install
```

### Emulator Connection Errors

**Issue**: Functions can't connect to Firestore emulator.

**Cause**: Emulator not running or wrong host.

**Solution**:

```bash
# Ensure emulators are running
cd was-web
yarn dev:firebase

# Check emulator UI
# Open http://localhost:4000
```

**In Docker**: Emulators bind to `0.0.0.0`, not `localhost`.

## Hosting & Routing Issues

### Landing Page Not Showing

**Issue**: Root URL shows app instead of landing page.

**Cause**: Missing build or incorrect rewrites.

**Solution**:

```bash
cd was-web
yarn build
firebase emulators:start --only hosting
# Visit http://localhost:3400
```

**Check rewrites** in [firebase.json](../was-web/firebase.json):

- Root (`/`) → `landing-index.html`
- App routes (`/app`, `/adventure/*`, etc.) → `app.html`

### 404 Errors on App Routes

**Issue**: Refreshing `/app` or `/adventure/xyz` gives 404.

**Cause**: Missing rewrites in [firebase.json](../was-web/firebase.json).

**Solution**: Ensure all app routes are rewritten to `app.html`:

```json
{
  "source": "/app/**",
  "destination": "/app.html"
}
```

## Real-Time Sync Issues

### Changes Not Appearing

**Issue**: Map changes don't sync to other clients.

**Possible causes**:

1. **Direct Firestore writes** (bypassing change tracking)
2. **Offline mode** (check network tab)
3. **Permission errors** (check Firestore security rules)
4. **Listener not attached** (check component lifecycle)

**Debug**:

```bash
# Open Firebase Emulator UI
# http://localhost:4000
# Check Firestore → maps/{id}/changes/
# Should see base + incremental change documents
```

### Conflict Resolution Failures

**Issue**: Changes are lost or overwritten.

**Cause**: Change tracking conflict resolution failed.

**Solution**:

- Check console for conflict errors
- Ensure [mapChangeTracker.ts](../was-web/src/models/mapChangeTracker.ts) is handling conflicts
- May need to increase conflict resolution timeout (currently 30s)

## Storage Issues

### Image Upload Failures

**Issue**: Images fail to upload to Firebase Storage.

**Possible causes**:

1. **CORS errors** (see CORS section above)
2. **Missing credentials** (check `firebase-admin-credentials.json`)
3. **Storage emulator not running**
4. **File size limits** (Firebase has 32MB limit)

**Debug**:

```bash
# Check Storage emulator
# http://localhost:4000 → Storage tab
# Should see uploaded files
```

### Image Loading Failures

**Issue**: Images don't load in app.

**Cause**: Storage bucket URL not configured or CORS issues.

**Solution**:

- Check Firebase Storage rules in [storage.rules](../was-web/storage.rules)
- Verify CORS configuration
- Check browser console for CORS errors
- Ensure images exist in Storage bucket
