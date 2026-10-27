// The current PTC boundary accepts provider/model, but not reasoning effort.
// Carry explicit options through model and unwrap BEFORE native child admission;
// real routes, never this envelope, reach child descriptors or LLM requests.
export const ROUTE_PREFIX = "ultracode-route-v1:";

export function routeOptions(parent, requested) {
  const baseline = parent.session.requestHeader?.()?.config ?? parent.options;
  const route = {
    provider: requested.provider ?? baseline.provider,
    model: requested.model ?? baseline.model,
  };
  const changed = route.provider !== baseline.provider || route.model !== baseline.model;
  const effort = requested.reasoning_effort ?? (!changed ? baseline.reasoningEffort : undefined);
  for (const [key, value] of Object.entries({ ...route, ...requested }))
    if (typeof value !== "string" || !value.trim() || value !== value.trim())
      throw new Error(`Ultracode: ${key} must be a non-empty model/effort id.`);
  if (effort !== undefined) route.reasoningEffort = effort;
  return route;
}

export function routingSubagents(native, llm) {
  return {
    getProvider: (...args) => native.getProvider(...args),
    async startActivation(spec) {
      const options = spec.request.agentOptions;
      if (!options) return native.startActivation(spec);
      spec.signal.throwIfAborted();
      let requested = options;
      if (options.model?.startsWith(ROUTE_PREFIX)) {
        requested = JSON.parse(options.model.slice(ROUTE_PREFIX.length));
        if (!requested || Array.isArray(requested) || typeof requested !== "object" ||
            Object.keys(requested).some(key => !["provider", "model", "reasoning_effort"].includes(key)))
          throw new Error("Ultracode: invalid child model selection.");
      }
      const route = routeOptions(spec.request.parent, requested);
      // Exact-model validation also checks adapter-owned efforts and defaults.
      // Do not fall back to the parent's model after an invalid explicit choice.
      const resolved = await llm.resolveCallConfig(route, spec.signal);
      spec.signal.throwIfAborted();
      return native.startActivation({ ...spec, request: { ...spec.request,
        agentOptions: { provider: resolved.provider, model: resolved.model,
          ...(resolved.reasoningEffort === undefined ? {} : { reasoningEffort: resolved.reasoningEffort }) },
      } });
    },
  };
}

export function modelDiscovery(ctx, defineTool) {
  return defineTool({
    name: "ultracode_models",
    description: "No arguments: show this agent's current model/effort and configured providers. With provider: list advertised models. With provider and model: inspect its efforts. Read-only. Use exact ids in agent(prompt, {provider, model, reasoning_effort}) only when the user requests a selection; for effort-only changes omit provider/model.",
    parameters: { provider: { type: "string" }, model: { type: "string" } },
    output: { schema: { type: "json" }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
    async execute(args, exec) {
      const llm = ctx.llm;
      exec.signal.throwIfAborted();
      if (args.model !== undefined && args.provider === undefined) throw new Error("model requires provider.");
      const providers = llm.listProviders();
      if (args.provider === undefined) {
        const selected = exec.agent.session.requestHeader?.()?.config ?? exec.agent.options;
        return { current: { provider: selected.provider, model: selected.model,
          ...(selected.reasoningEffort === undefined ? {} : { reasoning_effort: selected.reasoningEffort }) },
          providers: providers.map(({ id, name }) => ({ id, name })),
        };
      }
      if (!providers.some(p => p.id === args.provider)) throw new Error(`Unknown LLM provider: ${args.provider}`);
      const brief = m => ({ id: m.id, name: m.name,
        ...(m.reasoning ? { efforts: m.reasoning.efforts.map(e => ({ id: e.id, name: e.name })),
          ...(m.reasoning.defaultEffort === undefined ? {} : { defaultEffort: m.reasoning.defaultEffort }) } : {}),
      });
      if (args.model === undefined) return (await llm.listModels(args.provider)).map(brief);
      return brief(await llm.resolveModelInfo(args.provider, args.model, exec.signal));
    },
  });
}
