#!/bin/sh
# Run a script in a Docker-based local development environment. By default the "dev" script is run
# that emulates the project's services (including hosting) and rebuilds source files as necessary.
# To run a different script from the hexland-web/docker directory, specify the script name as the
# first command line argument (without the path and minus the .sh)

# Ensure we're in the directory of this script (the repo base directory)
cd "$(dirname "$0")"

# Build the Docker image, supplying user and group info about the current user so that info
# can be built into the image
cd hexland-web/docker
docker build --build-arg USER=${USER} --build-arg UID=`id -u ${USER}` --build-arg GID=`id -g ${USER}` \
  -t hexland_test .
cd ../..

# Run a Docker container with the previously built image, executing the target script in the
# container
target_script=${1:-dev}
if [ "${target_script}" = "dev" ]; then
  env_opts='-e GOOGLE_APPLICATION_CREDENTIALS=/usr/src/app/hexland-web/firebase-admin-credentials.json'
else
  env_opts=''
fi
docker run -it --rm -v "${PWD}:/usr/src/app" -v "${PWD}/.usercache:/home/${USER}" ${env_opts} \
  -p 0.0.0.0:4000:4000 -p 0.0.0.0:5000:5000 -p 0.0.0.0:5001:5001 \
  -p 0.0.0.0:8080:8080 -p 0.0.0.0:9005:9005 hexland_test \
  /usr/src/scripts/${target_script}.sh
