# Candidate Tracker rollout (safe, no production impact)

## Required environment variables (backend)
- **`ENABLE_CANDIDATE_TRACKER`**: `true|false` (default `false`)
- **`TRACKER_DB_URL`**: Postgres connection string for *tracker tables only*
- **`TRACKER_PROD_URL_HINTS`**: comma-separated substrings treated as “production” (dev/staging will refuse to connect if matched)
- **`ALLOW_PROD_DATA_ACCESS`**: `true|false` override for the above refusal (default `false`, not recommended)

## Why this is safe
- Tracker uses a **separate SQLAlchemy metadata** and a **separate engine/session**, so it cannot accidentally create/alter auth tables.\n- When disabled (`ENABLE_CANDIDATE_TRACKER=false`), the API returns **404** for tracker endpoints and does **not** create any tables.\n
## Enablement sequence
1. **Local dev**\n   - Copy `.env.dev.example` → `.env.dev`\n   - Ensure `TRACKER_DB_URL` points to `postgres-dev` (dev container)\n2. **Staging**\n   - Deploy backend with `ENABLE_CANDIDATE_TRACKER=false`\n   - Set up a staging Postgres DB for tracker tables\n   - Set `ENABLE_CANDIDATE_TRACKER=true` and `TRACKER_DB_URL=...staging...`\n   - Verify the `/tracker` UI and `/api/tracker/*` endpoints\n3. **Production**\n   - Create a *new* Postgres database/schema for tracker tables\n   - Set `TRACKER_PROD_URL_HINTS` to match your production DB hostname\n   - Enable `ENABLE_CANDIDATE_TRACKER=true` only after staging validation\n+
