export type Id = string;

export type Metadata = Record<string, unknown>;

export type IntentName =
  | "explore"
  | "compare"
  | "decide"
  | "continue_current_object"
  | "deepen_current_object"
  | "complete_task"
  | "clarify_goal"
  | "recover_flow";

export type OpportunityKind =
  | "item"
  | "content"
  | "continuation"
  | "workflow_step"
  | "tool_run"
  | "clarification"
  | "navigation";

export type ActionType =
  | "show"
  | "open"
  | "ask"
  | "confirm"
  | "execute"
  | "generate"
  | "navigate"
  | "purchase_and_run";

export type EventRef = {
  id: Id;
  type: string;
  timestampMs: number;
  objectRefs?: Id[];
  metadata?: Metadata;
};

export type ConstraintRef = {
  id: Id;
  kind: string;
  value?: unknown;
  metadata?: Metadata;
};

export type Estimate = {
  level?: "low" | "medium" | "high";
  score?: number;
  label?: string;
  metadata?: Metadata;
};

export type FeedbackSignal = {
  type: string;
  value?: number | string | boolean;
  metadata?: Metadata;
};

export type Context = {
  sessionId: Id;
  userId?: Id;
  surface: string;
  focusObjectIds: Id[];
  recentEvents?: EventRef[];
  constraints?: ConstraintRef[];
  metadata?: Metadata;
};

export type Intent = {
  name: IntentName;
  confidence: number;
  horizon?: "immediate" | "session" | "longer";
  evidence?: string[];
  metadata?: Metadata;
};

export type Opportunity = {
  id: Id;
  kind: OpportunityKind;
  headline: string;
  reason: string;
  sourceRefs: Id[];
  actionRef: Id;
  score?: number;
  cost?: Estimate;
  value?: Estimate;
  metadata?: Metadata;
};

export type Action = {
  id: Id;
  type: ActionType;
  input?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  metadata?: Metadata;
};

export type OutcomeStatus =
  | "shown"
  | "accepted"
  | "rejected"
  | "executed"
  | "failed";

export type Outcome = {
  actionId: Id;
  status: OutcomeStatus;
  feedbackSignals?: FeedbackSignal[];
  artifactRefs?: Id[];
  metadata?: Metadata;
};

export type ContextQuery = {
  sessionId?: Id;
  userId?: Id;
  surface?: string;
  metadata?: Metadata;
};

export type ResolveIntentInput = {
  context: Context;
  metadata?: Metadata;
};

export type OpportunityQuery = {
  context: Context;
  intent?: Intent;
  limit?: number;
  metadata?: Metadata;
};

export type GetActionInput = {
  actionRef: Id;
  context?: Context;
  metadata?: Metadata;
};

export type ActionArtifact = {
  id: Id;
  kind: string;
  metadata?: Metadata;
};

export type ActionExecutionResult = {
  outcome: Outcome;
  artifacts?: ActionArtifact[];
};

export type ExecuteActionInput = {
  action: Action;
  context?: Context;
  metadata?: Metadata;
};

export type RecordOutcomeInput = {
  outcome: Outcome;
  context?: Context;
  metadata?: Metadata;
};

export type Decision = {
  context: Context;
  intent: Intent;
  opportunities: Opportunity[];
};

export type DecideNextInput = {
  sessionId?: Id;
  userId?: Id;
  surface?: string;
  limit?: number;
  metadata?: Metadata;
};

export type ExecuteSelectionInput = {
  opportunity: Opportunity;
  context?: Context;
  metadata?: Metadata;
};

export type SelectionExecutionResult = {
  action: Action;
  outcome: Outcome;
  artifacts?: ActionArtifact[];
};

export interface RecommendationRuntime {
  getContext(input?: ContextQuery): Promise<Context>;
  resolveIntent(input: ResolveIntentInput): Promise<Intent>;
  listOpportunities(input: OpportunityQuery): Promise<Opportunity[]>;
  getAction(input: GetActionInput): Promise<Action>;
  executeAction(input: ExecuteActionInput): Promise<ActionExecutionResult>;
  recordOutcome(input: RecordOutcomeInput): Promise<void>;
}

export interface RecommendationSdk {
  decideNext(input?: DecideNextInput): Promise<Decision>;
  executeSelection(
    input: ExecuteSelectionInput
  ): Promise<SelectionExecutionResult>;
}
