# Architecture

Detailed architecture documentation for Wall & Shadow (Hexland).

## Data Layer Architecture

### Firebase Collections

- `profiles/` - User profiles and preferences
- `adventures/` - Campaign/session containers
  - `adventures/{id}/players/` - Player access control per adventure
  - `adventures/{id}/maps/` - Maps within an adventure
    - `maps/{id}/changes/` - Incremental change tracking for real-time sync
- `images/` - User-uploaded image metadata
- `spritesheets/` - Sprite collections for tokens
- `invites/` - Share links for adventures

### Data Service Pattern

[dataService.ts](../was-web/src/services/dataService.ts) provides a Repository-like abstraction over Firestore:

- `IDataReference<T>` - Typed document references with converters
- `IDataView<T>` - Observable data streams (reactive queries)
- Custom converters in [converter.ts](../was-web/src/services/converter.ts) marshal Firebase timestamps and data structures

### Firestore Security Rules

Located in [firestore.rules](../was-web/firestore.rules):

- **Adventures**: Owner + invited players have read/write
- **Maps**: Inherit adventure permissions
- **Profiles**: User can only read/write their own profile
- **Images**: User can only manage their own images

## Rendering Architecture (Three.js)

Maps use Three.js with a custom rendering pipeline in [src/models/three/](../was-web/src/models/three/).

### Core Rendering Components

- `gridGeometry.ts` / `hexGridGeometry.ts` / `squareGridGeometry.ts` - Abstract grid layout system supporting both hex and square grids
- `drawing.ts` / `drawingOrtho.ts` - Main rendering orchestration, manages scene graph
- `instancedFeatures.ts` / `instancedFeatureObject.ts` - Efficient instanced rendering for grid features (walls, terrain)
- `los.ts` / `losFilter.ts` - Line-of-sight calculations using raycasting
- `walls.ts` - Wall geometry generation and rendering
- `mapImages.ts` - Texture loading and image token rendering
- `tokenDrawingOrtho.ts` / `outlineTokenDrawing.ts` - Token rendering with outlines

### Rendering Pipeline

1. Grid geometry defines face/edge/vertex coordinates
2. Features (walls, terrain, tokens) are converted to instanced meshes
3. Filters (`losFilter`, `gridFilter`, `shaderFilter`) apply visual effects
4. Change tracking system ([mapChangeTracker.ts](../was-web/src/models/mapChangeTracker.ts)) triggers selective re-renders

### State Management

[mapStateMachine.ts](../was-web/src/models/mapStateMachine.ts) manages map interaction modes using a finite state machine pattern:

- View, pan, zoom
- Place tokens
- Draw walls
- Edit features
- And more

### Performance Considerations

The rendering system uses instanced meshes and geometry pooling for performance:

- **Reuse geometry buffers** where possible
- **Use `dispose()`** to clean up Three.js objects
- **Check memory usage** - Three.js can leak GPU memory if objects aren't disposed properly

## Context Provider Architecture

The app uses nested React Context providers in [App.tsx](../was-web/src/App.tsx) for dependency injection:

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

## Real-Time Synchronization

Maps use a change-tracking system for efficient real-time collaboration:

1. Base state stored in `maps/{id}/changes/base` document
2. Incremental changes stored in `maps/{id}/changes/{changeId}` documents
3. Clients subscribe to change stream via Firestore listeners
4. [mapChangeTracker.ts](../was-web/src/models/mapChangeTracker.ts) merges changes and detects conflicts
5. Optimistic updates with rollback on conflict

This allows multiple users to edit the same map simultaneously with minimal data transfer.

**IMPORTANT**: All map changes must go through the change tracking system. Direct Firestore writes will break real-time sync.

## Firebase Functions

Located in [was-web/functions/src/](../was-web/functions/src/):

- `index.ts` - Function exports and routing
- `services/adminDataService.ts` - Server-side Firestore access with admin SDK
- `services/storage.ts` - Firebase Storage operations (image uploads, sprites)
- `services/spriteExtensions.ts` - Sprite sheet processing and manipulation

Functions handle server-side operations requiring elevated permissions: image processing, storage management, data validation.

## Key Concepts

### Grid Types

Defined in [data/map.ts](../was-web/src/data/map.ts):

- `MapType.Hex` - Hexagonal grid (pointy-top orientation)
- `MapType.Square` - Square grid

Each grid type has its own geometry implementation extending the abstract `IGridGeometry` interface.

### Features vs Tokens

- **Features** ([data/feature.ts](../was-web/src/data/feature.ts)) - Generic grid elements: walls, terrain, areas
- **Tokens** ([data/tokens.ts](../was-web/src/data/tokens.ts)) - Movable game pieces representing characters/monsters
- **Characters** ([data/character.ts](../was-web/src/data/character.ts)) - Player character definitions with token associations
- **Sprites** ([data/sprite.ts](../was-web/src/data/sprite.ts)) - Image-based token appearances

### Coordinates

Grid coordinates defined in [data/coord.ts](../was-web/src/data/coord.ts):

- `GridCoord` - Face (cell) coordinates
- `GridEdge` - Edge between two faces (for walls)
- `GridVertex` - Vertex where edges meet

The coordinate system is abstracted to work with both hex and square grids.

### Image Storage

Images stored in Firebase Storage. Development uses Firebase Storage emulator.

Storage abstraction in [services/storage.ts](../was-web/src/services/storage.ts).

## Hosting & Routing

Firebase Hosting serves two HTML entry points:

- [landing-index.html](../was-web/landing-index.html) - Static landing page at root (`/`)
- [app.html](../was-web/app.html) - React SPA for all app routes (`/app`, `/adventure/*`, `/map/*`, `/invite/*`, etc.)

Routing configured in [firebase.json](../was-web/firebase.json) using rewrites.
