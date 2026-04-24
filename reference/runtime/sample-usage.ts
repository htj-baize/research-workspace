import { InMemoryRecommendationRuntime } from "./in-memory-recommendation-runtime";
import { InMemoryRetrievalService, SimplePolicyService } from "./default-services";
import { BasicCandidateConstructionService } from "./default-services";

async function main() {
  const runtime = new InMemoryRecommendationRuntime({
    sessions: [
      {
        sessionId: "session_studio_1",
        userId: "user_1",
        surface: "studio",
        focusObjectIds: ["atom_baijin", "work_rain_reunion"],
        recentEvents: [
          {
            id: "event_1",
            type: "work_created",
            timestampMs: Date.now() - 10_000,
            objectRefs: ["work_rain_reunion"],
          },
        ],
        constraints: [
          {
            id: "constraint_budget",
            kind: "budget_level",
            value: "medium",
          },
        ],
        metadata: {
          worldId: "world_1",
        },
      },
    ],
    services: {
      retrieval: new InMemoryRetrievalService({
        supply: {
          refs: [
            {
              id: "supply_1",
              kind: "character_scene",
              score: 0.92,
              metadata: {
                objectRefs: ["atom_baijin"],
              },
            },
            {
              id: "supply_2",
              kind: "relationship_turn",
              score: 0.87,
              metadata: {
                objectRefs: ["atom_baijin", "work_rain_reunion"],
              },
            },
            {
              id: "supply_3",
              kind: "dangerous_aftermath",
              score: 0.8,
              metadata: {
                objectRefs: ["work_rain_reunion"],
              },
            },
          ],
        },
      }),
      candidateConstruction: new BasicCandidateConstructionService({
        continue_current_object: {
          opportunityKind: "continuation",
          actionType: "generate",
          headlinePrefix: "Continue",
          reasonPrefix: "Fits current object",
        },
      }),
      policy: new SimplePolicyService(3),
    },
  });

  const decision = await runtime.decideNext({
    sessionId: "session_studio_1",
    userId: "user_1",
    surface: "studio",
    limit: 3,
  });

  console.log("Decision:");
  console.log(JSON.stringify(decision, null, 2));

  const selected = decision.opportunities[0];
  if (!selected) {
    throw new Error("No opportunity returned");
  }

  const execution = await runtime.executeSelection({
    opportunity: selected,
    context: decision.context,
  });

  console.log("\nExecution:");
  console.log(JSON.stringify(execution, null, 2));
}

void main();
