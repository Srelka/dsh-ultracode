import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { checkpointScript, resumeEntries, foldCheckpoint, CHECKPOINT_RECORD } from "../checkpoint.js";
import { parseScriptFile, resolveScriptFile } from "../script-file.js";
import { installJsonRecovery } from "../recovery.js";

test("script files parse literal metadata without executing expressions", () => {
  const good = parseScriptFile("// Example\nexport const meta = {name:'test',description:'Task',phases:[{title:'Inspect'}]};\nreturn await agent('check');");
  assert.equal(good.meta.name, "test"); assert.match(good.script,/return await/);
  for (const source of ["export const meta=evil(); return 1;", "export const meta={name:process.exit()};", "export const meta={...other};", "export const meta={name:'a',name:'b'};", "export const meta={name:'a'}; import('fs');"])
    assert.throws(()=>parseScriptFile(source));
});

test("file reads use host fs and reject disabled read tools before access", async () => {
  let accessed=false;
  await assert.rejects(resolveScriptFile({fs:{resolve(){accessed=true;}}},{ctx:{tools:{get:()=>null}}},"x",new AbortController().signal),/does not permit/);
  assert.equal(accessed,false);
});

test("script file loading preserves host paths and rejects oversized or invalid scripts", async () => {
  let source = "export const meta={name:'file',description:'Task'}; return 'ok';";
  const signal = new AbortController().signal, target = { path: "host:/workspace/task.js" };
  const ctx = { workingDirectory: { ensure: async()=>"host:/workspace" }, fs: {
    resolve: async(path, options)=>{ assert.equal(path,"task.js"); assert.equal(options.cwd,"host:/workspace"); return target; },
    stat: async()=>({type:"file",size:source.length}), readText:async()=>source, processPath:value=>value.path,
  }};
  const agent = {ctx:{tools:{get:()=>({name:"read"})}}};
  assert.equal((await resolveScriptFile(ctx,agent,"task.js",signal)).path,target.path);
  source="export const meta={name:'bad'}; return await ;";
  await assert.rejects(resolveScriptFile(ctx,agent,"task.js",signal));
  source="x".repeat(256*1024+1);
  await assert.rejects(resolveScriptFile(ctx,agent,"task.js",signal),/256 KiB/);
});

async function execute(body, cache=[]) {
  const calls=[], events=[];
  const context={agent:async (prompt)=>{calls.push(prompt);return prompt==='fail'?null:{answer:prompt};},
    phase:()=>{}, log:text=>events.push(JSON.parse(text.slice(3))),
    parallel:tasks=>Promise.all(tasks.map(t=>t()))};
  const result=await new vm.Script(`(async()=>{${checkpointScript(body,cache,'cp:')}})()`).runInNewContext(context,{timeout:1000});
  return { calls, events, result:JSON.parse(JSON.stringify(result)) };
}
test("replay reuses only exact successful prefix and reruns from first mismatch", async () => {
  const body="return await parallel([()=>agent('A'),()=>agent('B'),()=>agent('C')]);";
  const first=await execute(body);
  const cache=first.events.filter(e=>e.kind==='result').map((e,i)=>({...e,childId:'child-'+i}));
  const replay=await execute(body,cache); assert.equal(replay.calls.length,0); assert.deepEqual(replay.result,first.result);
  const changed=await execute(body.replace("'B'","'new B'"),cache);
  assert.deepEqual(changed.calls,['new B','C']);
  assert.equal(changed.events.filter(e=>e.kind==='hit').length,1);
});
test("cache is invalidated by route, failure or missing prefix result", () => {
  const entry={value:'ok'};
  assert.deepEqual(resumeEntries({checkpoints:{a:{route:'r',entries:{1:entry,3:entry}}}},'a','r'),[entry]);
  assert.deepEqual(resumeEntries({checkpoints:{a:{route:'r',entries:{1:{value:null},2:entry}}}},'a','r'),[]);
  assert.deepEqual(resumeEntries({checkpoints:{a:{route:'r',entries:{1:entry}}}},'a','other'),[]);
});
test("optional checkpoints rebuild independently from legacy execution history",()=>{
  const state={calls:{},runs:{r:{members:[]}},checkpoints:{}};
  const event={type:CHECKPOINT_RECORD,ignorable:true,time:3,data:{version:1,kind:'result',runId:'r',index:1,key:'k',childId:'c',value:'done'}};
  const saved=foldCheckpoint(state,event);assert.equal(saved.checkpoints.r.entries[1].value,'done');assert.equal(state.checkpoints.r,undefined);
  const reused=foldCheckpoint(saved,{...event,data:{...event.data,kind:'hit',label:'Design'}});
  assert.equal(reused.runs.r.members[0].reused,true);
});
test("malformed JSON retry is bounded and never repeats an executed tool call", async()=>{
  let listener; const events=[];
  const agent={session:{snapshotEvents:()=>events,append:(type,data)=>events.push({type,data})}};
  installJsonRecovery({on:(_name,fn)=>{listener=fn;return ()=>{};}},agent);
  const p={agent,turn:1,step:1,provider:'test',failure:{code:'MALFORMED_RESPONSE',message:'DeepSeek Messages stream: tool input is invalid JSON'},signal:new AbortController().signal};
  assert.equal((await listener(p,()=>undefined)).kind,'retry');
  assert.equal((await listener(p,()=>undefined)).kind,'retry');
  assert.equal(await listener(p,()=>undefined),undefined);
  events.push({type:'tool/call',data:{turn:1,step:2}});
  assert.equal(await listener({...p,step:2},()=>undefined),undefined);
  assert.equal(events.filter(e=>e.type==='llm/retry').length,2);
  assert.equal(new Set(events.filter(e=>e.type==='llm/retry').map(e=>e.data.retryId)).size,1);
});
