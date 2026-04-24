import type {
  Action,
  ActionExecutionResult,
  Context,
  ContextQuery,
  DecideNextInput,
  Decision,
  ExecuteActionInput,
  ExecuteSelectionInput,
  GetActionInput,
  Intent,
  RecordOutcomeInput,
  RecommendationRuntime,
  RecommendationSdk,
  ResolveIntentInput,
  SelectionExecutionResult,
} from "../recommendation-runtime-protocol.ts";
import type { CandidateConstructionService } from "../recommendation-runtime-candidate.ts";
import type {
  ContextEvent,
  PromotionDecision,
  SessionSummary,
  StateWrite,
  WorkingContext,
} from "../recommendation-runtime-context.ts";
import type {
  PolicyService,
  RetrievalQuery,
  RetrievalService,
} from "../recommendation-runtime-services.ts";
import { buildDefaultRuntimeServices } from "./default-services.ts";

export type SessionSnapshot = {
  sessionId: string;
  userId?: string;
  surface?: string;
  focusObjectIds?: string[];
  recentEvents?: Context["recentEvents"];
  constraints?: Context["constraints"];
  metadata?: Context["metadata"];
};

export type InMemoryRuntimeConfig = {
  sessions?: SessionSnapshot[];
  actions?: Action[];
  services?: {
    retrieval: RetrievalService;
    candidateConstruction: CandidateConstructionService;
    policy: PolicyService;
  };
  contextState?: ContextStateServiceLike;
};

export type RuntimeDecisionTrace = {
  writes: StateWrite[];
  sessionSummary?: SessionSummary;
  workingContext?: WorkingContext;
  promotionDecisions?: PromotionDecision[];
};

export type RuntimeExecutionTrace = RuntimeDecisionTrace & {
  appendedEvent?: ContextEvent;
};

type ContextStateServiceLike = {
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
};

export class InMemoryRecommendationRuntime
  implements RecommendationRuntime, RecommendationSdk
{
  private readonly sessionStore = new Map<string, SessionSnapshot>();
  private readonly actionStore = new Map<string, Action>();
  private readonly retrieval: RetrievalService;
  private readonly candidateConstruction: CandidateConstructionService;
  private readonly policy: PolicyService;
  private readonly contextState?: ContextStateServiceLike;
  private lastDecisionTrace?: RuntimeDecisionTrace;
  private lastExecutionTrace?: RuntimeExecutionTrace;

  constructor(config: InMemoryRuntimeConfig = {}) {
    for (const session of config.sessions ?? []) {
      this.sessionStore.set(session.sessionId, session);
    }

    for (const action of config.actions ?? []) {
      this.actionStore.set(action.id, action);
    }

    const defaults = buildDefaultRuntimeServices();
    this.retrieval = config.services?.retrieval ?? defaults.retrieval;
    this.candidateConstruction =
      config.services?.candidateConstruction ?? defaults.candidateConstruction;
    this.policy = config.services?.policy ?? defaults.policy;
    this.contextState = config.contextState;
  }

  async getContext(input: ContextQuery = {}): Promise<Context> {
    const sessionId = input.sessionId ?? "default_session";
    const session = this.sessionStore.get(sessionId);

    return {
      sessionId,
      userId: input.userId ?? session?.userId,
      surface: input.surface ?? session?.surface ?? "default",
      focusObjectIds: session?.focusObjectIds ?? [],
      recentEvents: session?.recentEvents ?? [],
      constraints: session?.constraints ?? [],
      metadata: {
        ...session?.metadata,
        ...input.metadata,
      },
    };
  }

  async resolveIntent(input: ResolveIntentInput): Promise<Intent> {
    const explicitIntent = input.metadata?.intent;
    if (typeof explicitIntent === "string") {
      return {
        name: explicitIntent as Intent["name"],
        confidence: 1,
        horizon: "immediate",
        evidence: ["explicit_input"],
        metadata: input.metadata,
      };
    }

    const focusCount = input.context.focusObjectIds.length;
    const surface = input.context.surface;

    if (focusCount > 0) {
      return {
        name: "continue_current_object",
        confidence: 0.8,
        horizon: "session",
        evidence: ["has_focus_objects"],
        metadata: { surface },
      };
    }

    return {
      name: "explore",
      confidence: 0.6,
      horizon: "immediate",
      evidence: ["default_fallback"],
      metadata: { surface },
    };
  }

  async listOpportunities(input: {
    context: Context;
    intent?: Intent;
    limit?: number;
    metadata?: Record<string, unknown>;
  }) {
    const intent =
      input.intent ?? (await this.resolveIntent({ context: input.context }));

    const materialQuery: RetrievalQuery = {
      target: "supply",
      context: input.context,
      intent,
      objectRefs: input.context.focusObjectIds,
      limit: input.limit,
      metadata: input.metadata,
    };

    const [state, memory, supply, constraints] = await Promise.all([
      this.retrieval.retrieveState({ ...materialQuery, target: "state" }),
      this.retrieval.retrieveMemory({ ...materialQuery, target: "memory" }),
      this.retrieval.retrieveSupply({ ...materialQuery, target: "supply" }),
      this.retrieval.retrieveConstraints({
        ...materialQuery,
        target: "constraint",
      }),
    ]);

    const opportunities = await this.candidateConstruction.construct({
      context: input.context,
      intent,
      materials: { state, memory, supply, constraints },
      limit: input.limit,
      metadata: input.metadata,
    });

    for (const opportunity of opportunities) {
      const actionType =
        (opportunity.metadata?.actionType as Action["type"] | undefined) ??
        "open";
      this.actionStore.set(opportunity.actionRef, {
        id: opportunity.actionRef,
        type: actionType,
        input: {
          opportunityId: opportunity.id,
          sourceRefs: opportunity.sourceRefs,
        },
        requiresConfirmation:
          actionType === "generate" || actionType === "purchase_and_run",
        metadata: {
          opportunityKind: opportunity.kind,
        },
      });
    }

    const decision = await this.policy.decide({
      context: input.context,
      intent,
      opportunities,
      constraints: input.context.constraints,
      metadata: input.metadata,
    });

    return decision.selected;
  }

  async getAction(input: GetActionInput): Promise<Action> {
    const action = this.actionStore.get(input.actionRef);
    if (!action) {
      throw new Error(`Unknown actionRef: ${input.actionRef}`);
    }
    return action;
  }

  async executeAction(
    input: ExecuteActionInput
  ): Promise<ActionExecutionResult> {
    const executed =
      input.action.type === "execute" ||
      input.action.type === "generate" ||
      input.action.type === "purchase_and_run";

    return {
      outcome: {
        actionId: input.action.id,
        status: executed ? "executed" : "accepted",
        feedbackSignals: [
          {
            type: executed ? "execution_success" : "selection_success",
            value: true,
          },
        ],
        artifactRefs: executed ? [`artifact_${input.action.id}`] : [],
        metadata: input.metadata,
      },
      artifacts: executed
        ? [
            {
              id: `artifact_${input.action.id}`,
              kind: "generated_artifact",
              metadata: input.metadata,
            },
          ]
        : [],
    };
  }

  async recordOutcome(input: RecordOutcomeInput): Promise<void> {
    const sessionId = input.context?.sessionId;
    if (!sessionId) return;

    const previous = this.sessionStore.get(sessionId) ?? { sessionId };
    const existingEvents = previous.recentEvents ?? [];

    this.sessionStore.set(sessionId, {
      ...previous,
      recentEvents: [
        ...existingEvents,
        {
          id: `event_${input.outcome.actionId}_${existingEvents.length}`,
          type: `outcome_${input.outcome.status}`,
          timestampMs: Date.now(),
          objectRefs: input.outcome.artifactRefs,
          metadata: input.outcome.metadata,
        },
      ],
    });

    if (this.contextState) {
      const event: ContextEvent = {
        id: `event_${input.outcome.actionId}_${existingEvents.length}`,
        type: `outcome_${input.outcome.status}`,
        timestampMs: Date.now(),
        actor: "system",
        objectRefs: input.outcome.artifactRefs,
        metadata: input.outcome.metadata,
      };

      await this.contextState.appendEvent({
        sessionId,
        event,
      });

      this.lastExecutionTrace = {
        ...(this.lastExecutionTrace ?? { writes: [] }),
        appendedEvent: event,
      };
    }
  }

  async decideNext(input: DecideNextInput = {}): Promise<Decision> {
    const context = await this.getContext(input);
    const intent = await this.resolveIntent({
      context,
      metadata: input.metadata,
    });
    const opportunities = await this.listOpportunities({
      context,
      intent,
      limit: input.limit,
      metadata: input.metadata,
    });

    const decision: Decision = {
      context,
      intent,
      opportunities,
    };

    if (this.contextState) {
      const writes = this.buildDecisionStateWrites({
        context,
        intent,
      });

      await this.contextState.applyStateWrites({
        sessionId: context.sessionId,
        writes,
      });

      const sessionSummary = await this.contextState.compressSession({
        sessionId: context.sessionId,
        trigger: "runtime_decide_next",
      });
      const workingContext = await this.contextState.buildWorkingContext({
        sessionId: context.sessionId,
      });

      this.lastDecisionTrace = {
        writes,
        sessionSummary,
        workingContext,
      };
    }

    return decision;
  }

  async executeSelection(
    input: ExecuteSelectionInput
  ): Promise<SelectionExecutionResult> {
    const context = input.context ?? (await this.getContext());
    const action = await this.getAction({
      actionRef: input.opportunity.actionRef,
      context,
      metadata: input.metadata,
    });
    const execution = await this.executeAction({
      action,
      context,
      metadata: input.metadata,
    });

    await this.recordOutcome({
      outcome: execution.outcome,
      context,
      metadata: input.metadata,
    });

    if (this.contextState) {
      const writes = this.buildExecutionStateWrites({
        opportunity: input.opportunity,
        outcomeStatus: execution.outcome.status,
        artifactRefs: execution.outcome.artifactRefs ?? [],
      });

      await this.contextState.applyStateWrites({
        sessionId: context.sessionId,
        writes,
      });

      const sessionSummary = await this.contextState.compressSession({
        sessionId: context.sessionId,
        trigger: "runtime_execute_selection",
      });
      const workingContext = await this.contextState.buildWorkingContext({
        sessionId: context.sessionId,
      });
      const promotionDecisions = await this.contextState.promoteMemory({
        sessionId: context.sessionId,
      });

      this.lastExecutionTrace = {
        writes,
        sessionSummary,
        workingContext,
        promotionDecisions,
        appendedEvent: this.lastExecutionTrace?.appendedEvent,
      };
    }

    return {
      action,
      outcome: execution.outcome,
      artifacts: execution.artifacts,
    };
  }

  getLastDecisionTrace(): RuntimeDecisionTrace | undefined {
    return this.lastDecisionTrace;
  }

  getLastExecutionTrace(): RuntimeExecutionTrace | undefined {
    return this.lastExecutionTrace;
  }

  private buildDecisionStateWrites(input: {
    context: Context;
    intent: Intent;
  }): StateWrite[] {
    const writes: StateWrite[] = [
      {
        target: "session",
        operation: "set",
        path: "goal.current",
        value:
          (input.context.metadata?.userGoal as string | undefined) ??
          (input.context.metadata?.goal as string | undefined),
        reason: "runtime_seed_goal",
      },
      {
        target: "session",
        operation: "set",
        path: "focusRefs",
        value: input.context.focusObjectIds,
        reason: "runtime_seed_focus_refs",
      },
      {
        target: "working",
        operation: "set",
        path: "intent",
        value: input.intent,
        reason: "runtime_resolved_intent",
      },
      {
        target: "working",
        operation: "set",
        path: "constraints",
        value: (input.context.constraints ?? []).map((constraint) => constraint.id),
        reason: "runtime_context_constraints",
      },
    ];

    if (input.intent.name === "recover_flow") {
      writes.push({
        target: "session",
        operation: "append",
        path: "rejectedPatterns",
        value: "recover_flow",
        reason: "runtime_recover_flow",
      });
    }

    return writes;
  }

  private buildExecutionStateWrites(input: {
    opportunity: ExecuteSelectionInput["opportunity"];
    outcomeStatus: SelectionExecutionResult["outcome"]["status"];
    artifactRefs: string[];
  }): StateWrite[] {
    const writes: StateWrite[] = [
      {
        target: "session",
        operation: "append",
        path: "acceptedPatterns",
        value:
          (input.opportunity.metadata?.mode as string | undefined) ??
          input.opportunity.kind,
        reason: "runtime_selected_opportunity",
      },
    ];

    if (input.outcomeStatus === "executed" && input.artifactRefs.length > 0) {
      for (const artifactRef of input.artifactRefs) {
        writes.push({
          target: "session",
          operation: "append",
          path: "recentArtifacts",
          value: artifactRef,
          reason: "runtime_execution_artifact",
        });
      }
    }

    return writes;
  }
}
