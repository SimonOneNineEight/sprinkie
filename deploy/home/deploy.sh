#!/bin/sh
# Cross-compile the API and purge binaries and ship them to the home box.
# Usage: DEPLOY_HOST=user@homebox deploy/home/deploy.sh
set -eu
: "${DEPLOY_HOST:?set DEPLOY_HOST=user@host}"
cd "$(dirname "$0")/../../api"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o /tmp/dw-api ./cmd/api
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o /tmp/dw-purge ./cmd/purge
scp /tmp/dw-api "$DEPLOY_HOST:/tmp/dw-api"
scp /tmp/dw-purge "$DEPLOY_HOST:/tmp/dw-purge"
ssh "$DEPLOY_HOST" 'sudo install -m 755 /tmp/dw-api /opt/sprinkie/api \
  && sudo install -m 755 /tmp/dw-purge /opt/sprinkie/purge \
  && sudo systemctl restart sprinkie-api \
  && systemctl is-active sprinkie-api'
echo "deployed"
