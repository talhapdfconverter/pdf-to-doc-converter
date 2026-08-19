# PDF to Word Backend

A secure Node.js/Express backend that converts PDF files to editable DOCX
files using the official **Adobe PDF Services API**. No generative AI is
used anywhere in the conversion pipeline.

For full beginner-friendly setup and deployment steps, see
[`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md). This file is a quick
technical reference.

## Requirements

- Node.js 18 or newer
- An Adobe PDF Services API credential (Client ID + Client Secret)

## Local setup

```bash
npm install
cp .env.example .env
# edit .env with real values
npm start
```

Visit `http://localhost:3000/api/health` to confirm it's running.

## Environment variables

See `.env.example` for the full list with descriptions. The two most
important are `PDF_SERVICES_CLIENT_ID` / `PDF_SERVICES_CLIENT_SECRET`
(from Adobe) and `PLUGIN_SHARED_SECRET` (must match the WordPress plugin's
"Shared Secret" setting exactly).

## API endpoints

| Method | Path                    | Auth              | Purpose                                  |
|--------|-------------------------|-------------------|-------------------------------------------|
| GET    | `/api/health`            | none              | Uptime / connection check                 |
| POST   | `/api/convert`           | shared secret     | Upload a PDF, start a conversion job      |
| GET    | `/api/status/:jobId`     | shared secret     | Poll job status                           |
| GET    | `/api/download/:jobId`   | shared secret + download token (query param) | Download the finished DOCX |
| DELETE | `/api/job/:jobId`        | shared secret     | Delete a job's files immediately          |

All protected endpoints require an `x-plugin-secret` header matching
`PLUGIN_SHARED_SECRET`. This backend is designed to be called only by the
companion WordPress plugin's server-side PHP — never directly from a
browser.

## Architecture notes

- **Job store:** file-based (`src/data/jobs.json`) with an in-memory
  cache. Works for a single backend instance. See the detailed comment
  block at the top of `src/services/jobStore.js` for its limitations and a
  documented Redis upgrade path.
- **OCR:** Adobe PDF Services has no built-in "detect scanned PDF"
  operation, so OCR is applied as a global toggle (`OCR_ENABLED`, or
  overridden per-request by the WordPress plugin's own setting) rather
  than automatic per-file detection. See the comment block in
  `src/services/adobeService.js`.
- **Cleanup:** a scheduler in `src/services/cleanupService.js` runs every
  5 minutes and deletes any file that is expired (`FILE_EXPIRY_MINUTES`)
  or already downloaded.

## Deployment

See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) Part E (Railway) or
Part F (Render) for exact, step-by-step deployment instructions.

## Generating `package-lock.json`

Run `npm install` once, locally or on first deploy — this generates an
accurate lockfile from the real npm registry. It cannot be hand-written
without a network connection to npm.
