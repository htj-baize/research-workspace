import test from "node:test";
import assert from "node:assert/strict";

import { createScenarioOverlay } from "../index.ts";

test("overlay factory composes feedback event from resolvers", () => {
  const overlay = createScenarioOverlay({
    name: "commerce",
    resolveFeedbackType(input) {
      return input.action === "like" ? "product_liked" : "feed_interacted";
    },
    resolveFeedbackKey(input) {
      return (
        (input.opportunity.metadata?.category as string | undefined) ??
        input.opportunity.kind
      );
    },
    buildFeedbackMetadata(input) {
      return {
        customCategory: input.opportunity.metadata?.category,
      };
    },
  });

  const event = overlay.buildFeedbackEvent({
    action: "like",
    opportunity: {
      id: "opp:1",
      kind: "content",
      headline: "Desk setup inspiration",
      reason: "fits your focus",
      sourceRefs: ["topic:desk-setup"],
      actionRef: "action:1",
      metadata: {
        category: "desk-setup",
      },
    },
  });

  assert.equal(event.type, "product_liked");
  assert.equal(event.metadata?.customCategory, "desk-setup");
  assert.equal(event.targetRef, "opp:1");
});
