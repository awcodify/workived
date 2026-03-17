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
	$(DOCKER_COMPOSE) up -d postgres redis minio

infra-down: ## Stop and remove all infra containers
	$(DOCKER_COMPOSE) down

# ── Migrations ────────────────────────────────────────────────────────────────

migrate-up: ## Apply all pending migrations
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" up

migrate-down: ## Roll back the last migration
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" down 1

migrate-create: ## Create a new migration pair  e.g. make migrate-create name=add_foo
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $(name)

# ── API ───────────────────────────────────────────────────────────────────────

run: ## Run the API server (infra must already be up)
	cd $(SERVICES_DIR) && go run ./cmd/api

dev: infra-up ## Start infra, run migrations, then start the API server
	@echo "Waiting for postgres to be ready..."
	@sleep 3
	@$(MAKE) migrate-up
	@$(MAKE) run

build: ## Build the API binary to bin/api
	@mkdir -p bin
	cd $(SERVICES_DIR) && go build -o ../bin/api ./cmd/api

# ── Tests ─────────────────────────────────────────────────────────────────────

test: ## Run all unit tests
	cd $(SERVICES_DIR) && go test ./... -short

test-cover: ## Run unit tests and open HTML coverage report
	cd $(SERVICES_DIR) && go test ./... -short -coverprofile=coverage.out \
	  && go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: $(SERVICES_DIR)/coverage.html"
