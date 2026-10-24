import { z } from "zod";
import { emptyState, fold, view, PROJECTION_KEY } from "./model.js";
export const inject = ["sessionProjections"];
export function apply(ctx) {
  const record = z.record(z.string(), z.unknown());
  ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateVersion: 4,
    stateSchema: z.object({
      enabled: z.boolean(),
      calls: record,
      runs: record,
      jobs: record,
      reads: z.record(z.string(), z.string()),
      checkpoints: record,
    }),
    init: emptyState,
    apply: fold,
    wire: {
      viewSchema: z.object({
        enabled: z.boolean(),
        workflows: z.array(z.unknown()),
      }),
      view,
    },
  });
}
