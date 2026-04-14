#!/bin/bash
# Seed comprehensive report data for ahmad@workived.com organization
# This script populates 3-6 months of historical data for reports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Seeding Report Data for Workived"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if postgres container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^workived-postgres$"; then
    echo "❌ PostgreSQL container 'workived-postgres' not found."
    echo "Please ensure Docker Compose is running: docker compose up -d"
    exit 1
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^workived-postgres$"; then
    echo "⚠️  PostgreSQL container exists but is not running."
    echo "Starting it now..."
    docker start workived-postgres
    echo "Waiting for PostgreSQL to be ready..."
    sleep 3
fi

echo "✓ Docker and PostgreSQL are running"
echo ""

# Check if seed_test_data has been run
echo "Checking if test organization exists..."
ORG_EXISTS=$(docker exec workived-postgres psql -U workived -d workived -t -c \
    "SELECT EXISTS(SELECT 1 FROM organisations WHERE slug = 'rizki-tech');" | xargs)

if [ "$ORG_EXISTS" = "f" ]; then
    echo "❌ Test organization not found!"
    echo ""
    echo "Please run the base seed script first:"
    echo "  make seed"
    echo ""
    echo "Or manually:"
    echo "  docker exec -i workived-postgres psql -U workived -d workived < scripts/seed_test_data.sql"
    exit 1
fi

echo "✓ Test organization exists"
echo ""

# Run the report seed script
echo "Seeding report data (this may take 30-60 seconds)..."
echo ""

docker exec -i workived-postgres psql -U workived -d workived < "${SCRIPT_DIR}/seed_report_data.sql"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Report data seeded successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 What was created:"
echo "   • ~470 attendance records (100% April coverage)"
echo "   • 25+ leave requests (6 months)"
echo "   • 50+ claims (3 months, all categories)"
echo "   • 46 tasks (26 completed, distributed across all 6 employees)"
echo ""
echo "🔑 Login credentials:"
echo "   Email: ahmad@workived.com"
echo "   Password: 12345678"
echo ""
echo "📈 Your reports should now show comprehensive data!"
echo ""
