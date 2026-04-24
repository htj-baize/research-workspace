import test from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryContextStateService,
  buildReferenceRuntime,
  sessionFromContext,
} from "../index.ts";

test("runtime decision trace includes retrieval plan and scores", async () => {
  const contextState = new InMemoryContextStateService({
    sessions: [{ sessionId: "layer-session-1" }],
  });

  const { runtime } = buildReferenceRuntime({
    contextState,
    sessions: [
      sessionFromContext({
        context: {
          sessionId: "layer-session-1",
          userId: "user-1",
          surface: "feed",
          focusObjectIds: ["topic:desk"],
          recentEvents: [],
          metadata: {},
        },
      }),
    ],
    retrievalData: {
      supply: {
        refs: [
          {
            id: "item:high-cost",
            kind: "product",
            score: 0.95,
            metadata: {
              objectRefs: ["topic:desk"],
              costLevel: "high",
              feedbackKey: "desk-premium",
            },
          },
          {
            id: "item:low-cost",
            kind: "product",
            score: 0.8,
            metadata: {
              objectRefs: ["topic:desk"],
              costLevel: "low",
              feedbackKey: "desk-basic",
            },
          },
        ],
      },
    },
  });

  await runtime.decideNext({
    sessionId: "layer-session-1",
    userId: "user-1",
    surface: "feed",
    limit: 2,
  });

  const trace = runtime.getLastDecisionTrace();
  assert.ok(trace?.retrievalPlan);
  assert.equal(trace?.retrievalPlan?.steps.length, 4);
  assert.ok(Array.isArray(trace?.scores));
  assert.equal(trace?.scores?.length, 2);
  assert.ok(trace?.scores?.every((item) => typeof item.finalScore === "number"));
});
