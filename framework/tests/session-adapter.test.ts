import test from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryContextStateService,
  RecommendationSessionAdapter,
  buildReferenceRuntime,
  createScenarioOverlay,
  sessionFromContext,
} from "../index.ts";

test("session adapter feedback updates state and affects next decision", async () => {
  const contextState = new InMemoryContextStateService({
    sessions: [{ sessionId: "session-1" }],
  });

  const overlay = createScenarioOverlay({
    name: "feed",
    candidateTemplates: {
      explore: {
        headlinePrefix: "For You",
        reasonPrefix: "Behavior suggests",
      },
      recover_flow: {
        headlinePrefix: "Recover",
        reasonPrefix: "Lower-friction recovery for",
      },
    },
  });

  const { runtime } = buildReferenceRuntime({
    overlay,
    contextState,
    sessions: [
      sessionFromContext({
        context: {
          sessionId: "session-1",
          userId: "user-1",
          surface: "feed",
          focusObjectIds: [],
          recentEvents: [],
          metadata: {},
        },
      }),
    ],
    retrievalData: {
      supply: {
        refs: [
          {
            id: "item:citywalk",
            kind: "post",
            score: 0.9,
            metadata: {
              feedbackKey: "citywalk",
            },
          },
        ],
      },
    },
  });

  const adapter = new RecommendationSessionAdapter({
    runtime,
    overlay,
    sessionId: "session-1",
    userId: "user-1",
    surface: "feed",
    contextState,
  });

  const initial = await adapter.next({ limit: 1 });
  assert.equal(initial.intent.name, "explore");

  const opportunity = initial.opportunities[0];
  assert.ok(opportunity);

  const result = await adapter.feedback({
    action: "dismiss",
    opportunity,
  });

  assert.equal(result.feedbackTrace?.signals[0]?.kind, "negative_interest");
  assert.equal(result.feedbackTrace?.projections[0]?.path, "rejectedPatterns");
  assert.equal(result.decision.intent.name, "recover_flow");
});
