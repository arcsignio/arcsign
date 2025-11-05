# ChainAdapter Makefile
#
# Common targets for building, testing, and linting the ChainAdapter library

.PHONY: help test build coverage lint clean install

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

test: ## Run all tests
	@echo "Running tests..."
	@go test -v -race ./...

test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	@go test -v -race ./... -run 'Unit'

test-integration: ## Run integration tests only (requires Docker)
	@echo "Running integration tests..."
	@go test -v -race ./... -run 'Integration'

test-contract: ## Run contract tests only
	@echo "Running contract tests..."
	@go test -v -race -count=1 -timeout=30s ./tests/contract/...

coverage: ## Generate test coverage report
	@echo "Generating coverage report..."
	@go test -v -race -coverprofile=coverage.out -covermode=atomic ./...
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"
	@go tool cover -func=coverage.out | grep total | awk '{print "Total coverage: " $$3}'

build: ## Build the chainadapter library
	@echo "Building chainadapter..."
	@go build -v ./...

lint: ## Run linters (go vet + golangci-lint if available)
	@echo "Running go vet..."
	@go vet ./...
	@if command -v golangci-lint > /dev/null; then \
		echo "Running golangci-lint..."; \
		golangci-lint run ./...; \
	else \
		echo "golangci-lint not installed, skipping (install: https://golangci-lint.run/usage/install/)"; \
	fi

fmt: ## Format code with gofmt
	@echo "Formatting code..."
	@gofmt -w -s .

tidy: ## Tidy go.mod and go.sum
	@echo "Tidying module dependencies..."
	@go mod tidy

install: ## Install dependencies
	@echo "Installing dependencies..."
	@go mod download

clean: ## Clean build artifacts and test cache
	@echo "Cleaning..."
	@go clean -testcache
	@rm -f coverage.out coverage.html
	@find . -name '*.test' -delete
	@echo "Clean complete"

deps: ## Show dependency tree
	@go list -m all

update-deps: ## Update all dependencies to latest minor/patch versions
	@echo "Updating dependencies..."
	@go get -u ./...
	@go mod tidy

# Development helpers
watch-test: ## Watch for changes and run tests (requires entr)
	@if command -v entr > /dev/null; then \
		find . -name '*.go' | entr -c make test; \
	else \
		echo "entr not installed. Install with: brew install entr (macOS) or apt install entr (Linux)"; \
	fi

.DEFAULT_GOAL := help
