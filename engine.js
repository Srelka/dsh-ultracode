import { routingSubagents } from "./routing.js";

export const inject = ["loader", "subagents", "llm", "ptcRuntime", "sandboxPolicy", "workingDirectory"];

// Keep the installed native engine and its config/lifecycle. The service facade
// exists only below this engine's context; standard mode and root routing are untouched.
export async function apply(ctx, config) {
  const { default: NativeEngine } = await ctx.loader.import("@deepseek-ai/dsh-workflow-ptc");
  if (typeof ctx.subagents.startActivation !== "function" || typeof ctx.llm.resolveCallConfig !== "function")
    throw new Error("Ultracode model selection requires native child admission and LLM route validation.");
  const scoped = ctx.isolate("subagents").isolate("workflowEngine");
  const facade = routingSubagents(ctx.subagents, ctx.llm);
  await scoped.plugin({ name: "ultracode-routing", apply: child => { child.provide("subagents", facade); } }).await();
  const engine = scoped.plugin(NativeEngine, config);
  await engine.await();
  if (engine.state !== 2) throw new Error(`Ultracode native workflow engine could not start (${engine.state}).`);
  let native;
  await scoped.inject(["workflowEngine"], child => { native = child.workflowEngine; }).await();
  // Capture the engine in its own scope: Cordis otherwise traces service calls
  // back to the caller and would resolve the caller's unadapted subagents service.
  ctx.provide("workflowEngine", { start: request => native.start(request) });
}
