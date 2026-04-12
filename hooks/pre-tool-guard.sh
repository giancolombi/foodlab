#!/bin/bash
# FoodLab Pre-Tool-Use Guard
# Inspired by Sondera's destructive.cedar policies.
# Blocks dangerous git, filesystem, and scope-creep operations before execution.
# Input: JSON on stdin from Claude Code / Gemini CLI hooks
# Output: JSON on stdout (empty {} = allow, permissionDecision: deny = block)

set -euo pipefail

HOOK_DATA=$(cat)

TOOL_NAME=$(echo "$HOOK_DATA" | jq -r '.tool_name // empty')
COMMAND=$(echo "$HOOK_DATA" | jq -r '.tool_input.command // empty')
FILE_PATH=$(echo "$HOOK_DATA" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Only check Bash commands and file operations
if [[ "$TOOL_NAME" == "Bash" && -n "$COMMAND" ]]; then

  # §1 — Destructive filesystem (from Sondera destructive.cedar §1)
  if echo "$COMMAND" | grep -qE 'rm\s+-(r|rf|fr)\s'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: recursive delete (rm -rf) is forbidden in FoodLab."}}
EOF
    exit 0
  fi

  if echo "$COMMAND" | grep -qE 'shred\s|dd\s.*of=/dev|mkfs\s'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: destructive disk operation."}}
EOF
    exit 0
  fi

  # §2 — Git force operations (from Sondera destructive.cedar §2)
  if echo "$COMMAND" | grep -qE 'git\s+push\s+--force|git\s+push\s+-f\s'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: git force-push is forbidden. Use normal push."}}
EOF
    exit 0
  fi

  if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: git reset --hard discards work. Use git stash or git revert."}}
EOF
    exit 0
  fi

  if echo "$COMMAND" | grep -qE 'git\s+clean\s+-(f|df|xf|xdf)'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: git clean -f removes untracked files permanently."}}
EOF
    exit 0
  fi

  if echo "$COMMAND" | grep -qE 'git\s+checkout\s+--\s+\.'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: git checkout -- . discards all changes."}}
EOF
    exit 0
  fi

  if echo "$COMMAND" | grep -qE 'git\s+branch\s+-D\s'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: git branch -D force-deletes without merge check. Use -d."}}
EOF
    exit 0
  fi

  if echo "$COMMAND" | grep -qE -- '--no-verify'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: --no-verify skips safety hooks."}}
EOF
    exit 0
  fi

  if echo "$COMMAND" | grep -qE 'git\s+filter-branch'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: git filter-branch rewrites history."}}
EOF
    exit 0
  fi

  # §3 — Infrastructure destruction (from Sondera destructive.cedar §3)
  if echo "$COMMAND" | grep -qE 'terraform\s+destroy|docker\s+system\s+prune|kubectl\s+delete\s+namespace'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: infrastructure destruction command."}}
EOF
    exit 0
  fi

  # §4 — Database destruction (from Sondera destructive.cedar §4)
  if echo "$COMMAND" | grep -qiE 'DROP\s+(DATABASE|TABLE)|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\w+\s*;|FLUSHALL|dropDatabase'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: destructive database operation."}}
EOF
    exit 0
  fi

  # §5 — Lock file deletion (from Sondera destructive.cedar §5)
  if echo "$COMMAND" | grep -qE 'rm\s.*(package-lock|yarn\.lock|pnpm-lock|Cargo\.lock|Gemfile\.lock|poetry\.lock)'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: deleting lock files breaks dependency resolution."}}
EOF
    exit 0
  fi

  # §6 — Dangerous permissions (from Sondera destructive.cedar §6)
  if echo "$COMMAND" | grep -qE 'chmod\s+-R\s+777|chown\s+-R\s+root'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: dangerous permission change."}}
EOF
    exit 0
  fi

  # §7 — Process killing (from Sondera destructive.cedar §9)
  if echo "$COMMAND" | grep -qE 'killall\s|pkill\s|kill\s+-9\s'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: mass process termination."}}
EOF
    exit 0
  fi

fi

# §8 — Protect critical files from deletion via Write/Edit tools
if [[ "$TOOL_NAME" == "Write" || "$TOOL_NAME" == "Edit" ]]; then
  if echo "$FILE_PATH" | grep -qE '\.(env|pem|key|p12)$'; then
    cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Blocked: writing to sensitive file (.env, private keys)."}}
EOF
    exit 0
  fi
fi

# Allow everything else
echo '{}'
exit 0
