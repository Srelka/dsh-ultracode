import fs from "node:fs";
import vm from "node:vm";

// Render/interaction contract harness; geometry and animation are checked in DSH.
export function dockHarness(projection, { source, language = "zh", ui = {}, openChild = async () => {}, killJob = async () => true } = {}) {
  source ??= fs.readFileSync(new URL("../client.js", import.meta.url), "utf8");
  let plugin, locale, cursor = 0, tree;
  const states = [], slots = new Map(), fragment = Symbol("fragment");
  const React = {
    Fragment: fragment,
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef: value => ({ current: value }), useEffect() {}, useLayoutEffect() {},
  };
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: module => { plugin = module.factory(() => React); } } },
    sessionStorage: { getItem: () => JSON.stringify(ui) },
    Date: class extends Date { static now() { return 120000; } },
  });
  plugin.apply({
    effect: fn => fn(), locale: { register: (_, value) => { locale = value; } },
    slots: { inject: (_, fn) => fn(), register: (definition, render) => slots.set(definition.name, render) },
  });
  const t = (key, values = {}) => (locale[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name]);
  function resolve(node) {
    if (node == null || typeof node === "boolean") return [];
    if (Array.isArray(node)) return node.flatMap(resolve);
    if (typeof node !== "object") return [node];
    if (typeof node.type === "function") return resolve(node.type(node.props));
    if (node.type === fragment) return resolve(node.props.children);
    return [{ ...node, props: { ...node.props, children: resolve(node.props.children) } }];
  }
  function render() {
    cursor = 0;
    tree = resolve(slots.get("conversation.composer.dock")({
      sessionId: "test-session", useProjection: () => projection, openChild, killJob, t,
    }));
    return tree;
  }
  function all(predicate) {
    const result = [];
    const visit = nodes => nodes.forEach(node => {
      if (node && typeof node === "object") {
        if (predicate(node)) result.push(node);
        visit(node.props.children);
      }
    });
    visit(tree);
    return result;
  }
  return {
    render, all, states,
    text: () => JSON.stringify(tree),
    snapshot: () => JSON.parse(JSON.stringify(tree, (key, value) =>
      key === "ref" || key === "key" || typeof value === "function" ? undefined : value)),
  };
}

export function sampleProjection() {
  const first = {
    id: "r1", number: 1, title: "Task", reason: "", status: "replaced", accepted: true,
    startedAt: 1000, endedAt: 3000, agentLimit: 4, phases: ["Build", "Check"],
    members: [], reused: [], error: null, output: "old result", jobId: "job1",
  };
  const second = { ...first, id: "r2", number: 2, status: "attention", issueCount: 1, jobId: "job2",
    reason: "Adjusted", members: [
      { seq: 1, childId: "child1", label: "Builder", phase: "Build", status: "completed", startedAt: 1000, endedAt: 2000, reused: true },
      { seq: 2, childId: "child2", label: "Verifier", phase: "Check", status: "cancelled", startedAt: 2000, endedAt: 3000,
        diagnostic: { kind: "parent_cancelled", code: "ABORTED", message: "" } },
    ], reused: [{ childId: "child1", reason: "Exact prefix" }] };
  const running = { ...first, id: "r3", number: 1, title: "Other task", status: "running", endedAt: null, jobId: "job3" };
  return { enabled: true, workflows: [
    { id: "task", title: "Task", current: "r2", revisions: [first, second] },
    { id: "other", title: "Other task", current: "r3", revisions: [running] },
  ] };
}
