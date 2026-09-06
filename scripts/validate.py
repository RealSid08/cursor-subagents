"""Check this instruction-only distribution; no network or third-party packages."""

import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def inside(base, relative):
    require(isinstance(relative, str) and relative.startswith("./"),
            f"Expected ./ relative path: {relative!r}")
    target = (base / relative).resolve()
    require(target.is_relative_to(base.resolve()), f"Path escapes bundle: {relative}")
    require(target.exists(), f"Missing path: {target.relative_to(ROOT)}")
    return target


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    marketplace = read_json(ROOT / ".agents/plugins/marketplace.json")
    require(marketplace["name"] == "cursor-subagents", "Unexpected marketplace name")
    require(len(marketplace["plugins"]) == 1, "Expected one plugin")
    entry = marketplace["plugins"][0]
    require(entry["source"]["source"] == "local", "Expected repository-local plugin")
    require(entry["policy"]["installation"] == "AVAILABLE", "Plugin must be available")
    require(entry["policy"]["authentication"] in {"ON_INSTALL", "ON_USE"},
            "Invalid authentication policy")
    require(bool(entry["category"]), "Missing marketplace category")
    plugin_root = inside(ROOT, entry["source"]["path"])
    plugin = read_json(plugin_root / ".codex-plugin/plugin.json")
    require(plugin["name"] == entry["name"] == plugin_root.name, "Plugin names disagree")
    require(re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][\w.-]+)?", plugin["version"]),
            "Invalid release version")
    require(plugin["license"] == "MIT", "Unexpected license")
    require(bool(plugin["description"]) and bool(plugin["author"]["name"]),
            "Missing plugin metadata")
    for field in ("displayName", "shortDescription", "longDescription", "developerName", "category"):
        require(bool(plugin["interface"][field]), f"Missing interface {field}")
    prompts = plugin["interface"]["defaultPrompt"]
    require(isinstance(prompts, list) and 1 <= len(prompts) <= 3,
            "Expected one to three plugin prompts")
    require(all(isinstance(p, str) and 0 < len(p) <= 128 for p in prompts),
            "Invalid plugin prompt")
    require(not any(key in plugin for key in ("mcpServers", "apps", "hooks")),
            "Plugin should only bundle the skill")
    skills_root = inside(plugin_root, plugin["skills"])
    skill_files = list(ROOT.glob("**/SKILL.md"))
    expected = skills_root / "cursor-subagents/SKILL.md"
    require(skill_files == [expected], "Expected one canonical SKILL.md")
    skill = expected.read_text(encoding="utf-8")
    frontmatter = re.match(r"\A---\n(.*?)\n---\n", skill, re.S)
    require(frontmatter is not None, "Missing skill frontmatter")
    # This bundle uses simple, single-line YAML scalars. The real skills CLI
    # performs discovery separately; this is not a general YAML parser.
    fields = dict(line.split(": ", 1) for line in frontmatter[1].splitlines())
    require(fields["name"] == expected.parent.name, "Skill name differs from folder")
    require(0 < len(fields["description"]) <= 1024, "Invalid skill description")
    require(fields["license"] == "MIT", "Missing skill license")
    require((expected.parent / "agents/openai.yaml").is_file(), "Missing skill UI metadata")

    # Installed skills must be self-contained; repository docs may link anywhere
    # inside the repository. Ignore fenced example code and external URLs.
    for document in ROOT.glob("**/*.md"):
        if ".git" in document.parts:
            continue
        text = document.read_text(encoding="utf-8")
        prose = re.sub(r"^```[^\n]*\n.*?^```\s*$", "", text, flags=re.M | re.S)
        for href in re.findall(r"\[[^\]]*\]\(([^)]+)\)", prose):
            parsed = urlsplit(href)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            target = (document.parent / unquote(parsed.path)).resolve()
            boundary = expected.parent if document.is_relative_to(expected.parent) else ROOT
            require(target.is_relative_to(boundary), f"Link escapes bundle: {document}: {href}")
            require(target.exists(), f"Broken link: {document.relative_to(ROOT)}: {href}")
    require((ROOT / "LICENSE").is_file(), "Missing license")
    print("Valid: one skill, one Codex plugin, marketplace paths, metadata, and local links.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f"Validation failed: {error}", file=sys.stderr)
        sys.exit(1)
