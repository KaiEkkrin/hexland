# Hexland Dev Container
# Node 20 LTS with Firebase tools, Java for emulators, and development dependencies

FROM mcr.microsoft.com/devcontainers/typescript-node:20-trixie

# Install system dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    openjdk-21-jdk \
    imagemagick \
    rsync \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Install Playwright system dependencies
RUN npx playwright install-deps

# Set environment for webpack 4 compatibility with Node 20
ENV NODE_OPTIONS=--openssl-legacy-provider

# Install global npm packages
RUN npm install -g firebase-tools npm-run-all

# Switch to node user for subsequent operations
# Note: Cache, config, and credential directories are created via symlinks
# in postCreateCommand (see .devcontainer/scripts/post-create.sh)
USER node

# Set working directory to VS Code's default for container volumes
WORKDIR /workspaces
