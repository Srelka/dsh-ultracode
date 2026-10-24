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
  h.all(byClass("uc-all-tasks"))[0].props.onClick(); h.render();
  h.all(byClass("uc-member"))[1].props.onClick(); h.render();
  assert.match(h.text(), /ABORTED/);
  assert.match(h.text(), /已完成结果保留/);
  const detail = h.all(byClass("uc-detail"))[0];
  const open = detail.props.children.find(n => n.type === "button");
  await open.props.onClick();
  assert.deepEqual(opened, [["test-session", "child2"]]);
  h.all(n=>n.type === "button" && n.props["aria-label"] === "关闭")[0].props.onClick(); h.render();
  h.all(byClass("uc-node"))[0].props.onClick(); h.render();
  assert.equal(h.all(byClass("uc-node"))[0].props["aria-current"], "step");
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
  h.render(); h.all(byClass("uc-all-tasks"))[0].props.onClick(); h.render(); h.all(byClass("uc-member"))[0].props.onClick(); h.render();
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

test("bookmarks follow active work until the user pins a phase, with an explicit return", () => {
  const p=sampleProjection(),r=p.workflows[0].revisions[1];
  r.members[1].status='running';r.status='running';
  const h=dockHarness(p,{ui:{workflowId:'task'}});h.render();
  assert.equal(h.all(byClass('uc-node'))[1].props['aria-current'],'step');
  h.all(byClass('uc-node'))[0].props.onClick();h.render();
  assert.equal(h.all(byClass('uc-node'))[0].props['aria-current'],'step');
  r.members[1].status='completed';h.render();
  assert.equal(h.all(byClass('uc-node'))[0].props['aria-current'],'step');
  h.all(byClass('uc-follow'))[0].props.onClick();h.render();
  assert.equal(h.all(byClass('uc-node'))[1].props['aria-current'],'step');
});

test("large workflows remain reachable through the phase selector and complete member reader", () => {
  const p=sampleProjection(),r=p.workflows[0].revisions[1];
  r.phases=Array.from({length:9},(_,i)=>'Stage '+i);
  r.members=Array.from({length:30},(_,i)=>({seq:i+1,childId:'child'+i,label:'Member '+i,phase:r.phases[i%9],status:i===29?'running':'completed'}));
  r.status='running';const before=JSON.stringify(p);
  const h=dockHarness(p,{ui:{workflowId:'task'}});h.render();
  assert.equal(h.all(byClass('uc-node')).length,3);
  assert.equal(h.all(n=>n.type==='option').length,9);
  assert.ok(h.all(byClass('uc-member uc-member-preview')).length<=3);
  h.all(byClass('uc-stage-picker'))[0].props.onChange({target:{value:'Stage 8'}});h.render();
  assert.match(h.text(),/Stage 8/);
  h.all(byClass('uc-all-tasks'))[0].props.onClick();h.render();
  assert.equal(h.all(byClass('uc-member')).length,30);
  assert.equal(h.all(byClass('uc-task-group')).length,9);
  assert.equal(JSON.stringify(p),before);
});

test("member preview prioritizes causes and opens the matching full record", () => {
  const p=sampleProjection(),r=p.workflows[0].revisions[1];
  r.phases=['Build'];r.members=Array.from({length:8},(_,i)=>({seq:i+1,label:'Worker '+i,phase:'Build',childId:'c'+i,status:i===7?'failed':'completed'}));
  const h=dockHarness(p,{ui:{workflowId:'task'}});h.render();
  const previews=h.all(byClass('uc-member uc-member-preview'));
  assert.equal(previews.length,3);assert.match(JSON.stringify(previews[0]),/Worker 7/);
  previews[0].props.onClick();h.render();
  assert.equal(h.all(byClass('uc-member')).filter(n=>n.props['aria-expanded']).length,1);
  assert.match(h.text(),/未返回有效结果/);
});

test("comet effects run only while a workflow is live and has actual completed progress", () => {
  for(const status of ['running','starting','completed','attention','failed','cancelled','interrupted','replaced']){
    const p=sampleProjection();p.workflows[0].revisions[1].status=status;
    const h=dockHarness(p,{ui:{workflowId:'task'}});h.render();
    const flowing=h.all(n=>n.props.className==='uc-progress uc-flowing').length===1;
    assert.equal(flowing,['running','starting'].includes(status),status);
  }
  const h=dockHarness(sampleProjection());h.render();
  assert.equal(h.all(n=>n.props.className==='uc-progress uc-flowing').length,0);
});

test("historical bookmark choice and legacy UI preferences do not alter stored workflow data", () => {
  const p=sampleProjection(),before=JSON.stringify(p);
  const h=dockHarness(p,{ui:{workflowId:'task',revisionId:'r1',phases:{'r1:Build':false},bookmarks:{r1:'Check',r2:'Build'}}});h.render();
  assert.equal(h.all(byClass('uc-node'))[1].props['aria-current'],'step');
  h.all(byClass('uc-node'))[0].props.onClick();h.render();
  assert.equal(JSON.stringify(p),before);
  assert.match(h.text(),/正在查看历史版本/);
});
