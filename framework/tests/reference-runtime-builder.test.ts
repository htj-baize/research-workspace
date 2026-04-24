import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReferenceRuntime,
  createScenarioOverlay,
  sessionFromContext,
} from "../index.ts";

test("reference runtime builder merges overlay candidate templates", async () => {
  const overlay = createScenarioOverlay({
    name: "feed",
    candidateTemplates: {
      explore: {
        headlinePrefix: "For You",
        reasonPrefix: "Behavior suggests",
      },
    },
  });

  const { runtime } = buildReferenceRuntime({
    overlay,
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
            id: "item:1",
            kind: "post",
            score: 0.8,
            metadata: {},
          },
        ],
      },
    },
  });

  const decision = await runtime.decideNext({
    sessionId: "session-1",
    userId: "user-1",
    surface: "feed",
    limit: 1,
  });

  assert.equal(decision.intent.name, "explore");
  assert.match(decision.opportunities[0]?.headline ?? "", /^For You:/);
});
