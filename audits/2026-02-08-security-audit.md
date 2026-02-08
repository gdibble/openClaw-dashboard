# Security Audit Report — 2026-02-08

**Auditor:** Internal review (AI-assisted)
**Scope:** Full codebase — `src/lib/data.ts`, `src/app/api/data/route.ts`, `src/lib/useSwarmData.ts`
**Status:** All findings remediated

---

## Summary

| Severity | Count | Resolved |
|----------|-------|----------|
| Critical | 1 | 1 |
| Medium | 2 | 2 |
| Low | 4 | 4 |
| **Total** | **7** | **7** |

---

## Findings

### CVE-1: Path Traversal in Task Loader (Critical)

**Description:** `loadTasks()` read files from `TASKS_DIR` using `join()` without validating that resolved paths stayed within the intended directory. A maliciously named file (e.g., `../../../etc/passwd.json`) could read arbitrary files from the filesystem.

**Fix:** Added `resolve()` path validation — every file path is resolved to an absolute path and checked against the resolved tasks directory before reading. Files that escape the directory are skipped with a warning.

**File:** `src/lib/data.ts`

---

### M-1: No Authentication on API Endpoint (Medium)

**Description:** The `/api/data` endpoint served all swarm data without any authentication, making it accessible to anyone who could reach the server.

**Fix:** Added optional API key authentication via the `OPENCLAW_API_KEY` environment variable. When set, all requests must include a valid `Authorization: Bearer <key>` header. When unset, the API remains open for local development convenience.

**File:** `src/app/api/data/route.ts`

---

### M-2: Hardcoded Tasks Directory Path (Medium)

**Description:** `TASKS_DIR` was hardcoded to an absolute path (`/Users/claude/clawd/projects/neo-swarm/tasks`), leaking system structure and making configuration impossible without modifying source code.

**Fix:** Replaced with the `OPENCLAW_TASKS_DIR` environment variable, defaulting to `./tasks`. Added `.env.example` documenting all available environment variables.

**File:** `src/lib/data.ts`

---

### L-1: No Rate Limiting (Low)

**Description:** The API endpoint had no request rate limiting, making it vulnerable to abuse or accidental denial-of-service from rapid polling.

**Fix:** Added in-memory IP-based rate limiting — 60 requests per minute per IP. Requests exceeding the limit receive a `429 Too Many Requests` response.

**File:** `src/app/api/data/route.ts`

---

### L-2: No File Size Limit on Task Files (Low)

**Description:** `loadTasks()` would attempt to read and parse JSON files of any size, risking memory exhaustion from oversized or malicious files.

**Fix:** Added a `statSync` check before reading — files larger than 1MB are skipped with a warning logged.

**File:** `src/lib/data.ts`

---

### L-3: Verbose Error Logging (Low)

**Description:** The API catch block logged the full error object (`console.error('Error loading data:', error)`), which could expose internal paths, stack traces, or sensitive details in server logs.

**Fix:** Error logging now only outputs the error message string, not the full object or stack trace.

**File:** `src/app/api/data/route.ts`

---

### L-4: No Color Value Validation (Low)

**Description:** Agent color values were used directly in components without validation. While currently safe (hardcoded hex values), any future dynamic color input could enable CSS injection.

**Fix:** Added a `sanitizeColor()` helper that validates strict `#RRGGBB` hex format, falling back to a neutral grey (`#697177`) for invalid values. Applied to all agent color definitions.

**File:** `src/lib/data.ts`

---

## Files Changed

| File | Changes |
|------|---------|
| `src/lib/data.ts` | Path traversal fix, env var for TASKS_DIR, file size limit, color validation |
| `src/app/api/data/route.ts` | API key auth, rate limiting, sanitized error logging |
| `src/lib/useSwarmData.ts` | Auth header forwarding |
| `.env.example` | New — documents available env vars |
| `README.md` | Updated setup instructions, added Security section |
