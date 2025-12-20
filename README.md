# Hexland

This project contains the source code for Wall & Shadow. It is available under the terms of the [Apache License, version 2.0](http://www.apache.org/licenses/LICENSE-2.0) -- see the LICENSE file.

## Stack

- **React 18** + TypeScript + Vite
- **Firebase v11** (Firestore, Functions, Auth, Hosting, Storage)
- **Three.js** for 3D map rendering
- **Bootstrap 5** with react-bootstrap

## Development with VS Code Dev Container (Recommended)

The easiest way to get started is with the VS Code dev container:

### Prerequisites

1. [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
2. [Visual Studio Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### Quick Start

1. Open this repository in VS Code
2. Press `F1` and select **"Dev Containers: Reopen in Container"**
3. Wait for the container to build (5-10 minutes first time)
4. Set up Firebase credentials (see [`.devcontainer/README.md`](.devcontainer/README.md))
5. Build Firebase Functions:
   ```bash
   cd hexland-web/functions
   yarn build
   ```
6. Start developing:
   ```bash
   cd hexland-web

   # Terminal 1: Start Firebase emulators
   yarn dev:firebase

   # Terminal 2: Start Vite dev server
   yarn dev:vite
   ```
7. Open http://localhost:5000 in your browser

Running emulators and dev server separately is recommended - you can restart the app without restarting the emulators.

See [`.devcontainer/README.md`](.devcontainer/README.md) for comprehensive documentation.

## Running Tests

```bash
cd hexland-web

# Unit tests (watch mode)
yarn test:unit

# End-to-end tests (requires dev server running)
yarn test:e2e
```

## Building and Deploying

```bash
cd hexland-web
yarn build
firebase deploy --only hosting    # Deploy web app only (recommended)
firebase deploy                   # Deploy everything (includes Functions)
```

## First Time Setup: CORS Policy

For deployment, configure CORS on your Firebase Storage bucket:

```bash
gsutil cors set hexland-web/cors.json gs://projectname.firebasestorage.app
```

## Alternative: Standalone Docker

A standalone Docker setup is available via `run_docker.sh` and `docker-compose.yml`. This is less integrated with VS Code but works for command-line development. See the script for usage.

## License

Apache License, version 2.0
