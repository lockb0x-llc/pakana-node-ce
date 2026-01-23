#!/bin/bash

# Pakana Private Ledger - Manual Deployment Script (Appliance Model)
# This script ensures a clean, idempotent deployment of the Pakana Node.
# It handles YottaDB safe shutdowns, image pruning, and service restoration.

set -e

# Configuration
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

echo "--- Starting Pakana Node Deployment [${TIMESTAMP}] ---"
echo "Target Directory: $APP_DIR"

cd "$APP_DIR"

# 1. Graceful Shutdown & YottaDB Maintenance
# Critical: YottaDB requires a 'rundown' to clear shared memory segments
# if the previous shutdown was not clean.
echo "Performing YottaDB maintenance..."
if docker ps | grep -q "pakana-yottadb"; then
    echo "Clearing YottaDB shared memory (rundown)..."
    docker exec pakana-yottadb sh -c "export ydb_gbldir=/data/r2.03_x86_64/g/yottadb.gld && /opt/yottadb/current/mupip rundown -region DEFAULT" || true
fi

echo "Stopping existing services..."
docker compose down

# 2. Image Cleanup
# Removes unused images to prevent OS disk exhaustion (critical for 64GB volumes)
echo "Cleaning up dangling images to reclaim space..."
docker image prune -f

# 3. Fresh Build & Initialization
# --build ensures any local code changes (Go/Rust/React) are incorporated.
echo "Rebuilding and starting services..."
docker compose up --build -d

# 4. Health Check
echo "Verifying appliance health..."
MAX_RETRIES=60
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8080/health | grep -q "healthy"; then
        HEALTHY=true
        break
    fi
    echo "Waiting for pakana-api-report to be healthy... ($((RETRY_COUNT+1))/$MAX_RETRIES)"
    sleep 5
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$HEALTHY" = true ]; then
    echo "--- Deployment Successful ---"
    docker ps
    echo ""
    echo "Access your node:"
    echo "Dashboard: http://<node-ip>:8080"
    echo "API Docs: http://<node-ip>:8080/docs"
else
    echo "--- Deployment FAILED: Health check timed out ---"
    echo "Checking logs..."
    docker compose logs --tail 20 api-report
    exit 1
fi
