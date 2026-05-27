# Frontend

React/Vite application for the job search platform.

## Source Layout

- `src/pages/`: route-level screens.
- `src/components/`: reusable UI grouped by domain (`auth`, `employer`, `home`, `layouts`, `providers`, `seeker-tools`, `ui`).
- `src/services/`: non-visual code grouped by domain:
  - `auth/`: auth API, storage, and Google credential flow.
  - `http/`: base API URL and request cache helpers.
  - `navigation/`: role redirects and dashboard route maps.
  - `ai-tests/`, `employer/`, `jobs/`, `talent-insights/`: feature-specific service helpers.
  - `geo/`, `content/`, `data/`, `router/`: shared data and app routing helpers.
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

- `@pages/*`
- `@components/*`
- `@services/*`

Prefer aliases over long relative imports for app code.
