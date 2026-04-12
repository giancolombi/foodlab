#!/bin/bash
# FoodLab Post-Tool-Use Guard
# Inspects tool output for secrets, credentials, and scope violations.
# Inspired by Sondera's base.cedar §4 and file.cedar §2-3.
# Input: JSON on stdin
# Output: JSON on stdout

set -euo pipefail

HOOK_DATA=$(cat)

TOOL_NAME=$(echo "$HOOK_DATA" | jq -r '.tool_name // empty')
TOOL_RESPONSE=$(echo "$HOOK_DATA" | jq -r '.tool_response // empty')

# §1 — Detect secrets in tool output (from Sondera base.cedar §4)
if [[ -n "$TOOL_RESPONSE" ]]; then
  if echo "$TOOL_RESPONSE" | grep -qiE 'AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----|sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}|xoxb-[0-9]+-[a-zA-Z0-9]+'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"WARNING: Tool output may contain secrets or API keys. Do NOT commit, log, or transmit this content."}}
EOF
    exit 0
  fi
fi

# Allow everything else
echo '{}'
exit 0
