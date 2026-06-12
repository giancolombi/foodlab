.PHONY: up down logs migrate seed dev lint typecheck test

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foodlab pnpm db:migrate

seed:
	DATABASE_URL=postgresql://postgres:postgres@localhost:5432/foodlab pnpm db:seed

dev:
	pnpm dev

lint:
	pnpm lint

typecheck:
	pnpm typecheck

# Needs Postgres up (`docker compose up -d db`); Playwright boots api + app.
test:
	pnpm test:e2e
