import { z } from "zod";
import { loadHostApi, assertRuntimeServices } from "./host-api.js";
import { createWorkflowOwner } from "./workflow.js";
export const inject = [
  "loader",
  "tools",
  "systemPrompt",
  "workflowEngine",
  "jobs",
  "sessionProjections",
  "agents",
];
export const Config = z.object({
  defaultAgentLimit: z.number().int().min(1).default(12),
  maxTotalAgents: z.number().int().min(1).default(40),
  replacementTimeoutMs: z.number().int().min(1000).default(30000),
});
const ROOT_PROMPT = `Ultracode is selected for this conversation. Selecting this preset is the user's explicit request for workflow orchestration; do not ask them to repeat that request. Judge the task's complexity yourself. For complex tasks involving multiple components, substantial implementation or independent validation, proactively use the workflow tool with task-appropriate phases, bounded delegation and a clear completion condition. A todo list alone is not a workflow. For chat, simple questions and small focused actions, work directly without a workflow. Do not decide based only on whether the user says "workflow" or "multi-agent".
Use the smallest useful team. Never treat an agent cap as a target. Do independent reads in parallel; give each writer disjoint files or explicitly sequence dependent writes. Keep verification separate from implementation. A null child result is a failure or interruption, not evidence that its task succeeded. Report unresolved failures and verification limits.
Keep the user's selected provider, model and reasoning effort. Do not hardcode a higher effort or change child models unless asked. Workflow children inherit the current selection. Give every agent a concise label and a phase. Describe the user task in meta.description. Do not guess progress percentages or planned totals.
Workflow runs in the background. After dispatch, do useful independent work or end this turn with an accurate progress update. DSH will wake you when the job settles. Do not repeatedly call job_output, list, sleep or goals solely to remain awake. On completion, read job_output, inspect the outcome and finish the user task.
Keep one workflow_id for one user objective. On adjustment, inspect ultracode_workflows, supply workflow_id, expected_revision and change_reason; the tool joins the old execution before the replacement starts. A different independent user objective starts without workflow_id. Preserve old results as evidence. Only declare reuse_results after comparing the original result and current requirements; explicitly pass needed data in args. Completed work is not automatically valid for changed requirements. A superseded job notification is not a new failure to retry.
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
              deny: ["workflow"],
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
          owner.reconcile(agent);
          resources.push(agent.ctx.tools.register(owner.build(native, agent)));
          resources.push(agent.ctx.tools.register(owner.management(agent)));
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
