import test from "node:test";
import assert from "node:assert/strict";
import { dockHarness, sampleProjection } from "./client-harness.mjs";
const byClass = name => node => node.props.className === name;

test("member causes, details, reuse and phase preferences survive component extraction", async () => {
  const opened = [];
  const h = dockHarness(sampleProjection(), { ui: { workflowId: "task" }, openChild: async (...args) => opened.push(args) });
  h.render();
  assert.match(h.text(), /被主代理中止/);
  assert.equal(h.all(byClass("uc-banner uc-notice")).length, 1);
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
  h.all(byClass("uc-anchor"))[0].props.onClick(); h.render();
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
