# PostHog Gemini Context

This document provides context for Gemini to understand the PostHog project.

## Project Overview

PostHog is an open-source product analytics platform. It's a monorepo that contains the entire PostHog platform, including a Django backend and a React frontend.

**Main Technologies:**

*   **Backend:** Django, Celery, ClickHouse, PostgreSQL, Redis
*   **Frontend:** React, TypeScript, pnpm
*   **Data Orchestration:** Dagster
*   **Containerization:** Docker

**Architecture:**

The project is a full-stack application with a monolithic backend and a micro-frontends architecture. The backend is a Django application that uses Celery for asynchronous tasks, ClickHouse for analytics data, and PostgreSQL for application data. The frontend is a React application that is divided into several packages.

## Building and Running

The project uses `pnpm` for package management and `docker-compose` for running the development environment.

**Key Commands:**

*   `pnpm install`: Install all dependencies.
*   `pnpm start`: Start the development environment. This will start all the services defined in `docker-compose.dev.yml`.
*   `pnpm format`: Format the code.
*   `pnpm schema:build`: Build the schema.
*   `pnpm taxonomy:build`: Build the taxonomy.
*   `pnpm grammar:build`: Build the grammar.

**Running Tests:**

The project has both backend and frontend tests.

*   **Backend Tests:** The backend tests are written in Python and can be run with `pytest`.
*   **Frontend Tests:** The frontend tests are written in TypeScript and can be run with `jest`.

## Development Conventions

The project has a set of development conventions that are enforced by linters and formatters.

**Coding Style:**

*   **Backend:** The backend code is formatted with `ruff`.
*   **Frontend:** The frontend code is formatted with `prettier`.

**Testing:**

The project has a strong testing culture. All new features should be accompanied by tests.

**Contribution Guidelines:**

The project has a set of contribution guidelines that are documented in `CONTRIBUTING.md`.
