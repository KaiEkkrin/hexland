# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wall & Shadow (project codename: Hexland) is a virtual tabletop (VTT) web application for running tabletop RPG sessions online. It provides real-time collaborative map editing, token management, and game state sharing.

**Stack**: React 18 + TypeScript + Firebase (Firestore, Functions, Auth, Hosting, Storage) + Three.js for 3D rendering + Vite

**Status**: Currently being revived. Modern toolchain with Node.js 20, React 18, Vite, and Firebase v11.

## Development Commands

All commands are run from the `hexland-web/` directory unless otherwise noted.

### Starting Development

```bash
cd hexland-web

# Terminal 1: Start Firebase emulators
yarn dev:firebase

# Terminal 2: Start Vite dev server
yarn dev:vite
```

Running these separately is recommended - you can restart the app without restarting the emulators.

- Vite dev server: http://localhost:5000
- Firebase Emulator UI: http://localhost:4000

Alternative: `yarn start` runs both in parallel (less flexible).

### Testing

```bash
# Unit tests (interactive watch mode)
yarn test:unit

# End-to-end tests with Playwright (requires dev server running)
yarn test:e2e

# Standard React test runner
yarn test
```

### Building

```bash
yarn build
```

Outputs to `hexland-web/build/` directory. The build uses Vite with Rollup for optimized production bundles.

### Firebase Functions

```bash
cd hexland-web/functions
yarn lint          # Run ESLint
yarn build         # Compile TypeScript to lib/
```

### Deployment

```bash
cd hexland-web
yarn build
firebase deploy --only hosting    # Deploy web app only (recommended)
firebase deploy                   # Deploy everything (slower, includes Functions)
```

## Architecture

### High-Level Structure

The codebase follows a typical React SPA architecture with Firebase backend:

```
hexland-web/
├── src/
│   ├── components/          # React components and UI logic
│   ├── data/                # TypeScript interfaces for domain models
│   ├── models/              # Business logic, state machines, rendering logic
│   ├── services/            # Firebase integration, data access layer
│   ├── *.tsx                # Top-level page components (Home, Map, Adventure, etc.)
│   └── index.tsx            # React entry point
├── functions/               # Firebase Cloud Functions (Node.js backend)
├── public/                  # Static assets
├── e2e/                     # Playwright end-to-end tests
└── unit/                    # Jest unit tests
```

### Data Layer Architecture

**Firebase Collections**:
- `profiles/` - User profiles and preferences
- `adventures/` - Campaign/session containers
  - `adventures/{id}/players/` - Player access control per adventure
  - `adventures/{id}/maps/` - Maps within an adventure
    - `maps/{id}/changes/` - Incremental change tracking for real-time sync
- `images/` - User-uploaded image metadata
- `spritesheets/` - Sprite collections for tokens
- `invites/` - Share links for adventures

**Data Service Pattern**: The `dataService.ts` provides a Repository-like abstraction over Firestore using:
- `IDataReference<T>` - Typed document references with converters
- `IDataView<T>` - Observable data streams (reactive queries)
- Custom converters in `converter.ts` to marshal Firebase timestamps and data structures

### Rendering Architecture (Three.js)

Maps are rendered using Three.js with a custom rendering pipeline in `src/models/three/`:

**Core Rendering Components**:
- `gridGeometry.ts` / `hexGridGeometry.ts` / `squareGridGeometry.ts` - Abstract grid layout system supporting both hex and square grids
- `drawing.ts` / `drawingOrtho.ts` - Main rendering orchestration, manages scene graph
- `instancedFeatures.ts` / `instancedFeatureObject.ts` - Efficient instanced rendering for grid features (walls, terrain)
- `los.ts` / `losFilter.ts` - Line-of-sight calculations using raycasting
- `walls.ts` - Wall geometry generation and rendering
- `mapImages.ts` - Texture loading and image token rendering
- `tokenDrawingOrtho.ts` / `outlineTokenDrawing.ts` - Token rendering with outlines

**Rendering Pipeline**:
1. Grid geometry defines face/edge/vertex coordinates
2. Features (walls, terrain, tokens) are converted to instanced meshes
3. Filters (`losFilter`, `gridFilter`, `shaderFilter`) apply visual effects
4. Change tracking system (`mapChangeTracker.ts`) triggers selective re-renders

**State Management**: `mapStateMachine.ts` manages map interaction modes (view, pan, zoom, place tokens, draw walls, etc.) using a finite state machine pattern.

### Context Provider Architecture

The app uses nested React Context providers in `App.tsx` for dependency injection:

```
FirebaseContextProvider (Firebase SDK, auth)
  └─ UserContextProvider (current user, dataService)
      └─ AnalyticsContextProvider (Google Analytics)
          └─ ProfileContextProvider (user profile data)
              └─ StatusContextProvider (network status, toasts)
                  └─ AdventureContextProvider (current adventure, players)
                      └─ MapContextProvider (current map, stateMachine)
```

Each context provides domain-specific data and services to child components via `useContext()` hooks.

### Real-Time Synchronization

Maps use a change-tracking system for efficient real-time collaboration:

1. Base state stored in `maps/{id}/changes/base` document
2. Incremental changes stored in `maps/{id}/changes/{changeId}` documents
3. Clients subscribe to change stream via Firestore listeners
4. `mapChangeTracker.ts` merges changes and detects conflicts
5. Optimistic updates with rollback on conflict

This allows multiple users to edit the same map simultaneously with minimal data transfer.

### Firebase Functions

Located in `hexland-web/functions/src/`:

- `index.ts` - Function exports and routing
- `services/adminDataService.ts` - Server-side Firestore access with admin SDK
- `services/storage.ts` - Firebase Storage operations (image uploads, sprites)
- `services/spriteExtensions.ts` - Sprite sheet processing and manipulation

Functions handle server-side operations like image processing, storage management, and data validation that require elevated permissions.

## Key Concepts

### Grid Types

The app supports two grid types defined in `data/map.ts`:
- `MapType.Hex` - Hexagonal grid (pointy-top orientation)
- `MapType.Square` - Square grid

Each grid type has its own geometry implementation (`hexGridGeometry.ts` / `squareGridGeometry.ts`) that extends the abstract `IGridGeometry` interface.

### Features vs Tokens

- **Features** (`data/feature.ts`) - Generic grid elements: walls, terrain, areas
- **Tokens** (`data/tokens.ts`) - Movable game pieces representing characters/monsters
- **Characters** (`data/character.ts`) - Player character definitions with token associations
- **Sprites** (`data/sprite.ts`) - Image-based token appearances

### Coordinates

Grid coordinates are defined in `data/coord.ts`:
- `GridCoord` - Face (cell) coordinates
- `GridEdge` - Edge between two faces (for walls)
- `GridVertex` - Vertex where edges meet

The coordinate system is abstracted to work with both hex and square grids.

### Image Storage

Images are stored in Firebase Storage. In development, the Firebase Storage emulator is used.

The storage abstraction is in `services/storage.ts`.

## Development Environment

### Dev Container (Recommended)

The repository includes a VS Code dev container (`.devcontainer/`) that provides:
- Node.js 20 LTS
- All Firebase emulators pre-configured (including Storage emulator)
- VS Code extensions for React/TypeScript development

**Important**: Must clone repository into a named Docker volume (`hexland_workspace`) to avoid Windows/Linux permission conflicts. See `.devcontainer/README.md` for setup instructions.

### Standalone Docker

Alternative Docker setup using `run_docker.sh` and `docker-compose.yml` in the root directory. Less integrated with VS Code but works for command-line development.

## Testing Strategy

### Unit Tests (`unit/`)

Jest-based tests with React Testing Library. Configuration in `unit/jest.config.js`.

### E2E Tests (`e2e/`)

Playwright tests that use image snapshots to verify rendering. Tests run against Firebase emulators with test data.

**Note**: Some tests have tight timeouts and may be flaky. Increase timeout values in test declarations if needed.

## Important Gotchas

### Firebase Configuration

- Requires Firebase Admin SDK credentials in `hexland-web/firebase-admin-credentials.json` (gitignored)
- Emulator configuration in `firebase.json` binds to `0.0.0.0` for Docker compatibility
- CORS configuration for Storage bucket in `hexland-web/cors.json`

### Three.js Performance

The rendering system uses instanced meshes and geometry pooling for performance. When modifying rendering code:
- Reuse geometry buffers where possible
- Use `dispose()` to clean up Three.js objects
- Check memory usage - Three.js can leak GPU memory if objects aren't disposed

### Change Tracking

The map change tracking system is complex. When modifying map data:
- All changes must go through the change tracking system
- Direct Firestore writes will break real-time sync
- Use `mapChangeTracker.ts` methods to apply changes

## Firestore Security Rules

Located in `hexland-web/firestore.rules`. Key access patterns:
- Adventures: Owner + invited players have read/write
- Maps: Inherit adventure permissions
- Profiles: User can only read/write their own profile
- Images: User can only manage their own images

## Common Tasks

### Adding a New Map Feature Type

1. Add TypeScript interface to `data/feature.ts`
2. Implement rendering in `models/three/` (e.g., new `*FeatureObject.ts`)
3. Add UI controls in `components/MapControls.tsx`
4. Update state machine in `models/mapStateMachine.ts`
5. Add change tracking support in `models/mapChangeTracker.ts`

### Adding a New Firebase Function

1. Add function implementation to `functions/src/index.ts` or separate file
2. Export from `functions/src/index.ts`
3. Add TypeScript types to `data/` if needed (types are shared between web and functions)
4. Test with emulators using `yarn dev:firebase` from `hexland-web/`

### Debugging Rendering Issues

1. Use VS Code debugger with "Launch Chrome" configuration (`.vscode/launch.json`)
2. Enable Three.js debug helpers in `drawing.ts` (grid helpers, axes)
3. Check browser console for WebGL errors
4. Use Firebase Emulator UI (http://localhost:4000) to inspect Firestore data

### Running a Single Test

```bash
cd hexland-web
yarn test:unit --testNamePattern="test name pattern"
yarn test:e2e --testNamePattern="test name pattern"
```
