import { spawn } from "node:child_process";

export const DEFAULT_MODEL = "composer-2.5";
export const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

export function cursorBinary() {
  return process.env.CURSOR_AGENT_BIN || "cursor-agent";
}

export function runCommand(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr || error.message, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

export function parseStreamJson(stdout) {
  const assistantMessages = [];
  const toolCalls = [];
  let finalResult = null;
  let init = null;
  let eventCount = 0;

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    eventCount += 1;
    try {
      const event = JSON.parse(line);
      if (event.type === "system" && event.subtype === "init") init = event;
      if (event.type === "assistant") {
        const text = event.message?.content?.map((part) => part.text || "").join("") || "";
        if (text) assistantMessages.push(text);
      }
      if (event.type === "tool_call") toolCalls.push(event);
      if (event.type === "result") finalResult = event;
    } catch {
      // Cursor can occasionally emit non-JSON diagnostics despite stream-json.
    }
  }

  return {
    init,
    finalResult,
    assistantText: finalResult?.result || assistantMessages.join(""),
    eventCount,
    toolCallCount: toolCalls.length,
  };
}

export async function listModels({ includeModels = false, filter = "", limit = 50 } = {}) {
  const result = await runCommand(cursorBinary(), ["--list-models"], { timeoutMs: 60_000 });
  let models = [];
  try {
    models = JSON.parse(result.stdout);
  } catch {
    models = result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(" - ");
        return separator > 0
          ? { id: line.slice(0, separator).trim(), name: line.slice(separator + 3).trim() }
          : { id: line };
      });
  }

  const loweredFilter = filter.toLowerCase();
  const filtered = loweredFilter
    ? models.filter((model) => JSON.stringify(model).toLowerCase().includes(loweredFilter))
    : models;
  const recommendedModels = models
    .filter((model) => typeof model.id === "string")
    .filter((model) => (
      model.id === DEFAULT_MODEL ||
      model.id === "composer-2.5-fast" ||
      model.id.startsWith("gpt-5.3-codex")
    ))
    .slice(0, 12);

  return {
    ok: result.code === 0,
    defaultModel: DEFAULT_MODEL,
    modelCount: models.length,
    recommendedModels,
    models: includeModels ? filtered.slice(0, limit) : undefined,
    truncated: includeModels ? filtered.length > limit : undefined,
    stderr: result.stderr.trim(),
  };
}

export async function doctor({ json = false } = {}) {
  const version = await runCommand(cursorBinary(), ["--version"], { timeoutMs: 30_000 });
  const status = await runCommand(cursorBinary(), ["status"], { timeoutMs: 30_000 });
  const result = {
    ok: version.code === 0,
    cursorBinary: cursorBinary(),
    defaultModel: DEFAULT_MODEL,
    version: version.stdout.trim() || null,
    authenticated: status.code === 0,
    status: status.stdout.trim(),
    stderr: [version.stderr.trim(), status.stderr.trim()].filter(Boolean).join("\n"),
  };
  return json ? result : [
    `cursor_binary: ${result.cursorBinary}`,
    `default_model: ${result.defaultModel}`,
    `version: ${result.version || "(unavailable)"}`,
    `authenticated: ${result.authenticated}`,
  ].join("\n");
}

export async function runOnce(input) {
  const cwd = input.cwd || process.cwd();
  const model = input.model || DEFAULT_MODEL;
  const mode = input.mode || "agent";
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--stream-partial-output",
    "--workspace",
    cwd,
    "--model",
    model,
  ];

  if (input.trust !== false) args.push("--trust");
  if (input.yolo !== false) args.push("--yolo");
  if (input.approveMcps === true) args.push("--approve-mcps");
  if (input.sandbox === "enabled" || input.sandbox === "disabled") args.push("--sandbox", input.sandbox);
  if (mode === "plan" || mode === "ask") args.push("--mode", mode);
  if (Array.isArray(input.extraArgs)) args.push(...input.extraArgs.map(String));
  args.push(input.prompt);

  const startedAt = Date.now();
  const result = await runCommand(cursorBinary(), args, {
    cwd,
    timeoutMs: input.timeoutMs || DEFAULT_TIMEOUT_MS,
  });
  const parsed = parseStreamJson(result.stdout);
  return {
    ok: result.code === 0 && !result.timedOut,
    mode: "headless",
    model,
    cwd,
    exitCode: result.code,
    timedOut: result.timedOut,
    durationMs: Date.now() - startedAt,
    sessionId: parsed.finalResult?.session_id || parsed.init?.session_id || null,
    requestId: parsed.finalResult?.request_id || null,
    text: parsed.assistantText,
    eventCount: parsed.eventCount,
    toolCallCount: parsed.toolCallCount,
    stderr: result.stderr.trim(),
  };
}
