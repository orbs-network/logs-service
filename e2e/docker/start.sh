#!/bin/sh +x

LOGS_PATH="/opt/orbs/logs/${MOCK_SERVICE_NAME}"
S="s${FILE_MAX_SIZE}"
N="n${FILE_MAX_COUNT}"

mkdir -pv $LOGS_PATH

node writer.js | multilog $S $N $LOGS_PATH
