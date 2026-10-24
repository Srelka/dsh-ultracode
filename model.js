import { CHECKPOINT_RECORD, foldCheckpoint } from "./checkpoint.js";
// Optional checkpoints are ignorable plugin records; legacy history is retained.
export const PROJECTION_KEY = "ultracode";
export const INTERRUPTED_DETAIL =
  "Ultracode: execution interrupted; runtime job no longer exists.";
export const emptyState = (header) => ({
  enabled: header.agentPreset === "ultracode",
  calls: {},
  runs: {},
  jobs: {},
  reads: {},
  checkpoints: {},
});
const textOf = (message) =>
  (message?.content ?? [])
    .filter((x) => x.type === "text")
    .map((x) => x.text)
    .join("\n");
const terminal = (reason) =>
  ({ completed: "completed", cancelled: "cancelled", error: "failed" })[
    reason
  ] ?? "interrupted";
const safeRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function patchRun(state, id, change) {
  const current = state.runs[id];
  if (!current) return state;
  return { ...state, runs: { ...state.runs, [id]: change(current) } };
}
export function fold(state, event) {
  if (event.type === CHECKPOINT_RECORD) return foldCheckpoint(state, event);
  const d = event.data ?? {},
    time = event.time ?? 0;
  if (event.type === "agent-preset/selected")
    return { ...state, enabled: d.agentPreset === "ultracode" };
  if (event.type === "tool/call") {
    let a = d.arguments;
    if (typeof a === "string") {
      try {
        a = JSON.parse(a);
      } catch {
        return state;
      }
    }
    if (!safeRecord(a)) a = {};
    if (
      d.name === "job_output" &&
      typeof a.job_id === "string" &&
      state.jobs[a.job_id]
    )
      return { ...state, reads: { ...state.reads, [d.callId]: a.job_id } };
    if (!state.enabled || d.name !== "workflow") return state;
    return {
      ...state,
      calls: {
        ...state.calls,
        [d.callId]: {
          id: d.callId,
          requestedId: a.workflow_id ?? null,
          title: a.meta?.description || a.meta?.name || "Workflow",
          name: a.meta?.name || "",
          phases: Array.isArray(a.meta?.phases)
            ? a.meta.phases
                .map((p) => p.title)
                .filter((x) => typeof x === "string")
            : [],
          reason: a.change_reason ?? "",
          startedAt: time,
          status: "starting",
          accepted: false,
          receipt: null,
          error: null,
        },
      },
    };
  }
  if (event.type === "tool/result") {
    const callId = d.message?.source?.callId,
      call = state.calls[callId];
    if (call) {
      const receipt = d.meta?.ultracode;
      if (
        !d.message.isError &&
        safeRecord(receipt) &&
        typeof receipt.workflowId === "string" &&
        typeof receipt.runId === "string"
      )
        return {
          ...state,
          calls: {
            ...state.calls,
            [callId]: { ...call, status: "accepted", accepted: true, receipt,
              title: receipt.title ?? call.title, phases: receipt.phases ?? call.phases },
          },
        };
      return {
        ...state,
        calls: {
          ...state.calls,
          [callId]: {
            ...call,
            status: "failed",
            error: textOf(d.message).slice(0, 4000),
          },
        },
      };
    }
    const jobId = state.reads[callId];
    if (jobId) {
      const reads = { ...state.reads };
      delete reads[callId];
      return {
        ...state,
        reads,
        ...(d.message?.isError
          ? {}
          : {
              jobs: {
                ...state.jobs,
                [jobId]: {
                  ...state.jobs[jobId],
                  output: textOf(d.message).slice(-20000),
                },
              },
            }),
      };
    }
    return state;
  }
  if (event.type === "tool-workflow/run-start")
    return {
      ...state,
      runs: {
        ...state.runs,
        [d.runId]: {
          id: d.runId,
          name: d.name,
          status: "running",
          startedAt: time,
          endedAt: null,
          members: [],
        },
      },
    };
  if (event.type === "tool-workflow/agent-start")
    return patchRun(state, d.runId, (r) => ({
      ...r,
      members: [
        ...r.members,
        {
          seq: d.seq,
          childId: d.childId,
          label: d.label,
          phase: d.phase ?? null,
          status: "running",
          startedAt: time,
          endedAt: null,
        },
      ],
    }));
  if (event.type === "tool-workflow/agent-end")
    return patchRun(state, d.runId, (r) => ({
      ...r,
      members: r.members.map((m) =>
        m.seq === d.seq
          ? {
              ...m,
              status:
                d.outcome === "completed"
                  ? "completed"
                  : d.outcome === "cancelled"
                    ? "cancelled"
                    : "failed",
              endedAt: time,
            }
          : m,
      ),
    }));
  if (event.type === "tool-workflow/run-end")
    return patchRun(state, d.runId, (r) => ({
      ...r,
      status: terminal(d.stopReason),
      endedAt: time,
      members: r.members.map((m) =>
        m.status === "running"
          ? {
              ...m,
              status:
                d.stopReason === "completed"
                  ? "interrupted"
                  : terminal(d.stopReason),
              endedAt: time,
            }
          : m,
      ),
    }));
  if (event.type === "job/registered" || event.type === "job/settled") {
    if (d.kind !== "workflow") return state;
    if (d.detail === INTERRUPTED_DETAIL) {
      const receipt = Object.values(state.calls).find(
        (c) => c.receipt?.jobId === d.jobId,
      )?.receipt;
      if (receipt)
        state = patchRun(state, receipt.runId, (r) => ({
          ...r,
          status: "interrupted",
          endedAt: time,
          members: r.members.map((m) =>
            m.status === "running"
              ? { ...m, status: "interrupted", endedAt: time }
              : m,
          ),
        }));
    }
    return {
      ...state,
      jobs: {
        ...state.jobs,
        [d.jobId]: {
          ...state.jobs[d.jobId],
          id: d.jobId,
          callId: d.toolCall?.callId ?? null,
          status: d.status ?? "running",
          detail: d.detail ?? "",
          startedAt: d.startedAt,
          endedAt: d.finishedAt ?? null,
        },
      },
    };
  }
  if (
    event.type === "turn/end" &&
    ["interrupted", "forked"].includes(d.reason?.kind)
  ) {
    const runs = Object.fromEntries(
      Object.entries(state.runs).map(([id, r]) => [
        id,
        r.status === "running"
          ? {
              ...r,
              status: "interrupted",
              endedAt: time,
              members: r.members.map((m) =>
                m.status === "running"
                  ? { ...m, status: "interrupted", endedAt: time }
                  : m,
              ),
            }
          : r,
      ]),
    );
    const calls = Object.fromEntries(
      Object.entries(state.calls).map(([id, c]) => [
        id,
        c.status === "starting"
          ? {
              ...c,
              status: "interrupted",
              error: "Execution interrupted before a receipt was recorded.",
            }
          : c,
      ]),
    );
    return { ...state, runs, calls };
  }
  return state;
}
export function view(state) {
  const groups = new Map();
  const acceptedIds = new Set(
    Object.values(state.calls)
      .filter((c) => c.accepted)
      .map((c) => c.receipt.workflowId),
  );
  for (const call of Object.values(state.calls)) {
    const receipt = call.receipt;
    const id =
      receipt?.workflowId ??
      (acceptedIds.has(call.requestedId) ? call.requestedId : call.id);
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        title: call.title,
        name: call.name,
        startedAt: call.startedAt,
        revisions: [],
      };
      groups.set(id, group);
    }
    const run = receipt ? state.runs[receipt.runId] : null;
    const job = receipt
      ? state.jobs[receipt.jobId]
      : Object.values(state.jobs).find((j) => j.callId === call.id);
    const status =
      job?.detail === INTERRUPTED_DETAIL
        ? "interrupted"
        : (run?.status ??
          (job?.status === "failed"
            ? "failed"
            : call.status === "starting"
              ? "starting"
              : call.status === "interrupted"
                ? "interrupted"
                : "failed"));
    group.revisions.push({
      id: call.id,
      number: receipt?.revision ?? group.revisions.length + 1,
      runId: receipt?.runId ?? null,
      jobId: receipt?.jobId ?? job?.id ?? null,
      scriptPath: receipt?.scriptPath ?? null,
      title: call.title,
      reason: receipt?.reason ?? call.reason,
      status,
      accepted: call.accepted,
      startedAt: run?.startedAt ?? call.startedAt,
      endedAt: run?.endedAt ?? job?.endedAt ?? null,
      phases: call.phases,
      members: run?.members ?? [],
      agentLimit: receipt?.agentLimit ?? null,
      reused: [...(receipt?.reused ?? []), ...(run?.members ?? []).filter(m=>m.reused).map(m=>({ childId:m.childId, reason:"Exact completed prefix replayed from saved result." }))],
      replacedRunId: receipt?.replacedRunId ?? null,
      error: call.error || (status === "failed" ? job?.detail : null),
      output: job?.output ?? null,
    });
    group.title = call.title;
  }
  for (const group of groups.values()) {
    const replaced = new Set(
      group.revisions
        .filter((r) => r.accepted)
        .map((r) => r.replacedRunId)
        .filter(Boolean),
    );
    group.revisions = group.revisions.map((r) =>
      replaced.has(r.runId)
        ? { ...r, status: "replaced", executionStatus: r.status }
        : r,
    );
    group.current = (
      group.revisions.findLast((r) => r.accepted) ?? group.revisions.at(-1)
    ).id;
    group.title = group.revisions.find((r) => r.id === group.current).title;
  }
  return { enabled: state.enabled, workflows: [...groups.values()] };
}
export function latestAccepted(state, workflowId) {
  const group = view(state).workflows.find((w) => w.id === workflowId);
  return group?.revisions.filter((r) => r.accepted).at(-1) ?? null;
}
