#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";

const DEFAULT_MODEL = "composer-2.5";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const serverStart = Date.now();
const agents = new Map();

function findCursorBinary() {
  return process.env.CURSOR_AGENT_BIN || "cursor-agent";
}

function ok(content) {
  return { content: [{ type: "text", text: JSON.stringify(content, null, 2) }] };
}

function err(message, extra = {}) {
  return ok({ ok: false, error: message, ...extra });
}

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  send({ jsonrpc: "2.0", id, error: { code, message, data } });
}

function gitSnapshot(cwd) {
  return new Promise((resolve) => {
    const child = spawn("git", ["status", "--short"], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolve({ available: false, error: error.message, status: [] }));
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ available: false, error: stderr.trim() || `git exited ${code}`, status: [] });
        return;
      }
      const status = out.split("\n").map((line) => line.trimEnd()).filter(Boolean);
      resolve({ available: true, status });
    });
  });
}

function diffStatus(before, after) {
  const beforeSet = new Set(before.status || []);
  return (after.status || []).filter((line) => !beforeSet.has(line));
}

function runCommand(command, args, options = {}) {
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
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
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

function parseStreamJson(stdout) {
  const events = [];
  const assistantMessages = [];
  const toolCalls = [];
  let finalResult = null;
  let init = null;

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      events.push(event);
      if (event.type === "system" && event.subtype === "init") init = event;
      if (event.type === "assistant") {
        const text = event.message?.content?.map((part) => part.text || "").join("") || "";
        if (text) assistantMessages.push(text);
      }
      if (event.type === "tool_call") toolCalls.push(event);
      if (event.type === "result") finalResult = event;
    } catch {
      events.push({ type: "unparsed", line });
    }
  }

  return {
    init,
    finalResult,
    assistantText: finalResult?.result || assistantMessages.join(""),
    eventCount: events.length,
    toolCallCount: toolCalls.length,
    toolCalls,
  };
}

async function cursorRunOnce(input) {
  const cwd = input.cwd || process.cwd();
  const prompt = input.prompt;
  if (!prompt || typeof prompt !== "string") return err("prompt is required");

  const model = input.model || DEFAULT_MODEL;
  const mode = input.mode || "agent";
  const timeoutMs = input.timeoutMs || DEFAULT_TIMEOUT_MS;
  const before = await gitSnapshot(cwd);
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
  args.push(prompt);

  const startedAt = Date.now();
  const result = await runCommand(findCursorBinary(), args, { cwd, timeoutMs });
  const after = await gitSnapshot(cwd);
  const parsed = parseStreamJson(result.stdout);

  return ok({
    ok: result.code === 0 && !result.timedOut,
    mode: "headless",
    command: findCursorBinary(),
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
    gitStatus: after,
    newGitStatusLines: diffStatus(before, after),
    stderr: result.stderr.trim(),
  });
}

class AcpAgent {
  constructor(input = {}) {
    this.id = input.agentId || `cursor-${randomUUID().slice(0, 8)}`;
    this.name = input.name || this.id;
    this.cwd = input.cwd || process.cwd();
    this.model = input.model || DEFAULT_MODEL;
    this.mode = input.mode || "agent";
    this.autoApprove = input.autoApprove !== false;
    this.createdAt = Date.now();
    this.lastActiveAt = this.createdAt;
    this.events = [];
    this.pending = new Map();
    this.nextId = 1;
    this.sessionId = null;
    this.ready = false;
    this.closed = false;
    this.warnings = [];
    this.promptBuffer = [];
    this.child = null;
  }

  async start() {
    const args = ["--model", this.model, "acp"];
    this.child = spawn(findCursorBinary(), args, {
      cwd: this.cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      if (text.trim()) this.events.push({ type: "stderr", text, at: Date.now() });
    });
    this.child.on("close", (code, signal) => {
      this.closed = true;
      this.events.push({ type: "close", code, signal, at: Date.now() });
    });
    this.child.on("error", (error) => {
      this.closed = true;
      this.events.push({ type: "error", message: error.message, at: Date.now() });
    });

    const rl = createInterface({ input: this.child.stdout });
    rl.on("line", (line) => this.handleLine(line));

    await this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: "codex-cursor-subagents", version: "0.1.0" },
    });
    await this.request("authenticate", { methodId: "cursor_login" });
    const session = await this.request("session/new", { cwd: this.cwd, mcpServers: [] });
    this.sessionId = session.sessionId;
    this.session = session;
    await this.setConfigBestEffort("mode", this.mode);
    this.ready = true;
    return this.summary();
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.events.push({ type: "unparsed", line, at: Date.now() });
      return;
    }

    if (message.id && (message.result || message.error)) {
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        message.error ? pending.reject(message.error) : pending.resolve(message.result);
      }
      return;
    }

    if (message.id && message.method === "session/request_permission") {
      this.respondPermission(message);
      return;
    }

    if (message.method === "session/update") {
      this.lastActiveAt = Date.now();
      const update = message.params?.update;
      const text = update?.content?.text || update?.message?.content?.map?.((part) => part.text || "").join("") || "";
      if (text && String(update?.sessionUpdate || "").includes("agent_message")) {
        this.promptBuffer.push(text);
      }
      this.events.push({ type: "session/update", update, at: Date.now() });
      return;
    }

    this.events.push({ type: "message", message, at: Date.now() });
  }

  respondPermission(message) {
    const options = message.params?.options || [];
    const allowOption = options.find((option) => option.kind === "allow_once")
      || options.find((option) => String(option.optionId || "").includes("allow"))
      || options[0];
    const rejectOption = options.find((option) => option.kind === "reject_once")
      || options.find((option) => String(option.optionId || "").includes("reject"))
      || options[0];
    const selected = this.autoApprove ? allowOption : rejectOption;
    this.events.push({
      type: "permission",
      autoApprove: this.autoApprove,
      selectedOptionId: selected?.optionId,
      at: Date.now(),
    });
    this.child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id: message.id,
      result: { outcome: { outcome: "selected", optionId: selected?.optionId } },
    })}\n`);
  }

  request(method, params, timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (!this.child || this.closed) return Promise.reject(new Error("ACP agent is not running"));
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(new Error(JSON.stringify(error)));
        },
      });
    });
  }

  async setConfigBestEffort(configId, value) {
    if (!value || value === "agent" && configId === "mode") return;
    try {
      await this.request("session/set_config_option", {
        sessionId: this.sessionId,
        configId,
        value,
      }, 15000);
    } catch (error) {
      this.warnings.push(`Could not set ACP ${configId}=${value}: ${error.message}`);
    }
  }

  async prompt(prompt, timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (!this.ready) throw new Error("ACP agent is not ready");
    const before = await gitSnapshot(this.cwd);
    this.promptBuffer = [];
    const startedAt = Date.now();
    const result = await this.request("session/prompt", {
      sessionId: this.sessionId,
      prompt: [{ type: "text", text: prompt }],
    }, timeoutMs);
    const after = await gitSnapshot(this.cwd);
    this.lastActiveAt = Date.now();
    return {
      ok: true,
      agentId: this.id,
      sessionId: this.sessionId,
      model: this.model,
      mode: this.mode,
      cwd: this.cwd,
      stopReason: result.stopReason || null,
      durationMs: Date.now() - startedAt,
      text: this.promptBuffer.join(""),
      result,
      warnings: this.warnings,
      gitStatus: after,
      newGitStatusLines: diffStatus(before, after),
      recentEvents: this.events.slice(-20),
    };
  }

  stop() {
    if (this.child && !this.closed) {
      this.child.stdin.end();
      this.child.kill("SIGTERM");
    }
    this.closed = true;
  }

  summary() {
    return {
      agentId: this.id,
      name: this.name,
      sessionId: this.sessionId,
      cwd: this.cwd,
      model: this.model,
      mode: this.mode,
      autoApprove: this.autoApprove,
      ready: this.ready,
      closed: this.closed,
      createdAt: new Date(this.createdAt).toISOString(),
      lastActiveAt: new Date(this.lastActiveAt).toISOString(),
      warnings: this.warnings,
    };
  }
}

async function startAgent(input = {}) {
  const agent = new AcpAgent(input);
  agents.set(agent.id, agent);
  try {
    const summary = await agent.start();
    return ok({ ok: true, ...summary });
  } catch (error) {
    agent.stop();
    agents.delete(agent.id);
    return err(error.message, { agentId: agent.id, recentEvents: agent.events.slice(-20) });
  }
}

async function promptAgent(input = {}) {
  const agent = agents.get(input.agentId);
  if (!agent) return err(`Unknown cursor agent: ${input.agentId}`);
  try {
    return ok(await agent.prompt(input.prompt, input.timeoutMs || DEFAULT_TIMEOUT_MS));
  } catch (error) {
    return err(error.message, { agentId: input.agentId, recentEvents: agent.events.slice(-20) });
  }
}

async function spawnTask(input = {}) {
  const start = await startAgent(input);
  const payload = JSON.parse(start.content[0].text);
  if (!payload.ok) return start;
  const result = await promptAgent({
    agentId: payload.agentId,
    prompt: input.prompt,
    timeoutMs: input.timeoutMs,
  });
  if (input.keepAlive === false) {
    const agent = agents.get(payload.agentId);
    if (agent) agent.stop();
    agents.delete(payload.agentId);
  }
  return result;
}

async function listModels(input = {}) {
  const result = await runCommand(findCursorBinary(), ["models"], { timeoutMs: 30000 });
  const models = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Available models") && !line.startsWith("Tip:"))
    .map((line) => {
      const match = line.match(/^([^ ]+)\s+-\s+(.+)$/);
      return match ? { id: match[1], name: match[2] } : { raw: line };
    });

  const filter = typeof input.filter === "string" ? input.filter.toLowerCase() : "";
  const filtered = filter
    ? models.filter((model) => JSON.stringify(model).toLowerCase().includes(filter))
    : models;
  const limit = Number.isFinite(input.limit) ? Math.max(1, Number(input.limit)) : 50;
  const includeModels = input.includeModels === true;
  const recommendedModels = models
    .filter((model) => typeof model.id === "string")
    .filter((model) => model.id === DEFAULT_MODEL || model.id === "composer-2.5-fast" || model.id.startsWith("gpt-5.3-codex"))
    .slice(0, 12);

  return ok({
    ok: result.code === 0,
    defaultModel: DEFAULT_MODEL,
    modelCount: models.length,
    recommendedModels,
    models: includeModels ? filtered.slice(0, limit) : undefined,
    truncated: includeModels ? filtered.length > limit : undefined,
    stderr: result.stderr.trim(),
  });
}

const tools = [
  {
    name: "cursor_run_once",
    description: "Run one headless Cursor subagent task with sensible defaults. Uses --yolo, --trust, stream-json, and composer-2.5 unless overridden.",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string" },
        cwd: { type: "string", description: "Workspace directory. Defaults to the MCP server cwd." },
        model: { type: "string", default: DEFAULT_MODEL },
        mode: { type: "string", enum: ["agent", "plan", "ask"], default: "agent" },
        yolo: { type: "boolean", default: true },
        trust: { type: "boolean", default: true },
        approveMcps: { type: "boolean", default: false },
        sandbox: { type: "string", enum: ["enabled", "disabled"] },
        timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
        extraArgs: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "cursor_start_agent",
    description: "Start a live Cursor ACP subagent session that can receive multiple prompts.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        cwd: { type: "string" },
        model: { type: "string", default: DEFAULT_MODEL },
        mode: { type: "string", enum: ["agent", "plan", "ask"], default: "agent" },
        autoApprove: { type: "boolean", default: true },
      },
    },
  },
  {
    name: "cursor_prompt_agent",
    description: "Send a follow-up prompt to a live Cursor ACP subagent session.",
    inputSchema: {
      type: "object",
      required: ["agentId", "prompt"],
      properties: {
        agentId: { type: "string" },
        prompt: { type: "string" },
        timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
      },
    },
  },
  {
    name: "cursor_spawn_task",
    description: "Start a live Cursor ACP subagent, send one prompt, and keep it alive by default for follow-ups.",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string" },
        name: { type: "string" },
        cwd: { type: "string" },
        model: { type: "string", default: DEFAULT_MODEL },
        mode: { type: "string", enum: ["agent", "plan", "ask"], default: "agent" },
        autoApprove: { type: "boolean", default: true },
        keepAlive: { type: "boolean", default: true },
        timeoutMs: { type: "number", default: DEFAULT_TIMEOUT_MS },
      },
    },
  },
  {
    name: "cursor_list_agents",
    description: "List live Cursor ACP subagent sessions managed by this MCP server.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "cursor_stop_agent",
    description: "Stop a live Cursor ACP subagent session.",
    inputSchema: {
      type: "object",
      required: ["agentId"],
      properties: { agentId: { type: "string" } },
    },
  },
  {
    name: "cursor_list_models",
    description: "Report the plugin default model and, when requested, list Cursor CLI models with optional filtering.",
    inputSchema: {
      type: "object",
      properties: {
        includeModels: { type: "boolean", default: false },
        filter: { type: "string", description: "Optional case-insensitive filter over model ids and names." },
        limit: { type: "number", default: 50 },
      },
    },
  },
];

async function callTool(name, args) {
  if (name === "cursor_run_once") return cursorRunOnce(args || {});
  if (name === "cursor_start_agent") return startAgent(args || {});
  if (name === "cursor_prompt_agent") return promptAgent(args || {});
  if (name === "cursor_spawn_task") return spawnTask(args || {});
  if (name === "cursor_list_agents") {
    return ok({ ok: true, uptimeMs: Date.now() - serverStart, agents: [...agents.values()].map((agent) => agent.summary()) });
  }
  if (name === "cursor_stop_agent") {
    const agent = agents.get(args?.agentId);
    if (!agent) return err(`Unknown cursor agent: ${args?.agentId}`);
    agent.stop();
    agents.delete(args.agentId);
    return ok({ ok: true, stopped: args.agentId });
  }
  if (name === "cursor_list_models") return listModels(args || {});
  return err(`Unknown tool: ${name}`);
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }

  try {
    if (request.method === "initialize") {
      sendResult(request.id, {
        protocolVersion: request.params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "cursor-subagents", version: "0.1.0" },
      });
      return;
    }
    if (request.method === "notifications/initialized") return;
    if (request.method === "tools/list") {
      sendResult(request.id, { tools });
      return;
    }
    if (request.method === "tools/call") {
      const result = await callTool(request.params?.name, request.params?.arguments || {});
      sendResult(request.id, result);
      return;
    }
    if (request.id) sendError(request.id, -32601, `Unknown method: ${request.method}`);
  } catch (error) {
    if (request.id) sendError(request.id, -32000, error.message);
  }
});

process.on("SIGTERM", () => {
  for (const agent of agents.values()) agent.stop();
  process.exit(0);
});
