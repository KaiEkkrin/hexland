#!/bin/bash
# Watch for changes to Firebase Function and webapp sources, rebuilding if
# necessary. Also emulate hosting, Firestore and Firebase Function services.
#
# Use a Firebase project named after the current user, request user
# authorisation and creating the project if necessary.

# Cleanup function to call on exit to stop background processes
pids=()
function cleanup {
  echo "Cleaning up processes"
  for pid in ${pids[@]}; do
    kill ${pid} || true
  done
}
trap cleanup EXIT

# Verify home directory links
mkdir -p ${HOME}/.cache
ln -sf /home/pwuser/.cache/ms-playwright ${HOME}/.cache/ms-playwright

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

# Interactive shell for debugging
if [ "$RUN_TESTS" == "shell" ]; then
  bash

# Unit tests
elif [ "$RUN_TESTS" == "test:unit" ]; then
  cd functions
  yarn
  IS_LOCAL_DEV="true" yarn serve &
  pids+=( "$!" )

  # Wait for emulator UI to become available (indicating emulators have started)
  until $(curl --output /dev/null --silent --head --fail http://localhost:4000); do
      sleep 1
  done

  cd ..
  # Set TERM=dumb here to stop jest from clearing the console and wiping interesting log messages
  # (Makes jest look ugly and harder to read)
  #TERM=dumb yarn test
  yarn test:unit

# Auto-rebuilding development environment with emulators
else
  # Watch for Firebase Function source changes
  cd functions
  yarn
  IS_LOCAL_DEV="true" yarn watch --preserveWatchOutput &
  pids+=( "$!" )
  cd ..

  # Run webapp dev server that watches for source changes (piping to cat to prevent terminal clear
  # escape codes being generated by the watcher).
  # Use coproc instead of & as it makes composing the command line easier.
  yarn
  { coproc { FORCE_COLOR=true yarn dev:react | cat -; } 2>&3 >&3; } 3>&1
  pids+=( "${COPROC_PID}" )

  # Run emulators
  # This includes hosting in order to provide access to init.json for configuring Firebase.
  # Start in background and wait to prevent emulators from blocking SIGTERM to this script.
  IS_LOCAL_DEV="true" firebase emulators:start &
  emul_pid="$!"
  pids+=("${emul_pid}")

  # End-to-end tests
  if [ "$RUN_TESTS" == "test:e2e" ]; then
    # Wait for emulator UI to become available (indicating emulators have started)
    until $(curl --output /dev/null --silent --head --fail http://localhost:4000); do
        sleep 1
    done

    # Wait for static pages to become available
    until $(curl --output /dev/null --silent --head --fail http://localhost:5000); do
        sleep 1
    done

    yarn test:e2e
  
  # For general development usage, keep running until ctrl+c is pressed
  else
    wait $emul_pid
  fi
fi
