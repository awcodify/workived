#!/bin/bash
set -euo pipefail

# Workived Production Deployment Script
# Run this on the VPS to deploy new versions

echo "==================================================================="
echo "  Workived Production Deployment"
echo "==================================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
APP_DIR="${APP_DIR:-/home/workived/app}"
COMPOSE_FILE="docker-compose.production.yml"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo -e "${GREEN}Step 1/7: Checking for updates${NC}"
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$BRANCH)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${YELLOW}Already up to date. No deployment needed.${NC}"
    exit 0
fi

echo -e "${GREEN}Step 2/7: Pulling latest changes from $BRANCH${NC}"
git pull origin $BRANCH

echo -e "${GREEN}Step 3/7: Checking for migration changes${NC}"
if git diff $LOCAL $REMOTE --name-only | grep -q "^migrations/"; then
    echo -e "${YELLOW}New migrations detected. Running migrations...${NC}"
    
    # Load DATABASE_URL from .env.production
    export $(grep -v '^#' .env.production | xargs)
    
    if [ -z "${DATABASE_URL:-}" ]; then
        echo -e "${RED}Error: DATABASE_URL not found in .env.production${NC}"
        exit 1
    fi
    
    # Run migrations
    migrate -path migrations -database "$DATABASE_URL" up
    echo -e "${GREEN}Migrations completed successfully${NC}"
else
    echo "No new migrations"
fi

echo -e "${GREEN}Step 4/7: Building new Docker images${NC}"
export VERSION=$(git rev-parse --short HEAD)
docker-compose -f $COMPOSE_FILE build

echo -e "${GREEN}Step 5/7: Stopping old containers (graceful shutdown)${NC}"
docker-compose -f $COMPOSE_FILE stop api web

echo -e "${GREEN}Step 6/7: Starting new containers${NC}"
docker-compose -f $COMPOSE_FILE up -d

echo -e "${GREEN}Step 7/7: Cleaning up old images${NC}"
docker system prune -af --filter "until=24h"

echo ""
echo -e "${GREEN}==================================================================="
echo "  ✅ Deployment Complete!"
echo "===================================================================${NC}"
echo ""
echo "Deployed commit: $REMOTE"
echo ""
echo "Next steps:"
echo "1. Check logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "2. Verify health: curl http://localhost:8080/health"
echo "3. Monitor for errors in the first 5 minutes"
echo ""
