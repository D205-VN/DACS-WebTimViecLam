Frontend layout:

- `src/app/`: app bootstrap, providers, layouts, router guards.
- `src/features/`: stateful user-facing capabilities such as auth, notifications, seeker tools.
- `src/shared/`: cross-cutting resources such as API config, routing helpers, content, geo data.
- `src/widgets/`: reusable UI blocks composed into pages.
- `src/pages/`: route-level screens.
- `src/pages/auth/`: authentication and password screens.
- `src/pages/admin/`, `src/pages/employer/`, `src/pages/seeker/`: role-specific route screens.

Import aliases are configured in `vite.config.js` and `jsconfig.json`:

- `@app/*`
- `@features/*`
- `@pages/*`
- `@shared/*`
- `@widgets/*`

This keeps page code focused on composition instead of long relative paths.
