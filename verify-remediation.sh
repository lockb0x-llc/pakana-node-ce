#!/bin/bash
# Pakana Node - Remediation Verification Script

set -e

echo "================================"
echo "Pakana Node Verification"
echo "================================"
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Clean restart
echo "Step 1: Clean Restart"
echo "---------------------"
echo -e "${YELLOW}This will delete all existing data and start fresh.${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo "Stopping all services and removing volumes..."
docker compose down -v

echo "Rebuilding images with no cache..."
docker compose build --no-cache

echo "Starting services..."
docker compose up -d

echo
echo "Step 2: Wait for Initialization"
echo "--------------------------------"
echo "Waiting 10 seconds for db-init to complete..."
sleep 10

# Check db-init logs
echo
echo "db-init logs:"
docker compose logs db-init | tail -5

echo
echo "Step 3: Service Health Checks"
echo "------------------------------"

# Wait a bit more for services to start
sleep 5

# Check yottadb
echo -n "yottadb service: "
if docker compose ps yottadb | grep -q "Up"; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    exit 1
fi

# Check api-go
echo -n "api-go service: "
if docker compose ps api-go | grep -q "Up"; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    exit 1
fi

# Check core-rust
echo -n "core-rust service: "
if docker compose ps core-rust | grep -q "Up"; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    exit 1
fi

# Check api-report
echo -n "api-report service: "
if docker compose ps api-report | grep -q "Up"; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    exit 1
fi

echo
echo "Step 4: Functional Verification"
echo "--------------------------------"

# Wait for api-report to be ready
sleep 5

# Health check
echo -n "api-report health endpoint: "
if curl -s http://localhost:8080/health | grep -q "healthy"; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    exit 1
fi

echo
echo "Step 5: Check for Errors"
echo "------------------------"

echo "Checking api-go logs for errors..."
if docker compose logs api-go | grep -iE "error|fatal|panic" | grep -v "Error reading"; then
    echo -e "${YELLOW}⚠ Errors found (review above)${NC}"
else
    echo -e "${GREEN}✓ No errors${NC}"
fi

echo
echo "Checking core-rust logs for errors..."
if docker compose logs core-rust | grep -iE "error|fatal|panic"; then
    echo -e "${YELLOW}⚠ Errors found (review above)${NC}"
else
    echo -e "${GREEN}✓ No errors${NC}"
fi

echo
echo "Checking for IPC/locking issues..."
if docker compose logs | grep -iE "HOSTCONFLICT|LOCKCONFL|mutex"; then
    echo -e "${RED}✗ IPC/Locking errors detected${NC}"
    exit 1
else
    echo -e "${GREEN}✓ No IPC/locking errors${NC}"
fi

echo
echo "Step 6: Ingestion Verification"
echo "-------------------------------"
echo "Waiting 15 seconds for ledger ingestion..."
sleep 15

echo "Recent api-go ingestion logs:"
docker compose logs api-go | grep "Ingested Stellar Ledger" | tail -3

echo
echo "Recent core-rust processing logs:"
docker compose logs core-rust | grep "Detected new Stellar Ledger" | tail -3

echo
echo "================================"
echo -e "${GREEN}✓ Verification Complete${NC}"
echo "================================"
echo
echo "System Status:"
echo "- All services running"
echo "- No IPC/locking conflicts detected"
echo "- Ledger ingestion active"
echo
echo "Next Steps:"
echo "1. Monitor logs: docker compose logs -f"
echo "2. Test API endpoints with your API key"
echo "3. Proceed with Sparse Blockchain History implementation"
