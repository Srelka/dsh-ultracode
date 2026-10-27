import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { ROUTE_PREFIX, routeOptions, routingSubagents, modelDiscovery } from "../routing.js";
import { checkpointScript } from "../checkpoint.js";
import * as engine from "../engine.js";
import { hostImport, api } from "./host-runtime.mjs";

const parent = () => ({ options: { provider: "old", model: "old", reasoningEffort: "low" },
  session: { requestHeader: () => ({config:{provider:"qa",model:"main",reasoningEffort:"high"}}) } });
const spec = (options) => ({ provider: "spawn", delivery: "caller", label: "Test",
  signal: new AbortController().signal, request: {parent:parent(), prompt:[{type:"text",text:"Test"}], ...(options ? {agentOptions:options} : {})} });
const envelope = options => ({model: ROUTE_PREFIX + JSON.stringify(options)});

test("routing uses current parent selection, independent effort and new-model defaults", () => {
  assert.deepEqual(routeOptions(parent(), {}), {provider:"qa",model:"main",reasoningEffort:"high"});
  assert.deepEqual(routeOptions(parent(), {reasoning_effort:"low"}), {provider:"qa",model:"main",reasoningEffort:"low"});
  assert.deepEqual(routeOptions(parent(), {model:"review"}), {provider:"qa",model:"review"});
  assert.deepEqual(routeOptions(parent(), {provider:"other",model:"review",reasoning_effort:"max"}), {provider:"other",model:"review",reasoningEffort:"max"});
  for (const requested of [{model:""},{provider:" qa"},{reasoning_effort:null},{reasoning_effort:3}])
    assert.throws(() => routeOptions(parent(), requested));
});

test("native admission receives real options; default starts are untouched and parents do not mutate", async () => {
  const calls=[], checks=[];
  const native={getProvider:id=>({name:id}),startActivation:async s=>{calls.push(s);return {childId:"child"};}};
  const facade=routingSubagents(native,{resolveCallConfig:async config=>{checks.push(config);return {...config,reasoningEffort:config.reasoningEffort??"medium"};}});
  const inherited=spec(); await facade.startActivation(inherited); assert.equal(calls[0],inherited); assert.equal(checks.length,0);
  const explicit=spec(envelope({provider:"other",model:"review",reasoning_effort:"low"}));
  await facade.startActivation(explicit);
  assert.deepEqual(calls[1].request.agentOptions,{provider:"other",model:"review",reasoningEffort:"low"});
  assert.equal(calls[1].request.parent,explicit.request.parent);
  assert.equal(calls[1].delivery,"caller"); assert.equal(calls[1].signal,explicit.signal);
  await facade.startActivation(spec({model:"review"}));
  assert.deepEqual(calls[2].request.agentOptions,{provider:"qa",model:"review",reasoningEffort:"medium"});
  assert.equal(explicit.request.parent.session.requestHeader().config.reasoningEffort,"high");
});

test("invalid selection and cancellation fail before creating any child, without fallback", async () => {
  let starts=0;
  const facade=routingSubagents({startActivation(){starts++;}}, {resolveCallConfig:async()=>{throw Error("unsupported effort");}});
  await assert.rejects(facade.startActivation(spec(envelope({reasoning_effort:"impossible"}))),/unsupported effort/);
  await assert.rejects(facade.startActivation(spec(envelope({maxTokens:999}))),/invalid child/);
  const s=spec(envelope({reasoning_effort:"low"}));
  const cancelled=routingSubagents({startActivation(){starts++;}}, {resolveCallConfig:async route=>route});
  const controller=new AbortController();s.signal=controller.signal;controller.abort();
  await assert.rejects(cancelled.startActivation(s),/abort/i); assert.equal(starts,0);
});

test("discovery returns ids and model efforts without provider configuration or secrets", async () => {
  const info={id:"review",name:"Review",reasoning:{efforts:[{id:"low",name:"Low"}],defaultEffort:"low"},secret:"never expose"};
  const tool=modelDiscovery({llm:{listProviders:()=>[{id:"qa",name:"QA",apiKey:"never expose"}],listModels:async()=>[info],resolveModelInfo:async()=>info}},api.defineTool);
  const exec={signal:new AbortController().signal,agent:parent()};
  assert.deepEqual(await tool.execute({},exec),{current:{provider:"qa",model:"main",reasoning_effort:"high"},providers:[{id:"qa",name:"QA"}]});
  const detail=await tool.execute({provider:"qa",model:"review"},exec);
  assert.equal(detail.defaultEffort,"low"); assert.equal(detail.secret,undefined);
  const plain=await tool.execute({}, {...exec,agent:{options:{provider:"qa",model:"plain"},session:{}}});
  assert(!Object.hasOwn(plain.current,"reasoning_effort"));
  await assert.rejects(tool.execute({model:"review"},exec),/requires provider/);
  await assert.rejects(tool.execute({provider:"missing"},exec),/Unknown LLM provider/);
});

test("checkpoint transport retains original model choices in keys and invalidates changed effort", async () => {
  async function run(body, cache=[]) {
    const calls=[],events=[];
    const result=await new vm.Script(`(async()=>{${checkpointScript(body,cache,"cp:")}})()`).runInNewContext({
      agent:async(prompt,opts)=>{calls.push({prompt,opts:JSON.parse(JSON.stringify(opts))});return "done";},
      phase(){},log:s=>events.push(JSON.parse(s.slice(3))),
    });return {calls,events,result};
  }
  const body="await agent('first',{label:'A',reasoning_effort:'low'}); return await agent('second',{label:'B',model:'review'});";
  const first=await run(body),cache=first.events.filter(e=>e.kind==='result').map((e,i)=>({...e,childId:'c'+i}));
  assert.deepEqual(JSON.parse(first.calls[0].opts.model.slice(ROUTE_PREFIX.length)),{reasoning_effort:"low"});
  assert.equal(first.calls[0].opts.reasoning_effort,undefined);
  assert.equal((await run(body,cache)).calls.length,0);
  const changed=await run(body.replace("'low'","'high'"),cache);
  assert.equal(changed.calls.length,2);
  assert(!cache[0].key.includes(ROUTE_PREFIX));
});

test("engine extension is scoped and delegates to the installed native PTC engine", async t => {
  const {Context}=await hostImport("@deepseek-ai/cordis");
  const calls=[],events=[],root=new Context(), native={getProvider:()=>({name:"spawn"}),startActivation:async spec=>{
    calls.push(spec);return {childId:"child-"+calls.length,result:Promise.resolve({output:"done",stopReason:"completed"}),dispose:async()=>{}};
  }};
  root.provide("loader",{import:hostImport}); root.provide("subagents",native);
  root.provide("llm",{resolveCallConfig:async r=>r});
  // Exercise the installed native guest + host protocol, substituting only the
  // process transport and child LLM. This is not a sandbox or real-model test.
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  root.provide("ptcRuntime",{language:"typescript",resolve:r=>r,run:async r=>({value:await new AsyncFunction("workflowHost",r.program)(r.bindings[0].functions)})});
  root.provide("sandboxPolicy",{resolve:()=>({mode:"danger-full-access"})}); root.provide("workingDirectory",{ensure:async()=>process.cwd()});
  const scope=root.isolate("workflowEngine");
  const fiber=scope.plugin(engine,{});t.after(()=>root.fiber.dispose());await fiber.await();
  assert.equal(fiber.state,2);
  assert.equal(root.subagents,native); assert.equal(root.workflowEngine,undefined);
  let actual;
  await scope.inject(["workflowEngine"], ctx => { actual=ctx.workflowEngine; }).await();
  assert.equal(typeof actual.start,"function");
  scope.on("workflow/agent-start",(_,member)=>events.push(member));
  const run=actual.start({script:checkpointScript("return await parallel([()=>agent('inherit'),()=>agent('review',{provider:'other',model:'review',reasoning_effort:'low'})]);",[],"cp:"),meta:{name:"test",description:"Test"},parent:parent()});
  const result=await run.result;await run.dispose();
  assert.equal(result.stopReason,"completed",result.error);
  assert.equal(calls.length,2);assert.equal(events.length,2);
  assert.equal(calls[0].request.agentOptions,undefined);
  assert.deepEqual(calls[1].request.agentOptions,{provider:"other",model:"review",reasoningEffort:"low"});
});
