import { Script } from "node:vm";
import {
  latestAccepted,
  view,
  PROJECTION_KEY,
  INTERRUPTED_DETAIL,
} from "./model.js";

const isActive = (status) => status === "running" || status === "stopping";
const outcome = (result) =>
  result.stopReason === "completed"
    ? {
        status: "completed",
        detail: `${result.agentsStarted} agents`,
        result: JSON.stringify(result.value ?? null, null, 2).slice(0, 50000),
      }
    : result.stopReason === "cancelled"
      ? { status: "killed" }
      : { status: "failed", detail: result.error || "Workflow failed" };

/** Uses DSH's engine, jobs, completion delivery, and supported lifecycle events. */
export function createWorkflowOwner(
  ctx,
  config,
  { validateMeta, validateJsonSchemaValue, defineTool },
) {
  const active = new Map(),
    locks = new Map();
  const onMember = (type, info, member) => {
    const entry = active.get(info.id);
    if (!entry) return;
    entry.session.append(type, {
      runId: info.id,
      seq: member.seq,
      ...(type.endsWith("start")
        ? {
            label: member.label,
            childId: member.childId,
            ...(member.phase === undefined ? {} : { phase: member.phase }),
          }
        : { outcome: member.outcome }),
    });
  };
  ctx.on("workflow/agent-start", (info, member) =>
    onMember("tool-workflow/agent-start", info, member),
  );
  ctx.on("workflow/agent-end", (info, member) =>
    onMember("tool-workflow/agent-end", info, member),
  );
  ctx.on("workflow/phase", (info, title) => {
    const entry = active.get(info.id);
    entry?.job.updateProgress(title);
    entry?.job.append(`▸ ${title}\n`, { channel: "log" });
  });
  ctx.on("workflow/log", (info, text) =>
    active.get(info.id)?.job.append(text + "\n", { channel: "log" }),
  );
  ctx.effect(
    () => async () => {
      const runs = [...active.values()];
      for (const entry of runs) entry.run.cancel("Ultracode plugin unloaded");
      await Promise.allSettled(runs.map((e) => e.run.dispose()));
      active.clear();
    },
    "Ultracode: owned runs",
  );

  async function serial(key, fn) {
    const previous = locks.get(key) ?? Promise.resolve();
    let release;
    const next = new Promise((r) => (release = r));
    locks.set(key, next);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (locks.get(key) === next) locks.delete(key);
    }
  }
  function state(agent) {
    return ctx.sessionProjections.stateOf(agent.session, PROJECTION_KEY);
  }
  function readCurrent(agent, id) {
    const current = latestAccepted(state(agent), id);
    if (!current)
      throw new Error(
        "Unknown workflow_id in this session. Start a new task without workflow_id.",
      );
    return current;
  }
  async function stopAndJoin(agent, current, signal, reason) {
    if (!current.jobId) return;
    let job;
    try {
      job = ctx.jobs.get(current.jobId, agent.id);
    } catch (error) {
      if (current.status === "running" || current.status === "starting")
        throw new Error(
          "Previous execution is not available. Reopen the session and inspect its state before replacing it.",
          { cause: error },
        );
      return;
    }
    if (!job || !isActive(job.status)) return;
    ctx.jobs.kill(current.jobId, agent.id, reason);
    await ctx.jobs.wait(
      current.jobId,
      config.replacementTimeoutMs,
      agent.id,
      signal,
    );
    job = ctx.jobs.get(current.jobId, agent.id);
    if (isActive(job.status))
      throw new Error(
        "Previous execution is still stopping; the replacement was not started. Retry after it settles.",
      );
  }
  function start(agent, args, exec, receipt) {
    let run;
    const jobId = ctx.jobs.start({
      kind: "workflow",
      label: args.meta.description || args.meta.name,
      owner: agent.id,
      toolCall: { callId: exec.callId, rootCallId: exec.rootCallId },
      run: (job) => {
        run = ctx.workflowEngine.start({
          script: args.script,
          meta: args.meta,
          ...(args.args === undefined ? {} : { args: args.args }),
          parent: agent,
          maxTotalAgents: receipt.agentLimit,
        });
        const entry = { run, session: agent.session, job };
        try {
          agent.session.append("tool-workflow/run-start", {
            runId: run.id,
            name: run.meta.name,
          });
          active.set(run.id, entry);
        } catch (error) {
          run.cancel("Failed to record workflow start");
          void run.dispose().catch((e) => ctx.logger.warn(String(e)));
          throw error;
        }
        const done = run.result.then(async (result) => {
          try {
            await run.dispose();
          } catch (error) {
            result = {
              ...result,
              stopReason: "error",
              error: `Workflow cleanup failed: ${String(error)}`,
            };
          } finally {
            active.delete(run.id);
          }
          agent.session.append("tool-workflow/run-end", {
            runId: run.id,
            stopReason: result.stopReason,
          });
          return outcome(result);
        });
        return {
          cancel: (reason) => run.cancel(reason || "Workflow cancelled"),
          done,
        };
      },
    });
    return {
      kind: "background",
      jobId,
      runId: run.id,
      ultracode: { ...receipt, runId: run.id, jobId },
    };
  }
  return {
    reconcile(agent) {
      const known = new Set(ctx.jobs.list(agent.id).map((job) => job.id));
      for (const workflow of view(state(agent)).workflows)
        for (const r of workflow.revisions) {
          if (
            !r.accepted ||
            !["running", "starting", "interrupted"].includes(r.status) ||
            !r.jobId ||
            known.has(r.jobId) ||
            active.has(r.runId)
          )
            continue;
          if (state(agent).jobs[r.jobId]?.detail === INTERRUPTED_DETAIL)
            continue;
          agent.session.append("job/settled", {
            jobId: r.jobId,
            owner: agent.id,
            kind: "workflow",
            label: r.title,
            startedAt: r.startedAt,
            finishedAt: Date.now(),
            status: "failed",
            cause: "teardown",
            producerReported: false,
            detail: INTERRUPTED_DETAIL,
          });
          agent.session.append("tool-workflow/run-end", {
            runId: r.runId,
            stopReason: "error",
          });
        }
    },
    build(native, agent) {
      const properties = {
        ...native.parameters.properties,
        workflow_id: {
          type: "string",
          minLength: 1,
          description:
            "Omit for a new independent user task. To revise the same task, use the workflowId from its last receipt.",
        },
        expected_revision: {
          type: "integer",
          minimum: 1,
          description:
            "Required when revising. Must match the last accepted revision.",
        },
        change_reason: {
          type: "string",
          minLength: 1,
          description:
            "Required when revising. Explain what the user asked to change.",
        },
        agent_limit: {
          type: "integer",
          minimum: 1,
          maximum: config.maxTotalAgents,
          description:
            "Hard cap on total new agents in this execution, not a target. Use the smallest task-appropriate cap.",
        },
        reuse_results: {
          type: "array",
          maxItems: config.maxTotalAgents,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["childId", "reason"],
            properties: {
              childId: { type: "string" },
              reason: { type: "string", minLength: 1 },
            },
          },
          description:
            "Optional declared reuse from completed members of the previous version. Inspect their actual result and recheck applicability first. Pass required data explicitly in args; this does not restore a running script.",
        },
      };
      const parameters = { ...native.parameters, properties };
      return {
        ...native,
        parameters,
        description:
          native.description +
          "\nUltracode: substantive tasks use this workflow automatically. Execution is always background. Revisions stop and join the previous execution before starting a replacement. Receipt supplies workflowId/revision. Preserve the selected model/effort unless the user explicitly requests a different route.",
        output: {
          schema: { type: "object", additionalProperties: true },
          render: (_args, value) => [
            {
              type: "text",
              text: `Workflow started in background. ${JSON.stringify(value)}\nYou may finish this turn; completion wakes you. Do not busy-poll. Use job_output after completion to read the result. Retain workflowId and revision when revising this task.`,
            },
          ],
          presentationMeta: (_args, value) => ({ ultracode: value.ultracode }),
        },
        async execute(args, exec) {
          const invalid = validateJsonSchemaValue(parameters, args, "");
          if (invalid.length)
            throw new Error(
              "Invalid workflow arguments: " + JSON.stringify(invalid),
            );
          if (exec.agent !== agent || (agent.options.subagentDepth ?? 0) > 0)
            throw new Error(
              "Only the owning root agent may orchestrate Ultracode workflows.",
            );
          exec.signal.throwIfAborted();
          new Script(`(async()=>{\n${args.script}\n})`);
          validateMeta(args.meta);
          const {
            workflow_id,
            expected_revision,
            change_reason,
            reuse_results = [],
            agent_limit = config.defaultAgentLimit,
            ...nativeArgs
          } = args;
          if (
            !Number.isInteger(agent_limit) ||
            agent_limit < 1 ||
            agent_limit > config.maxTotalAgents
          )
            throw new Error(
              `Invalid workflow agent_limit: expected 1..${config.maxTotalAgents}.`,
            );
          if (
            reuse_results.length > config.maxTotalAgents ||
            reuse_results.some((r) => !r.childId.trim() || !r.reason.trim())
          )
            throw new Error("Invalid workflow reuse_results.");
          if (workflow_id !== undefined && !workflow_id.trim())
            throw new Error("Invalid workflow_id.");
          const clean = { ...nativeArgs, run_in_background: true };
          const nativeInvalid = validateJsonSchemaValue(
            native.parameters,
            clean,
            "",
          );
          if (nativeInvalid.length)
            throw new Error(
              "Invalid native workflow arguments: " +
                JSON.stringify(nativeInvalid),
            );
          return serial(
            agent.id + ":" + (workflow_id || exec.callId),
            async () => {
              exec.signal.throwIfAborted();
              const current = workflow_id
                ? readCurrent(agent, workflow_id)
                : null;
              if (
                current &&
                (expected_revision !== current.number || !change_reason?.trim())
              )
                throw new Error(
                  "Revision is stale or change_reason is missing. Inspect the current workflow before retrying.",
                );
              if (
                !current &&
                (expected_revision !== undefined || reuse_results.length)
              )
                throw new Error(
                  "New workflows cannot refer to an earlier revision or reused member.",
                );
              for (const reused of reuse_results)
                if (
                  !current.members.some(
                    (m) =>
                      m.childId === reused.childId && m.status === "completed",
                  )
                )
                  throw new Error(
                    "Only completed members of the previous version can be declared reusable.",
                  );
              if (current)
                await stopAndJoin(
                  agent,
                  current,
                  exec.signal,
                  "Superseded: " + change_reason,
                );
              exec.signal.throwIfAborted();
              return start(agent, clean, exec, {
                workflowId: workflow_id || exec.callId,
                revision: (current?.number ?? 0) + 1,
                reason: change_reason || "",
                replacedRunId: current?.runId ?? null,
                reused: reuse_results,
                agentLimit: agent_limit,
              });
            },
          );
        },
        isConcurrencySafe: () => false,
      };
    },
    management(agent) {
      return defineTool({
        name: "ultracode_workflows",
        description:
          "Inspect workflows and revisions in this session, or cancel a workflow when the user asks. Cancellation preserves results and does not start a replacement.",
        parameters: {
          action: { type: "string", enum: ["list", "cancel"], required: true },
          workflow_id: { type: "string" },
          reason: { type: "string" },
        },
        output: {
          schema: { type: "json" },
          render: (_args, value) => [
            { type: "text", text: JSON.stringify(value) },
          ],
        },
        async execute(args, exec) {
          if (exec.agent !== agent || (agent.options.subagentDepth ?? 0) > 0)
            throw new Error(
              "Only the owning root agent may manage this workflow.",
            );
          if (args.action === "list") return view(state(agent));
          if (!args.workflow_id) throw new Error("workflow_id is required.");
          const current = readCurrent(agent, args.workflow_id);
          await stopAndJoin(
            agent,
            current,
            exec.signal,
            args.reason || "Cancelled by user request",
          );
          return {
            workflowId: args.workflow_id,
            revision: current.number,
            status:
              latestAccepted(state(agent), args.workflow_id)?.status ??
              current.status,
          };
        },
      });
    },
  };
}
