#!/bin/bash
# FoodLab User Prompt Guard
# Detects prompt injection and dangerous instructions.
# Inspired by Sondera's base.cedar §1 (prompt signature detection).
# Input: JSON on stdin
# Output: JSON on stdout

set -euo pipefail

HOOK_DATA=$(cat)

PROMPT=$(echo "$HOOK_DATA" | jq -r '.prompt // empty')

if [[ -z "$PROMPT" ]]; then
  echo '{}'
  exit 0
fi

PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# §1 — Prompt injection patterns (from Sondera base.cedar §1)
if echo "$PROMPT_LOWER" | grep -qE 'ignore (all |previous |prior |above )?(instructions|rules|constraints)|disregard (all |previous )?(instructions|rules)|override (system|safety|security) (prompt|instructions|rules)|you are now|new persona|act as if|pretend (you are|to be)|forget (all |everything |your )?(instructions|rules|training)'; then
  cat <<EOF
{"decision":"block","reason":"Blocked: prompt contains injection pattern. If this was unintentional, rephrase your request.","hookSpecificOutput":{"hookEventName":"UserPromptSubmit"}}
EOF
  exit 0
fi

# §2 — Data exfiltration attempts
if echo "$PROMPT_LOWER" | grep -qE 'send (this|the|all|my) (code|data|files|secrets|keys|tokens|passwords) to|upload (to|everything|all files)|exfiltrate|curl.*POST.*http'; then
  cat <<EOF
{"decision":"block","reason":"Blocked: prompt appears to request data exfiltration.","hookSpecificOutput":{"hookEventName":"UserPromptSubmit"}}
EOF
  exit 0
fi

# Allow everything else
echo '{}'
exit 0
