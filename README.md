# DACS WebTimViecLam

Full-stack job search platform with a React/Vite frontend and an Express/PostgreSQL backend.

## Structure

- `frontend/`: React client application.
- `backend/`: Express API, realtime socket server, database modules, and seed scripts.

## Development

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

## Notes

- Local environment files stay out of git. Use `backend/.env` for backend secrets.
- Build output, dependency folders, and local inventory dumps are ignored.
