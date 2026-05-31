import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { tool } from "@opencode-ai/plugin";

const DEFAULT_MODEL = "composer-2.5";
const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const NPX_SPEC = process.env.CURSOR_SUBAGENTS_NPX_SPEC || "__CURSOR_SUBAGENTS_NPX_SPEC__";

function resolveMcpCommand() {
  if (process.env.CURSOR_SUBAGENTS_BIN) {
    return { command: process.env.CURSOR_SUBAGENTS_BIN, args: ["mcp"] };
  }
  return {
    command: process.env.CURSOR_SUBAGENTS_NPX || "npx",
    args: ["-y", NPX_SPEC, "mcp"],
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
        clientInfo: { name: "opencode-cursor-subagents-local", version: "0.1.0" },
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

function output(title, payload) {
  return {
    title,
    output: JSON.stringify(payload, null, 2),
    metadata: {
      ok: payload?.ok,
      agentId: payload?.agentId,
      sessionId: payload?.sessionId,
      model: payload?.model,
    },
  };
}

const optionalString = (description) => tool.schema.string().optional().describe(description);
const optionalNumber = (description) => tool.schema.number().optional().describe(description);
const optionalBoolean = (description) => tool.schema.boolean().optional().describe(description);

export const CursorSubagents = async () => {
  const client = new CursorSubagentsMcpClient();
  const cwdFor = (args, context) => args.cwd || context.worktree || context.directory;
  const modelFor = (args) => args.model || DEFAULT_MODEL;

  return {
    dispose: async () => client.stop(),
    tool: {
      cursor_run_once: tool({
        description: "Run one headless Cursor Agent subagent task. Defaults to composer-2.5, yolo, trust, stream-json, and the current OpenCode worktree.",
        args: {
          prompt: tool.schema.string().describe("Bounded task for the Cursor subagent."),
          cwd: optionalString("Workspace directory. Defaults to the current OpenCode worktree or directory."),
          model: optionalString("Cursor model id. Defaults to composer-2.5."),
          mode: tool.schema.enum(["agent", "plan", "ask"]).optional().describe("Execution mode. Use ask or plan for read-only review."),
          yolo: optionalBoolean("Whether to pass Cursor --yolo. Defaults to true."),
          trust: optionalBoolean("Whether to pass Cursor --trust. Defaults to true."),
          approveMcps: optionalBoolean("Whether to approve Cursor MCP servers."),
          sandbox: tool.schema.enum(["enabled", "disabled"]).optional().describe("Cursor sandbox override."),
          timeoutMs: optionalNumber("Timeout in milliseconds."),
        },
        async execute(args, context) {
          const payload = await client.callTool("cursor_run_once", {
            ...args,
            cwd: cwdFor(args, context),
            model: modelFor(args),
          }, args.timeoutMs || DEFAULT_TIMEOUT_MS);
          return output("Cursor run", payload);
        },
      }),
      cursor_start_agent: tool({
        description: "Start a persistent live Cursor ACP subagent session for follow-up prompts.",
        args: {
          name: optionalString("Human-readable subagent name."),
          cwd: optionalString("Workspace directory. Defaults to the current OpenCode worktree or directory."),
          model: optionalString("Cursor model id. Defaults to composer-2.5."),
          mode: tool.schema.enum(["agent", "plan", "ask"]).optional().describe("Execution mode."),
          autoApprove: optionalBoolean("Auto-approve Cursor ACP permission requests. Defaults to true."),
        },
        async execute(args, context) {
          const payload = await client.callTool("cursor_start_agent", {
            ...args,
            cwd: cwdFor(args, context),
            model: modelFor(args),
          });
          return output("Cursor ACP agent", payload);
        },
      }),
      cursor_prompt_agent: tool({
        description: "Send a follow-up prompt to a live Cursor ACP subagent session.",
        args: {
          agentId: tool.schema.string().describe("Agent id returned by cursor_start_agent or cursor_spawn_task."),
          prompt: tool.schema.string().describe("Follow-up task or question."),
          timeoutMs: optionalNumber("Timeout in milliseconds."),
        },
        async execute(args) {
          const payload = await client.callTool("cursor_prompt_agent", args, args.timeoutMs || DEFAULT_TIMEOUT_MS);
          return output("Cursor ACP response", payload);
        },
      }),
      cursor_spawn_task: tool({
        description: "Start a live Cursor ACP subagent, send one prompt, and keep it alive by default for follow-ups.",
        args: {
          prompt: tool.schema.string().describe("Bounded task for the Cursor subagent."),
          name: optionalString("Human-readable subagent name."),
          cwd: optionalString("Workspace directory. Defaults to the current OpenCode worktree or directory."),
          model: optionalString("Cursor model id. Defaults to composer-2.5."),
          mode: tool.schema.enum(["agent", "plan", "ask"]).optional().describe("Execution mode."),
          autoApprove: optionalBoolean("Auto-approve Cursor ACP permission requests. Defaults to true."),
          keepAlive: optionalBoolean("Keep the ACP session alive for follow-ups. Defaults to true."),
          timeoutMs: optionalNumber("Timeout in milliseconds."),
        },
        async execute(args, context) {
          const payload = await client.callTool("cursor_spawn_task", {
            ...args,
            cwd: cwdFor(args, context),
            model: modelFor(args),
          }, args.timeoutMs || DEFAULT_TIMEOUT_MS);
          return output("Cursor ACP task", payload);
        },
      }),
      cursor_list_agents: tool({
        description: "List live Cursor ACP subagent sessions managed by this OpenCode plugin process.",
        args: {},
        async execute() {
          const payload = await client.callTool("cursor_list_agents", {});
          return output("Cursor ACP agents", payload);
        },
      }),
      cursor_stop_agent: tool({
        description: "Stop a live Cursor ACP subagent session.",
        args: {
          agentId: tool.schema.string().describe("Agent id returned by cursor_start_agent or cursor_spawn_task."),
        },
        async execute(args) {
          const payload = await client.callTool("cursor_stop_agent", args);
          return output("Cursor ACP stopped", payload);
        },
      }),
      cursor_list_models: tool({
        description: "List recommended Cursor model ids and optionally include the full model list.",
        args: {
          includeModels: optionalBoolean("Include full model list. Defaults to false."),
          filter: optionalString("Case-insensitive filter over model ids and names."),
          limit: optionalNumber("Maximum model records when includeModels is true."),
        },
        async execute(args) {
          const payload = await client.callTool("cursor_list_models", args);
          return output("Cursor models", payload);
        },
      }),
    },
  };
};
