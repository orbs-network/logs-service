#!/bin/sh +x

LOGS_PATH="/opt/orbs/logs/${MOCK_SERVICE_NAME}"

mkdir -pv $LOGS_PATH

node writer.js | multilog s4096 $LOGS_PATH
