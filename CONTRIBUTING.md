# Contributing

This project teaches an agent to use Cursor CLI directly. Keep that boundary:
changes should improve delegation, verification, or installability. New servers,
protocol bridges, automatic retries, and provider abstractions are outside scope.

The canonical skill is
`plugins/cursor-subagents/skills/cursor-subagents/SKILL.md`. Put Windows-specific
detail in its PowerShell reference. Update user documentation when behavior or
installation changes. Preserve the MIT license and existing attribution.

## Checks

Python 3.10+ runs the bundle validator using only its standard library:

```sh
python scripts/validate.py
git diff --check
```

Node.js/npm is needed only to test the external skills installer:

```sh
npx --yes skills@1.5.23 add . --list
```

The validator checks structural metadata, unique skill discovery, paths, and
relative Markdown links. It is not a full Agent Skills schema validator and does
not prove model behavior. The real installer checks discovery; maintainers also
validate with the Codex skill/plugin authoring tools when available.

For behavioral changes, use an isolated fixture and follow
[VERIFICATION.md](docs/VERIFICATION.md). Report platform, Cursor CLI version,
model ID, commands, exit codes, and observed file/test results. Do not commit
raw session logs, account identifiers, credentials, or machine-specific paths.

Open an issue for a reproducible bug or send a focused pull request. Distinguish
what you tested from what official documentation says should work.
