import {
  ComposableFeedbackInterpreter,
  ComposableFeedbackProjector,
  buildReferenceRuntime,
  createScenarioOverlay,
  defaultFeedbackProjectionRules,
  defaultFeedbackSignalRules,
  dismissToNegativeInterestRule,
  sessionFromContext,
  type FeedbackProjectionRule,
  type FeedbackSignalRule,
} from "../framework/index.ts";

const superLikeRule: FeedbackSignalRule = async ({ event, key }) => {
  if (event.action !== "like" || event.metadata?.superLike !== true) {
    return [];
  }

  return {
    id: `signal:super-like:${event.id}`,
    kind: "positive_interest",
    key,
    strength: 0.98,
    confidence: 0.97,
    sourceEventId: event.id,
    metadata: {
      ...event.metadata,
      source: "custom_super_like_rule",
    },
  };
};

const durablePreferenceProjectionRule: FeedbackProjectionRule = async ({
  event,
  signal,
}) => {
  if (
    signal.kind !== "positive_interest" ||
    signal.strength == null ||
    signal.strength < 0.95 ||
    !signal.key
  ) {
    return [];
  }

  return {
    target: "durable",
    operation: "append",
    path: "preferredPatterns",
    value: signal.key,
    reason: "custom_super_like_promotion",
    sourceEventIds: [event.id],
    confidence: signal.confidence,
    sourceSignalKinds: [signal.kind],
  };
};

const commerceOverlay = createScenarioOverlay({
  name: "commerce-feed",
  candidateTemplates: {
    explore: {
      headlinePrefix: "Shop For You",
      reasonPrefix: "Behavior suggests",
    },
    recover_flow: {
      headlinePrefix: "Easy Pick",
      reasonPrefix: "Lower-friction recovery for",
    },
  },
  resolveFeedbackType(input) {
    if (input.action === "like") return "product_liked";
    if (input.action === "save") return "wishlist_saved";
    return input.action === "dismiss" ? "product_skipped" : "feed_interacted";
  },
  buildFeedbackMetadata(input) {
    return {
      feedbackKey:
        input.opportunity.metadata?.feedbackKey ??
        input.opportunity.metadata?.category ??
        input.opportunity.kind,
      category: input.opportunity.metadata?.category,
      superLike: input.metadata?.superLike,
    };
  },
});

async function main() {
  const customInterpreter = new ComposableFeedbackInterpreter({
    signalRules: [superLikeRule, dismissToNegativeInterestRule, ...defaultFeedbackSignalRules],
  });
  const customProjector = new ComposableFeedbackProjector({
    projectionRules: [durablePreferenceProjectionRule, ...defaultFeedbackProjectionRules],
  });

  const { runtime } = buildReferenceRuntime({
    overlay: commerceOverlay,
    sessions: [
      sessionFromContext({
        context: {
          sessionId: "biz-session-1",
          userId: "buyer-1",
          surface: "commerce-feed",
          focusObjectIds: ["category:desk-setup"],
          recentEvents: [],
          metadata: {
            userGoal: "find a desk setup upgrade",
          },
        },
      }),
    ],
    retrievalData: {
      supply: {
        refs: [
          {
            id: "item:monitor-arm",
            kind: "product",
            score: 0.93,
            metadata: {
              objectRefs: ["category:desk-setup"],
              category: "desk-setup",
              feedbackKey: "desk-setup",
            },
          },
          {
            id: "item:lamp",
            kind: "product",
            score: 0.82,
            metadata: {
              objectRefs: ["category:desk-setup"],
              category: "lighting",
              feedbackKey: "lighting",
            },
          },
        ],
      },
    },
    feedback: {
      interpreter: customInterpreter,
      projector: customProjector,
    },
  });

  const decision = await runtime.decideNext({
    sessionId: "biz-session-1",
    userId: "buyer-1",
    surface: "commerce-feed",
    limit: 2,
  });

  const selected = decision.opportunities[0];
  if (!selected) {
    throw new Error("No opportunity selected");
  }

  const feedbackEvent = commerceOverlay.buildFeedbackEvent({
    action: "like",
    opportunity: selected,
    metadata: {
      superLike: true,
    },
  });

  const feedbackTrace = await runtime.handleFeedback?.({
    event: feedbackEvent,
    context: decision.context,
  });

  console.log(
    JSON.stringify(
      {
        decision,
        feedbackEvent,
        feedbackTrace,
      },
      null,
      2
    )
  );
}

void main();
