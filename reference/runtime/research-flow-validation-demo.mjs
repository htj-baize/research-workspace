const now = Date.now();

function inferIntent(context) {
  const hasFocus = context.focusObjectIds.length > 0;
  const recentReject = (context.recentEvents || []).some(
    (event) => event.type === "outcome_rejected"
  );
  const missingTopic = !context.metadata?.topic;

  if (recentReject) {
    return {
      name: "recover_flow",
      confidence: 0.78,
      evidence: ["recent_reject"],
    };
  }

  if (missingTopic) {
    return {
      name: "clarify_goal",
      confidence: 0.9,
      evidence: ["missing_topic"],
    };
  }

  if (hasFocus) {
    return {
      name: "continue_current_object",
      confidence: 0.82,
      evidence: ["has_focus_object"],
    };
  }

  return {
    name: "explore",
    confidence: 0.58,
    evidence: ["default_fallback"],
  };
}

function retrieveMaterials(strategy, context, intent, dataset) {
  const sessionEvents = context.recentEvents || [];
  const stateRefs = [
    {
      id: `state:${context.sessionId}`,
      kind: "session_state",
      score: 1,
      metadata: {
        source: strategy,
        eventCount: sessionEvents.length,
      },
    },
  ];

  const memoryRefs =
    strategy === "local-heavy"
      ? dataset.localMemory
      : strategy === "cloud-heavy"
        ? dataset.cloudMemory
        : [...dataset.localMemory, ...dataset.cloudMemory];

  const supplyRefs = dataset.supply.filter((ref) => {
    if (!context.focusObjectIds.length) return true;
    const objectRefs = ref.metadata?.objectRefs || [];
    return objectRefs.some((id) => context.focusObjectIds.includes(id));
  });

  const constraintRefs =
    strategy === "cloud-heavy"
      ? dataset.cloudConstraints
      : strategy === "local-heavy"
        ? dataset.localConstraints
        : [...dataset.localConstraints, ...dataset.cloudConstraints];

  return {
    state: stateRefs,
    memory: memoryRefs,
    supply: supplyRefs,
    constraints: constraintRefs,
    metadata: {
      strategy,
      intent: intent.name,
    },
  };
}

function toOpportunity(context, intent, ref, index) {
  const mode = ref.metadata?.mode || "generic";
  const kind =
    intent.name === "clarify_goal"
      ? "clarification"
      : ref.kind === "tool"
        ? "tool_run"
        : ref.kind === "step"
          ? "workflow_step"
          : ref.kind === "page"
            ? "navigation"
            : "content";

  const actionType =
    kind === "clarification"
      ? "ask"
      : kind === "tool_run"
        ? "execute"
        : kind === "workflow_step"
          ? "confirm"
          : kind === "navigation"
            ? "navigate"
            : "open";

  const costLevel =
    ref.metadata?.costLevel ||
    (actionType === "execute" ? "high" : actionType === "confirm" ? "medium" : "low");

  return {
    id: `opp:${context.sessionId}:${index}:${ref.id}`,
    kind,
    headline: ref.metadata?.headline || `Next: ${ref.id}`,
    reason: `${ref.metadata?.reasonPrefix || "Relevant for"} ${intent.name}`,
    sourceRefs: [ref.id, ...context.focusObjectIds].slice(0, 3),
    actionRef: `action:${actionType}:${ref.id}`,
    score: ref.score || 0.5,
    cost: {
      level: costLevel,
      label: ref.metadata?.costLabel || costLevel,
    },
    value: {
      level: ref.metadata?.valueLevel || "medium",
      label: ref.metadata?.valueLabel || mode,
    },
    metadata: {
      mode,
      actionType,
      source: ref.kind,
    },
  };
}

function constructOpportunities(context, intent, materials) {
  return materials.supply.map((ref, index) =>
    toOpportunity(context, intent, ref, index)
  );
}

function decide(strategy, context, intent, opportunities) {
  const suppressed = [];
  const selected = [];
  const limit = 3;

  const sorted = [...opportunities].sort((a, b) => {
    const rejectPenalty =
      intent.name === "recover_flow" && a.cost?.level === "high" ? 0.25 : 0;
    const bPenalty =
      intent.name === "recover_flow" && b.cost?.level === "high" ? 0.25 : 0;
    return (b.score || 0) - bPenalty - ((a.score || 0) - rejectPenalty);
  });

  for (const opportunity of sorted) {
    const actionType = opportunity.metadata?.actionType;

    if (intent.name === "clarify_goal" && actionType !== "ask") {
      suppressed.push({
        opportunityId: opportunity.id,
        reason: "prefer_clarification_first",
      });
      continue;
    }

    if (intent.name === "recover_flow" && opportunity.cost?.level === "high") {
      suppressed.push({
        opportunityId: opportunity.id,
        reason: "avoid_high_cost_during_recovery",
      });
      continue;
    }

    if (selected.length >= limit) {
      suppressed.push({
        opportunityId: opportunity.id,
        reason: "limit_reached",
      });
      continue;
    }

    selected.push(opportunity);
  }

  return {
    strategy,
    context,
    intent,
    selected,
    suppressed,
  };
}

function executeSelection(decision) {
  const selected = decision.selected[0];
  if (!selected) {
    return {
      outcome: {
        status: "failed",
        reason: "no_selected_opportunity",
      },
    };
  }

  const actionType = selected.metadata?.actionType;
  const outcomeStatus =
    actionType === "execute" ? "executed" : actionType === "confirm" ? "accepted" : "accepted";

  const artifact =
    actionType === "execute"
      ? {
          id: `artifact:${selected.id}`,
          kind: "research_outline",
        }
      : null;

  return {
    selected,
    action: {
      id: selected.actionRef,
      type: actionType,
      requiresConfirmation: actionType === "confirm",
    },
    outcome: {
      actionId: selected.actionRef,
      status: outcomeStatus,
      artifactRefs: artifact ? [artifact.id] : [],
      feedbackSignals: [
        {
          type: outcomeStatus === "executed" ? "execution_success" : "selection_success",
          value: true,
        },
      ],
    },
    artifact,
  };
}

function buildScenario() {
  const baseContext = {
    sessionId: "research-session-1",
    userId: "user-1",
    surface: "assistant",
    focusObjectIds: ["topic:agent-native-recommendation"],
    recentEvents: [
      {
        id: "event:1",
        type: "user_prompted",
        timestampMs: now - 60_000,
        objectRefs: ["topic:agent-native-recommendation"],
      },
      {
        id: "event:2",
        type: "outline_viewed",
        timestampMs: now - 40_000,
        objectRefs: ["draft:outline-v1"],
      },
      {
        id: "event:3",
        type: "outcome_rejected",
        timestampMs: now - 15_000,
        objectRefs: ["opp:old"],
      },
    ],
    metadata: {
      topic: "agent-native recommendation runtime",
      userGoal: "build a research outline",
    },
  };

  const dataset = {
    localMemory: [
      {
        id: "memory:recent-preference",
        kind: "memory",
        score: 0.7,
        metadata: {
          summary: "User prefers concise outlines before deep dives",
        },
      },
    ],
    cloudMemory: [
      {
        id: "memory:long-term",
        kind: "memory",
        score: 0.65,
        metadata: {
          summary: "Past research tasks favored structured comparison tables",
        },
      },
    ],
    localConstraints: [
      {
        id: "constraint:low-friction",
        kind: "constraint",
        score: 1,
        metadata: {
          type: "interaction_preference",
          value: "low_friction",
        },
      },
    ],
    cloudConstraints: [
      {
        id: "constraint:tool-cost",
        kind: "constraint",
        score: 1,
        metadata: {
          type: "tool_cost",
          value: "medium_budget",
        },
      },
    ],
    supply: [
      {
        id: "supply:clarify-scope",
        kind: "content",
        score: 0.74,
        metadata: {
          mode: "clarification",
          objectRefs: ["topic:agent-native-recommendation"],
          headline: "Ask one narrowing question about scope",
          reasonPrefix: "Useful before deeper work for",
          valueLevel: "high",
          costLevel: "low",
        },
      },
      {
        id: "supply:outline-step",
        kind: "step",
        score: 0.88,
        metadata: {
          mode: "workflow_step",
          objectRefs: ["topic:agent-native-recommendation"],
          headline: "Draft a first-pass research outline",
          reasonPrefix: "Strong next step for",
          valueLevel: "high",
          costLevel: "medium",
        },
      },
      {
        id: "supply:search-tool",
        kind: "tool",
        score: 0.8,
        metadata: {
          mode: "tool_run",
          objectRefs: ["topic:agent-native-recommendation"],
          headline: "Run a targeted literature search",
          reasonPrefix: "Actionable next step for",
          valueLevel: "high",
          costLevel: "high",
        },
      },
      {
        id: "supply:open-notes",
        kind: "page",
        score: 0.67,
        metadata: {
          mode: "navigation",
          objectRefs: ["draft:outline-v1"],
          headline: "Open the previous outline draft",
          reasonPrefix: "Helps recover context for",
          valueLevel: "medium",
          costLevel: "low",
        },
      },
    ],
  };

  return { baseContext, dataset };
}

function runStrategy(strategy, scenario) {
  const context = {
    ...scenario.baseContext,
    metadata: {
      ...scenario.baseContext.metadata,
      stateStrategy: strategy,
    },
  };
  const intent = inferIntent(context);
  const materials = retrieveMaterials(strategy, context, intent, scenario.dataset);
  const opportunities = constructOpportunities(context, intent, materials);
  const decision = decide(strategy, context, intent, opportunities);
  const execution = executeSelection(decision);

  return {
    strategy,
    contextSummary: {
      focusObjectIds: context.focusObjectIds,
      recentEventCount: context.recentEvents.length,
      stateStrategy: strategy,
    },
    intent,
    retrievalSummary: {
      stateCount: materials.state.length,
      memoryCount: materials.memory.length,
      supplyCount: materials.supply.length,
      constraintCount: materials.constraints.length,
    },
    selectedOpportunities: decision.selected.map((opportunity) => ({
      id: opportunity.id,
      kind: opportunity.kind,
      headline: opportunity.headline,
      cost: opportunity.cost,
      actionType: opportunity.metadata?.actionType,
    })),
    suppressed: decision.suppressed,
    execution,
  };
}

function main() {
  const scenario = buildScenario();
  const strategies = ["cloud-heavy", "hybrid", "local-heavy"];
  const results = strategies.map((strategy) => runStrategy(strategy, scenario));

  console.log(JSON.stringify(results, null, 2));
}

main();
