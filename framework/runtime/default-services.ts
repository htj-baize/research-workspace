import type {
  CandidateConstructionService,
  CandidateTemplate,
  CandidateTemplateMap,
  ConstructCandidatesInput,
} from "../core/recommendation-runtime-candidate.ts";
import type {
  DecisionInput,
  PolicyService,
  RetrievalQuery,
  RetrievalResult,
  RetrievalService,
  RetrievedRef,
} from "../core/recommendation-runtime-services.ts";
import type {
  ActionType,
  Context,
  Intent,
  Metadata,
  Opportunity,
  OpportunityKind,
} from "../core/recommendation-runtime-protocol.ts";

type RetrievalBucket = {
  refs: RetrievedRef[];
  metadata?: Metadata;
};

export type InMemoryRetrievalData = {
  state?: RetrievalBucket;
  memory?: RetrievalBucket;
  supply?: RetrievalBucket;
  constraint?: RetrievalBucket;
};

function truncate<T>(items: T[], limit?: number): T[] {
  if (!limit || limit <= 0) return items;
  return items.slice(0, limit);
}

export class InMemoryRetrievalService implements RetrievalService {
  private readonly data: InMemoryRetrievalData;

  constructor(data: InMemoryRetrievalData = {}) {
    this.data = data;
  }

  retrieveState(input: RetrievalQuery): Promise<RetrievalResult> {
    return Promise.resolve(this.buildResult("state", input, this.data.state));
  }

  retrieveMemory(input: RetrievalQuery): Promise<RetrievalResult> {
    return Promise.resolve(this.buildResult("memory", input, this.data.memory));
  }

  retrieveSupply(input: RetrievalQuery): Promise<RetrievalResult> {
    return Promise.resolve(this.buildResult("supply", input, this.data.supply));
  }

  retrieveConstraints(input: RetrievalQuery): Promise<RetrievalResult> {
    return Promise.resolve(
      this.buildResult("constraint", input, this.data.constraint)
    );
  }

  private buildResult(
    target: RetrievalResult["target"],
    input: RetrievalQuery,
    bucket?: RetrievalBucket
  ): RetrievalResult {
    const refs = truncate(bucket?.refs ?? [], input.limit).filter((ref) => {
      if (
        input.intent?.name === "recover_flow" ||
        input.intent?.name === "clarify_goal"
      ) {
        return true;
      }
      if (!input.objectRefs?.length) return true;
      const objectRefs = (ref.metadata?.objectRefs as string[] | undefined) ?? [];
      return objectRefs.some((objectRef) => input.objectRefs?.includes(objectRef));
    });

    return {
      target,
      refs,
      metadata: bucket?.metadata,
    };
  }
}

export class BasicCandidateConstructionService
  implements CandidateConstructionService
{
  private readonly templateByIntent: CandidateTemplateMap;

  constructor(templateByIntent: CandidateTemplateMap = {}) {
    this.templateByIntent = templateByIntent;
  }

  async construct(input: ConstructCandidatesInput): Promise<Opportunity[]> {
    const template = this.templateByIntent[input.intent.name] ?? {};
    const supplyRefs = input.materials.supply?.refs ?? [];
    const opportunities = truncate(
      supplyRefs.map((ref, index) =>
        this.toOpportunity(input.context, input.intent, ref, index, template)
      ),
      input.limit
    );
    return opportunities;
  }

  private toOpportunity(
    context: Context,
    intent: Intent,
    ref: RetrievedRef,
    index: number,
    template: CandidateTemplate
  ): Opportunity {
    const kind = template.opportunityKind ?? this.defaultKind(intent);
    const actionType = template.actionType ?? this.defaultActionType(kind);
    const headlinePrefix = template.headlinePrefix ?? "Next";
    const reasonPrefix = template.reasonPrefix ?? "Relevant for";

    return {
      id: `opp_${context.sessionId}_${index}_${ref.id}`,
      kind,
      headline:
        (ref.metadata?.headline as string | undefined) ??
        `${headlinePrefix}: ${ref.kind} ${ref.id}`,
      reason: `${
        (ref.metadata?.reasonPrefix as string | undefined) ?? reasonPrefix
      } ${intent.name}`,
      sourceRefs: [ref.id, ...context.focusObjectIds].slice(0, 3),
      actionRef: `action_${actionType}_${ref.id}`,
      score: ref.score,
      cost: {
        level: (ref.metadata?.costLevel as "low" | "medium" | "high" | undefined) ?? "medium",
        label: (ref.metadata?.costLevel as string | undefined) ?? "medium",
      },
      value: {
        level: (ref.metadata?.valueLevel as "low" | "medium" | "high" | undefined) ?? "medium",
        label:
          (ref.metadata?.valueLevel as string | undefined) ??
          (ref.metadata?.mode as string | undefined) ??
          "medium",
      },
      metadata: {
        sourceKind: ref.kind,
        sourceRefId: ref.id,
        actionType,
        mode: ref.metadata?.mode,
        feedbackKey: ref.metadata?.feedbackKey,
        creator: ref.metadata?.creator,
        hook: ref.metadata?.hook,
        tags: ref.metadata?.tags,
      },
    };
  }

  private defaultKind(intent: Intent): OpportunityKind {
    switch (intent.name) {
      case "clarify_goal":
        return "clarification";
      case "continue_current_object":
      case "deepen_current_object":
        return "continuation";
      case "complete_task":
        return "workflow_step";
      case "recover_flow":
        return "navigation";
      default:
        return "content";
    }
  }

  private defaultActionType(kind: OpportunityKind): ActionType {
    switch (kind) {
      case "clarification":
        return "ask";
      case "workflow_step":
        return "execute";
      case "continuation":
        return "generate";
      case "navigation":
        return "navigate";
      default:
        return "open";
    }
  }
}

export class SimplePolicyService implements PolicyService {
  private readonly defaultLimit: number;

  constructor(defaultLimit = 3) {
    this.defaultLimit = defaultLimit;
  }

  async decide(input: DecisionInput): Promise<DecisionResult> {
    const seen = new Set<string>();
    const selected: Opportunity[] = [];
    const suppressed: DecisionResult["suppressed"] = [];
    const rejectedPatterns =
      (input.context.metadata?.rejectedPatterns as string[] | undefined) ?? [];
    const acceptedPatterns =
      (input.context.metadata?.acceptedPatterns as string[] | undefined) ?? [];
    const sorted = [...input.opportunities].sort(
      (a, b) =>
        this.scoreOpportunity(b, input.intent.name, rejectedPatterns, acceptedPatterns) -
        this.scoreOpportunity(a, input.intent.name, rejectedPatterns, acceptedPatterns)
    );

    for (const opportunity of sorted) {
      if (seen.has(opportunity.actionRef)) {
        suppressed?.push({
          opportunityId: opportunity.id,
          reason: "duplicate_action",
        });
        continue;
      }

      if (selected.length >= this.defaultLimit) {
        suppressed?.push({
          opportunityId: opportunity.id,
          reason: "limit_reached",
        });
        continue;
      }

      selected.push(opportunity);
      seen.add(opportunity.actionRef);
    }

    return {
      selected,
      suppressed,
      metadata: input.metadata,
    };
  }

  private scoreOpportunity(
    opportunity: Opportunity,
    intentName: Intent["name"],
    rejectedPatterns: string[],
    acceptedPatterns: string[]
  ): number {
    let score = opportunity.score ?? 0;
    const mode = (opportunity.metadata?.mode as string | undefined) ?? opportunity.kind;
    const feedbackKey =
      (opportunity.metadata?.feedbackKey as string | undefined) ?? mode;

    if (intentName === "recover_flow" && opportunity.cost?.level === "high") {
      score -= 0.35;
    }

    if (
      rejectedPatterns.includes(feedbackKey) ||
      rejectedPatterns.includes(mode) ||
      rejectedPatterns.includes(opportunity.kind)
    ) {
      score -= 0.2;
    }

    if (
      acceptedPatterns.includes(feedbackKey) ||
      acceptedPatterns.includes(mode) ||
      acceptedPatterns.includes(opportunity.kind)
    ) {
      score += 0.12;
    }

    return score;
  }
}

export type DefaultRuntimeServices = {
  retrieval: RetrievalService;
  candidateConstruction: CandidateConstructionService;
  policy: PolicyService;
};

export function buildDefaultRuntimeServices(
  data: InMemoryRetrievalData = {}
): DefaultRuntimeServices {
  return {
    retrieval: new InMemoryRetrievalService(data),
    candidateConstruction: new BasicCandidateConstructionService(),
    policy: new SimplePolicyService(),
  };
}
