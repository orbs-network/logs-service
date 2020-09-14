#!/bin/bash

docker login -u $DOCKER_HUB_LOGIN -p $DOCKER_HUB_PASSWORD

export VERSION=$(cat .version)

docker push orbsnetworkstaging/logs-service:$VERSION

if [[ $CIRCLE_BRANCH == "master" ]] ;
then
  docker tag orbsnetworkstaging/logs-service:$VERSION orbsnetworkstaging/logs-service:experimental
  docker push orbsnetworkstaging/logs-service:experimental
fi
