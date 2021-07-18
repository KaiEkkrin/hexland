# Dockerfile for creating a build and test environment for hexland
FROM mcr.microsoft.com/playwright:v1.10.0-focal

ARG USER
ARG UID
ARG GID
ENV USER=${USER}

# Install all required tools
RUN apt-get update && \
    apt-get install -yqq default-jre imagemagick less && \
    apt-get clean && apt-get autoclean && rm -fr /var/lib/apt/lists/* && \
    yarn global add firebase-admin firebase-tools npm-run-all playwright

COPY ./*.sh /usr/src/scripts/

# Delete default node user and create user defined by args
RUN userdel -f pwuser && \
    groupadd --gid ${GID} ${USER} && \
    useradd --uid ${UID} --gid ${USER} --shell /bin/bash --create-home ${USER} && \
    chown ${USER}:${USER} -R /usr/src/scripts && \
    chmod 770 /usr/src/scripts/*.sh
USER ${UID}:${GID}

ENV RUN_TESTS=${RUN_TESTS}
WORKDIR /usr/src/app/hexland-web
ENTRYPOINT ["/bin/bash", "-c"]
CMD ["/usr/src/scripts/dev.sh"]
