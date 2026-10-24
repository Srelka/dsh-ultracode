import test from "node:test";
import assert from "node:assert/strict";
import { hostImport } from "./host-runtime.mjs";
import * as policy from "../preset.js";
import { emptyState } from "../model.js";

const { Context } = await hostImport("@deepseek-ai/cordis");
const { default: SystemPrompt, renderPrompt } = await hostImport("@deepseek-ai/dsh-system-prompt");
const { default: Tools } = await hostImport("@deepseek-ai/dsh-tools");
const { createScope, bindScopeParent, scopeTarget } = await hostImport("@deepseek-ai/dsh-scope");

// Real host scopes, event routing, prompt layers and tool registry. Only the
// idle agent catalog and execution services are stubbed; no model is called.
async function harness(t, availableDelegation = ["subagent", "subagent_fork"]) {
  const root = new Context();
  let ctx = root;
  const agents = new Map();
  ctx.provide("loader", { import: hostImport });
  ctx.provide("agents", { get: (id) => agents.get(id) });
  ctx.provide("workflowEngine", { start() { throw Error("not an execution test"); } });
  ctx.provide("jobs", { start() {}, get() {}, list: () => [], kill() {}, wait() {} });
  ctx.provide("sessionProjections", { stateOf: () => emptyState({ agentPreset: "ultracode" }) });
  ctx.provide("fs", {});
  ctx.provide("workingDirectory", {});
  await ctx.plugin(SystemPrompt, {}).await();
  await ctx.plugin(Tools, {}).await();
  await root.inject(["tools", "systemPrompt"], (injected) => { ctx = injected; }).await();
  const standardKey = {}, ultraKey = {};
  const standard = createScope(ctx, standardKey), ultra = createScope(ctx, ultraKey);
  const native = { name: "workflow", description: "native workflow", parameters: { type: "object", properties: {} }, output: { schema: {}, render: () => [] }, execute: async () => null };
  for (const scope of [standard, ultra]) {
    scope.ctx.tools.register(native);
    for (const name of availableDelegation) scope.ctx.tools.register({ ...native, name });
    scope.ctx.systemPrompt.section({ name: "tool:workflow", order: 50, text: "ONLY when explicitly asked" });
  }
  const fiber = ultra.ctx.plugin(policy, policy.Config.parse({}));
  await fiber.await();
  assert.equal(fiber.state, 2);
  const scopes = [];
  t.after(async () => {
    for (const scope of scopes) await scope.dispose();
    await ultra.dispose();
    await standard.dispose();
    await root.fiber.dispose();
  });
  async function create(id, preset, depth = 0) {
    const key = { id, options: { subagentDepth: depth }, session: { append() {} } }, scope = createScope(ctx, key);
    scopes.push(scope);
    const binding = bindScopeParent(key, preset === "standard" ? standardKey : ultraKey);
    const agent = Object.assign(key, { ctx: scope.ctx });
    agents.set(id, agent);
    await ctx.serial(scopeTarget(agent, key), "agent/created", { agent });
    return { agent, binding, key };
  }
  function select(entry, preset) {
    entry.binding.rebind(preset === "standard" ? standardKey : ultraKey);
    ctx.emit("tools/change");
    ctx.emit("agent-preset/selected", entry.agent.id, preset);
  }
  async function snapshot(entry) {
    const assembly = await ctx.systemPrompt.assemble({ scope: entry.key });
    return { prompt: renderPrompt(assembly), tools: assembly.tools };
  }
  function assertUltra(s) {
    assert.match(s.prompt, /Selecting this preset is the user's explicit request/);
    assert.match(s.prompt, /Judge the task's complexity yourself/);
    assert.doesNotMatch(s.prompt, /ONLY when explicitly asked/);
    assert.equal(s.tools.filter((x) => x.name === "ultracode_workflows").length, 1);
    assert(s.tools.find((x) => x.name === "workflow").parameters.properties.agent_limit);
    assert(!s.tools.some(x=>["subagent", "subagent_fork"].includes(x.name)));
  }
  function assertStandard(s) {
    assert.match(s.prompt, /ONLY when explicitly asked/);
    assert.doesNotMatch(s.prompt, /Ultracode is selected/);
    assert(!s.tools.some((x) => x.name === "ultracode_workflows"));
    assert(!s.tools.find((x) => x.name === "workflow").parameters.properties.agent_limit);
    assert(s.tools.some(x=>x.name === "subagent_fork"));
  }
  return { ctx, create, select, snapshot, assertUltra, assertStandard, fiber };
}

test("blank standard session switches to Ultracode before its first model request", async (t) => {
  const h = await harness(t), a = await h.create("new", "standard");
  h.assertStandard(await h.snapshot(a));
  h.select(a, "ultracode");
  h.assertUltra(await h.snapshot(a));
});

test("model-specific absent delegation tools do not roll back Ultracode policy", async (t) => {
  const h = await harness(t, ["subagent_fork"]), a = await h.create("model-specific", "ultracode");
  h.assertUltra(await h.snapshot(a));
  h.select(a, "standard"); h.assertStandard(await h.snapshot(a));
  const child = await h.create("model-worker", "ultracode", 1);
  const snapshot = await h.snapshot(child);
  assert.match(snapshot.prompt, /You are a workflow worker/);
  assert(!snapshot.tools.some(x => ["subagent_fork", "workflow"].includes(x.name)));
});

test("switching back cleans up, repeated selections do not duplicate, sessions stay isolated", async (t) => {
  const h = await harness(t), a = await h.create("a", "ultracode"), b = await h.create("b", "standard");
  for (let n = 0; n < 3; n++) {
    h.select(a, "standard"); h.assertStandard(await h.snapshot(a));
    h.select(a, "ultracode"); h.select(a, "ultracode"); h.assertUltra(await h.snapshot(a));
    h.assertStandard(await h.snapshot(b));
  }
});

test("restored Ultracode roots get orchestration and restored workers keep their delegation guard", async (t) => {
  const h = await harness(t), root = await h.create("restored", "ultracode"), child = await h.create("worker", "ultracode", 1);
  h.assertUltra(await h.snapshot(root));
  const worker = await h.snapshot(child);
  assert.match(worker.prompt, /You are a workflow worker/);
  assert(!worker.tools.some((x) => ["workflow", "ultracode_workflows"].includes(x.name)));
});

test("unloading policy releases agent-local tools and prompt", async (t) => {
  const h = await harness(t), a = await h.create("dispose", "ultracode");
  h.assertUltra(await h.snapshot(a));
  await h.fiber.dispose();
  h.assertStandard(await h.snapshot(a));
});
