import { createScenarioOverlay } from "../../framework/index.ts";

const socialFeedOverlay = createScenarioOverlay({
  name: "social-feed",
  candidateTemplates: {
    explore: {
      headlinePrefix: "For You",
      reasonPrefix: "Recent behavior suggests",
    },
    continue_current_object: {
      headlinePrefix: "Next",
      reasonPrefix: "High-signal next step for",
    },
    deepen_current_object: {
      headlinePrefix: "Deepen",
      reasonPrefix: "Build deeper momentum for",
    },
    recover_flow: {
      headlinePrefix: "Recover",
      reasonPrefix: "Low-friction recovery for",
    },
  },
  buildExplanations({ decision, sessionSummary, lastEvent }) {
    const lines = [];
    const rejected = sessionSummary?.rejectedPatterns ?? [];
    const accepted = sessionSummary?.acceptedPatterns ?? [];
    const recentArtifacts = sessionSummary?.recentArtifacts ?? [];

    if (lastEvent?.type === "feed_dismissed") {
      lines.push(
        `你刚刚跳过了 ${lastEvent.metadata?.feedbackKey ?? "上一张卡"}，所以系统把 intent 切向更保守的 ${decision.intent.name}。`
      );
    }

    if (lastEvent?.type === "post_liked" || lastEvent?.type === "video_watched") {
      lines.push(
        `你刚对 ${lastEvent.metadata?.feedbackKey ?? "这一类内容"} 给了正向反馈，所以相近主题在这轮里被放大了。`
      );
    }

    if (lastEvent?.type === "post_saved") {
      lines.push(
        `你刚收藏了 ${lastEvent.metadata?.feedbackKey ?? "一条内容"}，系统会把它当成更强的长期兴趣信号。`
      );
    }

    if (rejected.length > 0) {
      lines.push(`当前 session 已记录拒绝模式：${rejected.join(" / ")}，命中这些模式的卡会被降权。`);
    }

    if (accepted.length > 0) {
      lines.push(`当前 session 已记录接受模式：${accepted.join(" / ")}，相近路径会在后续推荐里被轻微放大。`);
    }

    if (accepted.length === 0 && rejected.length === 0) {
      lines.push("现在更像一个内容平台的冷启动阶段，系统先按你最近停留过的主题和基础热度发牌。");
    }

    if (recentArtifacts.length > 0) {
      lines.push(`最近已有产物 ${recentArtifacts.slice(-1)[0]}，所以系统会优先考虑“推进已有成果”的下一步。`);
    }

    return lines.slice(0, 4);
  },
});

const researchFlowOverlay = createScenarioOverlay({
  name: "research-flow",
  candidateTemplates: {
    continue_current_object: {
      headlinePrefix: "Next",
      reasonPrefix: "High-signal next step for",
    },
    deepen_current_object: {
      headlinePrefix: "Deepen",
      reasonPrefix: "Build deeper momentum for",
    },
    recover_flow: {
      headlinePrefix: "Recover",
      reasonPrefix: "Low-friction recovery for",
    },
  },
  buildExplanations({ decision, lastEvent }) {
    const lines = [];

    if (lastEvent?.type === "clarification_answered") {
      lines.push("你刚补充了一个更明确的目标，系统把它写进 currentGoal，并据此重排了下一轮候选。");
    }

    if (lastEvent?.type === "outcome_executed") {
      lines.push("你刚执行过一个动作并产出了 artifact，所以系统开始偏向更深一层的 continuation，而不是只做恢复。");
    }

    if (
      decision.intent.name === "recover_flow" &&
      decision.opportunities.some((item) => item.cost?.level === "high")
    ) {
      lines.push("虽然高成本候选还在池子里，但 recover_flow 阶段它们会被压到后面，不会优先顶到最前排。");
    }

    return lines.slice(0, 4);
  },
});

export const SCENARIO_OVERLAYS = {
  "social-feed": socialFeedOverlay,
  "research-flow": researchFlowOverlay,
};

export function getScenarioOverlay(name) {
  return SCENARIO_OVERLAYS[name] ?? SCENARIO_OVERLAYS["social-feed"];
}
