import test from "node:test";
import assert from "node:assert/strict";
import { createWorkflowOwner, backgroundWorkflowOutput } from "../workflow.js";
import { emptyState, fold, latestAccepted } from "../model.js";
import { api } from "./host-runtime.mjs";

test("workflow status reads never hold the root turn open; other jobs retain native waits", async () => {
  let job={kind:"workflow",status:"running"}, observed;
  const native={description:"Read job",output:{render:()=>[{type:"text",text:"status"}]},execute:async args=>{observed=args;return {job};}};
  const tool=backgroundWorkflowOutput({jobs:{get:(id,owner)=>{assert.equal(id,"j");assert.equal(owner,"owner");return job;}}},native,{id:"owner"});
  const value=await tool.execute({job_id:"j",wait:true},{});
  assert.equal(observed.wait,false);
  assert.match(tool.output.render({},value)[1].text,/completion will wake/);
  job={kind:"pwsh",status:"running"}; await tool.execute({job_id:"j",wait:true},{}); assert.equal(observed.wait,true);
  job={kind:"workflow",status:"completed"}; await tool.execute({job_id:"j",wait:true},{}); assert.equal(observed.wait,true);
  assert.equal(tool.output.render({},{job}).length,1);
});

function harness() {
  let state = emptyState({ agentPreset: "ultracode" }),
    seq = 0;
  const conclusions = [], order = [],
    jobs = new Map(),
    runs = new Map();
  const agent = {
    id: "owner",
    options: {},
    session: {
      append(type, data) {
        state = fold(state, { type, data, time: Date.now(), seq: seq++ });
      },
    },
  };
  const ctx = {
    on() {},
    effect(fn) {
      fn();
    },
    logger: { warn() {} },
    sessionProjections: {
      stateOf() {
        return state;
      },
    },
    workflowEngine: {
      start(options) {
        const id = "run-" + runs.size;
        let finish;
        const run = {
          id,
          meta: options.meta,
          result: new Promise((r) => (finish = r)),
          cancel() {
            order.push("cancel " + id);
            finish({ stopReason: "cancelled", agentsStarted: 0 });
          },
          async dispose() {
            order.push("dispose " + id);
          },
        };
        runs.set(id, { run, options, finish });
        order.push("start " + id);
        return run;
      },
    },
    jobs: {
      start(spec) {
        const id = "job-" + jobs.size,
          record = { id, status: "running", ...spec };
        jobs.set(id, record);
        const hooks = spec.run({ updateProgress() {}, append() {} });
        record.cancel = hooks.cancel;
        agent.session.append("job/registered", {
          jobId: id,
          kind: "workflow",
          toolCall: spec.toolCall,
          startedAt: Date.now(),
        });
        record.done = hooks.done.then((out) => {
          record.status = out.status;
          agent.session.append("job/settled", {
            jobId: id,
            kind: "workflow",
            status: out.status,
            detail: out.detail,
            finishedAt: Date.now(),
          });
        });
        return id;
      },
      get(id) {
        if (!jobs.has(id)) throw Error("unknown job");
        return jobs.get(id);
      },
      list() {
        return [...jobs.values()];
      },
      kill(id) {
        const j = jobs.get(id);
        j.status = "stopping";
        j.cancel();
      },
      async wait(id) {
        await jobs.get(id).done;
      },
    },
  };
  const owner = createWorkflowOwner(
    ctx,
    {
      defaultAgentLimit: 4,
      maxTotalAgents: 8,
      replacementTimeoutMs: 1000,
    },
    { ...api, appendPluginRecord(session, type, data) {
      state = fold(state, { type, data, seq: seq++, time: Date.now(), ignorable: true });
    } },
  );
  const native = {
    name: "workflow",
    description: "native",
    parameters: {
      type: "object",
      required: ["script", "meta"],
      properties: {
        script: { type: "string" },
        meta: { type: "object" },
        run_in_background: { type: "boolean" },
        args: { type: "object" },
      },
    },
  };
  const tool = owner.build(native, agent);
  async function invoke(overrides = {}, execution = {}) {
    const callId = "call-" + seq,
      args = {
        meta: { name: "test", description: "任务" },
        script: "return 1;",
        ...overrides,
      };
    agent.session.append("tool/call", {
      callId,
      name: "workflow",
      arguments: JSON.stringify(args),
    });
    try {
      const value = await tool.execute(args, {
        agent,
        callId,
        rootCallId: callId,
        signal: new AbortController().signal,
        concludeTurn() { conclusions.push(callId); },
        ...execution,
      });
      agent.session.append("tool/result", {
        message: { source: { callId }, content: [] },
        meta: tool.output.presentationMeta(args, value),
      });
      return value;
    } catch (error) {
      agent.session.append("tool/result", {
        message: {
          source: { callId },
          isError: true,
          content: [{ type: "text", text: error.message }],
        },
      });
      throw error;
    }
  }
  return {
    invoke,
    owner,
    agent,
    ctx,
    order,
    jobs,
    runs,
    conclusions,
    get state() {
      return state;
    },
  };
}
test("dispatch concludes only its own turn; later independent work leaves the run intact", async () => {
  const h = harness(), a = await h.invoke();
  assert.equal(h.conclusions.length, 1);
  const tool = backgroundWorkflowOutput(h.ctx, {
    description: "Read job", output: { render: () => [] },
    execute: async args => ({ job: h.jobs.get(args.job_id), wait: args.wait }),
  }, h.agent);
  const value = await tool.execute({ job_id: a.jobId, wait: true }, {
    concludeTurn() { assert.fail("A new user request must not be forced to end by a status read"); },
  });
  assert.equal(value.wait, false);
  assert.equal(h.jobs.get(a.jobId).status, "running");
  assert.deepEqual(h.order, ["start run-0"]);
});
test("missing host turn API rejects before starting or replacing a workflow", async () => {
  const h = harness();
  await assert.rejects(h.invoke({}, { concludeTurn: undefined }), /concludeTurn API/);
  assert.equal(h.runs.size, 0);
  assert.equal(h.conclusions.length, 0);
  const a = await h.invoke();
  await assert.rejects(h.invoke({ workflow_id: a.ultracode.workflowId, expected_revision: 1, change_reason: "调整" }, { concludeTurn: undefined }), /concludeTurn API/);
  assert.equal(h.jobs.get(a.jobId).status, "running");
  assert.equal(h.runs.size, 1);
  assert.equal(h.conclusions.length, 1);
});
test("malformed replacement is rejected before the old execution is cancelled", async () => {
  const h = harness(),
    a = await h.invoke();
  await assert.rejects(
    h.invoke({
      workflow_id: a.ultracode.workflowId,
      expected_revision: 1,
      change_reason: "调整",
      script: "return {",
    }),
    SyntaxError,
  );
  assert.equal(h.jobs.get(a.jobId).status, "running");
  await assert.rejects(
    h.invoke({
      workflow_id: a.ultracode.workflowId,
      expected_revision: 1,
      change_reason: "调整",
      meta: { name: "invalid", description: "任务", phases: [{ title: "" }] },
    }),
    /invalid meta/,
  );
  assert.deepEqual(h.order, ["start run-0"]);
  assert.equal(h.conclusions.length, 1);
});
test("stale revision and excessive cap cannot affect active work", async () => {
  const h = harness(),
    a = await h.invoke();
  await assert.rejects(
    h.invoke({
      workflow_id: a.ultracode.workflowId,
      expected_revision: 9,
      change_reason: "调整",
    }),
    /stale/,
  );
  await assert.rejects(h.invoke({ agent_limit: 9 }), /Invalid workflow/);
  assert.equal(h.jobs.get(a.jobId).status, "running");
});
test("replacement joins cancellation and cleanup before starting the new run", async () => {
  const h = harness(),
    a = await h.invoke(),
    b = await h.invoke({
      workflow_id: a.ultracode.workflowId,
      expected_revision: 1,
      change_reason: "合并任务",
      agent_limit: 1,
    });
  assert.equal(b.ultracode.revision, 2);
  assert.equal(h.conclusions.length, 2);
  assert.deepEqual(h.order, [
    "start run-0",
    "cancel run-0",
    "dispose run-0",
    "start run-1",
  ]);
  assert.equal(h.runs.get(b.runId).options.maxTotalAgents, 1);
  assert.equal(latestAccepted(h.state, a.ultracode.workflowId).number, 2);
});
test("unknown workflow and unverified reuse cannot cancel or start work", async () => {
  const h = harness(),
    a = await h.invoke();
  await assert.rejects(
    h.invoke({
      workflow_id: "another-session",
      expected_revision: 1,
      change_reason: "调整",
    }),
    /Unknown workflow_id/,
  );
  await assert.rejects(
    h.invoke({
      workflow_id: a.ultracode.workflowId,
      expected_revision: 1,
      change_reason: "调整",
      reuse_results: [{ childId: "missing", reason: "复用" }],
    }),
    /Only completed/,
  );
  assert.equal(h.runs.size, 1);
});
test("reattaching a session marks missing runtime jobs interrupted", async () => {
  const h = harness(),
    a = await h.invoke();
  h.jobs.clear();
  h.runs.get(a.runId).finish({ stopReason: "completed", agentsStarted: 0 });
  await new Promise((r) => setImmediate(r));
  // A separate owner instance models a restarted process with no live run registry.
  h.agent.session.append("tool-workflow/run-start", {
    runId: a.runId,
    name: "test",
  });
  const restarted = createWorkflowOwner(
    h.ctx,
    {
      defaultAgentLimit: 4,
      maxTotalAgents: 8,
      replacementTimeoutMs: 1000,
    },
    api,
  );
  restarted.reconcile(h.agent);
  assert.equal(
    latestAccepted(h.state, a.ultracode.workflowId).status,
    "interrupted",
  );
});
