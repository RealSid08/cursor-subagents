# Cursor Subagents

**Let Codex delegate coding tasks to Cursor CLI.**

One skill: give Cursor a bounded task, let it work, then have Codex review the
diff and verify the result. Useful for implementation, a second code review,
and independent verification.

The default is **Grok 4.6 high, without fast mode**:
`--model cursor-grok-4.6-high`. It is passed explicitly on every run and follow-up.
Every task also uses **YOLO / full local access**:
`--yolo --sandbox disabled --trust`.

```text
Codex → task prompt → Cursor CLI → files + report → Codex verification
```

The skill calls Cursor directly. The optional Codex plugin contains that same
skill, with no MCP server, ACP bridge, runtime package, or background service.

## Install

Choose either installation method; installing both can show duplicate skills.

### Codex plugin marketplace

```sh
codex plugin marketplace add RealSid08/cursor-subagents
codex plugin add cursor-subagents@cursor-subagents
```

This adds the repository's **Cursor Subagents** marketplace and installs its
plugin. You can also browse that marketplace in the Codex app and install
**Cursor Subagents** there. Start a new task after installation.

This repository-backed marketplace is available to anyone who adds it. Inclusion
in OpenAI's public plugin directory requires a separate submission and review;
shipping the manifest alone does not grant that listing.

### Agent skill / skills.sh

Run in your project:

```sh
npx skills add RealSid08/cursor-subagents --skill cursor-subagents --agent codex
```

Add `--global` for a user-wide installation. Add `--yes` for a non-interactive
install. Node.js/npm is needed for this installer, not by the skill itself.

To inspect available skills before installing:

```sh
npx skills add RealSid08/cursor-subagents --list
```

Or copy the complete
[`plugins/cursor-subagents/skills/cursor-subagents`](plugins/cursor-subagents/skills/cursor-subagents)
folder to your project's `.agents/skills/` or your user's `~/.agents/skills/`.
Keep its `references/` and `agents/` directories together with `SKILL.md`.

## Set up Cursor once

Install [Cursor CLI](https://cursor.com/docs/cli/installation), then authenticate:

```sh
agent --version
agent login
agent status
agent models
```

The official installer supports macOS, Linux, WSL, and native Windows PowerShell.
Some installations also expose `cursor-agent`; the skill supports that command
name. Verify that `cursor-grok-4.6-high` is in your account's model list.

The skill reuses your Cursor login. Cursor model access, billing, usage limits,
and privacy settings apply to delegated runs; a Codex subscription does not
supply Cursor access. If the requested model is unavailable, the skill reports
the problem instead of silently choosing another model.

## Use it in Codex

```text
Use $cursor-subagents to review the authentication changes. Don't edit files.
Return concrete correctness issues with file and line references.
```

```text
Use $cursor-subagents to fix the failing parser test. Cursor owns src/parser.ts
and its tests. Keep the public API unchanged and verify the fix afterward.
```

```text
Use $cursor-subagents for two independent tasks in separate worktrees:
one reviews the API, the other updates the CLI tests. Review both results.
```

Codex writes a self-contained review or implementation prompt,
captures the result and session ID, and checks the work. Cursor has no access to
the parent conversation unless that context is included in its prompt.

For direct invocation, Bash examples are in the
[skill](plugins/cursor-subagents/skills/cursor-subagents/SKILL.md), and native
Windows examples are in its
[PowerShell reference](plugins/cursor-subagents/skills/cursor-subagents/references/powershell.md).

## Permissions and isolation

All runs and resumes use `--yolo --sandbox disabled --trust`. Cursor can edit
files and run commands without confirmation, its sandbox is disabled for that
run, and the selected workspace is trusted. Explicit Cursor denials and host
restrictions can still apply. The skill does not rewrite global configuration.

Reviews use the same full-access mode. A prompt saying "don't edit files" is
an instruction, not an enforced read-only boundary.

Concurrent writers use separate Git worktrees. Worktrees isolate edits, not
credentials or filesystem access. They begin at a commit and do not automatically
include uncommitted changes. Single tasks use the intended checkout.

Older sessions created in Ask mode can remain read-only on resume. The skill
starts a fresh full-access session instead of reusing such a session.

## Project status

The v2 design replaces the previous multi-harness runtime entirely. Previous
setup commands and `cursor_*` tools no longer apply. Remove old installations
through the tool you used to install them before switching; this repository
does not delete other installed packages or modify user configuration on its own.

Verified on native Windows with Cursor CLI `2026.09.02-c22c1a3`:
model availability and direct CLI execution. See [verification notes](docs/VERIFICATION.md)
for the complete checks and platform limits.

## Contributing

Keep the skill small and direct. Please include a reproducible task, CLI version,
and sanitized output when reporting behavior changes. See
[CONTRIBUTING.md](CONTRIBUTING.md) for checks and
[distribution](docs/DISTRIBUTION.md) for both install paths and release steps.

The implementation is based on current primary documentation and live CLI
checks; [sources and rationale](docs/RESEARCH.md) record the evidence.

MIT licensed. Community project; not affiliated with OpenAI, Cursor, or xAI.
