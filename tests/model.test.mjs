import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, fold, view, latestAccepted } from "../model.js";
function session() {
  let state = emptyState({ agentPreset: "ultracode" }),
    seq = 0;
  return {
    get state() {
      return state;
    },
    send(type, data) {
      state = fold(state, { type, data, seq: seq++, time: 1000 + seq });
      return state;
    },
  };
}
function call(s, id, workflowId) {
  s.send("tool/call", {
    name: "workflow",
    callId: id,
    arguments: {
      workflow_id: workflowId,
      meta: {
        name: id,
        description: "任务 " + id,
        phases: [{ title: "检查" }],
      },
    },
  });
}
function start(s, id, run, logical = id, revision = 1, previous = null) {
  s.send("tool-workflow/run-start", { runId: run, name: id });
  s.send("job/registered", {
    jobId: "job-" + run,
    kind: "workflow",
    toolCall: { callId: id },
    startedAt: 1000,
  });
  s.send("tool/result", {
    message: { source: { callId: id }, content: [], isError: false },
    meta: {
      ultracode: {
        workflowId: logical,
        runId: run,
        jobId: "job-" + run,
        revision,
        replacedRunId: previous,
        reused: [],
        agentLimit: 4,
      },
    },
  });
}
test("natural turn completion does not mark a background workflow finished", () => {
  const s = session();
  call(s, "a");
  start(s, "a", "r1");
  s.send("turn/end", { reason: { kind: "completed" } });
  assert.equal(view(s.state).workflows[0].revisions[0].status, "running");
});
test("worker events before receipt are retained and joined by runId", () => {
  const s = session();
  call(s, "a");
  s.send("tool-workflow/run-start", { runId: "r1", name: "a" });
  s.send("tool-workflow/agent-start", {
    runId: "r1",
    seq: 1,
    label: "验证",
    phase: "检查",
    childId: "c1",
  });
  s.send("tool-workflow/agent-end", {
    runId: "r1",
    seq: 1,
    outcome: "completed",
  });
  s.send("tool/result", {
    message: { source: { callId: "a" }, content: [] },
    meta: {
      ultracode: { workflowId: "a", runId: "r1", revision: 1, jobId: "job-r1" },
    },
  });
  assert.equal(latestAccepted(s.state, "a").members[0].status, "completed");
});
test("successful replacement keeps one workflow and truthful historical status", () => {
  const s = session();
  call(s, "a");
  start(s, "a", "r1");
  s.send("tool-workflow/run-end", { runId: "r1", stopReason: "cancelled" });
  call(s, "b", "a");
  start(s, "b", "r2", "a", 2, "r1");
  const w = view(s.state).workflows;
  assert.equal(w.length, 1);
  assert.equal(w[0].revisions.length, 2);
  assert.equal(w[0].revisions[0].status, "replaced");
  assert.equal(w[0].revisions[0].executionStatus, "cancelled");
  assert.equal(w[0].revisions[1].status, "running");
});
test("failed adjustment never falsely replaces the previous run", () => {
  const s = session();
  call(s, "a");
  start(s, "a", "r1");
  call(s, "b", "a");
  s.send("tool/result", {
    message: {
      source: { callId: "b" },
      isError: true,
      content: [{ type: "text", text: "stale revision" }],
    },
  });
  const w = view(s.state).workflows[0];
  assert.equal(w.revisions[0].status, "running");
  assert.equal(w.revisions[1].status, "failed");
  assert.equal(latestAccepted(s.state, "a").runId, "r1");
});
test("an independent second task remains a separate workflow", () => {
  const s = session();
  call(s, "a");
  start(s, "a", "r1");
  s.send("tool-workflow/run-end", { runId: "r1", stopReason: "completed" });
  call(s, "b");
  start(s, "b", "r2");
  assert.deepEqual(
    view(s.state).workflows.map((w) => w.revisions.at(-1).status),
    ["completed", "running"],
  );
});
test("crash and fork boundaries cannot leave running badges indefinitely", () => {
  const s = session();
  call(s, "a");
  start(s, "a", "r1");
  s.send("tool-workflow/agent-start", {
    runId: "r1",
    seq: 1,
    label: "工作",
    childId: "c1",
  });
  s.send("turn/end", { reason: { kind: "interrupted" } });
  const r = latestAccepted(s.state, "a");
  assert.equal(r.status, "interrupted");
  assert.equal(r.members[0].status, "interrupted");
});
test("unrelated events preserve referential identity", () => {
  const s = emptyState({ agentPreset: "ultracode" });
  assert.equal(fold(s, { type: "irrelevant", data: {} }), s);
});
test("native JSON-string arguments preserve title and logical revision linkage", () => {
  const s = session();
  s.send("tool/call", {
    name: "workflow",
    callId: "a",
    arguments: JSON.stringify({
      meta: {
        name: "auth",
        description: "权限修复",
        phases: [{ title: "验证" }],
      },
    }),
  });
  start(s, "a", "r1");
  assert.equal(view(s.state).workflows[0].title, "权限修复");
  assert.deepEqual(latestAccepted(s.state, "a").phases, ["验证"]);
});
test("failed revision remains inspectable but does not displace the running current version", () => {
  const s = session();
  call(s, "a");
  start(s, "a", "r1");
  call(s, "b", "a");
  s.send("tool/result", {
    message: { source: { callId: "b" }, isError: true, content: [] },
  });
  assert.equal(view(s.state).workflows[0].current, "a");
});
