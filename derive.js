const PRESET_MODULE = "@deepseek-ai/dsh-agent-preset";
const ENGINE_MODULE = "@deepseek-ai/dsh-workflow-ptc";
const TOOL_MODULE = "@deepseek-ai/dsh-tool-workflow";
const POLICY_MODULE = "@srelka/dsh-ultracode/preset";

/** Read final Loader declarations, not a shipped file or registry private map. */
export function findBaseEntry(loader, basePreset) {
  const matches = [...loader.entries()].filter(
    (entry) =>
      entry.options.name === PRESET_MODULE &&
      entry.options.config?.id === basePreset,
  );
  if (matches.length !== 1)
    throw new Error(
      `Expected exactly one declaration for base preset "${basePreset}"; found ${matches.length}.`,
    );
  const entry = matches[0];
  if (entry.disabled)
    throw new Error(`Base preset "${basePreset}" is disabled.`);
  if (!entry.ctx.baseUrl)
    throw new Error("The base preset has no module resolution base.");
  return entry;
}

/** Snapshot at activation. Only workflow engine limits and the policy row differ. */
export function derivePlugins(source, config) {
  if (!Array.isArray(source))
    throw new Error("The base preset must declare a plugin list.");
  const plugins = structuredClone(source),
    engines = [],
    tools = [],
    policies = [];
  const visit = (rows, realm = null, disabled = false) => {
    for (const row of rows) {
      const unavailable = disabled || !!row.disabled;
      if (row.name === ENGINE_MODULE)
        engines.push({ row, realm, unavailable });
      if (row.name === TOOL_MODULE) tools.push({ row, realm, unavailable });
      if (row.name === POLICY_MODULE) policies.push(row);
      // Native model-selection delegation can register tools directly on each
      // agent; inherited tool restrictions cannot hide those registrations.
      // Ultracode delegates through workflow(), so omit these competing tools
      // from this derived preset only. The native providers remain available.
      if (row.name === "@deepseek-ai/dsh-tool-subagent") row.disabled = true;
      if (
        row.group === true ||
        row.name === "cordis:group" ||
        row.name === "@deepseek-ai/cordis-plugin-group"
      ) {
        if (!Array.isArray(row.config))
          throw new Error(
            `Group "${row.id ?? row.name}" does not contain a declarative list.`,
          );
        visit(
          row.config,
          row.isolate?.workflowEngine ? row : realm,
          unavailable,
        );
      }
    }
  };
  visit(plugins);
  if (engines.length !== 1 || tools.length !== 1 || policies.length)
    throw new Error(
      "The base preset must contain exactly one native workflow engine and one workflow tool, without an Ultracode policy.",
    );
  const engine = engines[0],
    tool = tools[0];
  if (!engine.realm || engine.realm !== tool.realm)
    throw new Error(
      "The workflow provider and tool must share an isolated workflowEngine group.",
    );
  if (engine.unavailable || tool.unavailable)
    throw new Error(
      "Required workflow components and their groups must be unconditionally enabled in the base preset.",
    );
  if (
    engine.row.config !== undefined &&
    (engine.row.config === null ||
      typeof engine.row.config !== "object" ||
      Array.isArray(engine.row.config) ||
      "__jsExpr" in engine.row.config)
  )
    throw new Error(
      "The workflow engine config must be an object so only its limits can be overridden.",
    );
  if (
    tool.row.config?.toolName !== undefined &&
    tool.row.config.toolName !== "workflow"
  )
    throw new Error(
      'Ultracode requires the native workflow tool to retain the name "workflow".',
    );
  if (engine.realm.config.some((row) => row.id === "ultracode-policy"))
    throw new Error(
      "The base preset already uses the reserved ultracode-policy row id.",
    );
  // Give the derived orchestrator its own realm, including when the base used a named realm.
  engine.realm.isolate = { ...engine.realm.isolate, workflowEngine: true };
  engine.row.config = {
    ...engine.row.config,
    maxConcurrentAgents: config.maxConcurrentAgents,
    maxTotalAgents: config.maxTotalAgents,
  };
  engine.realm.config.push({
    id: "ultracode-policy",
    name: POLICY_MODULE,
    config: {
      defaultAgentLimit: config.defaultAgentLimit,
      maxTotalAgents: config.maxTotalAgents,
      replacementTimeoutMs: config.replacementTimeoutMs,
    },
  });
  return plugins;
}
