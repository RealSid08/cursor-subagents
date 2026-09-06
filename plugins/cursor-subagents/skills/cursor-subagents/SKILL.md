---
name: cursor-subagents
description: Delegate self-contained coding tasks to Cursor CLI from Codex with YOLO and full local access. Use for implementation, code review, a second opinion, or independent verification, including parallel tasks in separate worktrees. Defaults to Grok 4.6 high without fast mode.
license: MIT
---

# Cursor CLI as a subagent

Launch Cursor CLI directly with `agent --print`. Codex supplies the task, monitors
the process, and reviews the result. Each launch has its own conversation; Cursor
does not receive the parent chat. No server or orchestration package is needed.

## Preflight

Requires a shell, authenticated Cursor CLI, and access to the selected model.
Git is needed for worktree isolation.

```sh
agent --version
agent status
agent models
```

If `agent` is unavailable, try `cursor-agent --version` and use that executable
consistently. If neither exists, direct the user to the
[Cursor installation guide](https://cursor.com/docs/cli/installation).
If signed out, the user runs `agent login` once. Reuse Cursor's existing login;
do not read credentials, inject API keys, or change providers to bypass a failure.

Default to **`cursor-grok-4.6-high`**, passing `--model` explicitly on every launch
and resume. High effort is encoded in this model ID; do not add Codex reasoning
flags. The `-fast` variant and `auto` are different choices. Use another model
only when the user requests it. Confirm the exact ID is in `agent models`; if
unavailable, report that and stop the delegated run instead of substituting.

## Prepare a bounded task

Give Cursor the goal, absolute workspace path, relevant context, files it owns,
constraints, verification command, and expected report. Include decisions from
the parent chat that matter. Ask it to return changed files, checks actually run,
results, and remaining concerns. Do not forward secrets or unrelated chat history.
Tell the child to finish its assigned task directly, without further delegation,
committing, pushing, or publishing unless those actions are part of its assignment.

Use the user's intended checkout for a single task. Record `git status --short`
before starting so existing edits remain distinguishable.

## Full-access execution

Always pass **`--yolo --sandbox disabled --trust`** on every delegated launch and
resume, including reviews. `--yolo` is Cursor's `--force` alias: allow commands
and edits without confirmation unless explicitly denied. `--sandbox disabled`
turns off Cursor's sandbox; `--trust` trusts the selected workspace without a prompt.
Do not add `--mode ask`, `--mode plan`, or `--plan`; omit `--mode` to use Agent
mode. `--mode agent` is not a valid value.

For reviews, say "Do not edit files" in the prompt. That is an instruction, not
an enforced read-only boundary. Full local access does not expand the assigned
task or authorize unrelated external actions. Cursor's explicit deny rules and
host restrictions can still apply; report a denial rather than rewriting them.

## Launch and collect

For **PowerShell**, read [references/powershell.md](references/powershell.md).
The following examples use **Bash**. Select the intended workspace explicitly.

```bash
WORKSPACE='/absolute/path/to/repo'
RUN_DIR=$(mktemp -d)
PROMPT='Review src/parser.ts for correctness. Do not edit files. Report concrete issues with file and line references, or say none found.'

agent --workspace "$WORKSPACE" \
  --model cursor-grok-4.6-high --yolo --sandbox disabled --trust \
  --print --output-format json "$PROMPT" \
  </dev/null >"$RUN_DIR/result.json" 2>"$RUN_DIR/stderr.log" &
PID=$!
```

For an implementation assignment, supply an implementation prompt. Keep the same
explicit workspace, model, full-access, and output flags.
For long prompts, write a task file outside the checkout and set
`PROMPT=$(cat /absolute/path/to/task.md)`; if it exceeds the OS argument limit,
pass a short prompt asking Cursor to read that absolute file first.

Use the host's managed background terminal/process facility where available.
Keep its handle (or the PID and original shell above) and logs. Give runs time to
finish; poll at sensible intervals while doing independent work. Do not launch a
duplicate because JSON output is still empty: it arrives at completion.

In the **same shell** that launched the Bash process:

```bash
if wait "$PID"; then EXIT_CODE=0; else EXIT_CODE=$?; fi
cat "$RUN_DIR/stderr.log"
if [ "$EXIT_CODE" -ne 0 ]; then
  printf 'Cursor failed with exit code %s\n' "$EXIT_CODE"
else
  cat "$RUN_DIR/result.json"
fi
```

Require exit code zero and a parseable object with `type: "result"`,
`subtype: "success"`, and `is_error: false`. Read `result` and retain `session_id`.
Missing/invalid JSON is a failed or interrupted run, not a successful empty answer.
`result` can contain intermediate assistant text as well as the final report.
Use `--output-format stream-json` instead when live tool events are necessary;
that is JSON Lines, so do not parse the whole file as one JSON object.

Review the actual diff, including untracked files, and independently run relevant
checks before reporting success. A successful process does not prove the task was
completed correctly. Collect evidence before removing temporary logs.

## Follow up

Resume the **exact** `session_id` from that result in the same workspace. Use new
output files and repeat the model and all full-access flags:

```bash
SESSION_ID='the-session-id-from-result-json'
agent --workspace "$WORKSPACE" --resume "$SESSION_ID" \
  --model cursor-grok-4.6-high --yolo --sandbox disabled --trust \
  --print --output-format json 'Check whether the same issue affects the other parser entrypoint. Do not edit files.' \
  </dev/null >"$RUN_DIR/followup.json" 2>"$RUN_DIR/followup.stderr.log"
```

Check the exit code and result again. If resuming an older session created outside
this skill in Ask/Plan mode, start a fresh full-access session instead: the old
mode can persist on resume. Avoid `--continue`, bare `--resume`, and
"latest session" selection when multiple children might exist.

## Parallel runs

Parallelize independent tasks with explicit ownership. Give each concurrent
writer a separate Git worktree and each run separate output files and a process
handle. A worktree isolates edits, not filesystem access or credentials.

```bash
git -C "$WORKSPACE" worktree add -b cursor/task-a /absolute/path/to/task-a HEAD
```

Use that path as the child's `--workspace`. Repeat with a unique branch and path
for other tasks. Worktrees start at the chosen commit; uncommitted parent changes
are not included. If the task depends on those edits, run sequentially in the
original checkout or deliberately transfer only the needed diff. Review and
integrate each completed change before removing its worktree. Do not force-remove
a worktree with uncollected edits. Read-only reviews may share a stable checkout.

## Failure handling

- Missing CLI, login, or model: report the failed prerequisite; do not loop.
- Permission failure despite the full-access flags: report the explicit denial
  or host restriction; do not rewrite permission configuration.
- Rate limit, quota, or provider error: preserve logs and report it; no automatic
  retry loop or silent model switch.
- Interrupted/stalled run: inspect logs and process state; stop only that child
  with the host's process control if needed. Check for partial edits before any
  retry. Never kill all `agent` or `node` processes.
- Child reports success but files/tests disagree: treat it as unfinished work;
  correct locally or send a bounded follow-up using its exact session ID.
