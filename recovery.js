import { randomUUID } from "node:crypto";

// This hook runs before the host commits an assistant message or executes its
// tool calls. It never retries an already executed file write or workflow.
export function installJsonRecovery(ctx, agent) {
  let position = "", retries = 0, retryId;
  return ctx.on("agent/request-error", async (payload, next) => {
    if (payload.agent !== agent || payload.failure?.code !== "MALFORMED_RESPONSE" || !payload.failure.message?.includes("tool input is invalid JSON")) return next();
    const key = `${payload.turn}:${payload.step}`;
    if (position !== key) { position = key; retries = 0; retryId = randomUUID(); }
    if (payload.signal.aborted || retries >= 2) return;
    if (agent.session.snapshotEvents().some(e=>e.type === "tool/call" && e.data.turn === payload.turn && e.data.step === payload.step)) return;
    const retry = ++retries;
    agent.session.append("llm/retry", { retryId, turn: payload.turn, step: payload.step,
      provider: payload.provider, mode: "normal", policyKey: "ultracode-json-v1", retry,
      maxRetries: 2, delayMs: 0, failure: payload.failure });
    agent.session.append("llm/retry-started", { retryId, turn: payload.turn, step: payload.step, retry });
    return { kind: "retry" };
  });
}
