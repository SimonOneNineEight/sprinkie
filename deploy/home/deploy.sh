#!/bin/sh
# Cross-compile the API and purge binaries and ship them to the home box.
# Usage: DEPLOY_HOST=user@homebox deploy/home/deploy.sh
set -eu
: "${DEPLOY_HOST:?set DEPLOY_HOST=user@host}"
cd "$(dirname "$0")/../../api"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o /tmp/sprinkie-api ./cmd/api
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o /tmp/sprinkie-purge ./cmd/purge
scp /tmp/sprinkie-api "$DEPLOY_HOST:/tmp/sprinkie-api"
scp /tmp/sprinkie-purge "$DEPLOY_HOST:/tmp/sprinkie-purge"
ssh "$DEPLOY_HOST" 'sudo install -m 755 /tmp/sprinkie-api /opt/sprinkie/api \
  && sudo install -m 755 /tmp/sprinkie-purge /opt/sprinkie/purge \
  && sudo systemctl restart sprinkie-api \
  && systemctl is-active sprinkie-api'
echo "deployed"
