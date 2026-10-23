import { z } from "zod";
import { findBaseEntry, derivePlugins } from "./derive.js";

export const inject = ["loader", "agentPresets"];
export const Config = z
  .object({
    basePreset: z.string().min(1).default("standard"),
    maxConcurrentAgents: z.number().int().min(1).max(16).default(4),
    defaultAgentLimit: z.number().int().min(1).default(12),
    maxTotalAgents: z.number().int().min(1).default(40),
    replacementTimeoutMs: z.number().int().min(1000).default(30000),
  })
  .prefault({});

export async function apply(ctx, config) {
  let registrationContext = ctx,
    plugins;
  try {
    if (config.basePreset === "ultracode")
      throw new Error("Ultracode cannot inherit itself.");
    if (config.defaultAgentLimit > config.maxTotalAgents)
      throw new Error("defaultAgentLimit must not exceed maxTotalAgents.");
    const source = findBaseEntry(ctx.loader, config.basePreset);
    // Keep relative plugin paths, includes and !!js evaluation in the base resolution context.
    registrationContext = ctx.extend({ baseUrl: source.ctx.baseUrl });
    plugins = derivePlugins(source.options.config.plugins, config);
  } catch (error) {
    const reason = `Ultracode could not derive from ${config.basePreset}: ${error.message}`;
    ctx.logger.warn(reason);
    plugins = [
      {
        id: "ultracode-unavailable",
        name: "@srelka/dsh-ultracode/unavailable",
        config: { reason },
      },
    ];
  }
  // No source-change subscription: one snapshot per plugin activation, normally startup.
  await ctx.effect(
    () =>
      registrationContext.agentPresets.register({
        id: "ultracode",
        name: "Ultracode",
        order: 10,
        description:
          "继承当前标准模式，仅覆盖多 Agent 编排；模型与思考强度独立选择。",
        plugins,
      }),
    "Ultracode: derived preset",
  );
}
