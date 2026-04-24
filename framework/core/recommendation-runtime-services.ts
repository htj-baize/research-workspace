import type {
  ConstraintRef,
  Context,
  Id,
  Intent,
  Metadata,
  Opportunity,
} from "./recommendation-runtime-protocol.ts";

export type RetrievalTarget =
  | "state"
  | "memory"
  | "supply"
  | "constraint";

export type RetrievalScope = "local" | "cloud" | "hybrid";

export type RetrievalQuery = {
  target: RetrievalTarget;
  context: Context;
  intent?: Intent;
  query?: string;
  objectRefs?: Id[];
  limit?: number;
  scope?: RetrievalScope;
  metadata?: Metadata;
};

export type RetrievedRef = {
  id: Id;
  kind: string;
  score?: number;
  metadata?: Metadata;
};

export type RetrievalResult = {
  target: RetrievalTarget;
  refs: RetrievedRef[];
  metadata?: Metadata;
};

export type RetrievalPlanStep = {
  id: Id;
  query: RetrievalQuery;
  rationale?: string;
};

export type RetrievalPlan = {
  steps: RetrievalPlanStep[];
  metadata?: Metadata;
};

export interface RetrievalService {
  retrieveState(input: RetrievalQuery): Promise<RetrievalResult>;
  retrieveMemory(input: RetrievalQuery): Promise<RetrievalResult>;
  retrieveSupply(input: RetrievalQuery): Promise<RetrievalResult>;
  retrieveConstraints(input: RetrievalQuery): Promise<RetrievalResult>;
}

export interface RetrievalPlanner {
  plan(input: {
    context: Context;
    intent: Intent;
    limit?: number;
    metadata?: Metadata;
  }): Promise<RetrievalPlan>;
}

export type ScoreBreakdown = {
  relevance?: number;
  urgency?: number;
  value?: number;
  costPenalty?: number;
  riskPenalty?: number;
  repetitionPenalty?: number;
  diversityAdjustment?: number;
  finalScore: number;
  metadata?: Metadata;
};

export type DecisionInput = {
  context: Context;
  intent: Intent;
  opportunities: Opportunity[];
  constraints?: ConstraintRef[];
  metadata?: Metadata;
};

export type OpportunityScore = {
  opportunityId: Id;
  breakdown: ScoreBreakdown;
};

export type SuppressedOpportunity = {
  opportunityId: Id;
  reason: string;
};

export type DecisionResult = {
  selected: Opportunity[];
  suppressed?: SuppressedOpportunity[];
  scores?: OpportunityScore[];
  metadata?: Metadata;
};

export interface PolicyService {
  decide(input: DecisionInput): Promise<DecisionResult>;
}

export interface PolicyScorer {
  score(input: {
    context: Context;
    intent: Intent;
    opportunity: Opportunity;
    constraints?: ConstraintRef[];
    metadata?: Metadata;
  }): Promise<ScoreBreakdown>;
}
