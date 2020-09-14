#!/bin/sh +x

multilog_err=1
multilog_cmd="multilog s16777215 n2 '!tai64nlocal' /opt/orbs/logs"

while [[ "${multilog_err}" -ne "0" ]]; do
    sleep 1
    echo "logs-service starting up.." | $multilog_cmd
    multilog_err=$?
done

echo "Running logs-service..."

npm start -- $@ 2>&1 | $multilog_cmd 2>&1
