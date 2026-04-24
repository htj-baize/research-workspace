import http from "node:http";

import { InMemoryRecommendationRuntime } from "../../framework/runtime/in-memory-recommendation-runtime.ts";
import {
  BasicCandidateConstructionService,
  InMemoryRetrievalService,
  SimplePolicyService,
} from "../../framework/runtime/default-services.ts";
import {
  loadResearchFlowStorage,
  loadSocialFeedStorage,
} from "../../framework/storage/file-state-storage.mjs";
import { InMemoryContextStateService } from "../../framework/storage/in-memory-context-state-service.mjs";
import { getScenarioOverlay } from "./scenario-overlays.mjs";

const PORT = Number(process.env.PORT || 4321);
const VALID_STRATEGIES = ["cloud-heavy", "hybrid", "local-heavy"];
const VALID_SCENARIOS = ["social-feed", "research-flow"];

function html(body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Recommendation Feed Demo</title>
  <style>
    :root {
      --bg: #f4efe7;
      --panel: #fffaf2;
      --line: #d9cdbd;
      --text: #1e1d1b;
      --muted: #6b675f;
      --accent: #b14d2f;
      --accent-2: #315a73;
      --green: #2f6b45;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", serif;
      background:
        radial-gradient(circle at top left, #fff5e2 0, transparent 28%),
        linear-gradient(180deg, #f4efe7 0%, #ece2d1 100%);
      color: var(--text);
    }
    .shell {
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px 20px 40px;
    }
    .hero {
      display: grid;
      gap: 10px;
      margin-bottom: 20px;
    }
    .kicker {
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: .12em;
      font-size: 12px;
      font-weight: 700;
    }
    h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 56px);
      line-height: 0.96;
      letter-spacing: -0.03em;
    }
    .sub {
      color: var(--muted);
      max-width: 760px;
      font-size: 16px;
      line-height: 1.5;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(320px, .9fr);
      gap: 18px;
    }
    .panel {
      background: color-mix(in srgb, var(--panel) 88%, white);
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 16px;
      box-shadow: 0 12px 40px rgba(53, 42, 25, 0.07);
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    select, button {
      border-radius: 999px;
      border: 1px solid var(--line);
      padding: 10px 14px;
      font: inherit;
      background: white;
      color: var(--text);
    }
    button {
      cursor: pointer;
      transition: transform .12s ease, background .12s ease;
    }
    button:hover { transform: translateY(-1px); }
    .btn-primary {
      background: var(--accent);
      color: white;
      border-color: transparent;
    }
    .cards {
      display: grid;
      gap: 12px;
    }
    .explain-rail {
      display: grid;
      gap: 8px;
      margin-bottom: 14px;
    }
    .explain-item {
      background: rgba(255,255,255,.7);
      border: 1px solid rgba(30,29,27,.08);
      border-radius: 14px;
      padding: 10px 12px;
      font-size: 14px;
      line-height: 1.45;
      color: var(--text);
    }
    .composer {
      display: none;
      gap: 10px;
      margin-bottom: 14px;
      background: rgba(255,250,240,.9);
      border: 1px solid rgba(197,141,34,.25);
      border-radius: 18px;
      padding: 14px;
    }
    .composer.active {
      display: grid;
    }
    .composer textarea {
      width: 100%;
      min-height: 96px;
      resize: vertical;
      border-radius: 14px;
      border: 1px solid var(--line);
      padding: 12px;
      font: inherit;
      background: white;
      color: var(--text);
    }
    .composer-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .card {
      background: rgba(255,255,255,.78);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 14px;
      display: grid;
      gap: 10px;
      overflow: hidden;
      position: relative;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 6px;
      border-radius: 18px 0 0 18px;
      background: rgba(49,90,115,.18);
    }
    .card-clarification {
      background: linear-gradient(135deg, rgba(255,251,240,.95), rgba(255,244,219,.88));
    }
    .card-clarification::before {
      background: #c58d22;
    }
    .card-workflow_step {
      background: linear-gradient(135deg, rgba(245,249,255,.95), rgba(228,239,255,.92));
    }
    .card-workflow_step::before {
      background: #315a73;
    }
    .card-tool_run {
      background: linear-gradient(135deg, rgba(255,244,240,.96), rgba(255,229,221,.92));
    }
    .card-tool_run::before {
      background: #b14d2f;
    }
    .card-navigation {
      background: linear-gradient(135deg, rgba(242,250,245,.95), rgba(228,244,234,.92));
    }
    .card-navigation::before {
      background: #2f6b45;
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: start;
    }
    .card-title {
      margin: 0;
      font-size: 22px;
      line-height: 1.05;
    }
    .pill {
      white-space: nowrap;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      color: white;
      background: var(--accent-2);
    }
    .eyebrow {
      margin: 0 0 4px;
      color: var(--muted);
      font-size: 11px;
      letter-spacing: .12em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .card-copy {
      display: grid;
      gap: 6px;
    }
    .card-description {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }
    .card-prompt {
      background: rgba(255,255,255,.58);
      border: 1px solid rgba(30,29,27,.08);
      border-radius: 14px;
      padding: 10px 12px;
      font-size: 14px;
      line-height: 1.45;
    }
    .meta, .trace-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
    }
    .metric-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .metric {
      background: rgba(255,255,255,.6);
      border: 1px solid rgba(30,29,27,.08);
      border-radius: 14px;
      padding: 10px;
      display: grid;
      gap: 4px;
    }
    .metric-label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .1em;
    }
    .metric-value {
      font-size: 16px;
      line-height: 1;
    }
    .trace-list span,
    .meta span {
      background: rgba(49,90,115,.08);
      border-radius: 999px;
      padding: 5px 10px;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .btn-ghost {
      background: transparent;
    }
    .btn-soft {
      background: rgba(255,255,255,.7);
    }
    .side-block {
      display: grid;
      gap: 12px;
      margin-bottom: 12px;
    }
    .label {
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 700;
    }
    .value {
      font-size: 20px;
      line-height: 1.15;
    }
    .log {
      background: #1f1d1b;
      color: #efe6d9;
      border-radius: 16px;
      padding: 12px;
      min-height: 220px;
      overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 1.45;
    }
    .status {
      color: var(--green);
      font-size: 13px;
    }
    .empty {
      padding: 30px 10px;
      text-align: center;
      color: var(--muted);
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

function feedPage() {
  return html(`
  <div class="shell">
    <div class="hero">
      <div class="kicker">Agent-Native Recommendation</div>
      <h1>Behavior-Driven Feed Demo</h1>
      <div class="sub">
        这个页面不是看 SDK JSON，而是模拟一个真实 feed：你可以刷新、跳过、运行或聚焦某个推荐，系统会把行为写回 session summary，再影响下一轮推荐。
      </div>
    </div>

    <div class="layout">
      <section class="panel">
        <div class="toolbar">
          <div class="controls">
            <select id="strategy">
              <option value="cloud-heavy">cloud-heavy</option>
              <option value="hybrid" selected>hybrid</option>
              <option value="local-heavy">local-heavy</option>
            </select>
            <select id="scenario">
              <option value="social-feed" selected>social-feed</option>
              <option value="research-flow">research-flow</option>
            </select>
            <button class="btn-primary" id="refresh">Refresh Feed</button>
            <button id="reset">Reset Session</button>
          </div>
          <div class="status" id="status">ready</div>
        </div>
        <div class="composer" id="composer">
          <div class="label">Clarification Prompt</div>
          <div class="value" id="composer-title">-</div>
          <div class="card-description" id="composer-copy">-</div>
          <textarea id="composer-input" placeholder="Write a short answer that should change the next recommendation pass."></textarea>
          <div class="composer-actions">
            <button class="btn-primary" id="composer-submit">Submit Answer</button>
            <button id="composer-cancel">Cancel</button>
          </div>
        </div>
        <div class="explain-rail" id="explain-rail"></div>
        <div class="cards" id="cards"></div>
      </section>

      <aside class="panel">
        <div class="side-block">
          <div class="label">Current Intent</div>
          <div class="value" id="intent">-</div>
        </div>
        <div class="side-block">
          <div class="label">Goal</div>
          <div class="value" id="goal">-</div>
        </div>
        <div class="side-block">
          <div class="label">Focus</div>
          <div class="trace-list" id="focus"></div>
        </div>
        <div class="side-block">
          <div class="label">Accepted / Rejected Patterns</div>
          <div class="trace-list" id="patterns"></div>
        </div>
        <div class="side-block">
          <div class="label">Recent Signals</div>
          <div class="trace-list" id="signals"></div>
        </div>
        <div class="side-block">
          <div class="label">Session Snapshot</div>
          <pre class="log" id="log"></pre>
        </div>
      </aside>
    </div>
  </div>

  <script>
    const els = {
      strategy: document.getElementById("strategy"),
      scenario: document.getElementById("scenario"),
      refresh: document.getElementById("refresh"),
      reset: document.getElementById("reset"),
      cards: document.getElementById("cards"),
      composer: document.getElementById("composer"),
      composerTitle: document.getElementById("composer-title"),
      composerCopy: document.getElementById("composer-copy"),
      composerInput: document.getElementById("composer-input"),
      composerSubmit: document.getElementById("composer-submit"),
      composerCancel: document.getElementById("composer-cancel"),
      explainRail: document.getElementById("explain-rail"),
      status: document.getElementById("status"),
      intent: document.getElementById("intent"),
      goal: document.getElementById("goal"),
      focus: document.getElementById("focus"),
      patterns: document.getElementById("patterns"),
      signals: document.getElementById("signals"),
      log: document.getElementById("log"),
    };

    let latestDecision = null;
    let pendingClarification = null;

    function setStatus(text) {
      els.status.textContent = text;
    }

    function renderTags(node, values) {
      node.innerHTML = "";
      if (!values || values.length === 0) {
        const span = document.createElement("span");
        span.textContent = "-";
        node.appendChild(span);
        return;
      }
      for (const value of values) {
        const span = document.createElement("span");
        span.textContent = value;
        node.appendChild(span);
      }
    }

    function cardPreset(opportunity) {
      const mode = opportunity.metadata?.mode || opportunity.kind;
      if (mode === "short_video") {
        return {
          variant: "tool_run",
          eyebrow: "Short Video",
          description: "更像抖音式短视频卡，重点是 hook、停留和看完后的下一跳。",
          prompt: "先看完它，再决定是点赞、收藏，还是继续滑走。",
          runLabel: "Watch",
          focusLabel: "Open Thread",
        };
      }
      if (mode === "lifestyle_post") {
        return {
          variant: "workflow_step",
          eyebrow: "Lifestyle Post",
          description: "更像小红书图文卡，重点是收藏价值、主题贴合度和作者风格。",
          prompt: "如果它像一张值得回头再看的帖子，优先收藏而不是只停留。",
          runLabel: "Open Post",
          focusLabel: "More Like This",
        };
      }
      if (mode === "clarification") {
        return {
          variant: "clarification",
          eyebrow: "Clarify",
          description: "先问一个更窄的问题，压缩搜索空间，再进入更重的执行动作。",
          prompt: "推荐先确认：你想要的是框架深度、文献覆盖，还是一个能立刻展开的执行骨架？",
          runLabel: "Ask This",
          focusLabel: "Center On It",
        };
      }
      if (mode === "workflow_step") {
        return {
          variant: "workflow_step",
          eyebrow: "Workflow Step",
          description: "这是当前最像主路径推进的一步，适合把模糊目标变成一个中间产物。",
          prompt: "如果现在只允许推进一格，最值当的是先产出一个可修改的中间版本。",
          runLabel: "Start Step",
          focusLabel: "Make Primary",
        };
      }
      if (mode === "tool_run") {
        return {
          variant: "tool_run",
          eyebrow: "Tool Run",
          description: "这是一个更重的动作，成本更高，但可能直接带来外部材料或强信号。",
          prompt: "只有当你愿意为更深信息付出更高成本时，这种卡才应该占前排。",
          runLabel: "Run Tool",
          focusLabel: "Hold For Later",
        };
      }
      if (mode === "navigation") {
        return {
          variant: "navigation",
          eyebrow: "Recover Context",
          description: "这类卡不是强推新动作，而是帮助你重新进入当前 flow。",
          prompt: "先回到你已经有的上下文，再决定要不要继续执行。",
          runLabel: "Open View",
          focusLabel: "Refocus Here",
        };
      }
      return {
        variant: "generic",
        eyebrow: "Recommendation",
        description: "这是一张通用型推荐卡，适合继续当前对象但没有明显动作偏置。",
        prompt: "把它当成当前状态下的一般下一步建议。",
        runLabel: "Run",
        focusLabel: "Focus",
      };
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function openClarification(opportunity) {
      const preset = cardPreset(opportunity);
      pendingClarification = opportunity;
      els.composer.classList.add("active");
      els.composerTitle.textContent = opportunity.headline;
      els.composerCopy.textContent = preset.prompt;
      els.composerInput.value = "";
      els.composerInput.focus();
    }

    function renderDecision(payload) {
      latestDecision = payload;
      const decision = payload.decision;
      const trace = payload.trace || {};
      const summary = trace.sessionSummary || {};
      const working = trace.workingContext || {};
      const explanations = payload.explanations || [];

      els.intent.textContent = decision.intent.name;
      els.goal.textContent = summary.currentGoal || decision.context.metadata?.currentGoal || decision.context.metadata?.userGoal || "-";
      renderTags(els.focus, summary.currentFocusRefs || decision.context.focusObjectIds || []);
      renderTags(
        els.patterns,
        [
          ...((summary.acceptedPatterns || []).map((value) => "accept:" + value)),
          ...((summary.rejectedPatterns || []).map((value) => "reject:" + value)),
        ]
      );
      renderTags(els.signals, working.recentSignals || []);
      els.log.textContent = JSON.stringify(payload, null, 2);
      els.explainRail.innerHTML = "";
      for (const line of explanations) {
        const item = document.createElement("div");
        item.className = "explain-item";
        item.textContent = line;
        els.explainRail.appendChild(item);
      }
      if (explanations.length === 0) {
        const item = document.createElement("div");
        item.className = "explain-item";
        item.textContent = "还没有明显的行为偏置，系统主要按当前 focus object 和基础供给来排序。";
        els.explainRail.appendChild(item);
      }

      els.cards.innerHTML = "";
      if (!decision.opportunities.length) {
        els.cards.innerHTML = '<div class="empty">No opportunities returned.</div>';
        return;
      }

      for (const opportunity of decision.opportunities) {
        const preset = cardPreset(opportunity);
        const scenario = els.scenario.value;
        const primaryAction =
          scenario === "social-feed"
            ? (opportunity.metadata?.mode === "short_video" ? "watch" : "open")
            : "run";
        const primaryLabel =
          scenario === "social-feed" ? preset.runLabel : preset.runLabel;
        const secondaryAction =
          scenario === "social-feed"
            ? (opportunity.metadata?.mode === "short_video" ? "like" : "save")
            : "focus";
        const secondaryLabel =
          scenario === "social-feed"
            ? (secondaryAction === "like" ? "Like" : "Save")
            : preset.focusLabel;
        const creatorHtml = opportunity.metadata?.creator
          ? \`<span>creator: \${escapeHtml(opportunity.metadata.creator)}</span>\`
          : "";
        const hookHtml = opportunity.metadata?.hook
          ? \`<div class="card-prompt">\${escapeHtml(opportunity.metadata.hook)}</div>\`
          : "";
        const tagsHtml = opportunity.metadata?.tags?.length
          ? \`<div class="trace-list">\${opportunity.metadata.tags
              .map((tag) => \`<span>#\${escapeHtml(tag)}</span>\`)
              .join("")}</div>\`
          : "";
        const card = document.createElement("article");
        card.className = \`card card-\${preset.variant}\`;
        card.innerHTML = \`
          <div class="card-head">
            <div class="card-copy">
              <div class="eyebrow">\${escapeHtml(preset.eyebrow)}</div>
              <h2 class="card-title">\${opportunity.headline}</h2>
              <div class="sub">\${opportunity.reason}</div>
              <div class="card-description">\${escapeHtml(preset.description)}</div>
            </div>
            <div class="pill">\${opportunity.kind}</div>
          </div>
          <div class="card-prompt">\${escapeHtml(preset.prompt)}</div>
          <div class="metric-row">
            <div class="metric">
              <div class="metric-label">Cost Band</div>
              <div class="metric-value">\${opportunity.cost?.level || "n/a"}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Value Pull</div>
              <div class="metric-value">\${opportunity.value?.level || "n/a"}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Mode</div>
              <div class="metric-value">\${escapeHtml(opportunity.metadata?.mode || "n/a")}</div>
            </div>
          </div>
          <div class="meta">
            <span>score: \${opportunity.score ?? "n/a"}</span>
            \${creatorHtml}
            <span>source: \${escapeHtml((opportunity.sourceRefs || []).join(" · "))}</span>
          </div>
          \${hookHtml}
          \${tagsHtml}
          <div class="actions">
            <button class="btn-ghost" data-opportunity="\${opportunity.id}" data-action="dismiss">Skip</button>
            <button class="btn-soft" data-opportunity="\${opportunity.id}" data-action="\${secondaryAction}">\${escapeHtml(secondaryLabel)}</button>
            <button class="btn-primary" data-opportunity="\${opportunity.id}" data-action="\${primaryAction}">\${escapeHtml(primaryLabel)}</button>
          </div>
        \`;
        els.cards.appendChild(card);
      }
    }

    async function callJson(path, payload) {
      const response = await fetch(path, {
        method: payload ? "POST" : "GET",
        headers: { "content-type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || "request_failed");
      }
      return json;
    }

    async function refreshFeed() {
      setStatus("loading...");
      const strategy = els.strategy.value;
      const scenario = els.scenario.value;
      const payload = await callJson("/feed/next", { strategy, scenario, limit: 3 });
      renderDecision(payload);
      setStatus("feed updated");
    }

    async function resetFeed() {
      setStatus("resetting...");
      const strategy = els.strategy.value;
      const scenario = els.scenario.value;
      await callJson("/feed/reset", { strategy, scenario });
      pendingClarification = null;
      els.composer.classList.remove("active");
      els.composerInput.value = "";
      await refreshFeed();
      setStatus("session reset");
    }

    els.refresh.addEventListener("click", refreshFeed);
    els.reset.addEventListener("click", resetFeed);
    els.strategy.addEventListener("change", refreshFeed);
    els.scenario.addEventListener("change", refreshFeed);
    els.composerCancel.addEventListener("click", () => {
      pendingClarification = null;
      els.composer.classList.remove("active");
      els.composerInput.value = "";
      setStatus("clarification cancelled");
    });
    els.composerSubmit.addEventListener("click", async () => {
      if (!pendingClarification) return;
      const answer = els.composerInput.value.trim();
      if (!answer) {
        setStatus("please answer the clarification first");
        return;
      }
      setStatus("clarifying...");
      const strategy = els.strategy.value;
      const scenario = els.scenario.value;
      await callJson("/feed/clarify", {
        strategy,
        scenario,
        opportunity: pendingClarification,
        answer,
      });
      pendingClarification = null;
      els.composer.classList.remove("active");
      els.composerInput.value = "";
      await refreshFeed();
    });
    els.cards.addEventListener("click", async (event) => {
      const target = event.target.closest("button[data-action]");
      if (!target || !latestDecision) return;
      const strategy = els.strategy.value;
      const opportunity = latestDecision.decision.opportunities.find(
        (item) => item.id === target.dataset.opportunity
      );
      if (!opportunity) return;

      setStatus(target.dataset.action + "...");
      const scenario = els.scenario.value;
      if (target.dataset.action === "run" || target.dataset.action === "watch" || target.dataset.action === "open") {
        if ((opportunity.metadata?.mode || opportunity.kind) === "clarification") {
          openClarification(opportunity);
          setStatus("clarification needed");
          return;
        }
        await callJson("/feed/run", {
          strategy,
          scenario,
          action: target.dataset.action,
          opportunity,
          context: latestDecision.decision.context,
        });
      } else {
        await callJson("/feed/feedback", {
          strategy,
          scenario,
          opportunity,
          action: target.dataset.action,
        });
      }
      await refreshFeed();
    });

    refreshFeed().catch((error) => {
      setStatus("error");
      els.log.textContent = String(error);
    });
  </script>`);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function seedContextState(contextState, session) {
  for (const event of session.recentEvents ?? []) {
    await contextState.appendEvent({
      sessionId: session.sessionId,
      event: {
        ...event,
        actor: "user",
      },
    });
  }
}

async function buildScenarioRuntime(strategy, scenario) {
  const overlay = getScenarioOverlay(scenario);
  const storage =
    scenario === "social-feed"
      ? loadSocialFeedStorage(strategy)
      : loadResearchFlowStorage(strategy);
  const contextState = new InMemoryContextStateService({
    sessions: [{ sessionId: storage.session.sessionId }],
  });

  await seedContextState(contextState, storage.session);

  const runtime = new InMemoryRecommendationRuntime({
    sessions: [
      {
        sessionId: storage.session.sessionId,
        userId: storage.session.userId,
        surface: storage.session.surface,
        focusObjectIds: storage.session.focusObjectIds,
        recentEvents: storage.session.recentEvents,
        constraints: storage.constraints.map((item) => ({
          id: item.id,
          kind: item.kind,
          value: item.metadata?.value,
          metadata: item.metadata,
        })),
        metadata: storage.session.metadata,
      },
    ],
    services: {
      retrieval: new InMemoryRetrievalService({
        state: { refs: storage.state },
        memory: { refs: storage.memory },
        supply: { refs: storage.supply },
        constraint: { refs: storage.constraints },
      }),
      candidateConstruction: new BasicCandidateConstructionService({
        ...overlay.candidateTemplates,
      }),
      policy: new SimplePolicyService(3),
    },
    contextState,
  });

  return {
    runtime,
    contextState,
    sessionId: storage.session.sessionId,
    userId: storage.session.userId,
    surface: storage.session.surface,
    strategy,
    scenario,
    overlay,
  };
}

const runtimes = new Map();

function runtimeKey(strategy, scenario) {
  return `${scenario}:${strategy}`;
}

async function getRuntime(strategy, scenario) {
  const key = runtimeKey(strategy, scenario);
  if (!runtimes.has(key)) {
    runtimes.set(key, await buildScenarioRuntime(strategy, scenario));
  }
  return runtimes.get(key);
}

async function resetRuntime(strategy, scenario) {
  const key = runtimeKey(strategy, scenario);
  const next = await buildScenarioRuntime(strategy, scenario);
  runtimes.set(key, next);
  return next;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function sendHtml(res, status, body) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getStrategy(url, body = {}) {
  const strategy = body.strategy || url.searchParams.get("strategy") || "hybrid";
  if (!VALID_STRATEGIES.includes(strategy)) {
    throw new Error(`Unsupported strategy: ${strategy}`);
  }
  return strategy;
}

function getScenario(url, body = {}) {
  const scenario = body.scenario || url.searchParams.get("scenario") || "social-feed";
  if (!VALID_SCENARIOS.includes(scenario)) {
    throw new Error(`Unsupported scenario: ${scenario}`);
  }
  return scenario;
}

async function buildExplanations(runtimeHandle, decision, scenario) {
  const snapshot =
    runtimeHandle.contextState.getSessionSnapshot(runtimeHandle.sessionId) ?? {};
  const summary = snapshot.summary ?? {};
  const sessionState = snapshot.sessionState ?? {};
  const trace = runtimeHandle.runtime.getLastDecisionTrace?.() ?? {};
  const lastEvent = snapshot.events?.[snapshot.events.length - 1];
  const lines = (await runtimeHandle.overlay.buildExplanations?.({
    decision,
    sessionSummary: summary,
    sessionState,
    workingContext: trace.workingContext,
    lastEvent,
    metadata: { scenario },
  })) ?? [];

  if (
    decision.intent.name === "recover_flow" &&
    decision.opportunities.some((item) => item.cost?.level === "high")
  ) {
    lines.push("虽然高成本候选还在池子里，但 recover_flow 阶段它们会被压到后面，不会优先顶到最前排。");
  }

  if (
    trace.workingContext?.focusRefs?.length &&
    sessionState.focusRefs &&
    JSON.stringify(trace.workingContext.focusRefs) !== JSON.stringify(decision.context.focusObjectIds)
  ) {
    lines.push("当前 focus 已经被重写，下一轮推荐会围绕新的 focus object 重组。");
  }

  return lines.slice(0, 4);
}

async function snapshotPayload(runtimeHandle, strategy, _scenario, decision = null) {
  return {
    strategy,
    scenario: runtimeHandle.scenario,
    decision,
    trace: runtimeHandle.runtime.getLastDecisionTrace?.(),
    session: runtimeHandle.contextState.getSessionSnapshot(runtimeHandle.sessionId),
    explanations: decision
      ? await buildExplanations(runtimeHandle, decision, runtimeHandle.scenario)
      : [],
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return sendHtml(res, 200, feedPage());
    }

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "recommendation-runtime-feed-demo",
      });
    }

    if (req.method === "POST" && url.pathname === "/feed/reset") {
      const body = await readJsonBody(req);
      const strategy = getStrategy(url, body);
      const scenario = getScenario(url, body);
      const runtimeHandle = await resetRuntime(strategy, scenario);
      return sendJson(res, 200, {
        ok: true,
        strategy,
        scenario,
        session: runtimeHandle.contextState.getSessionSnapshot(runtimeHandle.sessionId),
      });
    }

    if (req.method === "POST" && url.pathname === "/feed/next") {
      const body = await readJsonBody(req);
      const strategy = getStrategy(url, body);
      const scenario = getScenario(url, body);
      const runtimeHandle = await getRuntime(strategy, scenario);
      const decision = await runtimeHandle.runtime.decideNext({
        sessionId: runtimeHandle.sessionId,
        userId: runtimeHandle.userId,
        surface: runtimeHandle.surface,
        limit: body.limit || 3,
        metadata: body.metadata,
      });
      return sendJson(res, 200, await snapshotPayload(runtimeHandle, strategy, scenario, decision));
    }

    if (req.method === "POST" && url.pathname === "/feed/feedback") {
      const body = await readJsonBody(req);
      const strategy = getStrategy(url, body);
      const scenario = getScenario(url, body);
      const runtimeHandle = await getRuntime(strategy, scenario);

      if (!body.opportunity || !body.action) {
        return sendJson(res, 400, {
          error: "Missing `opportunity` or `action`",
        });
      }

      const event = runtimeHandle.overlay.buildFeedbackEvent({
        action: body.action,
        opportunity: body.opportunity,
      });
      const feedbackTrace = await runtimeHandle.runtime.handleFeedback({
        event,
        context: {
          sessionId: runtimeHandle.sessionId,
          userId: runtimeHandle.userId,
          surface: runtimeHandle.surface,
          focusObjectIds: [],
        },
      });

      const decision = await runtimeHandle.runtime.decideNext({
        sessionId: runtimeHandle.sessionId,
        userId: runtimeHandle.userId,
        surface: runtimeHandle.surface,
        limit: 3,
      });

      return sendJson(res, 200, {
        ok: true,
        action: body.action,
        feedbackTrace,
        ...(await snapshotPayload(runtimeHandle, strategy, scenario, decision)),
      });
    }

    if (req.method === "POST" && url.pathname === "/feed/run") {
      const body = await readJsonBody(req);
      const strategy = getStrategy(url, body);
      const scenario = getScenario(url, body);
      const runtimeHandle = await getRuntime(strategy, scenario);

      if (!body.opportunity) {
        return sendJson(res, 400, {
          error: "Missing `opportunity`",
        });
      }

      const context =
        body.context ??
        (await runtimeHandle.runtime.getContext({
          sessionId: runtimeHandle.sessionId,
          userId: runtimeHandle.userId,
          surface: runtimeHandle.surface,
        }));

      let execution;
      if (scenario === "social-feed") {
        const action = body.action || "open";
        const event = runtimeHandle.overlay.buildFeedbackEvent({
          action,
          opportunity: body.opportunity,
          context,
        });
        const feedbackTrace = await runtimeHandle.runtime.handleFeedback({
          event,
          context,
        });

        execution = {
          action: {
            id: `action:${action}:${body.opportunity.id}`,
            type: action,
          },
          outcome: {
            actionId: `action:${action}:${body.opportunity.id}`,
            status: "accepted",
            feedbackSignals: [
              {
                type: `feed_${action}_success`,
                value: true,
              },
            ],
            artifactRefs: action === "save" ? [`saved:${body.opportunity.id}`] : [],
          },
          feedbackTrace,
        };
      } else {
        execution = await runtimeHandle.runtime.executeSelection({
          opportunity: body.opportunity,
          context,
        });
      }

      const decision = await runtimeHandle.runtime.decideNext({
        sessionId: runtimeHandle.sessionId,
        userId: runtimeHandle.userId,
        surface: runtimeHandle.surface,
        limit: 3,
      });

      return sendJson(res, 200, {
        strategy,
        scenario,
        execution,
        executionTrace:
          scenario === "social-feed"
            ? execution.feedbackTrace
            : runtimeHandle.runtime.getLastExecutionTrace?.(),
        ...(await snapshotPayload(runtimeHandle, strategy, scenario, decision)),
      });
    }

    if (req.method === "POST" && url.pathname === "/feed/clarify") {
      const body = await readJsonBody(req);
      const strategy = getStrategy(url, body);
      const scenario = getScenario(url, body);
      const runtimeHandle = await getRuntime(strategy, scenario);

      if (!body.opportunity || !body.answer) {
        return sendJson(res, 400, {
          error: "Missing `opportunity` or `answer`",
        });
      }

      const event = runtimeHandle.overlay.buildFeedbackEvent({
        action: "clarify",
        opportunity: body.opportunity,
        answer: body.answer,
        metadata: {
          answer: body.answer,
          goal: body.answer,
        },
      });
      const feedbackTrace = await runtimeHandle.runtime.handleFeedback({
        event,
        context: {
          sessionId: runtimeHandle.sessionId,
          userId: runtimeHandle.userId,
          surface: runtimeHandle.surface,
          focusObjectIds: [],
        },
      });

      const decision = await runtimeHandle.runtime.decideNext({
        sessionId: runtimeHandle.sessionId,
        userId: runtimeHandle.userId,
        surface: runtimeHandle.surface,
        limit: 3,
      });

      return sendJson(res, 200, {
        ok: true,
        feedbackTrace,
        ...(await snapshotPayload(runtimeHandle, strategy, scenario, decision)),
      });
    }

    if (req.method === "GET" && url.pathname === "/sdk/state") {
      const strategy = getStrategy(url);
      const scenario = getScenario(url);
      const runtimeHandle = await getRuntime(strategy, scenario);
      return sendJson(res, 200, {
        strategy,
        scenario,
        session: runtimeHandle.contextState.getSessionSnapshot(runtimeHandle.sessionId),
      });
    }

    if (req.method === "POST" && url.pathname === "/sdk/decide") {
      const body = await readJsonBody(req);
      const strategy = getStrategy(url, body);
      const scenario = getScenario(url, body);
      const runtimeHandle = await getRuntime(strategy, scenario);
      const decision = await runtimeHandle.runtime.decideNext({
        sessionId: body.sessionId || runtimeHandle.sessionId,
        userId: body.userId || runtimeHandle.userId,
        surface: body.surface || runtimeHandle.surface,
        limit: body.limit || 3,
        metadata: body.metadata,
      });

      return sendJson(res, 200, {
        strategy,
        scenario,
        decision,
        trace: runtimeHandle.runtime.getLastDecisionTrace?.(),
      });
    }

    if (req.method === "POST" && url.pathname === "/sdk/execute") {
      const body = await readJsonBody(req);
      const strategy = getStrategy(url, body);
      const scenario = getScenario(url, body);
      const runtimeHandle = await getRuntime(strategy, scenario);

      if (!body.opportunity) {
        return sendJson(res, 400, {
          error: "Missing `opportunity` in request body",
        });
      }

      const execution = await runtimeHandle.runtime.executeSelection({
        opportunity: body.opportunity,
        context: body.context,
        metadata: body.metadata,
      });

      return sendJson(res, 200, {
        strategy,
        scenario,
        execution,
        trace: runtimeHandle.runtime.getLastExecutionTrace?.(),
      });
    }

    return sendJson(res, 404, {
      error: "Not found",
      path: url.pathname,
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(
    JSON.stringify(
      {
        ok: true,
        port: PORT,
        endpoints: [
          "GET /",
          "GET /health",
          "POST /feed/next",
          "POST /feed/feedback",
          "POST /feed/run",
          "POST /feed/clarify",
          "POST /feed/reset",
          "POST /sdk/decide",
          "POST /sdk/execute",
          "GET /sdk/state?strategy=hybrid",
        ],
      },
      null,
      2
    )
  );
});
