#!/bin/bash

npm run build
docker build -t orbsnetworkstaging/logs-service:$(cat .version) ./boyar
