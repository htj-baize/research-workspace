import type {
  FeedbackEvent,
  FeedbackInterpreter,
  FeedbackProjector,
  FeedbackSignal,
  StateProjection,
} from "../core/recommendation-runtime-feedback.ts";

function getFeedbackKey(event: FeedbackEvent): string | undefined {
  return (
    (event.metadata?.feedbackKey as string | undefined) ??
    (event.metadata?.mode as string | undefined) ??
    (event.metadata?.kind as string | undefined)
  );
}

export class RuleBasedFeedbackInterpreter implements FeedbackInterpreter {
  async interpret(input: { event: FeedbackEvent }): Promise<FeedbackSignal[]> {
    const { event } = input;
    const key = getFeedbackKey(event);
    const signals: FeedbackSignal[] = [];

    if (event.action === "dismiss") {
      signals.push({
        id: `signal:negative:${event.id}`,
        kind: "negative_interest",
        key,
        strength: 0.65,
        confidence: 0.92,
        sourceEventId: event.id,
        metadata: event.metadata,
      });
    }

    if (
      event.action === "like" ||
      event.action === "save" ||
      event.action === "watch"
    ) {
      signals.push({
        id: `signal:positive:${event.id}`,
        kind: "positive_interest",
        key,
        strength: event.action === "save" ? 0.9 : 0.72,
        confidence: 0.9,
        sourceEventId: event.id,
        metadata: event.metadata,
      });
    }

    if (event.action === "focus" || event.action === "open") {
      signals.push({
        id: `signal:focus:${event.id}`,
        kind: "focus_shift",
        key,
        strength: 0.7,
        confidence: 0.84,
        sourceEventId: event.id,
        metadata: event.metadata,
      });
    }

    if (event.action === "clarify") {
      signals.push({
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
      });
    }

    if (event.action === "execute" || event.action === "save") {
      signals.push({
        id: `signal:intent:${event.id}`,
        kind: "high_intent_engagement",
        key,
        strength: 0.8,
        confidence: 0.86,
        sourceEventId: event.id,
        metadata: event.metadata,
      });
    }

    return signals;
  }
}

export class RuleBasedFeedbackProjector implements FeedbackProjector {
  async project(input: {
    event: FeedbackEvent;
    signals: FeedbackSignal[];
    sessionId: string;
  }): Promise<StateProjection[]> {
    const projections: StateProjection[] = [];

    for (const signal of input.signals) {
      if (signal.kind === "negative_interest" && signal.key) {
        projections.push({
          target: "session",
          operation: "append",
          path: "rejectedPatterns",
          value: signal.key,
          reason: "feedback_negative_interest",
          sourceEventIds: [input.event.id],
          confidence: signal.confidence,
          sourceSignalKinds: [signal.kind],
        });
      }

      if (signal.kind === "positive_interest" && signal.key) {
        projections.push({
          target: "session",
          operation: "append",
          path: "acceptedPatterns",
          value: signal.key,
          reason: "feedback_positive_interest",
          sourceEventIds: [input.event.id],
          confidence: signal.confidence,
          sourceSignalKinds: [signal.kind],
        });
      }

      if (signal.kind === "focus_shift") {
        const focusRefs =
          ((input.event.metadata?.focusRefs as string[] | undefined) ?? []).length > 0
            ? (input.event.metadata?.focusRefs as string[] | undefined)
            : input.event.objectRefs?.slice(1);

        if (focusRefs?.length) {
          projections.push({
            target: "session",
            operation: "set",
            path: "focusRefs",
            value: focusRefs,
            reason: "feedback_focus_shift",
            sourceEventIds: [input.event.id],
            confidence: signal.confidence,
            sourceSignalKinds: [signal.kind],
          });
        }
      }

      if (signal.kind === "goal_refinement" && signal.key) {
        projections.push({
          target: "session",
          operation: "set",
          path: "goal.current",
          value: signal.key,
          reason: "feedback_goal_refinement",
          sourceEventIds: [input.event.id],
          confidence: signal.confidence,
          sourceSignalKinds: [signal.kind],
        });
      }

      if (signal.kind === "high_intent_engagement") {
        const artifactRef =
          (input.event.metadata?.artifactRef as string | undefined) ??
          (input.event.action === "save" ? `saved:${input.event.targetRef}` : undefined);

        if (artifactRef) {
          projections.push({
            target: "session",
            operation: "append",
            path: "recentArtifacts",
            value: artifactRef,
            reason: "feedback_high_intent_artifact",
            sourceEventIds: [input.event.id],
            confidence: signal.confidence,
            sourceSignalKinds: [signal.kind],
          });
        }
      }
    }

    return projections;
  }
}
