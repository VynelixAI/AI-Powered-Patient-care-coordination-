# VynelixAI Health API

Authenticated FastAPI prototype for the existing VynelixAI Health React frontend. It stores synthetic/demo workflow data in MongoDB and local medical-document files. It is not a validated clinical decision-support system or a production electronic medical record. Never enter real patient information into the demo.

## Prerequisites

- Windows with Python 3.12 (Python 3.11+ also works)
- MongoDB running locally or a configured MongoDB deployment
- Node.js/npm for the separate frontend

MongoDB must be running and reachable before the backend starts. The backend fails startup when it cannot connect; it does not fall back to an in-memory database.

## Setup

From PowerShell:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Generate a local signing secret, then place its output in `.env` as `AUTH_JWT_SECRET`:

```powershell
py -c "import secrets; print(secrets.token_urlsafe(48))"
```

Edit `.env` with the MongoDB URI/database, that generated secret, and the exact frontend origins. The default Vite ports 5173 and 5174 are included in `.env.example`; add the origin shown in your browser if using another port. Keep `.env` private; it is git-ignored. `AUTH_JWT_SECRET` must be at least 32 bytes.

## Configuration

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection URI. Default: `mongodb://localhost:27017`. |
| `MONGODB_DATABASE` | Database name. Default: `vynelixai_health`. |
| `AUTH_JWT_SECRET` | HMAC signing/verification secret; required at startup. |
| `AUTH_JWT_ISSUER` | Required JWT `iss` value; default `vynelixai-health`. |
| `ALLOWED_ORIGINS` | Comma-separated exact CORS origins. |
| `APP_ENV` | `development` exposes Swagger at `/docs` and OpenAPI at `/openapi.json`. |
| `MAX_UPLOAD_BYTES` | Upload maximum (default 10 MiB). |
| `UPLOAD_DIRECTORY` | Private local file-storage directory (default `uploads`). |

The API accepts signed JWT bearer tokens with `sub`, `role`, `iss`, `iat`, and `exp` claims, using HS256. Allowed roles are `triage_staff`, `clinician`, and `administrator`. There is intentionally no default/demo account, password, or authentication bypass. Obtain tokens from a trusted identity provider. For local-only development, a developer who controls the local secret can mint a short-lived token from the backend directory:

```powershell
py -c "from app.core.config import get_settings; from app.core.security import create_access_token; print(create_access_token('local-admin','administrator',get_settings(),900))"
```

An administrator token can register patients, upload reports, and run assessments. A `triage_staff` token can register/upload but cannot run assessments; a `clinician` token can upload/run assessments but cannot register patients. Do not use local shared-secret token minting as production identity management. The token subject is taken from the verified token; clinician identity is never accepted from review request data.

## Run

With the virtual environment active and `.env` configured, from `backend/`:

```powershell
python -m uvicorn app.main:app --reload
```

- Health: `http://localhost:8000/health`
- Authenticated readiness: `http://localhost:8000/api/v1/health/ready`
- Swagger UI (development only): `http://localhost:8000/docs`
- OpenAPI (development only): `http://localhost:8000/openapi.json`

## Tests

The tests use synthetic records and isolated async-compatible in-memory Mongo collection doubles. They do not contact a MongoDB server or external AI service. To run:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -v
```

## API overview

Every patient-record endpoint requires an `Authorization: Bearer <JWT>` header, except public `GET /health`. Role checks are applied to write and clinical workflow operations.

| Area | Endpoints |
| --- | --- |
| Readiness | `GET /api/v1/health/ready` |
| Patients | `POST /api/v1/patients`, `GET /api/v1/patients`, `GET /api/v1/patients/search?q=...`, `GET /api/v1/patients/{patient_id}`, `PATCH /api/v1/patients/{patient_id}`, `GET /api/v1/patients/{patient_id}/history`, `GET /api/v1/patients/{patient_id}/audit` |
| Visits | `POST /api/v1/patients/{patient_id}/visits`, `GET /api/v1/patients/{patient_id}/visits`, `GET /api/v1/visits/{visit_id}`, `PATCH /api/v1/visits/{visit_id}`, `PUT /api/v1/visits/{visit_id}/consultation`, `GET /api/v1/visits/{visit_id}/timeline` |
| Documents | `POST /api/v1/visits/{visit_id}/documents`, `GET /api/v1/visits/{visit_id}/documents`, `GET /api/v1/documents/{document_id}/download` |
| Assessments/reviews | `POST /api/v1/visits/{visit_id}/assessments`, `GET /api/v1/assessments/{assessment_id}`, `GET /api/v1/visits/{visit_id}/assessments`, `POST /api/v1/assessments/{assessment_id}/review`, `GET /api/v1/assessments/{assessment_id}/review` |
| Health trends | `POST /api/v1/visits/{visit_id}/observations`, `GET /api/v1/patients/{patient_id}/health-trends` |
| Routing | `POST /api/v1/visits/{visit_id}/routing`, `GET /api/v1/visits/{visit_id}/routing` |

The API generates `VYX-P-...` Hospital Patient IDs and `VYX-V-...` visit references. Registering a patient also opens the initial visit, matching the current UI workflow. Returning patients are found by their identifier/name and receive a new visit; previous records are retained.

### Example workflow

The examples below use `$token` containing a token from a trusted development issuer.

```powershell
$headers = @{ Authorization = "Bearer $token" }
$patient = Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/patients `
  -Headers $headers -ContentType "application/json" `
  -Body '{"name":"Synthetic Patient","date_of_birth":"1984-11-02","gender":"Prefer not to say","phone":"0412345678"}'
$patientId = $patient.id
$visit = Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/patients/$patientId/visits" `
  -Headers $headers -ContentType "application/json" `
  -Body '{"presenting_symptoms":"Synthetic symptoms for a demo"}'
```

Add observations/documents, then call assessment generation as a clinician. Reviews are single-transition; modifications and overrides need a reason. Routing is only accepted when the destination matches a clinician's stored final destination, and the route priority is copied from that doctor review.

## Storage, audit, and workflow limitations

- IDs use UUID internal `_id` values and stable public identifiers. MongoDB indexes enforce patient ID uniqueness and support visit/document/assessment/review/observation/audit retrieval.
- Async MongoDB operations use PyMongo's asynchronous API. Standalone MongoDB writes are not transactional; the assessment review transition is guarded by an atomic compare-and-set, but related audit/review writes can be incomplete if MongoDB fails between operations. Use a replica-set transaction strategy and operational recovery procedures before production.
- Audit records are ordinary MongoDB documents, not tamper-proof. Summaries omit clinical content, and credentials/tokens/document contents are not logged.
- Documents are saved under the configured private directory with generated filenames and are not exposed as static files. Uploads are checked against file signatures and size. Extraction is not implemented: extraction and processing statuses are explicitly `NOT_PROCESSED`.
- Historical lookups only use records stored in this configured database. No external hospital records are accessed.
- Care routes are simulated. They do not represent actual capacity, availability, booking, or hospital integration.
- The assessment service is replaceable, deterministic demo logic. It copies current symptoms, recorded observations and historical context into an evidence package; it does not diagnose, prescribe, calculate a clinical score, or make a validated urgency determination. A clinician remains the decision maker, and emergency escalation must not wait for this assessment.

## Frontend

See [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) for the current-screen mapping, API shape mappings, authentication contract, and local run commands. The frontend defaults to mock mode; connect it from Settings by entering a short-lived development JWT. Never expose the JWT signing secret in frontend configuration.

## Before production

Integrate an identity provider with role provisioning and key rotation; deploy TLS and private object storage; define clinical validation/governance and emergency escalation procedures; add transaction/reconciliation strategies, retention controls, security monitoring, backups, privacy/legal review, and a real authorization policy. This POC is not suitable for clinical decisions or real health information.
