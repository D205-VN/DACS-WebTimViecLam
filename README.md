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

Local AI with LM Studio:

```env
AI_PROVIDER=lmstudio
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_MODEL=local-model
LMSTUDIO_TIMEOUT_MS=120000
LMSTUDIO_MAX_TOKENS=4096
LMSTUDIO_TEMPERATURE=0.35
CV_OUTPUT_LANGUAGE=en
```

Open LM Studio, load a chat/instruct model, start the Local Server on port `1234`, then use the CV Builder page. Replace `LMSTUDIO_MODEL` with the loaded model identifier if your LM Studio server requires the exact name.

## Notes

- Local environment files stay out of git. Use `backend/.env` for backend secrets.
- Build output, dependency folders, and local inventory dumps are ignored.
