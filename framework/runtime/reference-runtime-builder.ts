import type {
  Action,
  Context,
} from "../core/recommendation-runtime-protocol.ts";
import type { CandidateTemplateMap } from "../core/recommendation-runtime-candidate.ts";
import type { ScenarioOverlay } from "../core/recommendation-runtime-overlay.ts";
import {
  buildDefaultRuntimeServices,
  type InMemoryRetrievalData,
  type DefaultRuntimeServices,
  BasicCandidateConstructionService,
  InMemoryRetrievalService,
  SimplePolicyService,
} from "./default-services.ts";
import {
  InMemoryRecommendationRuntime,
  type InMemoryRuntimeConfig,
  type SessionSnapshot,
} from "./in-memory-recommendation-runtime.ts";

type ContextStateLike = NonNullable<InMemoryRuntimeConfig["contextState"]>;

export type ReferenceRuntimeBuilderConfig = {
  sessions?: SessionSnapshot[];
  actions?: Action[];
  retrievalData?: InMemoryRetrievalData;
  candidateTemplates?: CandidateTemplateMap;
  policyLimit?: number;
  overlay?: ScenarioOverlay;
  contextState?: ContextStateLike;
  services?: Partial<DefaultRuntimeServices>;
};

export type ReferenceRuntimeHandle = {
  runtime: InMemoryRecommendationRuntime;
  config: ReferenceRuntimeBuilderConfig;
};

function mergeCandidateTemplates(
  config: ReferenceRuntimeBuilderConfig
): CandidateTemplateMap {
  return {
    ...(config.overlay?.candidateTemplates ?? {}),
    ...(config.candidateTemplates ?? {}),
  };
}

export function buildReferenceRuntime(
  config: ReferenceRuntimeBuilderConfig = {}
): ReferenceRuntimeHandle {
  const retrieval =
    config.services?.retrieval ??
    new InMemoryRetrievalService(config.retrievalData ?? {});
  const candidateConstruction =
    config.services?.candidateConstruction ??
    new BasicCandidateConstructionService(mergeCandidateTemplates(config));
  const policy =
    config.services?.policy ?? new SimplePolicyService(config.policyLimit ?? 3);

  const runtime = new InMemoryRecommendationRuntime({
    sessions: config.sessions,
    actions: config.actions,
    services: {
      retrieval,
      candidateConstruction,
      policy,
    },
    contextState: config.contextState,
  });

  return {
    runtime,
    config,
  };
}

export function sessionFromContext(input: {
  context: Context;
  metadata?: Context["metadata"];
}): SessionSnapshot {
  return {
    sessionId: input.context.sessionId,
    userId: input.context.userId,
    surface: input.context.surface,
    focusObjectIds: input.context.focusObjectIds,
    recentEvents: input.context.recentEvents,
    constraints: input.context.constraints,
    metadata: {
      ...input.context.metadata,
      ...input.metadata,
    },
  };
}
