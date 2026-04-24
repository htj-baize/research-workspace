export type ContextEvent = {
  id: string;
  type: string;
  timestampMs: number;
  actor: "user" | "agent" | "system" | "tool";
  objectRefs?: string[];
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type StateWrite = {
  target: "session" | "working" | "durable";
  operation: "set" | "append" | "merge" | "remove";
  path: string;
  value?: unknown;
  reason: string;
  sourceEventIds?: string[];
  confidence?: number;
};

export type SessionSummary = {
  sessionId: string;
  currentGoal?: string;
  currentFocusRefs: string[];
  acceptedPatterns?: string[];
  rejectedPatterns?: string[];
  openQuestions?: string[];
  recentArtifacts?: string[];
  inferredIntent?: string;
  lastUpdatedAt: number;
  metadata?: Record<string, unknown>;
};

export type PromotionDecision = {
  sourcePath: string;
  targetPath: string;
  value: unknown;
  confidence: number;
  reason: string;
  approved: boolean;
};

export type WorkingContext = {
  sessionId: string;
  activeGoal?: string;
  focusRefs: string[];
  recentSignals: string[];
  openQuestions?: string[];
  inferredIntent?: string;
  constraints?: string[];
  recentArtifactRefs?: string[];
  metadata?: Record<string, unknown>;
};

export interface ContextStateService {
  appendEvent(input: { sessionId: string; event: ContextEvent }): Promise<void>;
  applyStateWrites(input: {
    sessionId: string;
    writes: StateWrite[];
  }): Promise<void>;
  compressSession(input: {
    sessionId: string;
    trigger: string;
  }): Promise<SessionSummary>;
  promoteMemory(input: {
    sessionId: string;
  }): Promise<PromotionDecision[]>;
  buildWorkingContext(input: {
    sessionId: string;
  }): Promise<WorkingContext>;
}
