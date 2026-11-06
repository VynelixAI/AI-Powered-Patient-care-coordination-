# VynelixAI Health — Frontend POC

A responsive React and TypeScript demonstration of an Australian healthcare workflow. It supports local synthetic mock data and an authenticated FastAPI/MongoDB backend. It is not a clinical record system, does not provide medical advice, and its assessment and routing features are simulated.

## Screens

- Dashboard and recent visit activity
- Patient registration with validation and synthetic Hospital Patient IDs
- Patient directory, filters, profile tabs, and longitudinal visit timeline
- Visit detail editing and PDF/image document metadata selection
- Simulated AI assessment and historical evidence comparison
- Health observation trends
- Clinician approve/modify/override review flow
- Mock care routing and demo audit history
- Demo settings and local reset

## Structure

```text
frontend/
├── public/
├── src/
│   ├── data/mockData.ts
│   ├── services/mockApi.ts
│   ├── styles/{theme.css,globals.css}
│   ├── types/index.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

Mock-mode workflow changes are stored in the browser's `localStorage`. In mock mode uploaded file contents are not read, transmitted, or retained; only selected file metadata is kept in demo state. The Settings screen can switch to the authenticated FastAPI backend. Set `VITE_DATA_MODE=backend` to start in backend mode or `VITE_DATA_MODE=mock` for mock mode; a saved mode chosen in Settings takes precedence after the first launch. The base URL defaults to `http://localhost:8000/api/v1` and can be changed with `VITE_API_BASE_URL`. Copy `.env.example` to `.env.local` and restart Vite after changing these values. Backend mode requires a valid bearer token entered through Settings; do not put the token in a Vite environment variable. See `../backend/FRONTEND_INTEGRATION.md` for setup. Do not enter real patient information.

## Run locally

From this directory:

```bash
npm install
npm run dev
```

Create a production build with `npm run build`. The backend setup is documented in `../backend/README.md`.
