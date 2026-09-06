# Distribution

## One source, two installers

```text
.agents/plugins/marketplace.json
plugins/cursor-subagents/
  .codex-plugin/plugin.json
  skills/cursor-subagents/
    SKILL.md
    agents/openai.yaml
    references/powershell.md
```

The marketplace resolves `./plugins/cursor-subagents` from the repository root.
The plugin loads `./skills/`. The skills CLI also discovers the nested skill.
There are no generated copies, symlinks, npm packages, or runtime dependencies.

## Codex marketplace

Public repository installation:

```sh
codex plugin marketplace add RealSid08/cursor-subagents
codex plugin add cursor-subagents@cursor-subagents
```

Local authoring, from the repository root:

```sh
codex plugin marketplace add .
codex plugin add cursor-subagents@cursor-subagents
```

Choose the intended source; both advertise the same marketplace name. Inspect
`codex plugin marketplace list` before switching between local and Git sources.
Use `codex plugin list` to confirm the plugin, then start a new task to load it.

This is a repository-backed marketplace, not an OpenAI endorsement. The public
OpenAI directory has a separate
[submission process](https://learn.chatgpt.com/docs/submit-plugins).
Its acceptance and visibility are controlled by OpenAI. Do not claim that a
successful local install means that public review has passed.

## skills.sh

Validate discovery:

```sh
npx skills add . --list
```

Test installation from a disposable project directory:

```sh
npx skills add /absolute/path/to/cursor-subagents --skill cursor-subagents --agent codex --yes
```

For the published repository, replace the path with `RealSid08/cursor-subagents`.
Inspect `.agents/skills/cursor-subagents/` in that disposable project and confirm
the skill, PowerShell reference, and UI metadata are present.

The [skills.sh directory](https://skills.sh/docs) derives rankings from CLI
installation telemetry. A valid public repository and working install command
make the skill distributable; discovery, indexing time, and ranking are external
service behavior. Do not fabricate installations to influence the leaderboard.
Developers can set `DISABLE_TELEMETRY=1` for local/CI checks.

## Release checks

1. Run `python scripts/validate.py` and the skills CLI discovery check.
2. Install the plugin and skill from disposable/local sources; inspect their
   installed content. Run the scenarios in [VERIFICATION.md](VERIFICATION.md)
   when changing launch instructions or supported Cursor behavior.
3. Review `git diff --check` and the full diff. Check that published examples use
   the intended model and contain no personal paths, credentials, or logs.
4. Update the plugin's semantic version for a release. Version 2.0.0 is the
   breaking replacement of the old runtime design. Push the reviewed change.
5. Validate both install paths from GitHub, not just the checkout. Announce only
   verified distribution status; public directory acceptance is a separate step.

The repository's CI validates the bundle and discovers the skill without a
Cursor login or paid model calls. Live execution is a maintainer check.
