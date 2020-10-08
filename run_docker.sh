#!/bin/sh
# Runs a local development environment of hexland-web.
# To run tests instead, pass "test" as the first command-line argument.

echo "USER_ID=`id -u ${USER}`" > .env
echo "GROUP_ID=`id -u ${USER}`" >> .env

if [ "${1}" = "test" ]; then
  echo "RUN_TESTS=true" >> .env

  # `docker-compose up` won't let us interact with the `hexland` container even
  # though it has stdin enabled, we need to specifically attach to that one
  docker-compose up --build -d
  docker attach hexland_hexland_1

  # This will bring the containers down again after the user quits the interactive
  # session
  docker-compose down
else
  echo "RUN_TESTS=" >> .env
  docker-compose up --build
fi
