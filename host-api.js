/** Import helpers through the host Loader, never through a bundled old DSH runtime. */
export async function loadHostApi(ctx) {
  if (typeof ctx.loader?.import !== "function")
    throw new Error("Ultracode requires the host Loader import API.");
  const [tools, workflow, scope, session] = await Promise.all([
    ctx.loader.import("@deepseek-ai/dsh-tools"),
    ctx.loader.import("@deepseek-ai/dsh-workflow-ptc"),
    ctx.loader.import("@deepseek-ai/dsh-scope"),
    ctx.loader.import("@deepseek-ai/dsh-session"),
  ]);
  const api = {
    defineTool: tools.defineTool,
    validateJsonSchemaValue: tools.validateJsonSchemaValue,
    validateMeta: workflow.validateMeta,
    scopeOf: scope.scopeOf,
    scopeChainOf: scope.scopeChainOf,
    appendPluginRecord: session.appendPluginRecord,
  };
  for (const [name, value] of Object.entries(api))
    if (typeof value !== "function")
      throw new Error(
        `Ultracode is incompatible with this DSH runtime: ${name} is unavailable.`,
      );
  return api;
}

export function assertRuntimeServices(ctx) {
  const required = {
    tools: ["get", "register", "restrict", "guard"],
    systemPrompt: ["section", "getSectionOrder"],
    workflowEngine: ["start"],
    jobs: ["start", "get", "list", "kill", "wait"],
    sessionProjections: ["stateOf"],
  };
  for (const [service, methods] of Object.entries(required))
    for (const method of methods)
      if (typeof ctx[service]?.[method] !== "function")
        throw new Error(
          `Ultracode is incompatible with this DSH runtime: ${service}.${method} is unavailable.`,
        );
}
