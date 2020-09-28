# Hexland

This project contains the source code for [Wall & Shadow](https://wallandshadow.io).

## Building it

You will need:

- Node.js 12, Yarn.
- The Google Firebase toolchain, and a Firebase project to host Hexland in.  I recommend following the [Firebase setup instructions](https://firebase.google.com/docs/web/setup).  The project will need to have the following enabled:
  - Authentication: Email/password, Google.
  - Firestore.
  - Functions, with Node.js 12 support -- this means you need to upgrade your project to "Blaze" level from "Spark", and create yourself a billing account if you don't have one already.
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
yarn build
firebase deploy
```

If you have only made changes to the web application and not to anything else (Functions or Firestore security rules) I *strongly* recommend replacing that second command with

```bash
firebase deploy --only hosting
```

to avoid incurring the extra wait time (and potentially even bill!) of the server-side Functions build.

## Running it locally

Local execution of the web application assumes two things:

- a local release build of the web application, not used to serve any of its actual pages, but used to provide a static URL for the Firebase configuration
- access to the "real" Firebase Functions and Firestore.  (Setting up a debug build to run using emulators is left as an exercise for the reader.)

Therefore, I recommend doing your first deploy, and re-doing it if you've changed Functions or Firestore security rules, before doing this

```bash
yarn start
```

to load the local debug Web application.
