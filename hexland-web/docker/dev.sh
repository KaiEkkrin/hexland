#!/bin/bash
# Watch for changes to Firebase Function and webapp sources, rebuilding if
# necessary. Also emulate hosting, Firestore and Firebase Function services.
#
# Use a Firebase project named after the current user, request user
# authorisation and creating the project if necessary.

# Login to Firebase and specify the project to use (creating the project if it
# doesn't exist)
firebase login
firebase use hexland-test-${USER}
if [ $? -ne 0 ]; then
  firebase projects:create -n "Hexland Test for ${USER}" hexland-test-${USER}
  firebase use hexland-test-${USER}
fi

# Create a Firebase webapp if it doesn't already exist
WEBAPP_INFO=`firebase apps:list 2>/dev/null | fgrep "Hexland Test for ${USER}"`
if [ "$WEBAPP_INFO" == "" ]; then
  firebase apps:create web "Hexland Test for ${USER}"
fi

# Cleanup function to call on exit
# REVISIT: background processes seem to be killed cleanly anyway, but not sure why...
#function cleanup {
#  kill ${FUNCTION_WATCH_PID} || true
#  kill ${WEBAPP_WATCH_PID} || true
#}
#trap cleanup EXIT

if [ "$RUN_TESTS" == "true" ]; then
  cd functions
  IS_LOCAL_DEV="true" yarn serve &

  # Wait for emulator UI to become available (indicating emulators have started)
  until $(curl --output /dev/null --silent --head --fail http://localhost:4000); do
      sleep 1
  done

  cd ..
  # Set TERM=dumb here to stop jest from clearing the console and wiping interesting log messages
  # (Makes jest look ugly and harder to read)
  #TERM=dumb yarn test
  yarn test
else
  # Watch for Firebase Function source changes (removing escape codes from the watcher output to
  # prevent the terminal from being cleared)
  cd functions
  IS_LOCAL_DEV="true" yarn watch | sed 's/[^[:print:]]//g' &
  #FUNCTION_WATCH_PID=$!
  cd ..

  # Run webapp dev server that watches for source changes (removing escape codes from the watcher
  # output to prevent the terminal from being cleared)
  yarn dev:react | sed 's/[^[:print:]]//g' &
  #WEBAPP_WATCH_PID=$!

  # Run emulators
  # This includes hosting in order to provide access to init.json for configuring Firebase
  IS_LOCAL_DEV="true" firebase emulators:start
fi