window.__ModuleLoader__.load({
  id: "@srelka/dsh-ultracode",
  factory(require) {
    const React = require("react"),
      h = React.createElement;
    const { useState, useEffect, useLayoutEffect, useRef, useMemo } = React;
    const { MarkdownText } = require("@deepseek-ai/dsh-client-ui-primitives");
    const zh = {
      workflows: "工作流",
      running: "运行中",
      starting: "启动中",
      completed: "已完成",
      attention: "已结束，有异常",
      viewResult: "查看完整结果",
      rawResult: "原始数据",
      close: "关闭",
      copy: "复制",
      copied: "已复制",
      footnotes: "脚注",
      wrap: "换行",
      unwrap: "不换行",
      cause_parent_cancelled: "被主代理中止",
      cause_cancelled: "执行被中止",
      cause_interrupted: "执行已中断",
      cause_model_format: "模型返回格式异常",
      cause_rate_limit: "模型服务请求受限",
      cause_authentication: "模型服务认证失败",
      cause_connection: "连接失败或请求超时",
      cause_max_tokens: "已达到模型输出上限",
      cause_refusal: "模型未接受该任务",
      cause_error: "子代理执行出错",
      cause_unknown: "未返回有效结果，详细原因未记录",
      action_cancelled: "如仍需要该结果，让主代理重跑此项；已完成结果保留。",
      action_retry: "查看子代理记录；原因处理后，让主代理重跑未完成项。",
      action_authentication: "检查当前模型的登录或 API 配置，再重跑此项。",
      action_connection: "检查连接和服务状态，再重跑此项。",
      action_rate_limit: "等待服务限流解除后，再重跑此项。",
      technical: "错误详情",
      failed: "失败",
      cancelled: "已取消",
      interrupted: "已中断",
      replaced: "已替换",
      history: "调整记录",
      back: "返回当前",
      collapse: "收起工作流",
      expand: "展开工作流",
      phase: "未分阶段",
      empty: "尚未启动代理",
      agents: "已启动 {count} 个代理",
      limit: "代理上限 {count}",
      version: "v{version}",
      reused: "复用 {count} 项结果",
      replayed: "已复用完成结果",
      result: "执行结果",
      noResult: "主 Agent 读取后台结果后会显示在这里。",
      cancel: "停止运行",
      confirm: "确认停止",
      cancelError: "停止失败，请查看后台任务状态。",
      openChild: "打开子 Agent",
      childUnavailable: "该子 Agent 当前不可打开。",
      activeOther: "另有 {count} 个工作流运行中",
      returnActive: "查看运行中",
      historical: "正在查看历史版本",
      replacement: "同一任务的新版本",
      initial: "初始执行",
      untitled: "未命名工作流",
      unknown: "未知状态",
      background: "后台完成后自动继续",
      reusedCaution: "包含主 Agent 声明及脚本检查点复用，具体依据见各项记录。",
      busy: "正在停止…",
      move: "拖动工作流卡片；方向键移动，Home 或双击回到右上角",
    };
    const en = {
      workflows: "Workflows",
      running: "Running",
      starting: "Starting",
      completed: "Completed",
      attention: "Finished with issues",
      viewResult: "Read full result",
      rawResult: "Raw data",
      close: "Close",
      copy: "Copy",
      copied: "Copied",
      footnotes: "Footnotes",
      wrap: "Wrap",
      unwrap: "Unwrap",
      cause_parent_cancelled: "Stopped by the main agent",
      cause_cancelled: "Execution was stopped",
      cause_interrupted: "Execution was interrupted",
      cause_model_format: "Invalid model response format",
      cause_rate_limit: "Model service rate limit",
      cause_authentication: "Model authentication failed",
      cause_connection: "Connection failed or timed out",
      cause_max_tokens: "Model output limit reached",
      cause_refusal: "The model declined this task",
      cause_error: "Agent execution failed",
      cause_unknown: "No valid result; no detailed cause was recorded",
      action_cancelled: "Ask the main agent to rerun this task if still needed. Completed results are retained.",
      action_retry: "Inspect the agent record, address the cause, then ask the main agent to rerun unfinished work.",
      action_authentication: "Check model sign-in or API settings, then retry this task.",
      action_connection: "Check connectivity and service availability, then retry this task.",
      action_rate_limit: "Retry this task after the service rate limit clears.",
      technical: "Error details",
      failed: "Failed",
      cancelled: "Cancelled",
      interrupted: "Interrupted",
      replaced: "Replaced",
      history: "Revisions",
      back: "Back to current",
      collapse: "Collapse workflow",
      expand: "Expand workflow",
      phase: "Unphased",
      empty: "No agents started",
      agents: "{count} agents started",
      limit: "Agent cap {count}",
      version: "v{version}",
      reused: "{count} results reused",
      replayed: "Completed result replayed",
      result: "Result",
      noResult:
        "The result appears after the main agent reads the background output.",
      cancel: "Stop run",
      confirm: "Confirm stop",
      cancelError: "Could not stop the job. Check its status.",
      openChild: "Open agent",
      childUnavailable: "This agent is not available to open.",
      activeOther: "{count} other workflows running",
      returnActive: "View active",
      historical: "Viewing a historical revision",
      replacement: "New revision of the same task",
      initial: "Initial run",
      untitled: "Untitled workflow",
      unknown: "Unknown status",
      background: "Completion resumes the main agent",
      reusedCaution:
        "Includes agent-declared reuse and completed script checkpoints; inspect each record's reason.",
      busy: "Stopping…",
      move: "Drag workflow; arrow keys move, Home or double-click resets position",
    };
    const paths = {
      close: "m5 5 10 10M15 5 5 15",
      document: "M6 2h6l4 4v12H4V2h2M11 2v5h5M7 11h6M7 14h6",
      branch: "M6 3v12a3 3 0 0 0 3 3h3M6 8h8a4 4 0 0 0 4-4V3",
      chevron: "m8 4 6 6-6 6",
      minus: "M4 10h12",
      check: "m4 10 4 4 8-8",
      error: "M10 4v7M10 15v.1",
      history: "M4 5v4h4M4.6 8a7 7 0 1 1 .3 6M10 6v4l3 2",
      open: "M12 3h5v5M17 3l-8 8M8 4H4v12h12v-4",
    };
    function Icon({ name = "branch" }) {
      return h(
        "svg",
        {
          viewBox: "0 0 20 20",
          width: 16,
          height: 16,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.5,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
        },
        h("path", { d: paths[name] || paths.branch }),
      );
    }
    function Dot({ status }) {
      const running = status === "running" || status === "starting";
      return h(
        "span",
        { className: "uc-dot uc-" + status, "aria-hidden": true },
        running
          ? h("svg", { className: "uc-spinner", viewBox: "0 0 20 20", width: 12, height: 12, fill: "none" },
              h("circle", { className: "uc-spinner-track", cx: 10, cy: 10, r: 7.5, stroke: "currentColor", strokeWidth: 2.25 }),
              h("circle", { className: "uc-spinner-arc", cx: 10, cy: 10, r: 7.5, stroke: "currentColor", strokeWidth: 2.25, strokeDasharray: "32 15.124", strokeLinecap: "round", transform: "rotate(-90 10 10)" }),
            )
          : status === "completed"
            ? h(Icon, { name: "check" })
            : status === "failed" || status === "attention"
              ? h(Icon, { name: "error" })
              : null,
      );
    }
    function duration(a, b) {
      if (!a) return "—";
      const s = Math.max(0, Math.round(((b || Date.now()) - a) / 1000));
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }
    function memberIssue(member) {
      if (!["failed", "cancelled", "interrupted"].includes(member.status)) return null;
      const kind = member.diagnostic?.kind || (member.status === "failed" ? "unknown" : member.status);
      return {
        cause: `cause_${kind}` in zh ? `cause_${kind}` : "cause_unknown",
        action: ["parent_cancelled", "cancelled", "interrupted"].includes(kind) ? "action_cancelled"
          : `action_${kind}` in zh ? `action_${kind}` : "action_retry",
      };
    }
    function loadUI(id) {
      try {
        return (
          JSON.parse(
            sessionStorage.getItem("dsh.ultracode.ui." + id) || "null",
          ) || {}
        );
      } catch {
        return {};
      }
    }
    function useFloatingCard(rootRef, enabled, collapsed, position, commit) {
      const panelRef = useRef(null),
        drag = useRef(null),
        frame = useRef(0);
      const saved = useRef(position);
      saved.current = position;
      const [dragging, setDragging] = useState(false);
      const [placement, setPlacement] = useState({
        right: 18,
        top: 82,
        maxHeight: "calc(100dvh - 98px)",
      });
      const composer = () => rootRef.current?.closest('[data-phase]')?.querySelector('[data-composer-seat]');
      const lowerEdge = () => Math.max(242, Math.min(innerHeight - 16, (composer()?.getBoundingClientRect().top ?? innerHeight) - 12));
      const bounds = () => {
        const panel = panelRef.current,
          seat = composer();
        const rect = panel?.getBoundingClientRect(),
          area = seat?.getBoundingClientRect();
        const width = panel?.offsetWidth ?? 340,
          height = Math.min(panel?.offsetHeight ?? 300, innerHeight - 98);
        const right = Math.max(
          16,
          Math.min(innerWidth, area?.right ?? innerWidth) - width - 16,
        );
        return {
          left: Math.max(16, Math.min((area?.left ?? 0) + 16, right)),
          right,
          top: 82,
          bottom: Math.max(82, lowerEdge() - height),
          rect,
        };
      };
      const clamp = (p, b) => ({
        x: Math.max(b.left, Math.min(b.right, p.x)),
        y: Math.max(b.top, Math.min(b.bottom, p.y)),
      });
      const place = (p) =>
        setPlacement((old) => {
          const next = {
            left: p.x,
            top: p.y,
            maxHeight: Math.max(160, lowerEdge() - p.y),
          };
          return old.left === next.left &&
            old.top === next.top &&
            old.maxHeight === next.maxHeight
            ? old
            : next;
        });
      const restore = () => {
        if (!panelRef.current || drag.current) return;
        const b = bounds(),
          p = saved.current;
        place(
          clamp(
            p && Number.isFinite(p.x) && Number.isFinite(p.y)
              ? p
              : { x: b.right, y: b.top },
            b,
          ),
        );
      };
      const finish = (cancel = false) => {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        cancelAnimationFrame(frame.current);
        setDragging(false);
        if (d.moved && !cancel) {
          const b = bounds(),
            p = clamp(d.latest, b);
          if (Math.abs(p.x - b.right) < 12) p.x = b.right;
          if (Math.abs(p.x - b.left) < 12) p.x = b.left;
          if (Math.abs(p.y - b.top) < 12) p.y = b.top;
          place(p);
          commit(p);
        } else restore();
        if (d.handle.hasPointerCapture(d.id))
          d.handle.releasePointerCapture(d.id);
      };
      useLayoutEffect(() => {
        if (!enabled || collapsed) return;
        const panel = panelRef.current,
          seat = composer();
        if (!panel) return;
        const observer = new ResizeObserver(restore);
        observer.observe(panel);
        if (seat) observer.observe(seat);
        restore();
        window.addEventListener("resize", restore);
        const blur = () => finish(true);
        window.addEventListener("blur", blur);
        return () => {
          observer.disconnect();
          window.removeEventListener("resize", restore);
          window.removeEventListener("blur", blur);
          cancelAnimationFrame(frame.current);
          drag.current = null;
        };
      }, [enabled, collapsed]);
      useLayoutEffect(() => {
        restore();
      }, [position]);
      const reset = () => {
        finish(true);
        commit(null);
        const b = bounds();
        place({ x: b.right, y: b.top });
      };
      return {
        panelRef,
        placement,
        dragging,
        handle: {
          onPointerDown: (e) => {
            if (e.button !== 0 || !e.isPrimary) return;
            const b = bounds();
            if (!b.rect) return;
            e.preventDefault();
            e.currentTarget.focus({ preventScroll: true });
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              id: e.pointerId,
              handle: e.currentTarget,
              start: { x: e.clientX, y: e.clientY },
              origin: { x: b.rect.left, y: b.rect.top },
              latest: { x: b.rect.left, y: b.rect.top },
              moved: false,
            };
          },
          onPointerMove: (e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId) return;
            const dx = e.clientX - d.start.x,
              dy = e.clientY - d.start.y;
            if (!d.moved && Math.hypot(dx, dy) < 4) return;
            d.moved = true;
            setDragging(true);
            d.latest = clamp(
              { x: d.origin.x + dx, y: d.origin.y + dy },
              bounds(),
            );
            cancelAnimationFrame(frame.current);
            frame.current = requestAnimationFrame(() => {
              if (drag.current === d) place(d.latest);
            });
          },
          onPointerUp: (e) => {
            if (drag.current?.id === e.pointerId) finish();
          },
          onPointerCancel: () => finish(true),
          onLostPointerCapture: () => finish(true),
          onDoubleClick: reset,
          onKeyDown: (e) => {
            if (e.key === "Escape" && drag.current) {
              e.stopPropagation();
              e.preventDefault();
              finish(true);
              return;
            }
            if (e.key === "Home") {
              e.preventDefault();
              reset();
              return;
            }
            const delta = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            }[e.key];
            if (!delta) return;
            e.preventDefault();
            const b = bounds(),
              step = e.shiftKey ? 32 : 12;
            const p = clamp(
              {
                x: b.rect.left + delta[0] * step,
                y: b.rect.top + delta[1] * step,
              },
              b,
            );
            place(p);
            commit(p);
          },
        },
      };
    }
    const CSS = `
.uc-slot{--uc-bg:var(--dsw-alias-bg-base);--uc-ink:var(--dsw-alias-label-primary);--uc-muted:var(--dsw-alias-label-tertiary);--uc-line:var(--dsw-alias-border-l1);--uc-blue:var(--dsw-alias-state-business-primary);--uc-error:var(--dsw-alias-state-error-primary);position:relative;box-sizing:border-box;display:contents;color:var(--uc-ink);font-family:var(--dsw-font-family);font-size:12px;line-height:1.6;isolation:isolate}
.uc-slot *{box-sizing:border-box}.uc-slot button{font:inherit;color:inherit;cursor:pointer}.uc-slot button:focus-visible,.uc-slot summary:focus-visible{outline:2px solid var(--uc-blue);outline-offset:3px}.uc-slot svg{flex:none;vertical-align:middle}.uc-slot .uc-iconbutton{display:inline-grid;place-items:center;border:0;background:transparent;padding:4px;border-radius:6px;color:var(--uc-muted)}.uc-slot .uc-iconbutton:hover{background:color-mix(in srgb,var(--uc-bg) 70%,transparent)}
.uc-slot .uc-panel{position:fixed;top:82px;width:min(340px,calc(100vw - 56px));max-height:calc(100dvh - 98px);display:flex;flex-direction:column;overflow:hidden;overscroll-behavior:contain;scrollbar-width:thin;border-radius:18px;z-index:40;border:1px solid color-mix(in srgb,var(--uc-line) 52%,transparent);background:linear-gradient(145deg,color-mix(in srgb,var(--uc-bg) 97%,transparent),color-mix(in srgb,var(--uc-bg) 94%,transparent));backdrop-filter:blur(20px) saturate(145%);-webkit-backdrop-filter:blur(20px) saturate(145%);box-shadow:0 18px 45px -18px color-mix(in srgb,var(--uc-ink) 25%,transparent),0 5px 12px -7px color-mix(in srgb,var(--uc-ink) 20%,transparent),inset 0 2px 1px color-mix(in srgb,var(--uc-bg) 92%,transparent),inset 2px 0 2px color-mix(in srgb,var(--uc-bg) 88%,transparent),inset 0 -1px 2px color-mix(in srgb,var(--uc-blue) 13%,transparent)}
.uc-slot .uc-top{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:15px 17px 9px}.uc-slot .uc-brand{display:flex;align-items:center;gap:7px;color:var(--uc-muted);font-size:11px}.uc-slot .uc-tools{display:flex;align-items:center;gap:4px}.uc-slot .uc-picker{display:flex;align-items:center;gap:5px;background:none;border:0;font-size:11px;color:var(--uc-muted);padding:3px}.uc-slot .uc-picker svg{width:11px;height:11px;transform:rotate(90deg)}
.uc-slot .uc-body{padding:4px 20px 16px;overflow:auto;min-height:0;overscroll-behavior:contain;scrollbar-width:thin}.uc-slot .uc-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.uc-slot .uc-title h3{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;font-weight:550;line-height:1.65;letter-spacing:0;margin:0;overflow-wrap:anywhere}.uc-slot .uc-status{display:flex;align-items:center;gap:5px;font-size:10px;white-space:nowrap;color:var(--uc-muted)}.uc-slot .uc-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0 15px;color:var(--uc-muted);font-size:10px;font-variant-numeric:tabular-nums}.uc-slot .uc-link{background:none;border:0;color:var(--uc-blue);padding:0;font-size:11px;text-align:left}.uc-slot .uc-link:hover{text-decoration:underline;text-underline-offset:3px}
.uc-slot .uc-dot{width:12px;height:12px;display:inline-grid;place-items:center;color:var(--uc-muted);border:1px solid color-mix(in srgb,var(--uc-muted) 60%,transparent);border-radius:50%;flex:none}.uc-slot .uc-dot svg{width:10px;height:10px}.uc-slot .uc-dot.uc-running,.uc-slot .uc-dot.uc-starting{color:var(--uc-blue);border:0}.uc-slot .uc-dot.uc-failed{color:var(--uc-error);border-color:var(--uc-error)}.uc-slot .uc-dot.uc-replaced{border-style:dashed}
.uc-slot .uc-banner{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;margin-bottom:12px;border-radius:8px;background:color-mix(in srgb,var(--uc-blue) 6%,transparent);font-size:11px;color:var(--uc-muted);overflow-wrap:anywhere}.uc-slot .uc-errorbox{max-height:96px;overflow:auto;font-size:11px;color:var(--uc-error);background:color-mix(in srgb,var(--uc-error) 6%,transparent);padding:9px 10px;border-radius:7px;margin-bottom:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.uc-slot .uc-phase{border-top:1px solid color-mix(in srgb,var(--uc-line) 65%,transparent)}.uc-slot .uc-phase summary{cursor:pointer;display:flex;align-items:center;gap:7px;padding:10px 0;list-style:none;font-size:11px}.uc-slot .uc-phase summary::-webkit-details-marker{display:none}.uc-slot .uc-phase summary>svg{width:11px;height:11px;color:var(--uc-muted)}.uc-slot .uc-phase[open] summary>svg{transform:rotate(90deg)}.uc-slot .uc-phase summary>span:first-of-type{flex:1;overflow-wrap:anywhere}.uc-slot .uc-phase-count{font-size:10px;color:var(--uc-muted)}
.uc-slot .uc-member{width:100%;display:flex;align-items:center;gap:9px;border:0;border-radius:6px;background:none;padding:10px 2px;text-align:left}.uc-slot .uc-member:hover,.uc-slot .uc-member[aria-expanded=true]{background:color-mix(in srgb,var(--uc-bg) 65%,transparent)}.uc-slot .uc-member-name{flex:1;min-width:0;font-size:12px;overflow-wrap:anywhere}.uc-slot .uc-member-status{font-size:10px;color:var(--uc-muted)}.uc-slot .uc-detail{padding:4px 4px 12px 23px;font-size:11px;line-height:1.8;overflow-wrap:anywhere;color:var(--uc-muted)}.uc-slot .uc-empty{padding:7px 0 14px;font-size:11px;color:var(--uc-muted)}
.uc-slot .uc-footer{flex-shrink:0;padding:11px 18px 13px;border-top:1px solid color-mix(in srgb,var(--uc-line) 70%,transparent);display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:var(--uc-muted)}.uc-slot .uc-footer>span{display:flex;gap:5px;align-items:center}.uc-slot .uc-history{border:0;background:none;color:var(--uc-muted);font-size:10px;padding:0;display:flex;align-items:center;gap:4px}.uc-slot .uc-history svg{width:12px;height:12px}
.uc-slot .uc-anchor{display:inline-flex;align-items:center;gap:7px;padding:4px 8px;border:1px solid color-mix(in srgb,var(--uc-line) 65%,transparent);border-radius:10px;background:color-mix(in srgb,var(--uc-bg) 88%,transparent);backdrop-filter:blur(12px);max-width:216px;min-width:0;box-shadow:none;font-size:11px;text-align:left}.uc-slot .uc-anchor>span:not(.uc-dot){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.uc-slot .uc-anchor small{color:var(--uc-muted);font-size:10px;white-space:nowrap}
.uc-slot .uc-menu{position:absolute;z-index:4;top:53px;left:12px;right:12px;max-height:min(272px,calc(100% - 66px));overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;border:1px solid var(--uc-line);border-radius:12px;background:var(--uc-bg);padding:5px;box-shadow:0 12px 28px -8px color-mix(in srgb,var(--uc-ink) 20%,transparent),0 2px 6px color-mix(in srgb,var(--uc-ink) 5%,transparent)}.uc-slot .uc-option{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:0;border-radius:7px;padding:8px 10px}.uc-slot .uc-option[aria-pressed=true],.uc-slot .uc-option:hover{background:color-mix(in srgb,var(--uc-blue) 6%,transparent)}.uc-slot .uc-option-label{flex:1;min-width:0}.uc-slot .uc-option>.uc-dot{flex:0 0 12px;width:12px;height:12px}.uc-slot .uc-option strong{font-weight:500;font-size:12px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.uc-slot .uc-option small{font-size:10px;color:var(--uc-muted);display:block}
.uc-slot .uc-revision{border-left:1px solid var(--uc-line);margin:12px 0 0 4px;padding:0 0 17px 13px}.uc-slot .uc-revision-heading{display:flex;align-items:center;gap:7px;font-size:12px}.uc-slot .uc-revision p{font-size:11px;color:var(--uc-muted);line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0}.uc-slot .uc-revision small{font-size:10px;color:var(--uc-muted)}.uc-slot pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:210px;overflow:auto;font-size:11px;background:color-mix(in srgb,var(--uc-bg) 75%,transparent);border-radius:7px;padding:10px;margin:8px 0 0;color:var(--uc-ink)}
.uc-slot .uc-panel{transition:transform 180ms cubic-bezier(.2,.8,.2,1),box-shadow 180ms ease,border-color 180ms ease;transform-origin:50% 24px}.uc-slot .uc-top{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--uc-bg) 88%,transparent);backdrop-filter:blur(18px)}.uc-slot .uc-drag-handle{flex:1;min-width:0;align-self:stretch;border:0;background:none;padding:4px 0;cursor:grab;touch-action:none;user-select:none;text-align:left;transition:color 160ms ease}.uc-slot .uc-drag-handle:hover{color:var(--uc-blue)}.uc-slot .uc-dragging{transform:scale(1.008);border-color:color-mix(in srgb,var(--uc-blue) 24%,var(--uc-bg));box-shadow:0 28px 62px -18px color-mix(in srgb,var(--uc-ink) 28%,transparent),0 8px 20px -8px color-mix(in srgb,var(--uc-blue) 15%,transparent),inset 0 1px 2px var(--uc-bg);user-select:none}.uc-slot .uc-dragging .uc-drag-handle{cursor:grabbing;color:var(--uc-blue)}
.uc-slot .uc-dot .uc-spinner{display:block;width:12px;height:12px;animation:uc-status-spin 900ms linear infinite;transform-origin:50% 50%}.uc-slot .uc-spinner-track{opacity:.18}
@keyframes uc-status-spin{to{transform:rotate(360deg)}}
.uc-slot .uc-dot.uc-attention{color:var(--dsw-alias-state-warning-primary,#a46d20);border-color:currentColor}.uc-slot .uc-cause{display:block;margin-top:3px;font-size:10px;font-weight:400;line-height:1.5;color:var(--uc-muted)}.uc-slot .uc-next{margin:5px 0 7px;color:var(--uc-ink)}.uc-slot .uc-technical>summary{padding:3px 0;display:list-item;font-size:10px;cursor:pointer;color:var(--uc-muted)}.uc-slot .uc-technical pre{max-height:96px;font-size:10px}
@media(prefers-reduced-motion:reduce){.uc-slot .uc-dot .uc-spinner{animation:none}.uc-slot .uc-spinner-track{opacity:.75}.uc-slot .uc-spinner-arc{display:none}}
@media(max-width:600px){.uc-slot .uc-panel{width:min(350px,calc(100vw - 48px));border-radius:17px}.uc-slot .uc-body{padding:3px 15px 13px}.uc-slot .uc-member{min-height:44px}.uc-slot .uc-top{padding:12px 14px 8px}.uc-slot .uc-anchor small{display:none}}@media(prefers-reduced-transparency:reduce){.uc-slot .uc-panel,.uc-slot .uc-anchor{background:var(--uc-bg);backdrop-filter:none}}@media(prefers-reduced-motion:reduce){.uc-slot .uc-panel,.uc-slot .uc-drag-handle{transition:none}.uc-slot .uc-dragging{transform:none}}
.uc-slot .uc-panel,.uc-slot .uc-anchor,.uc-slot .uc-reader{-webkit-app-region:no-drag}.uc-report-list{padding-left:22px;margin:8px 0}.uc-report-list>li{padding-left:4px}.uc-slot .uc-summary{display:flex;align-items:center;justify-content:space-between;margin:0 0 9px;gap:12px}.uc-slot .uc-progress-count{font-size:11px;color:var(--uc-muted);font-variant-numeric:tabular-nums}.uc-slot .uc-meta{margin:8px 0 12px}.uc-slot .uc-progress{height:2px;border-radius:2px;background:color-mix(in srgb,var(--uc-muted) 10%,transparent);margin-bottom:13px;overflow:hidden}.uc-slot .uc-progress>span{height:100%;display:block;background:color-mix(in srgb,var(--uc-blue) 55%,var(--uc-muted));border-radius:inherit;transition:width 240ms ease}.uc-slot .uc-phase:first-of-type{border-top:0}
.uc-slot .uc-result{display:block;width:100%;border:1px solid color-mix(in srgb,var(--uc-line) 65%,transparent);border-radius:11px;background:color-mix(in srgb,var(--uc-bg) 94%,var(--uc-blue));padding:11px 12px;margin-top:12px;text-align:left;transition:border-color 160ms ease,background 160ms ease}.uc-slot .uc-result:hover{border-color:color-mix(in srgb,var(--uc-blue) 30%,var(--uc-line));background:color-mix(in srgb,var(--uc-bg) 90%,var(--uc-blue))}.uc-slot .uc-result-heading{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--uc-muted)}.uc-slot .uc-result-heading svg:last-child{margin-left:auto;width:13px;height:13px}.uc-slot .uc-result-preview{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:6px;font-size:12px;line-height:1.7;color:var(--uc-ink)}
.uc-slot .uc-reader{padding:0;border:1px solid var(--uc-line);border-radius:18px;background:var(--uc-bg);color:var(--uc-ink);width:min(820px,calc(100vw - 48px));max-width:none;max-height:calc(100dvh - 64px);box-shadow:0 28px 90px #0003;margin:auto;overflow:hidden;white-space:normal}.uc-reader::backdrop{background:#15152230;backdrop-filter:blur(4px)}.uc-reader-shell{display:flex;flex-direction:column;max-height:calc(100dvh - 66px)}.uc-reader-header{display:flex;align-items:center;gap:12px;padding:20px 24px;border-bottom:1px solid var(--uc-line);flex-shrink:0}.uc-reader-header>svg{color:var(--uc-muted);flex-shrink:0}.uc-reader-header h2{font-size:14px;font-weight:550;line-height:1.65;margin:0;flex:1;overflow-wrap:anywhere}.uc-reader-body{padding:24px 32px 32px;overflow:auto;overscroll-behavior:contain;font-size:14px;line-height:1.8;min-height:0}.uc-report-section+ .uc-report-section{margin-top:28px;padding-top:20px;border-top:1px solid var(--uc-line)}.uc-report-section>h3{font-size:12px;font-weight:500;color:var(--uc-muted);margin:0 0 12px;overflow-wrap:anywhere}.uc-slot .uc-reader pre{max-height:none;font-size:12px}.uc-slot .uc-reader .uc-raw{border-top:1px solid var(--uc-line);margin-top:32px;padding-top:16px;color:var(--uc-muted);font-size:11px}.uc-raw summary{cursor:pointer}.uc-reader-body table{max-width:100%}.uc-reader-body img{max-width:100%}.uc-slot .uc-reader .uc-raw pre{max-height:320px}.uc-slot .uc-reader .uc-iconbutton{width:28px;height:28px}.uc-slot .uc-anchor:hover{border-color:color-mix(in srgb,var(--uc-blue) 30%,var(--uc-line));background:var(--uc-bg)}
@media(max-width:900px){.uc-slot .uc-anchor{max-width:76px}.uc-slot .uc-anchor>span:not(.uc-dot){display:none}.uc-slot .uc-anchor small{display:block}}
@media(max-width:600px){.uc-slot .uc-reader{width:calc(100vw - 20px);max-height:calc(100dvh - 24px);border-radius:14px}.uc-reader-shell{max-height:calc(100dvh - 26px)}.uc-reader-header{padding:16px}.uc-reader-body{padding:18px}}
@media(prefers-reduced-motion:reduce){.uc-slot .uc-progress>span{transition:none}}

`;
    const statusText = (t, status) => t(status in zh ? status : "unknown");
    function WorkflowMenu({ workflows, selectedId, choose, t }) {
      return h("div", { className: "uc-menu" },
        ...workflows.slice().reverse().map((w) => h("button", {
          type: "button", className: "uc-option", key: w.id,
          "aria-pressed": selectedId === w.id, onClick: () => choose(w.id),
        },
          h("span", { className: "uc-option-label", title: w.title || t("untitled") },
            h("strong", null, w.title || t("untitled")),
            h("small", null, t("version", { version: w.revisions.at(-1).number }),
              " · ", statusText(t, w.revisions.at(-1).status))),
          h(Dot, { status: w.revisions.at(-1).status }))));
    }

    function RevisionHistory({ revisions, selectRevision, t }) {
      return h("div", null, ...revisions.slice().reverse().map((r) =>
        h("div", { className: "uc-revision", key: r.id },
          h("div", { className: "uc-revision-heading" },
            h("button", { type: "button", className: "uc-link", onClick: () => selectRevision(r.id) },
              t("version", { version: r.number })),
            h(Dot, { status: r.status }), statusText(t, r.status)),
          h("p", null, r.reason || t(r.number === 1 ? "initial" : "replacement")),
          h("small", null, new Date(r.startedAt).toLocaleString()),
          r.reused.length > 0 && h("p", null,
            t("reused", { count: r.reused.length }), " · ", t("reusedCaution"),
            ...r.reused.map((source, i) => h("span", { key: i }, h("br"), source.reason))),
          r.error && h("p", null, r.error))));
    }

    function MemberRow({ member: m, expanded, toggle, openMember, t }) {
      const issue = memberIssue(m);
      return h(React.Fragment, { key: m.seq },
        h("button", {
          type: "button", className: "uc-member", "aria-expanded": expanded, onClick: toggle,
        },
          h(Dot, { status: m.status }),
          h("span", { className: "uc-member-name" }, m.label || `#${m.seq}`,
            issue && h("small", { className: "uc-cause" }, t(issue.cause))),
          h("span", { className: "uc-member-status" }, statusText(t, m.status))),
        expanded && h("div", { className: "uc-detail" },
          h("div", null, duration(m.startedAt, m.endedAt)),
          m.reused && h("div", null, t("replayed")),
          issue && h("div", { className: "uc-next" }, t(issue.action)),
          issue && (m.diagnostic?.code || m.diagnostic?.message) &&
            h("details", { className: "uc-technical" }, h("summary", null, t("technical")),
              h("pre", null, [m.diagnostic.code, m.diagnostic.message].filter(Boolean).join("\n"))),
          h("button", { type: "button", className: "uc-link", onClick: () => openMember(m.childId) },
            t("openChild"), h(Icon, { name: "open" }))));
    }

    function WorkflowPhases({ revision, ui, patch, member, setMember, openMember, t }) {
      const groups = new Map(revision.phases.map((title) => [title, []]));
      for (const m of revision.members) {
        const key = m.phase ?? t("phase");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(m);
      }
      return h(React.Fragment, null, ...[...groups].map(([phase, members]) => {
        const phaseKey = revision.id + ":" + phase;
        const expanded = ui.phases?.[phaseKey] ??
          (members.some(m => m.status === "running" || memberIssue(m)) || groups.size === 1);
        return h("details", {
          className: "uc-phase", key: phase, open: expanded,
          onToggle: (e) => {
            const open = e.currentTarget.open;
            if (open !== expanded) patch({ phases: { ...ui.phases, [phaseKey]: open } });
          },
        },
          h("summary", null, h(Icon, { name: "chevron" }), h("span", null, phase),
            h("span", { className: "uc-phase-count" },
              members.filter(m => m.status === "completed").length, " / ", members.length)),
          members.length ? members.map(m => h(MemberRow, {
            key: m.seq, member: m, expanded: member === m.seq,
            toggle: () => setMember(v => v === m.seq ? null : m.seq), openMember, t,
          })) : h("div", { className: "uc-empty" }, t("empty")));
      }), !groups.size && h("div", { className: "uc-empty" }, t("empty")));
    }

    function parseOutput(output) {
      // job_output appends a native status line to the serialized script result.
      // Strip it only for a successful JSON parse; raw output is always retained.
      const body = output.replace(/\n\[status: [^\n]*\]\s*$/, "")
        .replace(/\n\nUltracode: the script returned, but these members did not complete: [\s\S]*\. Inspect ultracode_workflows for their causes\. Do not report full success without verifying how these tasks were resolved\.$/, "");
      try { return JSON.parse(body); } catch { return output; }
    }
    function resultPreview(value) {
      if (typeof value === "string") return value.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
      if (value && typeof value === "object") {
        for (const item of Object.values(value)) { const preview = resultPreview(item); if (preview) return preview; }
        return JSON.stringify(value);
      }
      return String(value ?? "");
    }
    function ResultContent({ value, labels, depth = 0 }) {
      if (typeof value === "string") return h(MarkdownText, { text: value, streaming: false, labels });
      if (Array.isArray(value) && value.length && depth < 8) return h("ol", { className: "uc-report-list" },
        value.map((item, index) => h("li", { key: index }, h(ResultContent, { value: item, labels, depth: depth + 1 }))));
      if (value && typeof value === "object" && Object.keys(value).length === 0) return h("pre", null, JSON.stringify(value));
      if (value && typeof value === "object" && depth < 8) return Object.entries(value).map(([key, item]) =>
        h("section", { className: "uc-report-section", key },
          h("h3", null, key),
          h(ResultContent, { value: item, labels, depth: depth + 1 })));
      return h("pre", null, JSON.stringify(value, null, 2));
    }
    function ResultReader({ title, output, value, close, t }) {
      const ref = useRef(null), backdropPress = useRef(false);
      useEffect(() => {
        const dialog = ref.current, previousFocus = document.activeElement;
        dialog?.showModal();
        return () => {
          dialog?.close();
          if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        };
      }, []);
      const labels = { code: { copyLabel: t("copy"), copiedLabel: t("copied"),
        toolbarLabels: { codeLabel: "Code", wrapLabel: t("wrap"), unwrapLabel: t("unwrap") } }, footnotes: t("footnotes") };
      return h("dialog", { ref, className: "uc-reader", "aria-label": title,
        onCancel: e => { e.preventDefault(); close(); },
        onPointerDown: e => { backdropPress.current = e.target === e.currentTarget; },
        onClick: e => { if (backdropPress.current && e.target === e.currentTarget) close(); backdropPress.current = false; },
        onKeyDown: e => e.stopPropagation() },
        h("div", { className: "uc-reader-shell" },
          h("header", { className: "uc-reader-header" }, h(Icon, { name: "document" }),
            h("h2", null, title), h("button", { type: "button", className: "uc-iconbutton", title: t("close"), "aria-label": t("close"), onClick: close }, h(Icon, { name: "close" }))),
          h("div", { className: "uc-reader-body" },
            h(ResultContent, { value, labels }),
            h("details", { className: "uc-raw" }, h("summary", null, t("rawResult")), h("pre", null, output)))));
    }
    function WorkflowDock({ sessionId, useProjection, killJob, openChild, t }) {
      const projection = useProjection("ultracode");
      const [ui, setUI] = useState(() => loadUI(sessionId)),
        [menu, setMenu] = useState(false),
        [history, setHistory] = useState(false),
        [member, setMember] = useState(null),
        [error, setError] = useState(""),
        [confirm, setConfirm] = useState(false),
        [busy, setBusy] = useState(false),
        [reader, setReader] = useState(false),
        [, tick] = useState(0);
      const pickerRef = useRef(null),
        rootRef = useRef(null);
      useEffect(() => {
        try {
          sessionStorage.setItem(
            "dsh.ultracode.ui." + sessionId,
            JSON.stringify(ui),
          );
        } catch {}
      }, [sessionId, ui]);
      const workflows = projection?.workflows ?? [];
      const selected =
        workflows.find((w) => w.id === ui.workflowId) ?? workflows.at(-1);
      const revision =
        selected?.revisions.find(
          (r) => r.id === (ui.revisionId ?? selected.current),
        ) ?? selected?.revisions.at(-1);
      const active = workflows.filter((w) =>
        w.revisions.some((r) => ["running", "starting"].includes(r.status)),
      );
      const floating = useFloatingCard(
        rootRef,
        !!selected,
        ui.collapsed === true,
        ui.position,
        (position) => setUI((old) => ({ ...old, position })),
      );
      useEffect(() => {
        if (!active.length) return;
        const id = setInterval(() => tick((x) => x + 1), 1000);
        return () => clearInterval(id);
      }, [active.length]);
      useEffect(() => {
        if (!menu) return;
        const outside = (e) => {
          if (!rootRef.current?.contains(e.target)) setMenu(false);
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
      }, [menu]);
      const resultValue = useMemo(() => parseOutput(revision?.output || ""), [revision?.output]);
      useEffect(() => setReader(false), [revision?.id]);
      if (!selected || !revision) return null;
      const collapsed = ui.collapsed === true,
        live = ["running", "starting"].includes(revision.status);
      const patch = (change) => setUI((old) => ({ ...old, ...change }));
      const choose = (id) => {
        patch({ workflowId: id, revisionId: null });
        setMenu(false);
        setReader(false);
        setHistory(false);
        setMember(null);
        setConfirm(false);
        setError("");
      };
      const selectRevision = (revisionId) => {
        patch({ revisionId });
        setReader(false);
        setHistory(false);
        setMember(null);
      };
      const openMember = async (childId) => {
        try { await openChild(sessionId, childId); setError(""); }
        catch { setError(t("childUnavailable")); }
      };
      const counts = revision.members.reduce((result, m) => {
        if (m.reused) result.reused++;
        else { result.started++; if (m.status === "completed") result.completed++; }
        return result;
      }, { started: 0, completed: 0, reused: 0 });
      const total = revision.members.length, done = counts.completed + counts.reused;
      const progressLabel = total ? done + " / " + total : "—";
      const otherActive = active.filter((w) => w.id !== selected.id);
      const stopped = async () => {
        if (!confirm) {
          setConfirm(true);
          return;
        }
        setBusy(true);
        setError("");
        try {
          const ok = await killJob(sessionId, revision.jobId);
          if (!ok) throw new Error(t("cancelError"));
          setConfirm(false);
        } catch (e) {
          setError(e.message || t("cancelError"));
        } finally {
          setBusy(false);
        }
      };
      const status = h(
        "span",
        { className: "uc-status", title: live ? t("background") : undefined },
        h(Dot, { status: revision.status }),
        statusText(t, revision.status),
      );
      const footer = h("div", { className: "uc-footer" },
        live && revision.jobId ? h("button", { type: "button", className: "uc-link", disabled: busy, onClick: stopped },
          busy ? t("busy") : confirm ? t("confirm") : t("cancel")) : h("span"),
        h("button", { type: "button", className: "uc-history", onClick: () => setHistory(v => !v), title: t("history") },
          h(Icon, { name: "history" }), history ? t("back") : t("history")));
      return h(
        "div",
        {
          className: "uc-slot",
          ref: rootRef,
          "data-ultracode-session": sessionId,
          onKeyDown: (e) => {
            if (e.key === "Escape") {
              if (menu) {
                setMenu(false);
                pickerRef.current?.focus();
              } else {
                patch({ collapsed: true });
              }
            }
          },
        },
        h("style", null, CSS),
        reader && h(ResultReader, { title: revision.title || selected.title, output: revision.output, value: resultValue, close: () => setReader(false), t }),
        !collapsed &&
          h(
            "section",
            {
              className: "uc-panel" + (floating.dragging ? " uc-dragging" : ""),
              ref: floating.panelRef,
              style: floating.placement,
              "aria-label": selected.title,
            },
            h(
              "div",
              { className: "uc-top" },
              h(
                "button",
                {
                  className: "uc-brand uc-drag-handle",
                  type: "button",
                  title: t("move"),
                  "aria-label": t("move"),
                  ...floating.handle,
                },
                h(Icon, { name: "branch" }),
                "Ultracode",
              ),
              h(
                "div",
                { className: "uc-tools" },
                h(
                  "button",
                  {
                    type: "button",
                    className: "uc-picker",
                    ref: pickerRef,
                    "aria-expanded": menu,
                    onClick: () => setMenu((v) => !v),
                  },
                  t("workflows"),
                  " ",
                  workflows.length,
                  h(Icon, { name: "chevron" }),
                ),
                h(
                  "button",
                  {
                    type: "button",
                    className: "uc-iconbutton",
                    "aria-label": t("collapse"),
                    onClick: () => patch({ collapsed: true }),
                  },
                  h(Icon, { name: "minus" }),
                ),
              ),
            ),
            menu && h(WorkflowMenu, { workflows, selectedId: selected.id, choose, t }),
            h(
              "div",
              { className: "uc-body" },
              h("div", { className: "uc-summary" }, status, h("span", { className: "uc-progress-count", title: t("completed") }, progressLabel)),
              h(
                "div",
                { className: "uc-title" },
                h("h3", { title: revision.title || selected.title }, revision.title || selected.title),
              ),
              h(
                "div",
                  { className: "uc-meta", title: revision.agentLimit ? t("limit", { count: revision.agentLimit }) : undefined },
                h(
                  "span",
                  null,
                  t("version", { version: revision.number }),
                  " · ",
                  duration(revision.startedAt, revision.endedAt),
                  ),
                h("span", { title: t("reusedCaution") }, counts.reused > 0 ? t("reused", { count: counts.reused }) : ""),
              ),
              h("div", { className: "uc-progress", role: "progressbar", "aria-label": t("completed"), "aria-valuemin": 0, "aria-valuemax": total || 1, "aria-valuenow": done },
                h("span", { style: { width: (total ? done / total * 100 : 0) + "%" } })),
              revision.id !== selected.current &&
                h(
                  "div",
                  { className: "uc-banner" },
                  t("historical"),
                  h(
                    "button",
                    { type: "button", className: "uc-link", onClick: () => selectRevision(null) },
                    t("back"),
                  ),
                ),
              otherActive.length > 0 &&
                h(
                  "div",
                  { className: "uc-banner" },
                  t("activeOther", { count: otherActive.length }),
                  h(
                    "button",
                    {
                      type: "button",
                      className: "uc-link",
                      onClick: () => choose(otherActive[0].id),
                    },
                    t("returnActive"),
                  ),
                ),
              error &&
                h("div", { className: "uc-errorbox", role: "alert" }, error),
              history
                ? h(RevisionHistory, { revisions: selected.revisions, selectRevision, t })
                : h(
                    React.Fragment,
                    null,
                    revision.reason &&
                      h("div", { className: "uc-banner" }, revision.reason),
                    revision.error &&
                      h("div", { className: "uc-errorbox" }, revision.error),
                    h(WorkflowPhases, { revision, ui, patch, member, setMember, openMember, t }),
                    revision.output && h("button", { type: "button", className: "uc-result", onClick: () => setReader(true), "aria-label": t("viewResult") },
                      h("span", { className: "uc-result-heading" }, h(Icon, { name: "document" }), t("result"), h(Icon, { name: "open" })),
                      h("span", { className: "uc-result-preview" }, resultPreview(resultValue))),
                  ),
            ),
            footer,
          ),
        collapsed && h(
          "button",
          {
            type: "button",
            className: "uc-anchor",
            title: selected.title + " · " + statusText(t, revision.status),
            "aria-description": statusText(t, revision.status) + " · " + progressLabel,
            "aria-label": collapsed ? t("expand") : t("collapse"),
            "aria-expanded": !collapsed,
            onClick: () => patch({ collapsed: !collapsed }),
          },
          h(Dot, { status: revision.status }),
          h("span", null, selected.title),
          h(
            "small",
            { title: otherActive.length ? t("activeOther", { count: otherActive.length }) : t("completed") },
            otherActive.length
              ? progressLabel + " · +" + otherActive.length
              : progressLabel,
          ),
        ),
      );
    }
    const composerGlowCSS = `
.uc-composer-glow{position:absolute;top:0;left:0;width:100%;height:0;border-radius:var(--uc-glow-radius,16px);pointer-events:none;user-select:none;z-index:1;visibility:hidden}
.uc-composer-glow[data-phase]:not([data-phase="off"]){visibility:visible}
.uc-glow-bloom,.uc-composer-glow::after{position:absolute;box-sizing:border-box;pointer-events:none;border-radius:inherit;opacity:0;transition:opacity 1.1s ease}
.uc-glow-bloom{inset:0;filter:blur(7px)}
.uc-glow-bloom::before{content:"";position:absolute;inset:-4px;padding:5px;border-radius:inherit;box-sizing:border-box;background:linear-gradient(110deg,#8764cd80 0%,#b38ae7aa 25%,#d5b3f5bb 48%,#a477dfbb 70%,#8664c880 100%);background-size:240% 100%;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.uc-composer-glow::after{content:"";inset:-1px;padding:1px;background:linear-gradient(110deg,#9672cf66 0%,#c3a0eaaa 25%,#dfcaf2aa 48%,#ac82dcbb 70%,#9672cf66 100%);background-size:240% 100%;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.uc-composer-glow[data-phase="ambient"] .uc-glow-bloom{opacity:.75;animation:uc-glow-breathe 5.6s ease-in-out infinite}
.uc-composer-glow[data-phase="ambient"] .uc-glow-bloom::before{animation:uc-glow-current 18s ease-in-out infinite alternate}
.uc-composer-glow[data-phase="ambient"]::after{opacity:.75;animation:uc-glow-current 18s ease-in-out infinite alternate}
.uc-composer-glow:not([data-phase="ambient"]) .uc-glow-bloom,.uc-composer-glow:not([data-phase="ambient"])::after{opacity:0;transition:none;animation:none}
.uc-composer-glow[data-paused="true"] .uc-glow-bloom,.uc-composer-glow[data-paused="true"] .uc-glow-bloom::before,.uc-composer-glow[data-paused="true"]::after{animation-play-state:paused}
.uc-composer-glow canvas{position:absolute;left:-24px;top:-24px;pointer-events:none}
@keyframes uc-glow-breathe{0%,100%{transform:scale(1,1);filter:blur(5px) opacity(.38)}48%{transform:scale(1.005,1.035);filter:blur(9px) opacity(1)}}
@keyframes uc-glow-current{from{background-position:0% 50%}to{background-position:100% 50%}}
@media(prefers-reduced-motion:reduce){.uc-glow-bloom,.uc-glow-bloom::before,.uc-composer-glow::after{transition:none!important;animation:none!important}.uc-composer-glow canvas{display:none}}
`;

    // Starts at the bottom-right tangent and follows a rounded rectangle clockwise.
    // The top-center origin is derived from arc length, never from the mode chip.
    function glowOutline(width, height, radius) {
      const a = width - 2 * radius, b = height - 2 * radius;
      const arc = Math.PI * radius / 2, length = 2 * a + 2 * b + 4 * arc;
      return {
        length,
        origin: 1.5 * a + b + 2 * arc,
        point(distance) {
          let s = ((distance % length) + length) % length;
          if (s < a) return [width - radius - s, height];
          s -= a;
          if (s < arc) { const t = Math.PI / 2 + s / radius; return [radius + radius * Math.cos(t), height - radius + radius * Math.sin(t)]; }
          s -= arc;
          if (s < b) return [0, height - radius - s];
          s -= b;
          if (s < arc) { const t = Math.PI + s / radius; return [radius + radius * Math.cos(t), radius + radius * Math.sin(t)]; }
          s -= arc;
          if (s < a) return [radius + s, 0];
          s -= a;
          if (s < arc) { const t = 1.5 * Math.PI + s / radius; return [width - radius + radius * Math.cos(t), radius + radius * Math.sin(t)]; }
          s -= arc;
          if (s < b) return [width, radius + s];
          s -= b;
          return [width - radius + radius * Math.cos(s / radius), height - radius + radius * Math.sin(s / radius)];
        },
      };
    }

    function mountComposerGlow(root, canvas, card) {
      const context = canvas.getContext("2d");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      let outline, width = 0, height = 0, frame = 0, elapsed = 0, lastTime = 0;
      let selected, disposed = false, phase = "off";
      const clamp = (x) => Math.max(0, Math.min(1, x));
      const clear = () => context?.clearRect(0, 0, width + 48, height + 48);
      const setPhase = (next) => { phase = next; root.dataset.phase = next; };

      function stroke(from, distance, direction, weight, alpha, color, blur = 0) {
        if (distance <= 0 || alpha <= 0) return;
        const steps = Math.ceil(distance / 3);
        context.beginPath();
        for (let i = 0; i <= steps; i++) {
          const [x, y] = outline.point(from + direction * distance * i / steps);
          if (i) context.lineTo(x + 24, y + 24);
          else context.moveTo(x + 24, y + 24);
        }
        context.lineWidth = weight;
        context.lineCap = "round";
        context.strokeStyle = `rgba(${color},${clamp(alpha)})`;
        context.shadowColor = context.strokeStyle;
        context.shadowBlur = blur;
        context.stroke();
        context.shadowBlur = 0;
      }
      function halo(position, alpha, size) {
        if (alpha <= 0) return;
        const [px, py] = outline.point(position), x = px + 24, y = py + 24;
        const gradient = context.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, `rgba(242,215,255,${alpha})`);
        gradient.addColorStop(.13, `rgba(194,117,255,${alpha * .85})`);
        gradient.addColorStop(.43, `rgba(145,70,230,${alpha * .28})`);
        gradient.addColorStop(1, "rgba(145,70,230,0)");
        context.fillStyle = gradient;
        context.fillRect(x - size, y - size, size * 2, size * 2);
      }
      function paint() {
        clear();
        if (!context || !outline || phase !== "intro") return;
        const t = clamp(elapsed / 1800), fade = 1 - clamp((t - .8) / .2);
        const progress = clamp((t - .055) / .66);
        const reach = progress * progress * (3 - 2 * progress) * outline.length / 2;
        const origin = outline.origin;
        if (t < .12) halo(origin, Math.sin(t / .12 * Math.PI) * .85, 22);
        for (const direction of [-1, 1]) {
          stroke(origin, reach, direction, 1.6, .612 * fade, "144,63,226", 3);
          const head = origin + direction * reach, tail = Math.min(reach, outline.length * .055);
          if (tail > 0) {
            for (let i = 0; i < 40; i++) {
              const fraction = i / 40;
              stroke(head - direction * tail * (1 - fraction), tail / 40 + 1, direction, 2.4,
                .85 * fade * Math.pow(fraction, 1.5), fraction > .87 ? "218,153,255" : "139,60,232", 9);
            }
            stroke(head - direction * Math.min(12, tail), Math.min(12, tail), direction, 1.3, .85 * fade, "249,232,255", 6);
            halo(head, .7225 * fade, 16);
          }
        }
        if (progress === 1) halo(origin + outline.length / 2, Math.sin(clamp((t - .715) / .18) * Math.PI) * .85, 25);
      }
      function tick(time) {
        frame = 0;
        if (disposed || document.hidden || !["intro", "quiet"].includes(phase)) return;
        elapsed += time - lastTime;
        lastTime = time;
        if (elapsed >= 2150) { clear(); setPhase("ambient"); return; }
        if (elapsed >= 1800) { clear(); setPhase("quiet"); }
        else paint();
        frame = requestAnimationFrame(tick);
      }
      function measure() {
        const rect = card.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        root.style.height = `${height}px`;
        const radius = Math.max(1, Math.min(parseFloat(getComputedStyle(card).borderTopLeftRadius) || 16, width / 2, height / 2));
        root.style.setProperty("--uc-glow-radius", `${radius}px`);
        outline = width > 0 && height > 0 ? glowOutline(width, height, radius) : null;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil((width + 48) * ratio);
        canvas.height = Math.ceil((height + 48) * ratio);
        canvas.style.width = `${width + 48}px`;
        canvas.style.height = `${height + 48}px`;
        context?.setTransform(ratio, 0, 0, ratio, 0, 0);
        paint();
      }
      function visibility() {
        root.dataset.paused = String(document.hidden);
        cancelAnimationFrame(frame);
        frame = 0;
        if (!document.hidden && ["intro", "quiet"].includes(phase)) {
          lastTime = performance.now();
          frame = requestAnimationFrame(tick);
        }
      }
      function motionPreference() {
        if (reduced.matches && selected === "ultracode") {
          cancelAnimationFrame(frame); frame = 0; clear(); setPhase("ambient");
        }
      }
      const resize = new ResizeObserver(measure);
      resize.observe(card);
      measure();
      document.addEventListener("visibilitychange", visibility);
      reduced.addEventListener("change", motionPreference);
      visibility();
      return {
        select(preset) {
          // Undefined is a not-yet-loaded projection; don't invent a switch on reconnect.
          if (disposed || preset === undefined || preset === selected) return;
          const previous = selected;
          selected = preset;
          cancelAnimationFrame(frame); frame = 0; clear(); elapsed = 0;
          if (preset !== "ultracode") { setPhase("off"); return; }
          if (previous === undefined || previous === null || reduced.matches || !context) {
            setPhase("ambient"); return;
          }
          setPhase("intro");
          lastTime = performance.now();
          if (!document.hidden) frame = requestAnimationFrame(tick);
        },
        dispose() {
          disposed = true;
          cancelAnimationFrame(frame);
          resize.disconnect();
          document.removeEventListener("visibilitychange", visibility);
          reduced.removeEventListener("change", motionPreference);
          clear();
        },
      };
    }

    function ComposerGlow({ sessionId, useProjection }) {
      const preset = useProjection("agentPreset");
      const root = useRef(null), canvas = useRef(null), controller = useRef(null);
      useLayoutEffect(() => {
        // The native input.overlay slot is anchored inside this semantic card.
        // Only read its size; all styles and DOM writes stay in our own layer.
        const card = root.current?.closest("[data-composer-card]");
        if (!card) return;
        const instance = mountComposerGlow(root.current, canvas.current, card);
        controller.current = instance;
        return () => { instance.dispose(); controller.current = null; };
      }, [sessionId]);
      useLayoutEffect(() => { controller.current?.select(preset); }, [sessionId, preset]);
      return h("div", { ref: root, className: "uc-composer-glow", "aria-hidden": "true", "data-ultracode-composer": sessionId },
        h("style", null, composerGlowCSS), h("span", { className: "uc-glow-bloom" }), h("canvas", { ref: canvas }));
    }

    return {
      inject: ["slots", "locale", "jobs", "uiWorkspace", "sessions"],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register("ultracode", { zh, en }),
          "Ultracode: locale",
        );
        ctx.slots.inject("conversation.input.overlay", () =>
          ctx.slots.register(
            { name: "conversation.input.overlay", id: "ultracode-composer-glow", order: -100 },
            (props) => h(ComposerGlow, { ...props, key: props.sessionId }),
          ),
        );
        ctx.slots.inject("conversation.session.header.actions", () =>
          ctx.slots.register(
            {
              name: "conversation.session.header.actions",
              id: "ultracode-floating",
              order: 30,
              locale: "ultracode",
              inject: () => ({
                killJob: async (sessionId, jobId) =>
                  (await ctx.jobs.kill(sessionId, jobId)).ok,
                openChild: async (parentSessionId, childSessionId) => {
                  const binding = ctx.sessions.list.getSnapshot();
                  const identity =
                    binding.projectionsBySession?.[childSessionId]?.values
                      ?.subagent;
                  if (!identity) throw new Error("Child session unavailable");
                  ctx.uiWorkspace.openSession({
                    parentSessionId,
                    childSessionId,
                    mode: identity.mode,
                  });
                },
              }),
            },
            (props) => h(WorkflowDock, { ...props, key: props.sessionId }),
          ),
        );
      },
    };
  },
});
