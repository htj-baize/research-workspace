import type { Id, Metadata } from "./recommendation-runtime-protocol.ts";
import type { StateWrite } from "./recommendation-runtime-context.ts";

export type FeedbackActor = "user" | "system";

export type FeedbackAction =
  | "dismiss"
  | "focus"
  | "open"
  | "like"
  | "save"
  | "watch"
  | "clarify"
  | "execute";

export type FeedbackEvent = {
  id: Id;
  actor: FeedbackActor;
  action: FeedbackAction;
  targetRef: Id;
  timestampMs: number;
  objectRefs?: Id[];
  metadata?: Metadata;
};

export type FeedbackSignalKind =
  | "negative_interest"
  | "positive_interest"
  | "focus_shift"
  | "goal_refinement"
  | "high_intent_engagement";

export type FeedbackSignal = {
  id: Id;
  kind: FeedbackSignalKind;
  key?: string;
  strength?: number;
  confidence?: number;
  sourceEventId: Id;
  metadata?: Metadata;
};

export type StateProjection = StateWrite & {
  sourceSignalKinds: FeedbackSignalKind[];
};

export type InterpretFeedbackInput = {
  event: FeedbackEvent;
  sessionId?: Id;
  metadata?: Metadata;
};

export type ProjectFeedbackInput = {
  event: FeedbackEvent;
  signals: FeedbackSignal[];
  sessionId: Id;
  metadata?: Metadata;
};

export interface FeedbackInterpreter {
  interpret(input: InterpretFeedbackInput): Promise<FeedbackSignal[]>;
}

export interface FeedbackProjector {
  project(input: ProjectFeedbackInput): Promise<StateProjection[]>;
}

export type FeedbackKeyResolver = (
  event: FeedbackEvent
) => string | undefined | Promise<string | undefined>;

export type FeedbackSignalRuleInput = InterpretFeedbackInput & {
  key?: string;
};

export type FeedbackSignalRule = (
  input: FeedbackSignalRuleInput
) =>
  | FeedbackSignal
  | FeedbackSignal[]
  | null
  | undefined
  | Promise<FeedbackSignal | FeedbackSignal[] | null | undefined>;

export type FeedbackProjectionRuleInput = ProjectFeedbackInput & {
  signal: FeedbackSignal;
};

export type FeedbackProjectionRule = (
  input: FeedbackProjectionRuleInput
) =>
  | StateProjection
  | StateProjection[]
  | null
  | undefined
  | Promise<StateProjection | StateProjection[] | null | undefined>;
