# Sources and design decisions

Checked 2026-09-06. CLI behavior can change; check the installed version and
account model list before running a task.

| Source | What it establishes |
| --- | --- |
| [Cursor parameters](https://cursor.com/docs/cli/reference/parameters) | Print mode, workspace selection, explicit models, Ask/Plan modes, exact-session resume, and trust. |
| [Cursor headless CLI](https://cursor.com/docs/cli/headless) | Direct non-interactive tasks and `--force` for applying changes. |
| [Cursor output format](https://cursor.com/docs/cli/reference/output-format) | JSON result fields, errors, and stream-json events. |
| [Cursor permissions](https://cursor.com/docs/cli/reference/permissions) | Cursor has its own allow/deny configuration. |
| [Cursor installation](https://cursor.com/docs/cli/installation) | Supported installers, including native Windows. |
| [Cursor authentication](https://cursor.com/docs/cli/reference/authentication) | Login and authentication status. |
| [OpenAI skill documentation](https://learn.chatgpt.com/docs/build-skills) | Skill discovery, frontmatter, local install locations, and optional UI metadata. |
| [OpenAI plugin documentation](https://learn.chatgpt.com/docs/build-plugins) | Packaging skills and exposing plugins through marketplaces. |
| [Agent Skills specification](https://agentskills.io/specification) | Portable skill metadata and folder format. |
| [Vercel skills CLI](https://github.com/vercel-labs/skills) | Repository discovery, local installs, agent targeting, and telemetry controls. |
| [skills.sh documentation](https://skills.sh/docs) | Directory ranking uses installation telemetry. |

## What comes from live verification

Cursor CLI `2026.09.02-c22c1a3` lists both `cursor-grok-4.6-high` and
`cursor-grok-4.6-high-fast`. The former is the requested default. Its display
label was `Cursor Grok 4.6`; the high effort is encoded in the ID. Availability
in one account is not a promise of access in every account.

The same CLI's help describes `--force` as allowing commands unless explicitly
denied. A new disposable workspace rejected a headless review until trust was
established. Passing `--trust` for that known fixture enabled the review.

A review session resumed with `--force` still reported Ask mode and made no
edits, despite returning a successful JSON envelope. A fresh implementation
session edited the fixture and passed its tests. This is why the skill requires
checking the actual outcome and starts fresh rather than reusing legacy Ask-mode
sessions. The final skill always uses `--yolo --sandbox disabled --trust`, for
both reviews and implementation. These are observed behaviors, not a guarantee about future CLI
versions. See [verification](VERIFICATION.md).

## Why this shape

The workflow follows the small CLI-subagent pattern: preflight, fully specified
task, explicit model, captured output, and parent verification. It does not copy
Codex-specific flags into Cursor commands. Cursor is a separate process, not a
native Codex subagent with inherited conversation or permission settings.

JSON gives both a report and a session ID without maintaining a protocol client.
The parent keeps the process handle; the project does not implement scheduling,
retries, credential management, or global configuration changes.

One canonical skill lives inside the Codex plugin. The skills CLI recursively
discovers that same folder, so the two distributions cannot drift. A separate
PowerShell reference handles shell syntax without adding a runtime wrapper.
