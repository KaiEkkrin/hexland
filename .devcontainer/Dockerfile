# Hexland Dev Container
# Node 20 LTS with Firebase tools, Java for emulators, and development dependencies

FROM mcr.microsoft.com/devcontainers/typescript-node:20-bookworm

# Install system dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    openjdk-17-jdk \
    imagemagick \
    rsync \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Install Playwright system dependencies
RUN npx playwright install-deps

# Set environment for webpack 4 compatibility with Node 20
ENV NODE_OPTIONS=--openssl-legacy-provider

# Install global npm packages
RUN npm install -g firebase-tools npm-run-all

# Create and configure cache directories for Firebase emulators
RUN mkdir -p /home/node/.cache/firebase \
    && chown -R node:node /home/node/.cache

# Switch to node user for subsequent operations
USER node

# Set working directory to VS Code's default for container volumes
WORKDIR /workspaces
