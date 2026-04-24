import type {
  FeedbackEvent,
  FeedbackInterpreter,
  FeedbackKeyResolver,
  FeedbackProjectionRule,
  FeedbackProjector,
  FeedbackSignal,
  FeedbackSignalRule,
  StateProjection,
} from "../core/recommendation-runtime-feedback.ts";

export const defaultFeedbackKeyResolver: FeedbackKeyResolver = async (
  event: FeedbackEvent
) =>
  (event.metadata?.feedbackKey as string | undefined) ??
  (event.metadata?.mode as string | undefined) ??
  (event.metadata?.kind as string | undefined);

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export const dismissToNegativeInterestRule: FeedbackSignalRule = async ({
  event,
  key,
}) => {
  if (event.action !== "dismiss") return [];
  return {
    id: `signal:negative:${event.id}`,
    kind: "negative_interest",
    key,
    strength: 0.65,
    confidence: 0.92,
    sourceEventId: event.id,
    metadata: event.metadata,
  };
};

export const positiveInterestRule: FeedbackSignalRule = async ({
  event,
  key,
}) => {
  if (!["like", "save", "watch"].includes(event.action)) return [];
  return {
    id: `signal:positive:${event.id}`,
    kind: "positive_interest",
    key,
    strength: event.action === "save" ? 0.9 : 0.72,
    confidence: 0.9,
    sourceEventId: event.id,
    metadata: event.metadata,
  };
};

export const focusShiftRule: FeedbackSignalRule = async ({ event, key }) => {
  if (!["focus", "open"].includes(event.action)) return [];
  return {
    id: `signal:focus:${event.id}`,
    kind: "focus_shift",
    key,
    strength: 0.7,
    confidence: 0.84,
    sourceEventId: event.id,
    metadata: event.metadata,
  };
};

export const goalRefinementRule: FeedbackSignalRule = async ({ event, key }) => {
  if (event.action !== "clarify") return [];
  return {
    id: `signal:goal:${event.id}`,
    kind: "goal_refinement",
    key:
      (event.metadata?.answer as string | undefined) ??
      (event.metadata?.goal as string | undefined) ??
      key,
    strength: 0.88,
    confidence: 0.95,
    sourceEventId: event.id,
    metadata: event.metadata,
  };
};

export const highIntentEngagementRule: FeedbackSignalRule = async ({
  event,
  key,
}) => {
  if (!["execute", "save"].includes(event.action)) return [];
  return {
    id: `signal:intent:${event.id}`,
    kind: "high_intent_engagement",
    key,
    strength: 0.8,
    confidence: 0.86,
    sourceEventId: event.id,
    metadata: event.metadata,
  };
};

export const defaultFeedbackSignalRules: FeedbackSignalRule[] = [
  dismissToNegativeInterestRule,
  positiveInterestRule,
  focusShiftRule,
  goalRefinementRule,
  highIntentEngagementRule,
];

export const negativeInterestProjectionRule: FeedbackProjectionRule = async ({
  event,
  signal,
}) => {
  if (signal.kind !== "negative_interest" || !signal.key) return [];
  return {
    target: "session",
    operation: "append",
    path: "rejectedPatterns",
    value: signal.key,
    reason: "feedback_negative_interest",
    sourceEventIds: [event.id],
    confidence: signal.confidence,
    sourceSignalKinds: [signal.kind],
  };
};

export const positiveInterestProjectionRule: FeedbackProjectionRule = async ({
  event,
  signal,
}) => {
  if (signal.kind !== "positive_interest" || !signal.key) return [];
  return {
    target: "session",
    operation: "append",
    path: "acceptedPatterns",
    value: signal.key,
    reason: "feedback_positive_interest",
    sourceEventIds: [event.id],
    confidence: signal.confidence,
    sourceSignalKinds: [signal.kind],
  };
};

export const focusShiftProjectionRule: FeedbackProjectionRule = async ({
  event,
  signal,
}) => {
  if (signal.kind !== "focus_shift") return [];

  const focusRefs =
    ((event.metadata?.focusRefs as string[] | undefined) ?? []).length > 0
      ? (event.metadata?.focusRefs as string[] | undefined)
      : event.objectRefs?.slice(1);

  if (!focusRefs?.length) return [];

  return {
    target: "session",
    operation: "set",
    path: "focusRefs",
    value: focusRefs,
    reason: "feedback_focus_shift",
    sourceEventIds: [event.id],
    confidence: signal.confidence,
    sourceSignalKinds: [signal.kind],
  };
};

export const goalRefinementProjectionRule: FeedbackProjectionRule = async ({
  event,
  signal,
}) => {
  if (signal.kind !== "goal_refinement" || !signal.key) return [];
  return {
    target: "session",
    operation: "set",
    path: "goal.current",
    value: signal.key,
    reason: "feedback_goal_refinement",
    sourceEventIds: [event.id],
    confidence: signal.confidence,
    sourceSignalKinds: [signal.kind],
  };
};

export const highIntentArtifactProjectionRule: FeedbackProjectionRule = async ({
  event,
  signal,
}) => {
  if (signal.kind !== "high_intent_engagement") return [];

  const artifactRef =
    (event.metadata?.artifactRef as string | undefined) ??
    (event.action === "save" ? `saved:${event.targetRef}` : undefined);

  if (!artifactRef) return [];

  return {
    target: "session",
    operation: "append",
    path: "recentArtifacts",
    value: artifactRef,
    reason: "feedback_high_intent_artifact",
    sourceEventIds: [event.id],
    confidence: signal.confidence,
    sourceSignalKinds: [signal.kind],
  };
};

export const defaultFeedbackProjectionRules: FeedbackProjectionRule[] = [
  negativeInterestProjectionRule,
  positiveInterestProjectionRule,
  focusShiftProjectionRule,
  goalRefinementProjectionRule,
  highIntentArtifactProjectionRule,
];

export type ComposableFeedbackInterpreterConfig = {
  keyResolver?: FeedbackKeyResolver;
  signalRules?: FeedbackSignalRule[];
};

export type ComposableFeedbackProjectorConfig = {
  projectionRules?: FeedbackProjectionRule[];
};

export class ComposableFeedbackInterpreter implements FeedbackInterpreter {
  private readonly keyResolver: FeedbackKeyResolver;
  private readonly signalRules: FeedbackSignalRule[];

  constructor(config: ComposableFeedbackInterpreterConfig = {}) {
    this.keyResolver = config.keyResolver ?? defaultFeedbackKeyResolver;
    this.signalRules = config.signalRules ?? defaultFeedbackSignalRules;
  }

  async interpret(input: { event: FeedbackEvent }): Promise<FeedbackSignal[]> {
    const key = await this.keyResolver(input.event);
    const signals: FeedbackSignal[] = [];

    for (const rule of this.signalRules) {
      const next = await rule({
        event: input.event,
        key,
      });
      signals.push(...asArray(next));
    }

    return signals;
  }
}

export class ComposableFeedbackProjector implements FeedbackProjector {
  private readonly projectionRules: FeedbackProjectionRule[];

  constructor(config: ComposableFeedbackProjectorConfig = {}) {
    this.projectionRules =
      config.projectionRules ?? defaultFeedbackProjectionRules;
  }

  async project(input: {
    event: FeedbackEvent;
    signals: FeedbackSignal[];
    sessionId: string;
  }): Promise<StateProjection[]> {
    const projections: StateProjection[] = [];

    for (const signal of input.signals) {
      for (const rule of this.projectionRules) {
        const next = await rule({
          ...input,
          signal,
        });
        projections.push(...asArray(next));
      }
    }

    return projections;
  }
}

export class RuleBasedFeedbackInterpreter extends ComposableFeedbackInterpreter {}

export class RuleBasedFeedbackProjector extends ComposableFeedbackProjector {}
