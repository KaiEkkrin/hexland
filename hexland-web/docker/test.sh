#!/bin/bash
# Emulate Firestore and Firebase Function services and then run tests

cd hexland-web/functions
yarn serve &

# Wait for emulator UI to become available (indicating emulators have started)
until $(curl --output /dev/null --silent --head --fail http://localhost:4000); do
    sleep 1
done

cd ..
yarn test
