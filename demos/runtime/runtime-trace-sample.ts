import {
  buildReferenceRuntime,
  InMemoryContextStateService,
  sessionFromContext,
} from "../../framework/index.ts";

async function main() {
  const contextState = new InMemoryContextStateService({
    sessions: [{ sessionId: "trace-session-1" }],
  });

  const { runtime } = buildReferenceRuntime({
    sessions: [
      sessionFromContext({
        context: {
          sessionId: "trace-session-1",
          userId: "user-trace-1",
          surface: "assistant",
          focusObjectIds: ["topic:agent-runtime"],
          recentEvents: [
            {
              id: "event:seed-1",
              type: "user_prompted",
              timestampMs: Date.now() - 5_000,
              objectRefs: ["topic:agent-runtime"],
            },
          ],
          constraints: [
            {
              id: "constraint:medium-budget",
              kind: "budget_level",
              value: "medium",
            },
          ],
          metadata: {
            topic: "agent-native recommendation runtime",
            userGoal: "draft a structured outline",
          },
        },
      }),
    ],
    retrievalData: {
      supply: {
        refs: [
          {
            id: "supply:outline",
            kind: "step",
            score: 0.91,
            metadata: {
              objectRefs: ["topic:agent-runtime"],
            },
          },
          {
            id: "supply:search",
            kind: "tool",
            score: 0.83,
            metadata: {
              objectRefs: ["topic:agent-runtime"],
            },
          },
        ],
      },
    },
    candidateTemplates: {
      continue_current_object: {
        opportunityKind: "workflow_step",
        actionType: "confirm",
        headlinePrefix: "Next",
        reasonPrefix: "High-signal next step for",
      },
    },
    policyLimit: 2,
    contextState,
  });

  const decision = await runtime.decideNext({
    sessionId: "trace-session-1",
    userId: "user-trace-1",
    surface: "assistant",
    limit: 2,
  });

  const selected = decision.opportunities[0];
  if (!selected) {
    throw new Error("No opportunity selected");
  }

  const execution = await runtime.executeSelection({
    opportunity: selected,
    context: decision.context,
  });

  console.log(
    JSON.stringify(
      {
        decision,
        decisionTrace: runtime.getLastDecisionTrace(),
        execution,
        executionTrace: runtime.getLastExecutionTrace(),
      },
      null,
      2
    )
  );
}

void main();
