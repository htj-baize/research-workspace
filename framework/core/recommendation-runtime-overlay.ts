import type {
  Context,
  Decision,
  EventRef,
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

export interface ScenarioOverlay {
  name: string;
  candidateTemplates?: CandidateTemplateMap;
  buildFeedbackEvent(input: OverlayFeedbackInput): FeedbackEvent;
  buildExplanations?(input: OverlayExplanationInput): string[] | Promise<string[]>;
}
