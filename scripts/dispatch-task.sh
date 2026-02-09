#!/usr/bin/env bash
set -euo pipefail
#
# dispatch-task.sh — Run a Claude agent and auto-capture token usage
#
# Usage:
#   ./scripts/dispatch-task.sh <task-id> "Your prompt here"
#   ./scripts/dispatch-task.sh <task-id> "prompt" --model claude-sonnet-4-5
#
# What it does:
#   1. Marks agent as "working" in agents-status.json
#   2. Runs `claude -p` with --output-format json to get structured output
#   3. Parses token usage from the response
#   4. Logs usage via log-usage.ts (writes to both DB + task file)
#   5. Marks agent back to "idle"
#
# Environment:
#   OPENCLAW_TASKS_DIR  — where to write task files (default: ./tasks)
#   DATABASE_URL        — PostgreSQL connection (optional, enhances logging)
#   OPENCLAW_AGENT_ID   — agent ID for status tracking (default: from session)
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TASKS_DIR="${OPENCLAW_TASKS_DIR:-./tasks}"

# ── Args ──────────────────────────────────────────────────────────────────
if [ $# -lt 2 ]; then
  echo "Usage: dispatch-task.sh <task-id> <prompt> [--model <model>]"
  echo ""
  echo "Examples:"
  echo '  ./scripts/dispatch-task.sh fix-auth "Fix the auth token refresh bug"'
  echo '  ./scripts/dispatch-task.sh refactor-api "Refactor the API layer" --model claude-sonnet-4-5'
  exit 1
fi

TASK_ID="$1"
PROMPT="$2"
shift 2

# Parse optional flags
MODEL=""
EXTRA_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)
      MODEL="$2"
      shift 2
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────
mkdir -p "$TASKS_DIR"

AGENT_STATUS_FILE="$TASKS_DIR/agents-status.json"
SESSION_ID="${TASK_ID}-$(date +%s)"

set_agent_status() {
  local status="$1"
  local agent_id="${OPENCLAW_AGENT_ID:-dispatch}"

  if [ -f "$AGENT_STATUS_FILE" ]; then
    # Update existing file
    local tmp
    tmp=$(mktemp)
    if command -v jq &>/dev/null; then
      jq --arg id "$agent_id" --arg st "$status" '.[$id] = $st' "$AGENT_STATUS_FILE" > "$tmp"
    else
      # Fallback without jq: write the whole file
      echo "{\"$agent_id\": \"$status\"}" > "$tmp"
    fi
    mv "$tmp" "$AGENT_STATUS_FILE"
  else
    echo "{\"${OPENCLAW_AGENT_ID:-dispatch}\": \"$status\"}" > "$AGENT_STATUS_FILE"
  fi
}

cleanup() {
  set_agent_status "idle"
}
trap cleanup EXIT

# ── 1. Mark working ──────────────────────────────────────────────────────
echo "[dispatch] Starting task: $TASK_ID"
set_agent_status "working"

# ── 2. Create initial task file ──────────────────────────────────────────
TASK_FILE="$TASKS_DIR/${TASK_ID}.json"
if [ ! -f "$TASK_FILE" ]; then
  cat > "$TASK_FILE" <<TASKJSON
{
  "id": "$TASK_ID",
  "title": "$TASK_ID",
  "description": "Dispatched: $PROMPT",
  "status": "in_progress",
  "priority": "normal",
  "claimed_by": "${OPENCLAW_AGENT_ID:-dispatch}",
  "tags": ["dispatched", "auto"],
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
TASKJSON
fi

# ── 3. Run claude ────────────────────────────────────────────────────────
CLAUDE_ARGS=(-p "$PROMPT" --output-format json)
if [ -n "$MODEL" ]; then
  CLAUDE_ARGS+=(--model "$MODEL")
fi
CLAUDE_ARGS+=("${EXTRA_ARGS[@]}")

echo "[dispatch] Running: claude ${CLAUDE_ARGS[*]}"

OUTPUT_FILE=$(mktemp)
EXIT_CODE=0
claude "${CLAUDE_ARGS[@]}" > "$OUTPUT_FILE" 2>&1 || EXIT_CODE=$?

# ── 4. Parse usage from output ───────────────────────────────────────────
INPUT_TOKENS=0
OUTPUT_TOKENS=0
CACHE_READ=0
CACHE_WRITE=0
DETECTED_MODEL=""

if command -v jq &>/dev/null && [ -s "$OUTPUT_FILE" ]; then
  # Claude CLI JSON output has usage in the response
  INPUT_TOKENS=$(jq -r '.usage.input_tokens // .result.usage.input_tokens // 0' "$OUTPUT_FILE" 2>/dev/null || echo 0)
  OUTPUT_TOKENS=$(jq -r '.usage.output_tokens // .result.usage.output_tokens // 0' "$OUTPUT_FILE" 2>/dev/null || echo 0)
  CACHE_READ=$(jq -r '.usage.cache_read_input_tokens // .result.usage.cache_read_input_tokens // 0' "$OUTPUT_FILE" 2>/dev/null || echo 0)
  CACHE_WRITE=$(jq -r '.usage.cache_creation_input_tokens // .result.usage.cache_creation_input_tokens // 0' "$OUTPUT_FILE" 2>/dev/null || echo 0)
  DETECTED_MODEL=$(jq -r '.model // .result.model // empty' "$OUTPUT_FILE" 2>/dev/null || echo "")

  # Handle "null" strings from jq
  [ "$INPUT_TOKENS" = "null" ] && INPUT_TOKENS=0
  [ "$OUTPUT_TOKENS" = "null" ] && OUTPUT_TOKENS=0
  [ "$CACHE_READ" = "null" ] && CACHE_READ=0
  [ "$CACHE_WRITE" = "null" ] && CACHE_WRITE=0
fi

FINAL_MODEL="${MODEL:-${DETECTED_MODEL:-unknown}}"

# ── 5. Log usage ─────────────────────────────────────────────────────────
if [ "$INPUT_TOKENS" -gt 0 ] || [ "$OUTPUT_TOKENS" -gt 0 ]; then
  LOG_ARGS=(
    --session-id "$SESSION_ID"
    --task-id "$TASK_ID"
    --input "$INPUT_TOKENS"
    --output "$OUTPUT_TOKENS"
    --model "$FINAL_MODEL"
    --provider "anthropic"
  )
  [ "$CACHE_READ" -gt 0 ] && LOG_ARGS+=(--cache-read "$CACHE_READ")
  [ "$CACHE_WRITE" -gt 0 ] && LOG_ARGS+=(--cache-write "$CACHE_WRITE")

  echo "[dispatch] Logging: ${INPUT_TOKENS} in + ${OUTPUT_TOKENS} out (${FINAL_MODEL})"
  npx tsx "$SCRIPT_DIR/log-usage.ts" "${LOG_ARGS[@]}" || echo "[dispatch] Warning: log-usage failed (non-fatal)"
else
  echo "[dispatch] No token usage detected in output"
fi

# ── 6. Update task status ────────────────────────────────────────────────
if [ "$EXIT_CODE" -eq 0 ]; then
  # Mark task as done
  if command -v jq &>/dev/null && [ -f "$TASK_FILE" ]; then
    TMP=$(mktemp)
    jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.status = "done" | .completed_at = $ts' "$TASK_FILE" > "$TMP"
    mv "$TMP" "$TASK_FILE"
  fi
  echo "[dispatch] Task $TASK_ID completed successfully"
else
  echo "[dispatch] Task $TASK_ID failed (exit code: $EXIT_CODE)"
fi

# ── 7. Print agent response ─────────────────────────────────────────────
if command -v jq &>/dev/null && [ -s "$OUTPUT_FILE" ]; then
  RESPONSE=$(jq -r '.result.text // .result // .text // empty' "$OUTPUT_FILE" 2>/dev/null || true)
  if [ -n "$RESPONSE" ]; then
    echo ""
    echo "── Agent Response ──"
    echo "$RESPONSE"
  fi
fi

rm -f "$OUTPUT_FILE"
exit $EXIT_CODE
