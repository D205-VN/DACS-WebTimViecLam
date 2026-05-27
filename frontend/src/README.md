Frontend layout:

- `src/pages/`: route-level screens.
- `src/components/`: reusable UI grouped by domain (`auth`, `employer`, `home`, `layouts`, `providers`, `seeker-tools`, `ui`).
- `src/services/`: non-visual code grouped by domain:
  - `auth/`: auth API, storage, and Google credential flow.
  - `http/`: base API URL and request cache helpers.
  - `navigation/`: role redirects and dashboard route maps.
  - `ai-tests/`, `employer/`, `jobs/`, `talent-insights/`: feature-specific service helpers.
  - `geo/`, `content/`, `data/`, `router/`: shared data and app routing helpers.
- `src/App.jsx`: app composition root.
- `src/main.jsx`: React entry point.
- `src/index.css`: global styles.

The backend owns MVC concerns such as controllers, models, repositories, routes, and services. Frontend services call backend APIs and keep page/component code focused on rendering and UI flow.

Import aliases are configured in `vite.config.js` and `jsconfig.json`:

- `@pages/*`
- `@components/*`
- `@services/*`
