# Frontend and backend integration

The React UI supports both its original synthetic browser mock mode and backend mode through `frontend/src/services/backendApi.ts`. Mock mode is the default when `VITE_DATA_MODE` is not configured; `VITE_DATA_MODE=backend` selects the authenticated API on first launch. A mode previously selected in Settings is saved in local storage and takes precedence over the environment default. Backend mode reads and writes MongoDB records through the authenticated FastAPI API. API failures are shown in the UI; they do not silently fall back to local mock data.

## Run locally

Start MongoDB first. In one PowerShell terminal, from the backend directory with its virtual environment active and `.env` configured:

```powershell
cd C:\Users\srava\OneDrive\Desktop\healthcarerepository\backend
python -m uvicorn app.main:app --reload
```

The Python module form avoids directly launching `uvicorn.exe`. In another terminal:

```powershell
cd C:\Users\srava\OneDrive\Desktop\healthcarerepository\frontend
npm run dev
```

The API base URL defaults to `http://localhost:8000/api/v1`. Optionally create `frontend/.env.local` with:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_DATA_MODE=backend
```

Configure the backend's `ALLOWED_ORIGINS` to include the Vite origin (`http://localhost:5173` or `http://localhost:5174`). Restart the backend after changing `.env` and restart Vite after changing its environment file.

## Connect the UI

The backend has no demo login route. For local development only, mint a short-lived token with the backend's configured JWT secret. From the backend directory and its active environment:

```powershell
python -c "from app.core.config import get_settings; from app.core.security import create_access_token; print(create_access_token('local-admin','administrator',get_settings(),3600))"
```

Use an `administrator` token for the local demo workflow, or a narrower role if testing permissions. In the UI, navigate to **Settings**, paste the printed token into **Backend bearer token**, then select **Check backend and connect**. The UI checks authenticated database readiness and loads backend records. On app startup in backend mode, an unauthenticated `GET /health` confirms the API process is reachable; record requests wait until a bearer token is present. The token is held in the current tab's `sessionStorage`, not in frontend source, Vite environment variables, or local storage. Select **Switch to mock mode** to return to the browser demo.

Never copy `AUTH_JWT_SECRET` into the frontend or share the generated access token. In production, an approved identity provider must issue tokens; the local signing command is not production authentication.

## Screen-to-endpoint mapping

Paths below are prefixed with `/api/v1`.

| UI screen or action | API operations |
| --- | --- |
| Dashboard and activity | `GET /patients`, `GET /patients/{id}/visits`, `GET /audit` |
| Patient search and profile | `GET /patients/search?q=...`, `GET /patients/{id}`, `GET /patients/{id}/history` |
| Patient medical documents tab | Authenticated `GET /patients/{id}/documents`; authenticated downloads use `GET /documents/{id}/download` |
| Register patient | `POST /patients` (also opens the initial visit), then one `POST /visits/{id}/documents` per selected report |
| Start a returning patient's visit | `POST /patients/{id}/visits` |
| Visit management and details | `GET /visits?q=...&status=...`, `GET /visits/{id}`, `GET /visits/{id}/timeline`, `PATCH /visits/{id}` |
| Doctor consultation | `PUT /visits/{id}/consultation` with `examination_findings` and `consultation_notes`; clinicians and administrators only |
| Medical documents | `POST /visits/{id}/documents`, `GET /visits/{id}/documents`, authenticated `GET /documents/{id}/download` |
| Record observations / trends | `POST /visits/{id}/observations`, `GET /visits/{id}/observations`; timeline observations feed UI trends. API also provides `GET /patients/{id}/health-trends` |
| Simulated assessment | `POST /visits/{id}/assessments`, `GET /assessments/{id}`, `GET /visits/{id}/assessments` |
| Doctor review | `GET /doctor-reviews/pending`, `POST /assessments/{id}/review`, `GET /assessments/{id}/review` |
| Care routing | `POST /visits/{id}/routing`, `GET /visits/{id}/routing` |
| Audit history | `GET /audit`; patient profile history uses `GET /patients/{id}/audit` |

The UI loads paginated patients and their visits, then reads each visit's timeline and assessments to build its existing view model. Patient and visit search use the backend search/list endpoints. Doctor Review loads the authenticated pending-assessment queue, Care Routing only offers clinician-reviewed visits, and the audit page loads the workspace audit endpoint.

## Field mappings

The adapter maps API DTOs into the existing types in `frontend/src/types/index.ts`:

| Frontend field | Backend field or conversion |
| --- | --- |
| `Patient.id` | Public Hospital Patient ID (`id` / `hospital_patient_id`) |
| `Patient.history` | `medical_history` |
| `Visit.id`, `patientId`, `date` | `id`, `patient_id`, `created_at` |
| `Visit.complaint`, `symptoms`, `onset`, `notes` | `presenting_complaint`, `presenting_symptoms`, `symptom_onset` + `symptom_duration`, `clinician_notes` |
| `Visit.status` | `IN_PROGRESS`, `AWAITING_REVIEW`, `ROUTED`, `COMPLETED` mapped to UI display labels |
| Priority | `final_priority` enum mapped to `Urgent`, `High`, `Standard`, `Low` |
| Document name/category/size | `original_filename`, `category`, `file_size` |
| Observation label/value/date | `measurement_type`, `value`, `recorded_at` |
| Assessment summary/context/pathway | `current_problem_summary`, `relevant_historical_context`, `suggested_care_pathway` |
| Review decision | `APPROVE`, `MODIFY`, `OVERRIDE` mapped to `Approved`, `Modified`, `Overridden` |
| Audit date/actor/description | `timestamp`, `actor_id`, `safe_summary` |

The UI sends ISO date-only DOBs and displays dates using Australian locale formatting. Patient registration accepts PDF, JPEG, and PNG reports up to 10 MiB per file, creates the patient before uploading, and retains the patient ID so failed report uploads can be retried without creating a duplicate patient. The patient profile provides authenticated report downloads. Other visit uploads also accept WebP. The backend reports extraction as `NOT_PROCESSED`; uploaded content is not analysed.

## Authentication and errors

All patient data API requests include an authenticated bearer token. Roles are `triage_staff`, `clinician`, and `administrator`. Patient create/update requires triage staff or administrator; assessment generation and doctor review require clinician or administrator. Triage staff may record observations as unverified; only clinicians or administrators may mark them verified. The backend derives clinician identity from the token, not a form field.

The adapter surfaces server errors in a visible UI banner. Typical statuses are 401 (missing/invalid token), 403 (role not permitted), 404 (record missing), 409 (workflow conflict), and 422 (invalid data). The frontend never treats a failed backend request as success or changes to mock mode automatically.

In Vite development mode, the browser console logs each API method, path, and HTTP status as `[Vynelix API] ...`. It omits request/response bodies and credentials. Browser DevTools Network remains the source of truth for request payloads and response bodies; never copy bearer tokens or real patient data into logs or bug reports.

## Prototype limitations

Assessment is explicitly simulated and must not be treated as diagnosis or validated triage. Routing creates a simulated destination only; it does not connect to a hospital. Document extraction and real identity-provider sign-in are not implemented. Use synthetic data only.
