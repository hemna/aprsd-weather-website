.PHONY: help install install-dev lint lint-fix format test test-cov clean docker-build docker-up docker-down

# Default target
help:
	@echo "APRSD Weather Website - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install      - Install production dependencies"
	@echo "  make install-dev  - Install development dependencies (includes linting/testing)"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint         - Run ruff linter (check only)"
	@echo "  make lint-fix     - Run ruff linter and auto-fix issues"
	@echo "  make format       - Format code with ruff"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run pytest"
	@echo "  make test-cov     - Run pytest with coverage report"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up    - Start containers with docker-compose"
	@echo "  make docker-down  - Stop containers"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Remove build artifacts and cache files"

# ============================================
# Setup
# ============================================
install:
	pip install -r requirements.txt

install-dev:
	pip install -e ".[dev]"

# ============================================
# Code Quality
# ============================================
lint:
	ruff check app/ tests/

lint-fix:
	ruff check --fix app/ tests/

format:
	ruff format app/ tests/

# ============================================
# Testing
# ============================================
test:
	pytest

test-cov:
	pytest --cov=app --cov-report=term-missing --cov-report=html

# ============================================
# Docker
# ============================================
docker-build:
	docker build -t aprsd-weather-website .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

# ============================================
# Cleanup
# ============================================
clean:
	rm -rf __pycache__ .pytest_cache .ruff_cache .coverage htmlcov
	rm -rf app/__pycache__ tests/__pycache__
	rm -rf *.egg-info build dist
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
