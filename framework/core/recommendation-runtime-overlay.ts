import type {
  Context,
  Decision,
  EventRef,
  Id,
  Metadata,
  Opportunity,
} from "./recommendation-runtime-protocol.ts";
import type { CandidateTemplateMap } from "./recommendation-runtime-candidate.ts";
import type {
  FeedbackAction,
  FeedbackEvent,
} from "./recommendation-runtime-feedback.ts";
import type {
  SessionSummary,
  WorkingContext,
} from "./recommendation-runtime-context.ts";

export type OverlayFeedbackInput = {
  action: FeedbackAction;
  opportunity: Opportunity;
  context?: Context;
  answer?: string;
  metadata?: Metadata;
};

export type OverlayExplanationInput = {
  decision: Decision;
  sessionSummary?: SessionSummary | null;
  sessionState?: Record<string, unknown>;
  workingContext?: WorkingContext;
  lastEvent?: EventRef;
  metadata?: Metadata;
};

export type OverlayFeedbackTypeResolver = (
  input: OverlayFeedbackInput
) => string;

export type OverlayFeedbackKeyResolver = (
  input: OverlayFeedbackInput
) => string | undefined;

export type OverlayFeedbackMetadataBuilder = (
  input: OverlayFeedbackInput
) => Metadata | undefined;

export type OverlayExplanationBuilder = (
  input: OverlayExplanationInput
) => string[] | Promise<string[]>;

export interface ScenarioOverlay {
  name: string;
  candidateTemplates?: CandidateTemplateMap;
  buildFeedbackEvent(input: OverlayFeedbackInput): FeedbackEvent;
  buildExplanations?(input: OverlayExplanationInput): string[] | Promise<string[]>;
}

export type ScenarioOverlayConfig = {
  name: string;
  candidateTemplates?: CandidateTemplateMap;
  resolveFeedbackType?: OverlayFeedbackTypeResolver;
  resolveFeedbackKey?: OverlayFeedbackKeyResolver;
  buildFeedbackMetadata?: OverlayFeedbackMetadataBuilder;
  buildExplanations?: OverlayExplanationBuilder;
};

function defaultEventId(type: string): Id {
  return `event:${type}:${Date.now()}`;
}

export function createScenarioOverlay(
  config: ScenarioOverlayConfig
): ScenarioOverlay {
  const resolveFeedbackType =
    config.resolveFeedbackType ??
    ((input) =>
      input.action === "dismiss"
        ? "feed_dismissed"
        : input.action === "focus" || input.action === "open"
          ? "feed_focused"
          : input.action === "like"
            ? "post_liked"
            : input.action === "save"
              ? "post_saved"
              : input.action === "watch"
                ? "video_watched"
                : input.action === "clarify"
                  ? "clarification_answered"
                  : "feed_interacted");

  const resolveFeedbackKey =
    config.resolveFeedbackKey ??
    ((input) =>
      (input.opportunity.metadata?.feedbackKey as string | undefined) ??
      (input.opportunity.metadata?.mode as string | undefined) ??
      input.opportunity.kind);

  const buildFeedbackMetadata =
    config.buildFeedbackMetadata ??
    ((input) => ({
      feedbackKey: resolveFeedbackKey(input),
      mode: input.opportunity.metadata?.mode,
      kind: input.opportunity.kind,
      action: input.action,
      focusRefs:
        input.action === "focus" || input.action === "open"
          ? (input.opportunity.sourceRefs ?? []).slice(1)
          : undefined,
      artifactRef:
        input.action === "save"
          ? `saved:${input.opportunity.id}`
          : undefined,
      ...(input.answer ? { answer: input.answer, goal: input.answer } : {}),
      ...(input.metadata ?? {}),
    }));

  return {
    name: config.name,
    candidateTemplates: config.candidateTemplates,
    buildFeedbackEvent(input) {
      const type = resolveFeedbackType(input);
      return {
        id: defaultEventId(type),
        action: input.action,
        targetRef: input.opportunity.id,
        type,
        timestampMs: Date.now(),
        actor: "user",
        objectRefs: [
          input.opportunity.id,
          ...(input.opportunity.sourceRefs ?? []),
        ].slice(0, 3),
        metadata: buildFeedbackMetadata(input),
      };
    },
    buildExplanations: config.buildExplanations,
  };
}
