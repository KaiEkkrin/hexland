# Hexland Dev Container

Complete development environment for Hexland (Wall & Shadow) with Node.js 20, Firebase Emulator Suite, and optional GPU support for Playwright/WebGL tests.

## Prerequisites

1. **Docker Desktop** (or Docker Engine + Docker Compose on Linux)
   - [Download Docker Desktop](https://www.docker.com/products/docker-desktop)

2. **Visual Studio Code** with **Dev Containers** extension
   - Install VS Code: https://code.visualstudio.com/
   - Install extension: `ms-vscode-remote.remote-containers`

3. **Windows Users: Use WSL2**
   - ⚠️ **IMPORTANT**: On Windows, you MUST use WSL2 for good performance
   - Clone and work with this repository inside WSL2, not directly on Windows (C: drive)
   - Docker Desktop must be configured to use the WSL2 backend
   - Setup guide: https://learn.microsoft.com/en-us/windows/wsl/install

## Quick Start

### Initial Setup

**On Windows:**
```bash
# Inside WSL2 (Ubuntu or other Linux distribution)
cd ~
git clone https://github.com/KaiEkkrin/hexland.git
cd hexland
code .
```

**On Linux:**
```bash
cd ~
git clone https://github.com/KaiEkkrin/hexland.git
cd hexland
code .
```

When VS Code opens, you'll see a popup: **"Reopen in Container"** - click it.

Alternatively, press `F1` and select **"Dev Containers: Reopen in Container"**.

The first build takes 5-10 minutes (downloads base image, installs dependencies, sets up Firebase emulators). Subsequent starts are much faster.

### Start Developing

Once the container is ready:

```bash
cd hexland-web
yarn start
```

This starts:
- React development server at http://localhost:5000
- Firebase Emulator UI at http://localhost:4000
- All Firebase emulators (Firestore, Auth, Functions, Hosting)

## GPU Configuration

GPU support enables hardware-accelerated WebGL rendering for Playwright tests. **This is optional** - the dev container works fine without GPU support (only the WebGL-specific Playwright test will fail).

### Option 1: NVIDIA GPU (WSL2 + Docker Desktop)

**Requirements:**
- NVIDIA GPU
- NVIDIA driver installed on Windows host
- Docker Desktop with WSL2 backend (includes NVIDIA Container Toolkit)

**Setup:**

Create a `.env` file in the `.devcontainer` directory:

```bash
# .devcontainer/.env
COMPOSE_PROFILES=nvidia
```

Then rebuild the container: `F1` → **"Dev Containers: Rebuild Container"**

**Note for WSL2 users**: Do NOT install any NVIDIA driver inside WSL2. The Windows driver is automatically made available to WSL2.

### Option 2: AMD GPU (Native Linux)

**Requirements:**
- AMD GPU with ROCm support
- ROCm drivers installed on Linux host
- Verify GPU access: `ls -la /dev/dri /dev/kfd`

**Setup:**

Create a `.env` file in the `.devcontainer` directory:

```bash
# .devcontainer/.env
COMPOSE_PROFILES=amd
```

Then rebuild the container: `F1` → **"Dev Containers: Rebuild Container"**

**Installing ROCm drivers** (if not already installed):
- Follow AMD's guide: https://rocm.docs.amd.com/projects/install-on-linux/en/latest/

### Option 3: No GPU

No configuration needed! Just open the repository in the dev container. The WebGL-dependent Playwright test will skip/fail, but all other functionality works normally.

### Verifying GPU Access

Inside the container, check for GPU devices:

**NVIDIA:**
```bash
# Should show your GPU
nvidia-smi
```

**AMD:**
```bash
# Should list GPU devices
ls -la /dev/dri /dev/kfd
```

## Firebase Setup (Optional)

For full Firebase Functions and Firestore emulator functionality, add admin credentials:

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select or create your Firebase project
3. Go to **Project Settings** > **Service Accounts**
4. Click **"Generate new private key"**
5. Save the downloaded JSON file as:
   ```
   hexland-web/firebase-admin-credentials.json
   ```

This file is in `.gitignore` and will never be committed.

The dev container works without credentials, but some Firebase features will be limited.

## Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| **React App** | http://localhost:5000 | Main web application |
| **Emulator UI** | http://localhost:4000 | Firebase emulator dashboard |
| **Hosting** | http://localhost:3400 | Firebase hosting emulator |
| **Functions** | http://localhost:5001 | Firebase Functions endpoint |
| **Mock Storage** | http://localhost:7000 | WebDAV storage service |
| **Firestore** | localhost:8080 | Firestore emulator |
| **Auth** | localhost:9099 | Authentication emulator |
| **Node Debug** | localhost:9229 | Node.js debugging port |

## Development Workflows

### Running Tests

```bash
cd hexland-web

# Unit tests (watch mode)
yarn test:unit

# E2E tests (requires dev server running in another terminal)
yarn test:e2e

# All tests
yarn test
```

### Building for Production

```bash
cd hexland-web
yarn build
```

Creates optimized production build in `hexland-web/build/` directory.

### Debugging

#### React App Debugging

1. Start dev server: `yarn start`
2. Press `F5` in VS Code or go to Run & Debug
3. Select **"Launch Chrome"**
4. Set breakpoints in your React code

#### Firebase Functions Debugging

1. Start emulators: `yarn start`
2. Go to Run & Debug in VS Code
3. Select **"Debug Firebase Functions"**
4. Set breakpoints in `hexland-web/functions/src/**/*.ts`
5. Trigger the function from your app or Emulator UI

## Architecture

### Services

The dev container runs two Docker services:

1. **hexland-dev** - Main development environment with Node.js, Firebase tools, and all dependencies
2. **mock-storage** - NGINX-based WebDAV server emulating Firebase Storage

Both share a Docker network for seamless communication.

### Storage

The repository is mounted as a bind mount at `/workspaces/hexland`. Cache and config directories are stored within the repository via symlinks:

- `~/.cache/firebase` → `.devcontainer/.cache/firebase`
- `~/.config` → `.devcontainer/.config`
- `~/.claude` → `.devcontainer/.claude`

This keeps cache/config persistent across container rebuilds while maintaining good performance on Linux/WSL2.

### Environment Variables

Automatically configured in the container:

- `NODE_OPTIONS=--openssl-legacy-provider` - webpack 4 compatibility with Node 20
- `IS_LOCAL_DEV=true` - Enables emulator-only features
- `FORCE_COLOR=true` - Colorized terminal output
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Firebase admin credentials

## Troubleshooting

### OpenSSL Error

**Symptom**: `error:0308010C:digital envelope routines::unsupported`

**Solution**: This should not happen as `NODE_OPTIONS=--openssl-legacy-provider` is set automatically. If you see this error:
1. Verify you're inside the dev container
2. Check: `echo $NODE_OPTIONS` (should show `--openssl-legacy-provider`)
3. Rebuild the container

### Firebase Emulators Won't Start

**Possible causes:**

1. **Java not found**: Run `java --version` (should show OpenJDK 17)
2. **Port conflicts**: Check if ports 3400, 4000, 5000, 5001, 8080, 9099 are already in use on your host
3. **Missing credentials**: Some emulators need `firebase-admin-credentials.json` (see Firebase Setup section)

### Slow Performance on Windows

**Symptom**: Slow file operations, long build times

**Solution**: Ensure you're working in WSL2, NOT directly on Windows:
- ✅ Repository should be in WSL2 filesystem: `/home/username/hexland`
- ❌ NOT on Windows filesystem: `/mnt/c/Users/username/hexland`

Verify Docker Desktop is using WSL2 backend: Settings → General → Use WSL 2 based engine

### Module Not Found

**Symptom**: `Cannot find module` errors

**Solution**: Reinstall dependencies
```bash
cd hexland-web
rm -rf node_modules
yarn install

cd functions
rm -rf node_modules
yarn install
```

### GPU Not Detected

**NVIDIA**:
- Verify NVIDIA driver on Windows: Open PowerShell, run `nvidia-smi`
- Verify Docker Desktop has WSL2 backend enabled
- Check `.env` file has `COMPOSE_PROFILES=nvidia`

**AMD**:
- Verify ROCm drivers: `rocm-smi` on host Linux
- Verify devices exist: `ls -la /dev/dri /dev/kfd`
- Check `.env` file has `COMPOSE_PROFILES=amd`
- Ensure your user is in `video` and `render` groups on the host

### Changes Not Reflecting in Browser

**Solutions:**

1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Check terminal for compilation messages
3. Restart dev server: `Ctrl+C`, then `yarn start`
4. Verify file is in `hexland-web/src/` and not excluded by `.gitignore`

### Container Build Fails

**Common causes:**

1. **Docker out of space**: Run `docker system prune -a`
2. **Network issues**: Retry the build
3. **Invalid configuration**: Check `.devcontainer/devcontainer.json` syntax

## Reconnecting After Closing VS Code

1. Open VS Code
2. Press `F1`
3. Type **"File: Open Recent"**
4. Select your hexland container workspace

OR use the Remote Explorer:
1. Open Remote Explorer in VS Code sidebar
2. Select "Dev Containers" from dropdown
3. Find your hexland container
4. Click to connect

## Resources

- [VS Code Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Node.js 20 Documentation](https://nodejs.org/docs/latest-v20.x/api/)
- [Docker Compose Profiles](https://docs.docker.com/compose/how-tos/profiles/)
- [WSL2 Setup Guide](https://learn.microsoft.com/en-us/windows/wsl/install)
- [NVIDIA GPU on WSL2](https://docs.nvidia.com/cuda/wsl-user-guide/index.html)
- [AMD ROCm on Linux](https://rocm.docs.amd.com/projects/install-on-linux/en/latest/)
