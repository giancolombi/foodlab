.PHONY: up down logs migrate seed dev

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
