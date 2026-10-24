import test from "node:test";
import assert from "node:assert/strict";
import { memberDiagnostic, readMemberDiagnostic, DIAGNOSTIC_RECORD } from "../diagnostics.js";
import { emptyState, fold, latestAccepted } from "../model.js";

test("diagnostics use the final turn, never earlier recovered tool errors", () => {
  assert.equal(memberDiagnostic([{type:"turn/end",data:{reason:{kind:"aborted",reason:{kind:"parent"}}}}],"failed").kind,"cancelled");
  for (const [code,kind] of [["MALFORMED_RESPONSE","model_format"],["RATE_LIMIT","rate_limit"],["NETWORK_ERROR","connection"],["AUTHENTICATION","authentication"]])
    assert.equal(memberDiagnostic([{type:"turn/end",data:{reason:{kind:"error",error:{code,message:"test failure"}}}}],"failed").kind,kind);
  assert.equal(memberDiagnostic([{type:"tool/result",data:{message:{isError:true}}},{type:"turn/end",data:{reason:{kind:"completed"}}}],"failed").kind,"unknown");
});

test("child diagnostics read host observations without resuming an agent and always dispose", async () => {
  let disposed=0;
  const ctx={agents:{get:()=>undefined},get:()=>({observeSession:async(id,options)=>{
    assert.equal(id,"child");assert.equal(options.projectionMode,"none");
    return {events:[{type:"turn/end",data:{reason:{kind:"max-tokens"}}}], [Symbol.dispose](){disposed++;}};
  }})};
  assert.equal((await readMemberDiagnostic(ctx,"child","failed")).kind,"max_tokens");
  assert.equal(disposed,1);
  assert.equal((await readMemberDiagnostic({get:()=>({observeSession:async()=>{throw Error("missing")}})},"child","failed")).kind,"unknown");
});

function fixture({interruptError=false, interrupted=true, outcome="failed"}={}) {
  let state=emptyState({agentPreset:"ultracode"}), seq=0;
  const send=(type,data,extra={})=>state=fold(state,{type,data,time:++seq,seq,...extra});
  send("tool/call",{name:"workflow",callId:"w",arguments:{meta:{name:"test"}}});
  send("tool-workflow/run-start",{runId:"r"});
  send("tool/result",{message:{source:{callId:"w"},content:[]},meta:{ultracode:{workflowId:"w",runId:"r",jobId:"j",revision:1}}});
  send("tool-workflow/agent-start",{runId:"r",seq:1,childId:"child",label:"check"});
  if(interrupted){
    send("tool/call",{name:"interrupt_agent",callId:"stop",arguments:JSON.stringify({agent_id:"child"})});
    send("tool/result",{message:{source:{callId:"stop"},isError:interruptError,content:[]}});
  }
  send("tool-workflow/agent-end",{runId:"r",seq:1,outcome});
  send("tool-workflow/run-end",{runId:"r",stopReason:"completed"});
  return {send,current:()=>latestAccepted(state,"w")};
}

test("legacy successful interrupt explains failed child and prevents an all-complete badge",()=>{
  const h=fixture(),r=h.current();
  assert.equal(r.status,"attention");assert.equal(r.executionStatus,"completed");assert.equal(r.issueCount,1);
  assert.equal(r.members[0].status,"cancelled");assert.equal(r.members[0].diagnostic.kind,"parent_cancelled");
  h.send(DIAGNOSTIC_RECORD,{version:1,runId:"r",seq:1,childId:"child",diagnostic:{kind:"unknown"}},{ignorable:true});
  assert.equal(h.current().members[0].diagnostic.kind,"parent_cancelled");
  h.send(DIAGNOSTIC_RECORD,{version:1,runId:"r",seq:1,childId:"child",diagnostic:{kind:"cancelled"}},{ignorable:true});
  assert.equal(h.current().members[0].diagnostic.kind,"parent_cancelled");
});

test("failed interrupt is not blamed for failure; a completed child stays completed after a racing stop",()=>{
  const failed=fixture({interruptError:true}).current();
  assert.equal(failed.members[0].status,"failed");assert.equal(failed.members[0].diagnostic,undefined);
  const completed=fixture({outcome:"completed"}).current();
  assert.equal(completed.status,"completed");assert.equal(completed.issueCount,0);
});

test("optional detailed diagnosis survives replay and only targets its exact child",()=>{
  const h=fixture({interrupted:false});
  const record={version:1,runId:"r",seq:1,childId:"other",diagnostic:{kind:"model_format",code:"MALFORMED_RESPONSE",message:"tool input is invalid JSON"}};
  h.send(DIAGNOSTIC_RECORD,record,{ignorable:true});assert.equal(h.current().members[0].diagnostic,undefined);
  h.send(DIAGNOSTIC_RECORD,{...record,childId:"child"},{ignorable:true});
  assert.equal(h.current().members[0].diagnostic.kind,"model_format");assert.equal(h.current().status,"attention");
});
