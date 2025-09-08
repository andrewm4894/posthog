# Repository Guidelines

## Project Structure & Module Organization
- `posthog/`: Django backend (APIs, ClickHouse, Celery, tasks, settings).
- `frontend/`: React/TypeScript app and product bundles.
- `ee/`: Enterprise modules; browse for context but avoid changes unless requested.
- `common/`: Shared code (e.g., HogQL parser, utilities).
- `bin/`: Local dev/test helpers (e.g., `bin/start`, `bin/tests`).
- `dags/`, `docker-compose.*.yml`: Data/infra and local orchestration.
- Tests: Python in `posthog/**/test_*.py`; frontend Jest tests under `frontend/`, `products/`, and `common/`.

## Build, Test, and Development Commands
- Start dev environment: `pnpm start` (uses `bin/start` + mprocs). Variants: `bin/start --minimal` or `--vite`.
- Backend migrations: `pnpm dev:migrate:postgres` and `pnpm dev:migrate:clickhouse`.
- Frontend build: `pnpm --filter=@posthog/frontend build`.
- Backend tests: `bin/tests` (interactive), `bin/tests --changed`, or `pytest posthog/api/test/test_user.py`.
- Frontend tests: `pnpm --filter=@posthog/frontend test`.
- Format code: `pnpm format` (Python + frontend).

## Coding Style & Naming Conventions
- Python 3.11. Lint/format with Ruff; type-check with MyPy. Max line length 120; isort groups configured in Ruff.
- TypeScript/JS: `oxlint` + `prettier`; CSS via `stylelint`. Run `pnpm --filter=@posthog/frontend lint`.
- Naming: Python modules and functions `snake_case`; classes `CamelCase`; TypeScript files `*.ts(x)` and components `PascalCase`.

## Testing Guidelines
- Python: `pytest` with `pytest-django` and `xdist`. Name files `test_*.py`; mark DB tests with `@pytest.mark.django_db`.
- Frontend: Jest tests co-located in `frontend/`/`products/`. Prefer small, deterministic tests.
- Aim to cover new/changed logic. Add snapshots only when structure is stable.

## Commit & Pull Request Guidelines
- Commits: clear, imperative messages (e.g., "fix(api): handle null cohorts"). Keep changes focused.
- Before pushing: run `pnpm format`, backend and frontend tests.
- Pull requests: include a concise description, linked issue, and screenshots/GIFs for UI changes. Note migrations and rollout steps. Update docs or changelog when relevant.

## Security & Configuration Tips
- Do not commit secrets. Use `.env` locally; Docker compose files wire services for dev.
- Python deps managed via `pyproject.toml`/`uv.lock`; Node via `pnpm` (Node 22). Keep versions consistent with repo constraints.

