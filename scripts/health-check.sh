#!/bin/bash

# Workived Production Health Check Script
# Run this periodically via cron to monitor system health

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "==================================================================="
echo "  Workived Production Health Check - $(date)"
echo "==================================================================="
echo ""

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
API_URL="${API_URL:-http://localhost:8080}"
WEB_URL="${WEB_URL:-http://localhost:80}"

# Check if containers are running
echo -e "${GREEN}Container Status:${NC}"
docker-compose -f $COMPOSE_FILE ps

echo ""
echo -e "${GREEN}API Health Check:${NC}"
if curl -sf "${API_URL}/health" > /dev/null; then
    echo -e "${GREEN}✅ API is healthy${NC}"
    curl -s "${API_URL}/health" | jq '.' 2>/dev/null || echo "Response OK"
else
    echo -e "${RED}❌ API health check failed${NC}"
fi

echo ""
echo -e "${GREEN}Web Health Check:${NC}"
if curl -sf "${WEB_URL}" > /dev/null; then
    echo -e "${GREEN}✅ Web is responding${NC}"
else
    echo -e "${RED}❌ Web health check failed${NC}"
fi

echo ""
echo -e "${GREEN}Redis Connection:${NC}"
if docker exec $(docker ps -qf "name=redis") redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is responding${NC}"
    REDIS_MEM=$(docker exec $(docker ps -qf "name=redis") redis-cli INFO memory | grep used_memory_human | cut -d: -f2)
    echo "Memory used: ${REDIS_MEM}"
else
    echo -e "${RED}❌ Redis connection failed${NC}"
fi

echo ""
echo -e "${GREEN}Disk Usage:${NC}"
df -h / | tail -1 | awk '{
    percent=$5+0
    if (percent >= 90) {
        print "\033[0;31m❌ Critical: " $5 " used (" $3 " / " $2 ")\033[0m"
    } else if (percent >= 75) {
        print "\033[1;33m⚠️  Warning: " $5 " used (" $3 " / " $2 ")\033[0m"
    } else {
        print "\033[0;32m✅ OK: " $5 " used (" $3 " / " $2 ")\033[0m"
    }
}'

echo ""
echo -e "${GREEN}Memory Usage:${NC}"
free -h | awk 'NR==2{
    percent=$3/$2*100
    if (percent >= 90) {
        print "\033[0;31m❌ Critical: " int(percent) "% used (" $3 " / " $2 ")\033[0m"
    } else if (percent >= 75) {
        print "\033[1;33m⚠️  Warning: " int(percent) "% used (" $3 " / " $2 ")\033[0m"
    } else {
        print "\033[0;32m✅ OK: " int(percent) "% used (" $3 " / " $2 ")\033[0m"
    }
}'

echo ""
echo -e "${GREEN}Docker Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

echo ""
echo -e "${GREEN}Recent Errors (last 100 lines):${NC}"
ERROR_COUNT=$(docker-compose -f $COMPOSE_FILE logs --tail=100 | grep -i "error\|fatal\|panic" | wc -l)
if [ $ERROR_COUNT -gt 0 ]; then
    echo -e "${RED}Found $ERROR_COUNT error(s) in logs${NC}"
    docker-compose -f $COMPOSE_FILE logs --tail=100 | grep -i "error\|fatal\|panic" | tail -5
else
    echo -e "${GREEN}No errors found${NC}"
fi

echo ""
echo "==================================================================="
