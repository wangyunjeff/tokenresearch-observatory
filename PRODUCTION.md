# Production monitor

The public page now reads `/api/status`. All model credentials remain server-side.

## Cadence

- Candy reasoning probe: every **10 minutes**, aligned to `:00/:10/:20/...`.
- Pelican HTML probe: every **30 minutes**, aligned to `:00/:30`.
- Each probe is a new independent request. No previous conversation is sent.
- `RUN_ON_START=true` performs one probe shortly after the process starts, then continues on aligned boundaries.
- A lock prevents overlapping runs if one request lasts longer than its interval.

## Configure

Copy `.env.example` to `.env` in the production environment only. Do not commit `.env`.

Required for candy:

```env
OPENAI_BASE_URL=https://YOUR-BASE/v1
OPENAI_API_KEY=YOUR-KEY
CANDY_MODEL=YOUR-MODEL
```

The worker posts the exact candy prompt to an OpenAI-compatible `Responses` endpoint. The prompt requires one JSON object with `final_answer` and a concise proof. Only a parsed `final_answer` of `21` passes; intermediate proof numbers do not participate in grading. Legacy non-JSON records retain conservative conclusion extraction, with boxed conclusions preferred over intermediate arithmetic.

## Codex Exec adapter

The repository intentionally does not assume one private executor implementation. Choose one:

### Command adapter

```env
PELICAN_EXEC_MODE=command
CODEX_EXEC_COMMAND_JSON=["codex","exec","-"]
```

The exact pelican prompt is sent to stdin in a fresh temporary directory. The command must create `index.html` in that directory. Use JSON array syntax; the server never invokes a shell.

### HTTP adapter

```env
PELICAN_EXEC_MODE=http
CODEX_EXEC_URL=https://YOUR-EXECUTOR/run
CODEX_EXEC_KEY=YOUR-EXECUTOR-KEY
```

Request body:

```json
{"prompt":"<exact pelican prompt>","output_file":"index.html"}
```

Accepted response forms:

```json
{"html":"<!doctype html>..."}
```

or

```json
{"files":{"index.html":"<!doctype html>..."}}
```

Only **one real pelican execution** is performed per 30-minute probe.

## Public gallery provenance

The gallery exposes all saved real pelican probe outputs in newest-first order, subject to the public display limit. Each displayed item is a server-side execution result; reference material and synthetic placeholders are not included in live results.

The implementation deliberately does not backfill fabricated 5-hour monitoring data. Real history accumulates from the configured worker; existing historical data remains available in the repository archive fallback.

## Recovery retests

When a confirmed server-side incident invalidates scheduled candy probes, retain the original error records and run real recovery retests against an explicit interval while the monitor service is stopped:

```bash
node scripts/retest-candy-slots.mjs --from=2026-09-15T01:00:00Z --to=2026-09-15T03:00:00Z
```

The script only selects unretested `HTTP 502` errors in that interval. A completed retest keeps its actual request time, records the original slot as `display_timestamp`, and links the original error ID. It must not be used to create synthetic historical measurements.

## Run

```bash
cp .env.example .env
# edit .env
npm test
npm start
```

Or:

```bash
docker compose -f docker-compose.example.yml up -d --build
```

Put your reverse proxy in front of `127.0.0.1:8080` for `https://live.tokenresearch.com.cn/`.

Health check: `GET /healthz`
Public feed: `GET /api/status`

`runtime/monitor-state.json` is atomic-written and should live on persistent storage.
