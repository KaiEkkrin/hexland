/**
 * Updates the app version document in Firestore after deployment.
 *
 * This script is run as part of the CI/CD deployment workflow to notify
 * connected clients that a new version is available, triggering them to reload.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json node scripts/update-version.js
 *
 * The script
 * 1. Reads the current Git commit hash
 * 2. Reads the version from package.json
 * 3. Writes both to the config/version document in Firestore
 *
 * Connected clients listening to this document will detect the change
 * and reload to get the new version.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { execSync } from 'child_process';
import { createRequire } from 'module';

// Use createRequire to load JSON files in ESM
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

// Initialize Firebase Admin SDK
// Uses GOOGLE_APPLICATION_CREDENTIALS environment variable
initializeApp();

const db = getFirestore();

async function updateVersion() {
  // Get the short Git commit hash
  const commit = execSync('git rev-parse --short HEAD').toString().trim();
  const version = packageJson.version;

  console.log(`Updating Firestore config/version document...`);
  console.log(`  Version: ${version}`);
  console.log(`  Commit: ${commit}`);

  await db.collection('config').doc('version').set({
    commit,
    version,
    updatedAt: FieldValue.serverTimestamp()
  });

  console.log(`\u2705 Updated version in Firestore: v${version}+${commit}`);
}

updateVersion()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\u274c Failed to update version:', error);
    process.exit(1);
  });
