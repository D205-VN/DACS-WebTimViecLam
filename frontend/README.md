# Frontend

React/Vite application for the job search platform.

## Source Layout

- `src/app/`: app bootstrap, providers, layouts, and router setup.
- `src/features/`: stateful product capabilities such as auth, messages, notifications, and seeker tools.
- `src/pages/`: route-level screens.
- `src/pages/auth/`: login, register, forgot password, and change password screens.
- `src/pages/admin/`: admin-only route screens.
- `src/pages/employer/`: employer-only route screens.
- `src/pages/seeker/`: seeker-only route screens.
- `src/shared/`: cross-cutting API config, utility functions, geo data, content, and shared UI.
- `src/widgets/`: composed UI sections reused by pages.
- `public/`: static files served as-is.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Import Aliases

Aliases are configured in `vite.config.js` and `jsconfig.json`:

- `@app/*`
- `@features/*`
- `@pages/*`
- `@shared/*`
- `@widgets/*`

Prefer aliases over long relative imports for app code.
