Large-scale backend layout:

- `src/app.js`: assembles the Express application.
- `src/server.js`: boots HTTP and realtime only.
- `src/core/`: shared runtime concerns such as middleware, realtime, utilities.
- `src/infrastructure/`: technical adapters like PostgreSQL.
- `src/modules/`: business domains such as auth, jobs, employer, notifications.

Inside each module:

- `*.routes.js`: declares HTTP endpoints and middleware chain.
- `*.controller.js`: handles request/response orchestration.
- `*.model.js`: owns schema preparation and direct database access helpers.
- `*.service.js`: owns external integrations or reusable workflows across controllers.
- module-owned assets such as JSON knowledge files stay inside that module.

This is closer to the way large product teams organize a modular monolith:
- infrastructure is separated from business modules
- shared runtime code is centralized under `core`
- each domain keeps its own HTTP, data, and local assets together
