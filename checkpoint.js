import { ROUTE_PREFIX } from "./routing.js";
export const CHECKPOINT_RECORD = "plugin:ultracode/checkpoint";

export function foldCheckpoint(state, event) {
  const d = event.data;
  if (event.ignorable !== true || !d || d.version !== 1 || typeof d.runId !== "string") return state;
  const records = state.checkpoints ?? {}, run = records[d.runId] ?? { entries: {}, route: d.route };
  if (d.kind === "init") return { ...state, checkpoints: { ...records, [d.runId]: { entries: {}, route: d.route } } };
  if (d.kind === "result" && Number.isInteger(d.index) && d.index > 0 && typeof d.key === "string" && typeof d.childId === "string") {
    return { ...state, checkpoints: { ...records, [d.runId]: { ...run, entries: { ...run.entries, [d.index]: d } } } };
  }
  if (d.kind === "hit" && Number.isInteger(d.index) && typeof d.childId === "string") {
    const current = state.runs[d.runId];
    if (!current) return state;
    const member = { seq: d.index, childId: d.childId, label: d.label || "Reused result", phase: d.phase ?? null,
      status: "completed", startedAt: event.time, endedAt: event.time, reused: true };
    return { ...state, runs: { ...state.runs, [d.runId]: { ...current, members: [...current.members, member].sort((a,b)=>a.seq-b.seq) } } };
  }
  return state;
}

export function resumeEntries(state, runId, route) {
  const cached = state.checkpoints?.[runId];
  if (!cached || cached.route !== route) return [];
  const result = [];
  for (let i=1;;i++) {
    const entry = cached.entries[i];
    if (!entry || entry.value === null || entry.value === undefined) break;
    result.push(entry);
  }
  return result;
}

// Helpers and cache live outside the author's body. Every miss still delegates
// through the host's agent() implementation, sandbox, permissions and limits.
export function checkpointScript(body, cached, marker) {
  return `return await (async (__ucNativeAgent, __ucNativePhase, __ucNativeLog) => {
const __ucCache = ${JSON.stringify(cached)}, __ucMarker = ${JSON.stringify(marker)};
let __ucIndex = 0, __ucMiss = 0, __ucReuse = true, __ucPhase = null;
const __ucEmit = value => __ucNativeLog(__ucMarker + JSON.stringify(value));
const __ucPhaseFn = title => { __ucPhase = title; return __ucNativePhase(title); };
const __ucAgentFn = async (prompt, options) => {
  const index = ++__ucIndex, opts = options || {}, key = JSON.stringify([prompt, opts]);
  const old = __ucCache[index - 1];
  if (__ucReuse && old && old.key === key) {
    __ucEmit({kind:'hit', index, key, value:old.value, childId:old.childId, label:opts.label || old.label, phase:opts.phase || __ucPhase});
    return JSON.parse(JSON.stringify(old.value));
  }
  __ucReuse = false;
  const nativeIndex = ++__ucMiss;
  __ucEmit({kind:'begin', index, nativeIndex, key, label:opts.label || 'Agent ' + index, phase:opts.phase || __ucPhase});
  let nativeOptions = options;
  if (opts.reasoning_effort !== undefined) {
    const { provider, model, reasoning_effort, ...rest } = opts;
    nativeOptions = {...rest, model: ${JSON.stringify(ROUTE_PREFIX)} + JSON.stringify({provider, model, reasoning_effort})};
  }
  const value = await __ucNativeAgent(prompt, nativeOptions);
  __ucEmit({kind:'result', index, nativeIndex, key, value, label:opts.label || 'Agent ' + index, phase:opts.phase || __ucPhase});
  return value;
};
return await (async (agent, phase) => {
${body}
})(__ucAgentFn, __ucPhaseFn);
})(agent, phase, log);`;
}
