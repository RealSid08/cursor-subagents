import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

const require = createRequire(import.meta.url);
const DEFAULT_MODEL = "composer-2.5";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

function resolveMcpCommand() {
  if (process.env.CURSOR_SUBAGENTS_BIN) {
    return { command: process.env.CURSOR_SUBAGENTS_BIN, args: ["mcp"] };
  }

  const packageJson = require.resolve("cursor-subagents/package.json");
  return {
    command: process.execPath,
    args: [join(dirname(packageJson), "bin", "cursor-subagents.mjs"), "mcp"],
  };
}

class CursorSubagentsMcpClient {
  constructor() {
    this.child = null;
    this.nextId = 1;
    this.pending = new Map();
    this.ready = null;
  }

  async ensureStarted() {
    if (this.ready) return this.ready;

    this.ready = new Promise((resolve, reject) => {
      const { command, args } = resolveMcpCommand();
      this.child = spawn(command, args, {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stderr = "";
      this.child.stderr.on("data", (chunk) => { stderr += String(chunk); });
      this.child.on("error", reject);
      this.child.on("close", (code, signal) => {
        for (const pending of this.pending.values()) {
          pending.reject(new Error(`cursor-subagents MCP exited (${code ?? signal})`));
        }
        this.pending.clear();
        this.ready = null;
      });

      const lines = createInterface({ input: this.child.stdout });
      lines.on("line", (line) => this.handleLine(line));

      this.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "pi-cursor-subagents", version: "0.1.0" },
      }, 30000)
        .then(() => {
          this.notify("notifications/initialized", {});
          resolve();
        })
        .catch((error) => reject(new Error(`${error.message}${stderr ? `\n${stderr.trim()}` : ""}`)));
    });

    return this.ready;
  }

  handleLine(line) {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
    else pending.resolve(message.result);
  }

  request(method, params, timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (!this.child) throw new Error("cursor-subagents MCP is not running");
    const id = this.nextId++;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);

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
          reject(error);
        },
      });
    });
  }

  notify(method, params) {
    if (!this.child) return;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async callTool(name, args = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    await this.ensureStarted();
    const result = await this.request("tools/call", { name, arguments: args }, timeoutMs);
    const text = result?.content?.find((part) => part.type === "text")?.text;
    if (!text) return result;
    try {
      return JSON.parse(text);
    } catch {
      return { ok: true, text };
    }
  }

  stop() {
    if (this.child && !this.child.killed) {
      this.child.stdin.end();
      this.child.kill("SIGTERM");
    }
    this.child = null;
    this.ready = null;
  }
}

const optionalString = (description) => Type.Optional(Type.String({ description }));
const optionalNumber = (description) => Type.Optional(Type.Number({ description }));
const optionalBoolean = (description) => Type.Optional(Type.Boolean({ description }));
const modeSchema = Type.Optional(StringEnum(["agent", "plan", "ask"], { description: "Cursor execution mode." }));
const sandboxSchema = Type.Optional(StringEnum(["enabled", "disabled"], { description: "Cursor sandbox override." }));

function result(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
    isError: payload?.ok === false,
  };
}

export default function cursorSubagents(pi) {
  const client = new CursorSubagentsMcpClient();

  pi.registerTool({
    name: "cursor_run_once",
    label: "Cursor Run Once",
    description: "Run one headless Cursor Agent subagent task. Defaults to composer-2.5, yolo, trust, stream-json, and the active Pi workspace.",
    promptSnippet: "Delegate a bounded implementation, review, or investigation task to Cursor Agent.",
    promptGuidelines: [
      "Use cursor_run_once for independent subagent work that does not need follow-up context.",
      "Pass mode ask or plan and yolo false for read-only delegation.",
    ],
    parameters: Type.Object({
      prompt: Type.String({ description: "Bounded task for the Cursor subagent." }),
      cwd: optionalString("Workspace directory. Defaults to Pi's current cwd."),
      model: optionalString("Cursor model id. Defaults to composer-2.5."),
      mode: modeSchema,
      yolo: optionalBoolean("Whether to pass Cursor --yolo. Defaults to true."),
      trust: optionalBoolean("Whether to pass Cursor --trust. Defaults to true."),
      approveMcps: optionalBoolean("Whether to approve Cursor MCP servers."),
      sandbox: sandboxSchema,
      timeoutMs: optionalNumber("Timeout in milliseconds."),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const payload = await client.callTool("cursor_run_once", {
        ...params,
        cwd: params.cwd || ctx?.cwd || process.cwd(),
        model: params.model || DEFAULT_MODEL,
      }, params.timeoutMs || DEFAULT_TIMEOUT_MS);
      return result(payload);
    },
  });

  pi.registerTool({
    name: "cursor_start_agent",
    label: "Cursor Start Agent",
    description: "Start a persistent live Cursor ACP subagent session for follow-up prompts.",
    promptSnippet: "Start a live Cursor ACP subagent when the task benefits from a persistent side session.",
    parameters: Type.Object({
      name: optionalString("Human-readable subagent name."),
      cwd: optionalString("Workspace directory. Defaults to Pi's current cwd."),
      model: optionalString("Cursor model id. Defaults to composer-2.5."),
      mode: modeSchema,
      autoApprove: optionalBoolean("Auto-approve Cursor ACP permission requests. Defaults to true."),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const payload = await client.callTool("cursor_start_agent", {
        ...params,
        cwd: params.cwd || ctx?.cwd || process.cwd(),
        model: params.model || DEFAULT_MODEL,
      });
      return result(payload);
    },
  });

  pi.registerTool({
    name: "cursor_prompt_agent",
    label: "Cursor Prompt Agent",
    description: "Send a follow-up prompt to a live Cursor ACP subagent session.",
    parameters: Type.Object({
      agentId: Type.String({ description: "Agent id returned by cursor_start_agent or cursor_spawn_task." }),
      prompt: Type.String({ description: "Follow-up task or question." }),
      timeoutMs: optionalNumber("Timeout in milliseconds."),
    }),
    async execute(_toolCallId, params) {
      const payload = await client.callTool("cursor_prompt_agent", params, params.timeoutMs || DEFAULT_TIMEOUT_MS);
      return result(payload);
    },
  });

  pi.registerTool({
    name: "cursor_spawn_task",
    label: "Cursor Spawn Task",
    description: "Start a live Cursor ACP subagent, send one prompt, and keep it alive by default for follow-ups.",
    promptSnippet: "Spawn a Cursor subagent and keep the ACP session alive for iterative follow-up.",
    promptGuidelines: [
      "Prefer cursor_spawn_task when you want Cursor to inspect or edit in parallel and then receive follow-ups.",
      "Use the returned agentId with cursor_prompt_agent.",
    ],
    parameters: Type.Object({
      prompt: Type.String({ description: "Bounded task for the Cursor subagent." }),
      name: optionalString("Human-readable subagent name."),
      cwd: optionalString("Workspace directory. Defaults to Pi's current cwd."),
      model: optionalString("Cursor model id. Defaults to composer-2.5."),
      mode: modeSchema,
      autoApprove: optionalBoolean("Auto-approve Cursor ACP permission requests. Defaults to true."),
      keepAlive: optionalBoolean("Keep the ACP session alive for follow-ups. Defaults to true."),
      timeoutMs: optionalNumber("Timeout in milliseconds."),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const payload = await client.callTool("cursor_spawn_task", {
        ...params,
        cwd: params.cwd || ctx?.cwd || process.cwd(),
        model: params.model || DEFAULT_MODEL,
      }, params.timeoutMs || DEFAULT_TIMEOUT_MS);
      return result(payload);
    },
  });

  pi.registerTool({
    name: "cursor_list_agents",
    label: "Cursor List Agents",
    description: "List live Cursor ACP subagent sessions managed by this Pi extension process.",
    parameters: Type.Object({}),
    async execute() {
      const payload = await client.callTool("cursor_list_agents", {});
      return result(payload);
    },
  });

  pi.registerTool({
    name: "cursor_stop_agent",
    label: "Cursor Stop Agent",
    description: "Stop a live Cursor ACP subagent session.",
    parameters: Type.Object({
      agentId: Type.String({ description: "Agent id returned by cursor_start_agent or cursor_spawn_task." }),
    }),
    async execute(_toolCallId, params) {
      const payload = await client.callTool("cursor_stop_agent", params);
      return result(payload);
    },
  });

  pi.registerTool({
    name: "cursor_list_models",
    label: "Cursor List Models",
    description: "List recommended Cursor model ids and optionally include the full model list.",
    parameters: Type.Object({
      includeModels: optionalBoolean("Include full model list. Defaults to false."),
      filter: optionalString("Case-insensitive filter over model ids and names."),
      limit: optionalNumber("Maximum model records when includeModels is true."),
    }),
    async execute(_toolCallId, params) {
      const payload = await client.callTool("cursor_list_models", params);
      return result(payload);
    },
  });

  pi.on("session_shutdown", async () => {
    client.stop();
  });
}
