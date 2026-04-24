import type {
  Context,
  Decision,
  ExecuteSelectionInput,
  Metadata,
  Opportunity,
  RecommendationRuntime,
  SelectionExecutionResult,
} from "../core/recommendation-runtime-protocol.ts";
import type { ScenarioOverlay } from "../core/recommendation-runtime-overlay.ts";
import type {
  SessionSummary,
  WorkingContext,
} from "../core/recommendation-runtime-context.ts";
import type { FeedbackHandlingResult } from "../core/recommendation-runtime-protocol.ts";

type ContextStateSnapshot = {
  events?: Context["recentEvents"];
  sessionState?: Record<string, unknown>;
  summary?: SessionSummary | null;
};

type ContextStateLike = {
  getSessionSnapshot?(sessionId: string): ContextStateSnapshot | undefined;
};

type TraceCapableRuntime = RecommendationRuntime & {
  decideNext?(input?: {
    sessionId?: string;
    userId?: string;
    surface?: string;
    limit?: number;
    metadata?: Metadata;
  }): Promise<Decision>;
  executeSelection?(
    input: ExecuteSelectionInput
  ): Promise<SelectionExecutionResult>;
  getLastDecisionTrace?(): { workingContext?: WorkingContext } | undefined;
};

export type RecommendationSessionAdapterConfig = {
  runtime: TraceCapableRuntime;
  overlay: ScenarioOverlay;
  sessionId: string;
  userId?: string;
  surface: string;
  contextState?: ContextStateLike;
};

export type AdapterFeedbackInput = {
  action: Parameters<ScenarioOverlay["buildFeedbackEvent"]>[0]["action"];
  opportunity: Opportunity;
  answer?: string;
  metadata?: Metadata;
};

export type AdapterFeedbackResult = {
  feedbackTrace?: FeedbackHandlingResult;
  decision: Decision;
};

export type AdapterSnapshot = {
  context: Context;
  sessionState?: Record<string, unknown>;
  summary?: SessionSummary | null;
  explanations: string[];
};

export class RecommendationSessionAdapter {
  private readonly runtime: TraceCapableRuntime;
  private readonly overlay: ScenarioOverlay;
  private readonly sessionId: string;
  private readonly userId?: string;
  private readonly surface: string;
  private readonly contextState?: ContextStateLike;

  constructor(config: RecommendationSessionAdapterConfig) {
    this.runtime = config.runtime;
    this.overlay = config.overlay;
    this.sessionId = config.sessionId;
    this.userId = config.userId;
    this.surface = config.surface;
    this.contextState = config.contextState;
  }

  async next(input: { limit?: number; metadata?: Metadata } = {}): Promise<Decision> {
    if (!this.runtime.decideNext) {
      throw new Error("Runtime does not implement decideNext()");
    }

    return this.runtime.decideNext({
      sessionId: this.sessionId,
      userId: this.userId,
      surface: this.surface,
      limit: input.limit,
      metadata: input.metadata,
    });
  }

  async feedback(input: AdapterFeedbackInput): Promise<AdapterFeedbackResult> {
    const context = await this.runtime.getContext({
      sessionId: this.sessionId,
      userId: this.userId,
      surface: this.surface,
    });

    const event = this.overlay.buildFeedbackEvent({
      action: input.action,
      opportunity: input.opportunity,
      context,
      answer: input.answer,
      metadata: input.metadata,
    });

    const feedbackTrace = this.runtime.handleFeedback
      ? await this.runtime.handleFeedback({
          event,
          context,
          metadata: input.metadata,
        })
      : undefined;

    const decision = await this.next();

    return {
      feedbackTrace,
      decision,
    };
  }

  async execute(
    input: Omit<ExecuteSelectionInput, "context"> & { metadata?: Metadata }
  ): Promise<{
    execution: SelectionExecutionResult;
    decision: Decision;
  }> {
    if (!this.runtime.executeSelection) {
      throw new Error("Runtime does not implement executeSelection()");
    }

    const context = await this.runtime.getContext({
      sessionId: this.sessionId,
      userId: this.userId,
      surface: this.surface,
    });

    const execution = await this.runtime.executeSelection({
      opportunity: input.opportunity,
      context,
      metadata: input.metadata,
    });

    const decision = await this.next();

    return {
      execution,
      decision,
    };
  }

  async snapshot(decision?: Decision): Promise<AdapterSnapshot> {
    const currentDecision = decision ?? (await this.next());
    const context = await this.runtime.getContext({
      sessionId: this.sessionId,
      userId: this.userId,
      surface: this.surface,
    });
    const snapshot =
      this.contextState?.getSessionSnapshot?.(this.sessionId) ?? undefined;
    const decisionTrace = this.runtime.getLastDecisionTrace?.();
    const explanations =
      (await this.overlay.buildExplanations?.({
        decision: currentDecision,
        sessionSummary: snapshot?.summary ?? undefined,
        sessionState: snapshot?.sessionState ?? undefined,
        workingContext: decisionTrace?.workingContext,
        lastEvent: snapshot?.events?.[snapshot.events.length - 1],
        metadata: {
          surface: this.surface,
        },
      })) ?? [];

    return {
      context,
      sessionState: snapshot?.sessionState,
      summary: snapshot?.summary,
      explanations,
    };
  }
}
