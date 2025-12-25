# Developer Guide

Development workflows, common tasks, testing, and debugging for Wall & Shadow (Hexland).

## Development Environment

### Dev Container (Recommended)

The repository includes a VS Code dev container ([.devcontainer/](../.devcontainer/)):

- Node.js 20 LTS
- All Firebase emulators pre-configured (including Storage emulator)
- VS Code extensions for React/TypeScript development

**IMPORTANT**: Must clone repository into a named Docker volume (`hexland_workspace`) to avoid Windows/Linux permission conflicts.

See [.devcontainer/README.md](../.devcontainer/README.md) for detailed setup instructions.

### Standalone Docker

Alternative Docker setup using `run_docker.sh` and `docker-compose.yml` in the root directory. Less integrated with VS Code but works for command-line development.

## Testing Strategy

### Unit Tests

Location: [unit/](../was-web/unit/)
Framework: Vitest
Configuration: [unit/vitest.config.ts](../was-web/unit/vitest.config.ts)

**Commands**:

```bash
cd was-web
yarn test:unit          # Interactive watch mode
yarn test               # Single run
```

**Run a single test**:

```bash
yarn test:unit --testNamePattern="test name pattern"
```

### E2E Tests

Location: [e2e/](../was-web/e2e/)
Framework: Playwright
Test approach: Image snapshots to verify rendering

**Commands**:

```bash
cd was-web
yarn test:e2e           # Run all E2E tests (requires dev server running)
```

**Run a single test**:

```bash
yarn test:e2e --testNamePattern="test name pattern"
```

**Note**: Some tests have tight timeouts and may be flaky. Increase timeout values in test declarations if needed.

**Test environment**: Tests run against Firebase emulators with test data.

## Common Tasks

### Adding a New Map Feature Type

1. Add TypeScript interface to [data/feature.ts](../was-web/src/data/feature.ts)
2. Implement rendering in [models/three/](../was-web/src/models/three/) (e.g., new `*FeatureObject.ts`)
3. Add UI controls in [components/MapControls.tsx](../was-web/src/components/MapControls.tsx)
4. Update state machine in [models/mapStateMachine.ts](../was-web/src/models/mapStateMachine.ts)
5. Add change tracking support in [models/mapChangeTracker.ts](../was-web/src/models/mapChangeTracker.ts)

### Adding a New Firebase Function

1. Add function implementation to [functions/src/index.ts](../was-web/functions/src/index.ts) or separate file
2. Export from [functions/src/index.ts](../was-web/functions/src/index.ts)
3. Add TypeScript types to [data/](../was-web/src/data/) if needed (types are shared between web and functions)
4. Test with emulators using `yarn dev:firebase` from `was-web/`

### Debugging Rendering Issues

1. **VS Code debugger**: Use "Launch Chrome" configuration ([.vscode/launch.json](../.vscode/launch.json))
2. **Three.js debug helpers**: Enable in [drawing.ts](../was-web/src/models/three/drawing.ts) (grid helpers, axes)
3. **WebGL errors**: Check browser console
4. **Firestore data**: Use Firebase Emulator UI (http://localhost:4000)

### Debugging Firebase Issues

**Firebase Emulator UI**: http://localhost:4000

Available emulators:

- Firestore (port 8080)
- Functions (port 5001)
- Hosting (port 3400)
- Auth (port 9099)
- Storage (port 9199)

### Building for Production

```bash
cd was-web
yarn build
```

Output: `was-web/build/` directory
Build system: Vite with Rollup for optimized production bundles

**Verify build**:

```bash
# Start hosting emulator with production build
firebase emulators:start --only hosting
# Visit http://localhost:3400
```

### Deployment

See [DEPLOY.md](../DEPLOY.md) for comprehensive deployment instructions.

Quick reference:

```bash
cd was-web
yarn build
firebase deploy --only hosting    # Web app only (fast)
firebase deploy                   # Everything (includes Functions)
```

## Code Standards

### React Components

- Use functional components with hooks
- TypeScript strict mode enabled
- Components in [src/components/](../was-web/src/components/)
- Top-level page components as `*.tsx` files in [src/](../was-web/src/)

### Data Access

- Use `IDataReference<T>` for typed document access
- Use `IDataView<T>` for reactive queries
- Converters in [src/services/converter.ts](../was-web/src/services/converter.ts) for Firestore serialization
- All data access through [dataService.ts](../was-web/src/services/dataService.ts)

### Map Changes

**CRITICAL**: All map changes must go through the change tracking system.

- Use [mapChangeTracker.ts](../was-web/src/models/mapChangeTracker.ts) methods
- Never write directly to Firestore for map data
- Direct writes will break real-time sync

### Three.js Resources

- Reuse geometry buffers where possible
- Call `dispose()` on all Three.js objects when done
- Three.js can leak GPU memory if objects aren't disposed
- Monitor memory usage in browser dev tools

## Firebase Admin Credentials

Development requires Firebase Admin SDK credentials:

- Location: `was-web/firebase-admin-credentials.json`
- **Gitignored** - never commit credentials
- Obtain from Firebase Console: Project Settings → Service Accounts

## CORS Configuration

Firebase Storage CORS configuration in [was-web/cors.json](../was-web/cors.json).

Apply CORS configuration:

```bash
gsutil cors set cors.json gs://your-bucket-name.appspot.com
```
