Large-scale backend layout:

- `src/app.js`: assembles the Express application.
- `src/server.js`: boots HTTP and realtime only.
- `src/core/`: shared runtime concerns such as middleware, realtime, utilities.
- `src/infrastructure/`: technical adapters like PostgreSQL.
- `src/modules/`: business domains such as auth, jobs, employer, notifications.

Inside each module:

- `*.routes.js`: declares HTTP endpoints and middleware chain.
- `*.controller.js`: handles request/response orchestration only.
- `*.service.js`: owns business rules, validation flow, and cross-repository workflows.
- `*.repository.js`: owns SQL queries and persistence operations.
- `*.model.js`: owns schema preparation and module-level data definitions.
- module-owned assets such as JSON knowledge files stay inside that module.

This is closer to the way large product teams organize a modular monolith:
- infrastructure is separated from business modules
- shared runtime code is centralized under `core`
- each domain keeps its own HTTP, data, and local assets together
- large modules should follow `routes -> controller -> service -> repository -> model/schema`
