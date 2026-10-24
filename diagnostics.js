export const DIAGNOSTIC_RECORD = "plugin:ultracode/diagnostic";

export function memberDiagnostic(events, outcome) {
  const reason = events.findLast(e => e.type === "turn/end")?.data?.reason;
  if (reason?.kind === "aborted")
    return { kind: "cancelled", code: "ABORTED", message: "" };
  if (reason?.kind === "max-tokens" || reason?.kind === "refusal")
    return { kind: reason.kind === "max-tokens" ? "max_tokens" : "refusal", code: reason.kind, message: "" };
  if (reason?.kind === "error") {
    const code = String(reason.error?.code || "UNKNOWN");
    const message = String(reason.error?.message || "").slice(0, 2000);
    const value = `${code} ${message}`;
    const kind = /MALFORMED_RESPONSE|invalid JSON/i.test(value) ? "model_format"
      : /RATE_LIMIT|rate limit|HTTP 429|status[=: ]+429/i.test(value) ? "rate_limit"
      : /UNAUTHORIZED|AUTHENTICATION|HTTP (401|403)|status[=: ]+(401|403)/i.test(value) ? "authentication"
      : /NETWORK|TIMEOUT|ETIMEDOUT|ECONN|fetch failed/i.test(value) ? "connection"
      : "error";
    return { kind, code, message };
  }
  return { kind: outcome === "cancelled" ? "cancelled" : "unknown", code: "", message: "" };
}

// Observe child history through the host query service; never open or resume the child.
export async function readMemberDiagnostic(ctx, childId, outcome) {
  const live = ctx.agents?.get(childId)?.session;
  if (live) return memberDiagnostic(live.snapshotEvents(), outcome);
  const query = ctx.get?.("sessionQuery");
  if (!query?.observeSession) return memberDiagnostic([], outcome);
  let observation;
  try {
    observation = await query.observeSession(childId, { projectionMode: "none" });
    return memberDiagnostic(observation.events, outcome);
  } catch {
    return memberDiagnostic([], outcome);
  } finally {
    observation?.[Symbol.dispose]();
  }
}
