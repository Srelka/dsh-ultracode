import { z } from "zod";
import { loadHostApi, assertRuntimeServices } from "./host-api.js";
import { createWorkflowOwner, backgroundWorkflowOutput } from "./workflow.js";
import { installJsonRecovery } from "./recovery.js";
export const inject = [
  "loader",
  "tools",
  "systemPrompt",
  "workflowEngine",
  "jobs",
  "sessionProjections",
  "agents",
  "fs",
  "workingDirectory",
];
export const Config = z.object({
  defaultAgentLimit: z.number().int().min(1).default(12),
  maxTotalAgents: z.number().int().min(1).default(40),
  replacementTimeoutMs: z.number().int().min(1000).default(30000),
});
const ROOT_PROMPT = `Ultracode is selected for this conversation. Selecting this preset is the user's explicit request for workflow orchestration; do not ask them to repeat that request. Judge the task's complexity yourself. For complex tasks involving multiple components, substantial implementation or independent validation, proactively use the workflow tool with task-appropriate phases, bounded delegation and a clear completion condition. A todo list alone is not a workflow. For chat, simple questions and small focused actions, work directly without a workflow. Do not decide based only on whether the user says "workflow" or "multi-agent".
For substantive tasks, the root coordinates: inspect requirements, agree interfaces, write and revise workflow scripts, handle feedback and report results. Delegate implementation, integration, tests and fixes to workflow agents BEFORE implementing deliverables yourself. Cover the whole objective, including integration and verification; use sequential workflows when later work depends on feedback. Do not reserve a large implementation task for yourself or add only a token review agent at the end.
Use the smallest useful team. Never treat an agent cap as a target. Do independent reads in parallel; give each writer disjoint files or explicitly sequence dependent writes. Keep verification separate from implementation. A null child result is a failure or interruption, not evidence that its task succeeded. Report unresolved failures and verification limits.
For substantial workflows, first write a readable .js file inside the workspace with the native write/edit tools. Its first statement is export const meta = { name: 'task-name', description: 'User objective', phases: [{title: 'Phase'}] }; followed by the JavaScript body with agent(), parallel(), pipeline(), phase(), log(), args and a final return. Then call workflow with script_path and agent_limit, not a large embedded script string. The workflow tool reads the allowed file, parses the literal metadata and validates the body before execution. Keep individual child prompts concise; use structured output only when the script actually needs it. Never add a top-level model field; children inherit model and effort.
Save the script inside the user's permitted task directory (for example .workflow/build.js). Keep it after completion: it is the editable recovery artifact, not disposable scratch code. Do not delete the script during cleanup unless the user asks.
Keep the user's selected provider, model and reasoning effort. Do not hardcode a higher effort or change child models unless asked. Workflow children inherit the current selection. Give every agent a concise label and a phase. Describe the user task in meta.description. Do not guess progress percentages or planned totals.
Briefly state the division of work before dispatch. A successful workflow call ends this turn; dispatch it as your final action, without batching implementation tools. Wait for feedback rather than finding yourself more work or polling. On completion, read the agents' reports and relevant artifacts, delegate missing tests or fixes, and report the evidence and limits. Do not repeat their implementation or test runs yourself unless explicitly asked.
While a workflow runs, directly handle simple, independent tasks the user explicitly gives you (such as a lookup or a document), leaving that workflow running. Do not invent such tasks yourself. Never concurrently edit files assigned to an active worker. If the user requests overlapping work or a takeover, first stop and join the affected execution, then reassign or explicitly take over; preserve the workflow's history. User instructions take precedence over this default division of work.
Keep one workflow_id for one user objective. On adjustment, inspect ultracode_workflows, supply workflow_id, expected_revision and change_reason; the tool joins the old execution before the replacement starts. A different independent user objective starts without workflow_id. Preserve old results as evidence. Only declare reuse_results after comparing the original result and current requirements; explicitly pass needed data in args. Completed work is not automatically valid for changed requirements. A superseded job notification is not a new failure to retry.
For an interrupted run or a user-requested adjustment, edit the script file and relaunch with the same workflow_id, expected_revision, change_reason and resume:true. This replays the unchanged successful prefix, not a live program counter: the first changed prompt/options, missing result or failed child and all following calls run again. Model/effort changes invalidate reuse. If earlier results are no longer valid for the user's changed requirements, use resume:false. In-flight agents stop before a replacement starts. Completed results survive session restart; do not claim a killed process continued running. Use resume checkpoints and small staged workflows for natural mid-task changes.
Use ultracode_workflows to inspect logical task labels, current versions and reused members. Native list_agents includes historical children and its generic child numbering restarts per execution; that numbering is not evidence of duplicated implementation. Completed checkpoint replay does not start a new child. Never interrupt a child based only on a generic native label.
If workflow startup fails, inspect the reported error and correct the script or call when possible. Do not silently replace substantive orchestration with serial implementation or modify the host installation to work around a runtime incompatibility; report that blocker accurately.
This does not override user boundaries, plan mode, permission policies or stop requests. Do not publish, send messages or modify unrelated files without authorization.`;
export async function apply(ctx, config) {
  if (config.defaultAgentLimit > config.maxTotalAgents)
    throw new Error("defaultAgentLimit must not exceed maxTotalAgents");
  const api = await loadHostApi(ctx);
  assertRuntimeServices(ctx);
  const owner = createWorkflowOwner(ctx, config, api),
    disposers = new Map();
  const presetScope = api.scopeOf(ctx);
  if (!presetScope || typeof ctx.agents.get !== "function")
    throw new Error("Ultracode requires a scoped preset and the host agent registry.");
  function detach(agent) {
    disposers.get(agent)?.();
    disposers.delete(agent);
  }
  function compose(agent) {
    // A blank session can rebind its preset without creating another Agent.
    // Check this exact preset revision, not only the displayed preset id.
    if (!api.scopeChainOf(api.scopeOf(agent.ctx)).includes(presetScope)) {
      detach(agent);
      return;
    }
    if (disposers.has(agent)) return;
    const dispose = agent.ctx.effect(() => {
      const native = agent.ctx.tools.get("workflow", agent);
      if (!native)
        throw new Error(
          "Ultracode requires the native workflow tool in its preset.",
        );
      const child = (agent.options.subagentDepth ?? 0) > 0;
      const resources = [];
      const cleanup = () => {
        for (const release of resources.reverse()) release();
      };
      try {
        resources.push(installJsonRecovery(agent.ctx, agent));
        if (child) {
          resources.push(
            agent.ctx.tools.guard((exec) =>
              ["workflow", "subagent", "subagent_fork"].includes(exec.name)
                ? "Ultracode workers cannot delegate further. Return the result or request additional help from the root orchestrator."
                : undefined,
            ),
          );
          resources.push(
            agent.ctx.tools.restrict({
              deny: ["workflow", "subagent", "subagent_fork"].filter(name => agent.ctx.tools.get(name, agent)),
            }),
          );
          resources.push(
            agent.ctx.systemPrompt.section({
              name: "tool:workflow",
              order: agent.ctx.systemPrompt.getSectionOrder("TOOL_WORKFLOW"),
              text: "You are a workflow worker. Complete only your assigned task and return evidence. Do not invoke workflow, subagent or subagent_fork: further delegation is disabled so the root can enforce its agent budget. The root orchestrator owns workflow planning, revisions, and final delivery.",
            }),
          );
        } else {
          const delegation = ["subagent", "subagent_fork"].filter(name => agent.ctx.tools.get(name, agent));
          if (delegation.length) resources.push(agent.ctx.tools.restrict({ deny: delegation }));
          owner.reconcile(agent);
          resources.push(agent.ctx.tools.register(owner.build(native, agent)));
          resources.push(agent.ctx.tools.register(owner.management(agent)));
          const jobOutput = agent.ctx.tools.get("job_output", agent);
          if (jobOutput) resources.push(agent.ctx.tools.register(backgroundWorkflowOutput(ctx, jobOutput, agent)));
          resources.push(
            agent.ctx.systemPrompt.section({
              name: "tool:workflow",
              order: agent.ctx.systemPrompt.getSectionOrder("TOOL_WORKFLOW"),
              text: ROOT_PROMPT,
            }),
          );
        }
      } catch (error) {
        cleanup();
        throw error;
      }
      return cleanup;
    }, "Ultracode: agent composition");
    disposers.set(agent, dispose);
  }
  ctx.on("agent/created", ({ agent }) => compose(agent));
  ctx.on("agent-preset/selected", (sessionId) => {
    const agent = ctx.agents.get(sessionId);
    if (agent) compose(agent);
  });
  ctx.on("agent/disposed", ({ agent }) => detach(agent));
  ctx.effect(
    () => () => {
      for (const release of disposers.values()) release();
      disposers.clear();
    },
    "Ultracode: composition cleanup",
  );
}
