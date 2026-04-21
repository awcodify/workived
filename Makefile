SERVICES_DIR  := services
MIGRATIONS_DIR := migrations
DOCKER_COMPOSE := docker compose -f infra/docker-compose.yml

# Default DATABASE_URL matches the docker-compose postgres setup.
# Override by exporting DATABASE_URL before running make.
DATABASE_URL ?= postgres://workived:password@localhost:5432/workived?sslmode=disable

.PHONY: help infra-up infra-down migrate-up migrate-down migrate-create run dev build test test-cover

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Infrastructure ────────────────────────────────────────────────────────────

infra-up: ## Start postgres, redis, and minio (detached)
	$(DOCKER_COMPOSE) up -d postgres redis minio mailcatcher

infra-down: ## Stop and remove all infra containers
	$(DOCKER_COMPOSE) down

setup-storage: ## Create MinIO bucket (run after infra-up)
	@./scripts/setup-minio.sh

# ── Migrations ────────────────────────────────────────────────────────────────

migrate-up: ## Apply all pending migrations
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" up

migrate-down: ## Roll back the last migration
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" down 1

migrate-create: ## Create a new migration pair  e.g. make migrate-create name=add_foo
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $(name)

seed: ## Seed test data (run after migrate-up)
	@echo "Seeding configuration data..."
	@docker exec -i infra-postgres-1 psql -U workived -d workived < scripts/seed_config.sql
	@echo "Seeding public holidays..."
	@docker exec -i infra-postgres-1 psql -U workived -d workived < scripts/seed_holidays.sql
	@echo "Seeding policy templates..."
	@docker exec -i infra-postgres-1 psql -U workived -d workived < scripts/seed_templates.sql
	@echo "Seeding test data..."
	@docker exec -i infra-postgres-1 psql -U workived -d workived < scripts/seed_test_data.sql
	@echo "✓ Database seeded successfully"

seed-reports: ## Seed comprehensive report data (90 days attendance, 6 months leave/claims)
	@echo "📊 Seeding report data for ahmad@workived.com..."
	@docker exec -i infra-postgres-1 psql -U workived -d workived < scripts/seed_report_data.sql
	@echo "✓ Report data seeded successfully"

reset-db: ## Reset database (WARNING: destroys all data and volumes)
	@echo "⚠️  WARNING: This will delete all database data and volumes!"
	@echo "Stopping containers and removing volumes..."
	$(DOCKER_COMPOSE) down -v
	@echo "Starting fresh infrastructure..."
	$(DOCKER_COMPOSE) up -d postgres redis minio mailcatcher
	@echo "Waiting for postgres to be ready..."
	@sleep 5
	@echo "Running migrations..."
	@$(MAKE) migrate-up
	@echo "Seeding data..."
	@$(MAKE) seed
	@echo "✓ Database reset complete"

# ── API ───────────────────────────────────────────────────────────────────────

run: ## Run the API server (infra must already be up)
	cd $(SERVICES_DIR) && go run ./cmd/api

dev: infra-up ## Start infra, run migrations, then start the API server
	@echo "Waiting for postgres to be ready..."
	@sleep 3
	@$(MAKE) setup-storage
	@$(MAKE) migrate-up
	@$(MAKE) run

build: ## Build the API binary to bin/api
	@mkdir -p bin
	cd $(SERVICES_DIR) && go build -o ../bin/api ./cmd/api

build-staff: ## Build the staff admin binary to bin/staff
	@mkdir -p bin
	cd $(SERVICES_DIR) && go build -o ../bin/staff ./cmd/staff

run-staff: ## Run the staff admin server
	cd $(SERVICES_DIR) && go run ./cmd/staff

backfill-task-codes: ## Backfill task codes for all existing tasks (use --dry-run to preview)
	@mkdir -p bin
	cd $(SERVICES_DIR) && go build -o ../bin/backfill-task-codes ./cmd/backfill-task-codes
	@echo "Running backfill script..."
	@./bin/backfill-task-codes $(ARGS)

backfill-task-codes-dry: ## Preview task code backfill without making changes
	@$(MAKE) backfill-task-codes ARGS="--dry-run"

# ── Frontend ─────────────────────────────────────────────────────────────────

web-install: ## Install frontend dependencies
	cd apps/web && npm install --legacy-peer-deps

web-dev: ## Start frontend dev server on :3000
	cd apps/web && npm run dev

web-build: ## Build frontend for production
	cd apps/web && npm run build

# ── Tests ─────────────────────────────────────────────────────────────────────

lint: ## Run golangci-lint (includes gosec)
	cd $(SERVICES_DIR) && golangci-lint run ./...

test: ## Run all unit tests
	cd $(SERVICES_DIR) && go test ./... -short

test-cover: ## Run unit tests and open HTML coverage report
	cd $(SERVICES_DIR) && go test ./... -short -coverprofile=coverage.out \
	  && go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: $(SERVICES_DIR)/coverage.html"

# ── Production Deployment ─────────────────────────────────────────────────────

prod-setup: ## Setup a fresh VPS for production (run as root on VPS)
	@echo "Setting up production VPS..."
	@bash scripts/setup-production-vps.sh

prod-deploy: ## Deploy latest changes to production (run on VPS)
	@echo "Deploying to production..."
	@bash scripts/deploy-production.sh

prod-health: ## Check production system health
	@bash scripts/health-check.sh

prod-logs: ## Show production logs (tail -f)
	docker-compose -f docker-compose.production.yml logs -f

prod-restart: ## Restart all production services
	docker-compose -f docker-compose.production.yml restart

prod-migrate: ## Run database migrations on production
	@if [ -z "$$DATABASE_URL" ]; then \
		echo "Error: DATABASE_URL not set. Export it from .env.production"; \
		exit 1; \
	fi
	migrate -path $(MIGRATIONS_DIR) -database "$$DATABASE_URL" up

# ── MCP Server ────────────────────────────────────────────────────────────────

mcp-build: ## Build MCP server (stdio mode, 100% API-based)
	@echo "Building MCP server..."
	@mkdir -p bin
	cd $(SERVICES_DIR) && go build -o ../bin/mcp ./cmd/mcp
	@echo "✅ MCP server built successfully"

mcp-test: mcp-build ## Test MCP server with sample requests
	@echo "Testing MCP server..."
	@echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | ./bin/mcp
	@echo ""
	@echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | ./bin/mcp
