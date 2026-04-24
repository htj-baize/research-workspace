import test from "node:test";
import assert from "node:assert/strict";

import {
  ComposableFeedbackInterpreter,
  ComposableFeedbackProjector,
  defaultFeedbackProjectionRules,
  defaultFeedbackSignalRules,
} from "../index.ts";

test("dismiss maps to negative_interest and rejectedPatterns projection", async () => {
  const interpreter = new ComposableFeedbackInterpreter({
    signalRules: defaultFeedbackSignalRules,
  });
  const projector = new ComposableFeedbackProjector({
    projectionRules: defaultFeedbackProjectionRules,
  });

  const event = {
    id: "event:dismiss:1",
    action: "dismiss" as const,
    targetRef: "opp:1",
    type: "feed_dismissed",
    timestampMs: Date.now(),
    actor: "user" as const,
    objectRefs: ["opp:1", "topic:citywalk"],
    metadata: {
      feedbackKey: "citywalk",
    },
  };

  const signals = await interpreter.interpret({ event });
  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.kind, "negative_interest");
  assert.equal(signals[0]?.key, "citywalk");

  const projections = await projector.project({
    event,
    signals,
    sessionId: "session-1",
  });
  assert.equal(projections.length, 1);
  assert.equal(projections[0]?.path, "rejectedPatterns");
  assert.equal(projections[0]?.value, "citywalk");
});

test("clarify maps to goal_refinement and goal.current projection", async () => {
  const interpreter = new ComposableFeedbackInterpreter();
  const projector = new ComposableFeedbackProjector();

  const event = {
    id: "event:clarify:1",
    action: "clarify" as const,
    targetRef: "opp:clarify",
    type: "clarification_answered",
    timestampMs: Date.now(),
    actor: "user" as const,
    metadata: {
      answer: "先收成三段式提纲",
    },
  };

  const signals = await interpreter.interpret({ event });
  assert.equal(signals[0]?.kind, "goal_refinement");
  assert.equal(signals[0]?.key, "先收成三段式提纲");

  const projections = await projector.project({
    event,
    signals,
    sessionId: "session-1",
  });
  assert.equal(projections[0]?.path, "goal.current");
  assert.equal(projections[0]?.value, "先收成三段式提纲");
});
