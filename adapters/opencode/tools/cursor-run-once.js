import { tool } from "@opencode-ai/plugin";

export default tool({
  description: "Run Cursor Agent once as a write-capable Cursor subagent.",
  args: {
    prompt: tool.schema.string().describe("Bounded task for the Cursor subagent"),
    model: tool.schema.string().optional().describe("Cursor model id, default composer-2.5"),
    mode: tool.schema.enum(["agent", "ask", "plan"]).optional().describe("Cursor execution mode"),
    yolo: tool.schema.boolean().optional().describe("Allow write-capable yolo execution, default true"),
  },
  async execute(args, context) {
    const command = [
      "npx",
      "-y",
      "cursor-subagents",
      "run",
      "--json",
      "--workspace",
      context.worktree || context.directory,
      "--model",
      args.model || "composer-2.5",
      "--mode",
      args.mode || "agent",
      args.yolo === false ? "--no-yolo" : "--yolo",
      "--prompt",
      args.prompt,
    ];
    const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) return `cursor-subagents failed (${exitCode}):\n${stderr || stdout}`;
    return stdout.trim();
  },
});
