import test from "node:test";
import assert from "node:assert/strict";
import { dockHarness, sampleProjection } from "./client-harness.mjs";
const byClass = name => node => node.props.className === name;

test("member causes, details, reuse and phase preferences survive component extraction", async () => {
  const opened = [];
  const h = dockHarness(sampleProjection(), { ui: { workflowId: "task" }, openChild: async (...args) => opened.push(args) });
  h.render();
  assert.match(h.text(), /被主代理中止/);
  assert.equal(h.all(byClass("uc-banner uc-notice")).length, 0);
  assert.equal(h.all(byClass("uc-phase"))[1].props.open, true);
  h.all(byClass("uc-member"))[1].props.onClick(); h.render();
  assert.match(h.text(), /ABORTED/);
  assert.match(h.text(), /已完成结果保留/);
  const detail = h.all(byClass("uc-detail"))[0];
  const open = detail.props.children.find(n => n.type === "button");
  await open.props.onClick();
  assert.deepEqual(opened, [["test-session", "child2"]]);
  h.all(byClass("uc-phase"))[1].props.onToggle({ currentTarget: { open: false } });
  h.render(); assert.equal(h.all(byClass("uc-phase"))[1].props.open, false);
});

test("history and independent workflow selection retain their current versions", () => {
  const h = dockHarness(sampleProjection(), { ui: { workflowId: "task" } });
  h.render(); h.all(byClass("uc-history"))[0].props.onClick(); h.render();
  assert.equal(h.all(byClass("uc-revision")).length, 2);
  const old = h.all(byClass("uc-revision"))[1];
  old.props.children[0].props.children[0].props.onClick(); h.render();
  assert.match(h.text(), /正在查看历史版本/);
  const back = h.all(n => n.type === "button" && n.props.children.includes("返回当前"))[0];
  back.props.onClick(); h.render(); assert.match(h.text(), /已结束，有异常/);
  h.all(byClass("uc-picker"))[0].props.onClick(); h.render();
  h.all(byClass("uc-option"))[0].props.onClick(); h.render();
  assert.equal(h.all(byClass("uc-menu")).length, 0);
  assert.match(h.text(), /Other task/);
});

test("collapse and two-step stop keep their existing behavior", async () => {
  const stopped = [];
  const h = dockHarness(sampleProjection(), { killJob: async (...args) => { stopped.push(args); return true; } });
  h.render();
  const stop = () => h.all(n => n.type === "button" && n.props.children.some(x => x === "停止运行" || x === "确认停止"))[0];
  await stop().props.onClick(); h.render(); assert.equal(stopped.length, 0);
  await stop().props.onClick(); h.render(); assert.deepEqual(stopped, [["test-session", "job3"]]);
  assert.equal(h.all(byClass("uc-anchor")).length, 0);
  h.all(n => n.type === "button" && n.props["aria-label"] === "收起工作流")[0].props.onClick(); h.render();
  assert.equal(h.all(byClass("uc-panel")).length, 0);
  h.all(byClass("uc-anchor"))[0].props.onClick(); h.render();
  assert.equal(h.all(byClass("uc-panel")).length, 1);
});

test("opening an unavailable member and a rejected stop show existing errors", async () => {
  const h = dockHarness(sampleProjection(), { ui: { workflowId: "task" }, openChild: async () => { throw Error(); } });
  h.render(); h.all(byClass("uc-member"))[0].props.onClick(); h.render();
  await h.all(byClass("uc-detail"))[0].props.children.find(n=>n.type === "button").props.onClick();
  h.render(); assert.match(h.text(), /该子 Agent 当前不可打开/);
  const k = dockHarness(sampleProjection(), { killJob: async () => false });
  k.render();
  const stop = () => k.all(n=>n.type === "button" && n.props.children.some(x=>x === "停止运行" || x === "确认停止"))[0];
  await stop().props.onClick(); k.render(); await stop().props.onClick(); k.render();
  assert.match(k.text(), /停止失败/);
});

test("structured native output opens as Markdown sections without losing raw data", () => {
  const p = sampleProjection(), r = p.workflows[0].revisions[1];
  r.output = JSON.stringify({ research: "## 结论\n\n**通过**\n\n|项|值|\n|---|---|\n|A|1|", build: { files: ["a.js", "b.js"], valid: true }, check: "" }) + "\n\nUltracode: the script returned, but these members did not complete: Verifier. Inspect ultracode_workflows for their causes. Do not report full success without verifying how these tasks were resolved.\n[status: completed, 3 agents; 1 did not complete]";
  const h = dockHarness(p, { ui: { workflowId: "task" } });
  h.render();
  assert.equal(h.all(n => n.type === "dialog").length, 0);
  assert.equal(h.all(n => n.type === "pre").length, 0);
  const preview = h.all(byClass("uc-result-preview"))[0].props.children.join("");
  assert.match(preview, /结论/); assert.doesNotMatch(preview, /research|\\n|\*\*/);
  h.all(byClass("uc-result"))[0].props.onClick(); h.render();
  assert.equal(h.all(n => n.type === "dialog").length, 1);
  assert.ok(h.all(n => n.props["data-markdown"]).some(n => n.props.children.includes("a.js")));
  assert.ok(h.all(n => n.type === "pre").some(n => n.props.children.includes(r.output)));
  assert.match(h.text(), /build/); assert.match(h.text(), /true/);
  h.all(n => n.type === "button" && n.props["aria-label"] === "关闭")[0].props.onClick(); h.render();
  assert.equal(h.all(n => n.type === "dialog").length, 0);
});

test("plain, malformed and scalar outputs remain readable and inspectable", () => {
  for (const output of ["# 普通报告\n\n- 已完成", '{"partial": "truncated', "null", "false", "0", '"line one\\nline two"', '[]', '{}']) {
    const p=sampleProjection(); p.workflows[0].revisions[1].output=output;
    const h=dockHarness(p,{ui:{workflowId:"task"}});h.render();
    h.all(byClass("uc-result"))[0].props.onClick();h.render();
    assert.ok(h.all(n=>n.type==="pre").some(n=>n.props.children.includes(output)));
    assert.equal(h.all(n=>n.type==="dialog").length,1);
  }
});

test("reuse counts as completed progress and no summary warning is duplicated", () => {
  const h=dockHarness(sampleProjection(),{ui:{workflowId:"task"}});h.render();
  const progress=h.all(n=>n.props.role==="progressbar")[0];
  assert.equal(progress.props["aria-valuenow"],1);assert.equal(progress.props["aria-valuemax"],2);
  assert.equal(h.all(byClass("uc-status")).length,1);
  assert.equal(h.all(byClass("uc-banner uc-notice")).length,0);
  assert.match(h.text(),/被主代理中止/);
});

test("changing workflow closes an open result reader and keeps the original projection intact", () => {
  const p=sampleProjection(), before=JSON.stringify(p);
  const h=dockHarness(p,{ui:{workflowId:"task"}});h.render();
  h.all(byClass("uc-result"))[0].props.onClick();h.render();
  h.all(byClass("uc-picker"))[0].props.onClick();h.render();
  h.all(byClass("uc-option"))[0].props.onClick();h.render();
  assert.equal(h.all(n=>n.type==="dialog").length,0);
  assert.equal(JSON.stringify(p),before);
});

test("reader ignores the opening click and closes only after a backdrop press", () => {
  const h=dockHarness(sampleProjection(),{ui:{workflowId:"task"}});h.render();
  h.all(byClass("uc-result"))[0].props.onClick();h.render();
  const dialog=h.all(n=>n.type==="dialog")[0], target={};
  dialog.props.onClick({target,currentTarget:target});h.render();
  assert.equal(h.all(n=>n.type==="dialog").length,1);
  const next=h.all(n=>n.type==="dialog")[0];
  next.props.onPointerDown({target,currentTarget:target});
  next.props.onClick({target,currentTarget:target});h.render();
  assert.equal(h.all(n=>n.type==="dialog").length,0);
  assert.equal(h.all(byClass("uc-panel")).length,1);
});
