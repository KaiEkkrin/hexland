# Hexland Dev Container

This dev container provides a complete, modern development environment for Hexland (Wall & Shadow), including:

- **Node.js 20 LTS** - Modern, secure Node.js runtime
- **Firebase Emulator Suite** - Full local Firebase environment
- **Mock WebDAV Storage** - Local file storage emulation
- **All build tools** - TypeScript, React, testing frameworks
- **VS Code integration** - Debugging, extensions, and more

## Prerequisites

Before using this dev container, ensure you have:

1. **Docker Desktop** installed and running
   - [Download for Windows/Mac](https://www.docker.com/products/docker-desktop)
   - Linux: Install Docker Engine + Docker Compose

2. **Visual Studio Code** with the "Dev Containers" extension
   - Install VS Code: https://code.visualstudio.com/
   - Install extension: `ms-vscode-remote.remote-containers`

3. **Firebase Admin Credentials** (optional but recommended)
   - See "Firebase Setup" section below

## Quick Start

1. **Open in VS Code**: Open this repository in VS Code

2. **Reopen in Container**:
   - Press `F1` or `Ctrl+Shift+P` (Windows/Linux) / `Cmd+Shift+P` (Mac)
   - Type "Reopen in Container"
   - Select "Dev Containers: Reopen in Container"

3. **Wait for setup**: First build takes 5-10 minutes
   - Downloading base image
   - Installing dependencies
   - Setting up Firebase

4. **Start developing**:
   ```bash
   cd hexland-web
   yarn start
   ```

5. **Open in browser**: Navigate to http://localhost:5000

## Firebase Setup

For full functionality (Functions, Firestore), you need Firebase admin credentials:

### Getting Credentials

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Go to **Project Settings** > **Service Accounts** tab
4. Click **"Generate new private key"**
5. Save the downloaded JSON file as:
   ```
   hexland-web/firebase-admin-credentials.json
   ```

### Important Notes

- This file is already in `.gitignore` and will **never be committed**
- The dev container works without it, but with limited functionality
- You can add it anytime and rebuild the container

### Firebase Project Setup

If you don't have a Firebase project:

1. Go to https://console.firebase.google.com/
2. Click "Add project" or "Create a project"
3. Follow the setup wizard
4. Enable these services:
   - **Authentication** (Email/Password + Google providers)
   - **Firestore Database**
   - **Cloud Functions**
   - **Hosting** (optional)
   - **Storage**

5. After creating the project, run in the dev container:
   ```bash
   cd hexland-web
   firebase use --add
   ```

## Service Endpoints

Once the dev server is running, access these services:

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

### Starting the Application

From within the dev container terminal:

```bash
cd hexland-web
yarn start
```

This command:
- Starts the React development server (port 5000)
- Starts all Firebase emulators (Firestore, Auth, Functions, Hosting)
- Enables hot-reload for both React and Functions
- Opens the Emulator UI at http://localhost:4000

### Running Tests

```bash
cd hexland-web

# Unit tests (watch mode)
yarn test:unit

# E2E tests (requires dev server running in another terminal)
yarn test:e2e

# All tests (interactive)
yarn test
```

### Debugging

#### Debugging the React App

1. Start the dev server: `yarn start`
2. In VS Code, press `F5` or go to Run & Debug
3. Select **"Launch Chrome"**
4. Set breakpoints in your React code
5. Interact with the app in the browser

#### Debugging Firebase Functions

1. Start emulators: `yarn start`
2. In VS Code, go to Run & Debug
3. Select **"Debug Firebase Functions"**
4. Set breakpoints in `hexland-web/functions/src/**/*.ts`
5. Trigger the function from your app or Emulator UI

### Building for Production

```bash
cd hexland-web
yarn build
```

Creates optimized production build in `hexland-web/build/` directory.

## Troubleshooting

### OpenSSL Error

**Symptom**: `error:0308010C:digital envelope routines::unsupported`

**Cause**: webpack 4 incompatibility with Node 18+

**Solution**: This should not happen in the dev container as `NODE_OPTIONS=--openssl-legacy-provider` is automatically set. If you see this error:
1. Verify you're inside the dev container
2. Check environment variable: `echo $NODE_OPTIONS`
3. Rebuild the container

### Firebase Emulators Won't Start

**Symptom**: Errors when running `yarn start` about emulators

**Possible causes and solutions**:

1. **Java not found**:
   ```bash
   java --version  # Should show OpenJDK 17
   ```
   If not found, rebuild the container.

2. **Port conflicts**:
   - Check if ports are already in use on your host machine
   - Stop other services using ports 3400, 4000, 5000, 5001, 8080, 9099

3. **Firebase credentials**:
   - Some emulators need `firebase-admin-credentials.json`
   - See "Firebase Setup" section above

4. **Clear cache**:
   ```bash
   rm -rf ~/.cache/firebase
   firebase emulators:start
   ```

### Slow Performance (Windows)

**Symptom**: Slow file operations, long build times

**Why**: Docker on Windows has slower file I/O for bind mounts

**Optimizations already applied**:
- `node_modules` directories use named volumes (not bind mounted)
- Source code uses `:cached` mount option

**Additional tips**:
- Ensure WSL 2 backend is enabled in Docker Desktop
- Keep the project on the Linux filesystem if using WSL 2
- Close unnecessary applications

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

### Port Already in Use

**Symptom**: `EADDRINUSE: address already in use`

**Solution**: Stop processes using the required ports

On Windows:
```powershell
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

On Linux/Mac:
```bash
lsof -ti:5000 | xargs kill -9
```

Or restart the dev container to reset all services.

### Firebase Login Issues

**Symptom**: `firebase login` fails or asks for login repeatedly

**Solutions**:

1. **Use localhost login** (if in interactive terminal):
   ```bash
   firebase login --reauth
   ```

2. **Use CI token** (for non-interactive):
   ```bash
   firebase login:ci
   # Copy the token, then:
   firebase login --token <your-token>
   ```

3. **Already logged in**:
   - This is fine! The error can be ignored if you're already logged in
   - Verify: `firebase projects:list`

### Container Build Fails

**Symptom**: Dev container fails to build

**Common causes**:

1. **Docker out of space**:
   ```bash
   docker system prune -a
   ```

2. **Network issues**: Retry the build

3. **Invalid configuration**: Check `.devcontainer/devcontainer.json` syntax

### Changes Not Reflecting

**Symptom**: Code changes don't appear in the browser

**Solutions**:

1. **Check hot-reload**: Look for compilation messages in terminal

2. **Hard refresh browser**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

3. **Restart dev server**:
   - Stop with `Ctrl+C`
   - Run `yarn start` again

4. **Check file is being watched**:
   - Ensure file is within `hexland-web/src/`
   - Check `.gitignore` isn't excluding it

## Architecture

### Multi-Service Setup

The dev container uses Docker Compose with two services:

1. **hexland-dev** (main container):
   - Your development environment
   - Contains Node.js, Firebase tools, all dependencies
   - Runs your terminal and VS Code server

2. **mock-storage** (companion container):
   - NGINX-based WebDAV server
   - Emulates Firebase Storage locally
   - Accessible at http://localhost:7000

Both services share a Docker network for seamless communication.

### Volumes

**Named volumes** (for performance):
- `hexland_node_modules_web` - Web app dependencies
- `hexland_node_modules_functions` - Functions dependencies
- `hexland_firebase_cache` - Firebase emulator JARs (faster startup)

**Bind mounts**:
- Project root → `/workspace` (your source code)

### Environment Variables

Automatically set in the container:

- `NODE_OPTIONS=--openssl-legacy-provider` - webpack 4 compatibility
- `IS_LOCAL_DEV=true` - Enables emulator-only features
- `FORCE_COLOR=true` - Colorized terminal output
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Firebase credentials

## Differences from Standalone Docker Setup

This dev container **coexists** with the existing `run_docker.sh` and `docker-compose.yml` setup:

| Feature | Dev Container | Standalone Docker |
|---------|---------------|-------------------|
| **Integration** | VS Code native | Command-line |
| **Extensions** | Auto-installed | Manual |
| **Debugging** | VS Code debugger | Terminal only |
| **Permissions** | Standard `node` user | Custom UID/GID mapping |
| **Use case** | Daily development | CI/CD, standalone |

You can use either approach based on your preference!

## VS Code Extensions

These extensions are automatically installed:

- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **Docker** - Docker file support
- **Firebase** - Firebase integration
- **Jest** - Test runner integration
- **Playwright** - E2E test support
- **React snippets** - React development helpers
- **GitLens** - Enhanced Git integration
- **Path Intellisense** - Autocomplete file paths

## Advanced Usage

### Rebuilding the Container

If you modify `.devcontainer/` configuration:

1. Press `F1` / `Ctrl+Shift+P`
2. Select "Dev Containers: Rebuild Container"
3. Wait for rebuild to complete

### Accessing the Host

From within the container, access host services at:
- Linux/Mac: `host.docker.internal`
- Windows: `host.docker.internal`

### Installing Additional Tools

Add to `.devcontainer/Dockerfile`:
```dockerfile
RUN apt-get update && apt-get install -y <package-name>
```

Then rebuild the container.

### Docker-in-Docker (DinD)

If you need Docker inside the container, uncomment in `docker-compose.yml`:
```yaml
privileged: true
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

## Getting Help

- **VS Code Docs**: https://code.visualstudio.com/docs/devcontainers/containers
- **Firebase Docs**: https://firebase.google.com/docs/emulator-suite
- **Project Issues**: Check the main README.md

## Resources

- [Dev Containers Documentation](https://containers.dev/)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Node.js 20 Release Notes](https://nodejs.org/en/blog/release/v20.0.0)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
