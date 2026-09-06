# Verification

## Environment

Checked 2026-09-06 on native Windows with PowerShell 7, Cursor CLI
`2026.09.02-c22c1a3`, Codex CLI `0.153.2`, and skills CLI `1.5.23`.
Model: `cursor-grok-4.6-high` from the account's live model catalog.

## Repeatable execution check

Create a disposable workspace outside the repository with two files:

`sum.js`:

```javascript
export const sum = (a, b) => a - b;
```

`sum.test.mjs`:

```javascript
import { sum } from './sum.js';
import assert from 'node:assert/strict';
assert.equal(sum(2, 3), 5);
assert.equal(sum(-2, 2), 0);
```

1. Launch using the skill's shell instructions with
   `--model cursor-grok-4.6-high --yolo --sandbox disabled --trust --print --output-format json`.
   Ask for a review without edits. Check that it identifies subtraction and
   verify the fixture remains unchanged. This tests prompt compliance, not
   enforced read-only permissions.
2. Resume the returned session ID with the same flags. Ask it to modify only
   `sum.js`, fix the bug, and run `node sum.test.mjs`.
3. Require exit code zero and a successful JSON envelope. Inspect `sum.js` and
   independently execute `node sum.test.mjs`. Check the second response uses
   the expected session ID.
4. Confirm logs and reports are outside the checkout. Remove the fixture only
   after collecting results; never include credentials or raw account output
   in a public issue.

The PowerShell background-job example can run step 1 to verify argument-array
handling, stdin completion, output redirection, and exit-code capture together.

## Observations during development

- The final full-access flags completed a review through the documented
  PowerShell background job. Its output, exit-code file, and JSON were collected
  successfully; the review left the fixture's source unchanged.
- Resuming that exact full-access session edited the deliberately restored
  subtraction bug and ran the tests successfully. The parent independently ran
  the tests with exit code zero and confirmed the same session ID was returned.
- The requested high/non-fast model is present as a distinct ID from its fast
  counterpart.
- An initial Ask-mode review identified the bug and left the fixture unchanged.
- Resuming that Ask-mode session with `--force` returned success but refused to
  edit, and the fixture tests still failed. This establishes the documented
  legacy-session caveat and the need to inspect files and tests.
- A fresh implementation session with `--force` changed only the addition
  expression. Its test command and an independent parent run both exited zero.

These initial permission-mode probes are distinct from the final policy:
the published skill always uses YOLO, disabled sandbox, and workspace trust.

## Distribution checks

`python scripts/validate.py` checks the local bundle. `npx skills add . --list`
must find exactly one skill. Validate the skill and plugin with Codex's authoring
validators when available, then exercise both install methods as documented in
[DISTRIBUTION.md](DISTRIBUTION.md).

Local discovery found one skill. A real skills CLI installation into a disposable
project included the skill, its PowerShell reference, and its UI metadata.
Codex CLI accepted the repository marketplace and installed the plugin with
`codex plugin add cursor-subagents@cursor-subagents`.

CI runs structural checks and skills discovery on Linux and Windows without
calling Cursor. Live Cursor execution on macOS, Linux, and WSL is not verified
by these checks. Cursor quota exhaustion, explicit deny rules, forced
cancellation, and concurrent write integration require separate behavioral tests.
