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

