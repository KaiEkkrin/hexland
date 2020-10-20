# Hexland

This project contains the source code for [Wall & Shadow](https://wallandshadow.io).

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

I develop using WSL 2 and Visual Studio Code, I can't vouch for the effectiveness of anything else ;)

## Running tests

The following command is set up to load a Firebase emulator with Firestore and Functions support:

```bash
cd functions && yarn serve
```

Having left that running you can now do

```bash
yarn test
```

The expected execution time of some of the tests is quite close to the timeout value.  If you encounter spurious timeouts, try adding longer timeout values to the `test(...)` declarations.

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
changes are detected). The web application can then be accessed at:

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