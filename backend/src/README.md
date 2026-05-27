Backend MVC layout:

- `src/controllers/<module>/`: Express request handlers grouped by feature.
- `src/models/<module>/`: database schemas, persistence models, and domain data.
- `src/services/<module>/`: business logic grouped by feature.
- `src/repositories/<module>/`: SQL query modules used by services.
- `src/routes/<module>/`: Express route definitions grouped by feature.
- `src/core/`: shared middleware, config, errors, realtime, and utility code.
- `src/infrastructure/`: database and external infrastructure adapters.

Example: auth code lives across `controllers/auth`, `models/auth`, `services/auth`, `repositories/auth`, and `routes/auth`. This keeps the backend MVC pattern, while keeping each layer easy to scan and update.
