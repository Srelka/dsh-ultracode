import test from "node:test";
import assert from "node:assert/strict";
import fs from 'node:fs';
import {semver} from './host-runtime.mjs';
import { derivePlugins, findBaseEntry } from "../derive.js";
import { apply, Config } from "../inherit.js";
import { loadHostApi, assertRuntimeServices } from "../host-api.js";
const config = Config.parse({});
test('compatibility admits tested and same-minor runtimes, excluding older and next-minor previews',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));
 const accepts=version=>semver.satisfies(version,manifest.engines.dsh,{includePrerelease:true});
 assert(accepts('0.2.1-rc.2'));assert(accepts('0.2.2-rc.1'));assert(!accepts('0.2.1-rc.1'));assert(!accepts('0.3.0-alpha.1'));assert(!accepts('0.3.0'));
 assert.deepEqual(Object.keys(manifest.dependencies).sort(),['acorn','zod']);
});
const recipe = () => [
  {
    id: "persona",
    name: "@deepseek-ai/dsh-persona",
    config: { prefix: "current standard" },
  },
  {
    id: "os-tool",
    name: "example",
    disabled: { __jsExpr: "process.platform !== 'win32'" },
    config: { path: "./relative.json" },
  },
  {
    id: "renamed-team",
    name: "cordis:group",
    group: true,
    isolate: { workflowEngine: true, otherService: true },
    config: [
      {
        id: "engine-renamed",
        name: "@deepseek-ai/dsh-workflow-ptc",
        config: { provider: "spawn", futureOption: true },
      },
      {
        id: "tool-renamed",
        name: "@deepseek-ai/dsh-tool-workflow",
        config: { maxResultChars: 12345 },
      },
    ],
  },
];
const entry = (plugins) => ({
  options: {
    name: "@deepseek-ai/dsh-agent-preset",
    config: { id: "standard", plugins },
  },
  ctx: { baseUrl: "file:///profile/cordis.yml" },
  disabled: false,
});
test("only orchestration limits and policy differ; raw expressions and other config survive", () => {
  const source = recipe(),
    before = structuredClone(source),
    derived = derivePlugins(source, config);
  assert.deepEqual(source, before);
  assert.deepEqual(derived.slice(0, 2), source.slice(0, 2));
  assert.deepEqual(derived[2].config[0].config, {
    provider: "spawn",
    futureOption: true,
    maxConcurrentAgents: 4,
    maxTotalAgents: 40,
  });
  assert.deepEqual(derived[2].config[1], source[2].config[1]);
  assert.equal(derived[2].config[0].name, "@srelka/dsh-ultracode/engine");
  assert.equal(derived[2].isolate.otherService, true);
  assert.equal(derived[2].config.at(-1).name, "@srelka/dsh-ultracode/preset");
});
test("restart derivation follows updated standard, while an existing snapshot stays unchanged", () => {
  const source = recipe(),
    first = derivePlugins(source, config);
  source[0].config.prefix = "updated";
  source.push({ id: "new-tool", name: "future-tool" });
  const second = derivePlugins(source, config);
  assert.equal(first[0].config.prefix, "current standard");
  assert.equal(first.length, 3);
  assert.equal(second[0].config.prefix, "updated");
  assert.equal(second.at(-1).name, "future-tool");
});

test("Ultracode omits native delegation registrations without changing standard or providers", () => {
  const source = recipe();
  source[2].config.push({id:"spawn-tool",name:"@deepseek-ai/dsh-tool-subagent",config:{toolName:"subagent",modelSelectionSettings:true}});
  source[2].config.push({id:"fork-tool",name:"@deepseek-ai/dsh-tool-subagent",config:{toolName:"subagent_fork",provider:"fork"}});
  const before=structuredClone(source), derived=derivePlugins(source,config);
  assert.deepEqual(source,before);
  assert(derived[2].config.filter(x=>x.name==="@deepseek-ai/dsh-tool-subagent").every(x=>x.disabled===true));
  assert.equal(derived[2].config[0].config.provider,"spawn");
});
test("disabled or missing native workflow never silently enables a replacement", () => {
  const source = recipe();
  source[2].disabled = true;
  assert.throws(() => derivePlugins(source, config), /unconditionally enabled/);
  assert.throws(() => derivePlugins(source.slice(0, 2), config), /exactly one/);
  source[2].disabled = false;
  source[2].config[0].disabled = { __jsExpr: "true" };
  assert.throws(() => derivePlugins(source, config), /unconditionally enabled/);
});
test("ambiguous engines, wrong isolation and renamed tool fail with diagnostics", () => {
  const a = recipe();
  a[2].config.push(structuredClone(a[2].config[0]));
  assert.throws(() => derivePlugins(a, config), /exactly one/);
  const b = recipe();
  delete b[2].isolate;
  assert.throws(() => derivePlugins(b, config), /isolated/);
  const c = recipe();
  c[2].config[1].config.toolName = "custom";
  assert.throws(() => derivePlugins(c, config), /name "workflow"/);
});
test("whole-config expressions are not flattened or evaluated twice", () => {
  const a = recipe();
  a[2].config[0].config = { __jsExpr: "customConfig" };
  assert.throws(() => derivePlugins(a, config), /must be an object/);
});
test("base discovery uses identity, preserves resolution base and rejects ambiguous declarations", () => {
  const base = entry(recipe());
  const loader = {
    *entries() {
      yield { options: { name: "other", config: { id: "standard" } } };
      yield base;
    },
  };
  assert.equal(findBaseEntry(loader, "standard"), base);
  assert.throws(
    () => findBaseEntry({ entries: () => [base, base] }, "standard"),
    /exactly one/,
  );
  base.disabled = true;
  assert.throws(() => findBaseEntry(loader, "standard"), /disabled/);
});
test("bootstrap registers once, owns disposal, and does not subscribe to base changes", async () => {
  const base = entry(recipe()),
    registrations = [];
  let disposed = false,
    extended;
  const ctx = {
    loader: { entries: () => [base] },
    logger: { warn() {} },
    extend(options) {
      extended = options;
      return this;
    },
    agentPresets: {
      async register(def) {
        registrations.push(def);
        return () => {
          disposed = true;
        };
      },
    },
    async effect(setup) {
      this.release = await setup();
    },
  };
  await apply(ctx, config);
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].id, "ultracode");
  assert.equal(extended.baseUrl, base.ctx.baseUrl);
  base.options.config.plugins[0].config.prefix = "changed live";
  assert.equal(registrations[0].plugins[0].config.prefix, "current standard");
  ctx.release();
  assert(disposed);
});
test("invalid base stays visible as an unavailable Ultracode preset", async () => {
  let registered;
  const ctx = {
    loader: { entries: () => [] },
    logger: { warn() {} },
    agentPresets: {
      async register(d) {
        registered = d;
        return () => {};
      },
    },
    effect: async (setup) => setup(),
  };
  await apply(ctx, config);
  assert.equal(registered.id, "ultracode");
  assert.equal(registered.plugins[0].name, "@srelka/dsh-ultracode/unavailable");
  assert.match(registered.plugins[0].config.reason, /base preset/);
});
test("host helper API is resolved by Loader and fails on an unsupported contract", async () => {
  const names = [],
    fn = () => {};
  const ctx = {
    loader: {
      async import(name) {
        names.push(name);
        return {
          defineTool: fn,
          validateJsonSchemaValue: fn,
          validateMeta: fn,
          scopeOf: fn,
          scopeChainOf: fn,
          appendPluginRecord: fn,
        };
      },
    },
  };
  const sdk = await loadHostApi(ctx);
  assert.equal(sdk.defineTool, fn);
  assert.deepEqual(names, [
    "@deepseek-ai/dsh-tools",
    "@deepseek-ai/dsh-workflow-ptc",
    "@deepseek-ai/dsh-scope",
    "@deepseek-ai/dsh-session",
  ]);
  await assert.rejects(
    loadHostApi({ loader: { import: async () => ({}) } }),
    /incompatible/,
  );
});
test("missing runtime service methods fail before any workflow executes", () => {
  assert.throws(
    () =>
      assertRuntimeServices({
        tools: { get() {}, register() {}, restrict() {} },
      }),
    /tools.guard/,
  );
});
