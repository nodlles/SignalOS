#!/bin/bash
# SignalOS daily driver: ingest + brief + Telegram notification.
# Invoked by launchd (com.signalos.daily) every morning, but also runnable by hand.

set -u
set -o pipefail

REPO="/Users/lixin/Workspace/SignalOS"
LOG_DIR="${REPO}/.signalos/logs"
LOG_FILE="${LOG_DIR}/daily.log"
NODE_BIN="/usr/local/bin/node"

mkdir -p "${LOG_DIR}"

# Env vars live in ~/.zshrc. Source it but ignore interactive-only lines that
# fail under non-interactive shells (pnpm, nvm, etc.).
if [ -f "${HOME}/.zshrc" ]; then
  # shellcheck disable=SC1091
  set +u
  source "${HOME}/.zshrc" >/dev/null 2>&1 || true
  set -u
fi

cd "${REPO}"

exec >>"${LOG_FILE}" 2>&1

echo
echo "=== $(date '+%Y-%m-%d %H:%M:%S %z') daily run start ==="

if [ -z "${LLM_TOKEN:-}" ]; then
  echo "ERROR: LLM_TOKEN not set"
  exit 1
fi

"${NODE_BIN}" src/cli.js run
status=$?
if [ "${status}" -ne 0 ]; then
  echo "ERROR: signalos run exited with ${status}"
  exit "${status}"
fi

BRIEF_DATE="$(date '+%Y-%m-%d')"
BRIEF_PATH="briefs/${BRIEF_DATE}.md"
if [ ! -f "${BRIEF_PATH}" ]; then
  echo "WARNING: no brief produced at ${BRIEF_PATH}; skipping notify."
  exit 0
fi

"${NODE_BIN}" scripts/notify-telegram.mjs "${BRIEF_PATH}" || echo "WARNING: telegram notify failed"

echo "=== $(date '+%Y-%m-%d %H:%M:%S %z') daily run done ==="
