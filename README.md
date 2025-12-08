# Hexland

This project contains the source code for Wall & Shadow.  It is available under the terms of the [Apache License, version 2.0](http://www.apache.org/licenses/LICENSE-2.0) -- see the LICENSE file.  Versions of the source code prior to the creation of the LICENSE file (made when the repository was private) are retroactively covered by that license too.

Wall & Shadow itself is now mothballed because I don't have enough free time to maintain it. It may reappear at some point in the future. I'm leaving this repository here for posterity.

## Building it

You will need:

- Node.js 12, Yarn.
- The Google Firebase toolchain, and a Firebase project to host Hexland in.  I recommend following the [Firebase setup instructions](https://firebase.google.com/docs/web/setup).  The project will need to have the following enabled:
  - Authentication: Email/password, Google.
  - Firestore.
  - Functions, with Node.js 12 support -- this means you need to upgrade your project to "Blaze" level from "Spark", and create yourself a billing account if you don't have one already.  (You're quite unlikely to actually incur a bill.  The free quotas are plenty for most development usage.)
  - Google Analytics (optionally, I think.)
  - Hosting.
- The Firebase emulator suite.
- gsutil, installed as per the [gsutil setup instructions](https://cloud.google.com/storage/docs/gsutil_install#linux).

I develop using WSL 2 and Visual Studio Code, I can't vouch for the effectiveness of anything else ;)

## Running tests

First time setup: ensure you have the Firebase emulators ready

```bash
# Initialize only the emulators we need (Auth, Firestore, Functions, Hosting)
# This excludes Storage, Database, Pub/Sub, and other emulators
firebase init emulators
# When prompted, select: Authentication, Firestore, Functions, Hosting
# Use default ports or customize as needed
```

The following command is set up to load a Firebase emulator with Firestore and Functions support:

```bash
cd hexland-web/functions && yarn serve
```

Having left that running you can now run tests:

```bash
# Run unit tests (Jest-based tests for models, services, data)
cd hexland-web
yarn test:unit

# Run end-to-end tests (Playwright-based visual regression tests)
# Note: E2E tests require Playwright setup (currently needs revival)
yarn test:e2e
```

The expected execution time of some of the tests is quite close to the timeout value.  If you encounter spurious timeouts, try adding longer timeout values to the `test(...)` declarations.

## Development with VS Code Dev Container (Recommended)

The easiest way to get started with modern tooling is to use the VS Code dev container. This provides:

- **Node.js 20 LTS** - Modern, secure runtime (vs. the EOL Node.js 12/14 mentioned above)
- **Firebase Emulator Suite** - Fully configured and ready to use
- **All dependencies pre-installed** - No manual setup required
- **VS Code integration** - Debugging, extensions, and more
- **Zero configuration** - Works with existing codebase, no upgrades needed

### Prerequisites

1. [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
2. [Visual Studio Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

### Quick Start

1. Open this repository in VS Code
2. Press `F1` (or `Ctrl+Shift+P` / `Cmd+Shift+P`) and select **"Dev Containers: Reopen in Container"**
3. Wait for the container to build (5-10 minutes first time)
4. Follow the prompts to set up Firebase credentials (see `.devcontainer/README.md` for details)
5. Start developing:
   ```bash
   cd hexland-web
   yarn start
   ```
6. Open http://localhost:5000 in your browser

### Documentation

See [`.devcontainer/README.md`](.devcontainer/README.md) for comprehensive documentation including:
- Firebase credentials setup
- Service endpoints and ports
- Development workflows
- Debugging guide
- Troubleshooting common issues

### Note on Compatibility

The dev container uses **Node.js 20 LTS** with a compatibility workaround (`NODE_OPTIONS=--openssl-legacy-provider`) that allows the existing 2022-era dependencies to work without any upgrades. This gives you a secure, modern development environment while maintaining full compatibility with the existing codebase.

The standalone Docker setup (see "Running locally with Docker" below) is still available and fully supported.

## Running locally (in Dev Container)

Once you're inside the dev container (see "Development with VS Code Dev Container" above), follow these steps to run the application locally:

### 1. Build Functions

First, build the Firebase Functions TypeScript code:

```bash
cd /workspaces/hexland/hexland-web/functions
yarn install  # First time only
yarn build    # Compiles TypeScript to lib/
```

### 2. Start Firebase Emulators

Start the Firebase emulators (Auth, Firestore, Functions, Hosting) in one terminal:

```bash
cd /workspaces/hexland/hexland-web
firebase emulators:start --only auth,firestore,functions,hosting
```

This will start:
- **Authentication Emulator**: `http://localhost:9099`
- **Firestore Emulator**: `http://localhost:8080`
- **Functions Emulator**: `http://localhost:5001`
- **Hosting Emulator**: `http://localhost:3400`
- **Emulator UI**: `http://localhost:4000` (view all emulator data here)

### 3. Start React Dev Server

In a separate terminal, start the React development server:

```bash
cd /workspaces/hexland/hexland-web
PORT=5000 yarn react-scripts start
```

Or use the convenience script that runs both emulators and dev server in parallel:

```bash
cd /workspaces/hexland/hexland-web
yarn start  # Runs both dev:firebase and dev:react in parallel
```

### 4. Access the Application

Open your browser to:
- **Application**: http://localhost:5000
- **Emulator UI**: http://localhost:4000 (to view/manage emulated Firebase data)

### Running Tests

```bash
cd /workspaces/hexland/hexland-web

# Unit tests (interactive watch mode)
yarn test:unit

# Unit tests (single run)
yarn test:unit --watchAll=false

# End-to-end tests (requires Playwright setup)
yarn test:e2e
```

### Building for Production

```bash
cd /workspaces/hexland/hexland-web
yarn build  # Creates optimized production build in build/
```

## First time setup: enabling the CORS policy on your project's storage bucket (needed for deployment only)

Make sure that `hexland-web/cors.json` contains the correct origin(s) for your project and then run

```bash
gsutil cors set cors.json gs://projectname.appspot.com
```

(replacing `projectname` with your project name).

## Deploying

```bash
yarn install
yarn build
firebase deploy
```

If you have only made changes to the web application and not to anything else (Functions or Firestore security rules) I *strongly* recommend replacing that second command with

```bash
firebase deploy --only hosting
```

to avoid incurring the extra wait time (and potentially even bill!) of the server-side Functions build.

## Running locally with Docker

### Setup

Docker can be used to run the web application locally with emulators for Firebase Functions and
Firestore. With this development flow, the Firebase project associated with the application only
needs to be set to the "Spark" level rather than the "Blaze" level.

To start, run the following:

```bash
./run_docker.sh
```

This will build a Docker image containing build tools and the emulators, and then start a
container that runs the emulators and builds the web application (rebuilding when source file
changes are detected).

If you get a permissions error, run this and try again

```bash
sudo chown -R $USER .usercache
```

When running, the web application can then be accessed at:

[http://localhost:5000](http://localhost:5000)

Note that the web application may take a minute or more to build, although subsequent source file
changes should result in a much faster rebuild.

The first time this script is run, you will have to follow the generated browser link in order to
authorise the Firebase CLI to access Firebase resources via your Google account. After
successful authorisation, the script will create a default Firebase project with the name
`hexland-test-<username>` and create an associated Firebase web app resource. You will then see
the message:

```shell
Error: Failed to read credentials from file /usr/src/app/hexland-web/firebase-admin-credentials.json
```

This means that you must supply Firebase admin SDK service account credentials for the Firebase
Function and Firestore emulators. You can provide these by accessing the
[Firebase console](https://console.firebase.google.com/), navigating to "Project settings"
(found by clicking the cog-wheel at the top-left of the Firebase console page) and selecting the
"Service accounts" tab. Make sure the "Firebase Admin SDK" is selected and then click "Generate
new private key". Save the generated JSON file to:

```
hexland-web/firebase-admin-credentials.json
```

Then re-run `run_docker.sh` (Ctrl-C any existing run first) to use the credentials.

### Running unit tests

To run unit tests inside the container, run:

```shell
./run_docker.sh test:unit
```

### Running end-to-end tests

To run end-to-end tests inside the container, run:

```shell
./run_docker.sh test:e2e
```

### Debugging via a shell

To run a bash shell for debugging inside the container, run:

```shell
./run_docker.sh shell
```
