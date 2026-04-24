# Quest Engine, Generative Recommendation, and Agent-Native Recommendation Systems

Date: 2026-04-24

## Context

This note consolidates a discussion around `Studio Quest`, generative recommendation, recall architecture, and how human and agent roles may evolve in next-generation recommendation systems.

The starting point was a `Studio Quest` MVP framing:

- It should not be treated as a heavy task tree.
- It should not be treated as a world evaluator for its own sake.
- It should not be treated as a payment pop-up layer.
- It should instead be treated as a continuation engine grounded in world state.

## 1. What Studio Quest Actually Is

The right abstraction for the current MVP is:

> A world-state-driven continuation engine.

It has two layers:

1. `Quest Validity Layer`
   - Determines which quests genuinely grow out of the current world state.
2. `Offer Priority Layer`
   - Determines which valid quests are most worth surfacing as 1-3 continuation offers.

Frontend value is not raw token selling. The product sells:

- a chance to continue the same object,
- to deepen a line,
- to escalate tension into consequences.

Backend logic is not abstract monetization. It computes:

- token cost,
- workflow cost,
- intensity cost,
- safety/governance cost.

## 2. Why This Is a Generative Recommendation Problem

This should be understood as a form of generative recommendation, but not as a traditional feed recommender.

The system is recommending:

- the next creative action,
- the next continuation opportunity,
- the next step that feels naturally implied by the current world.

What is being recommended is not an existing item from a static catalog. It is a dynamically constructed `ContinuationOffer`.

Compared with traditional recommendation:

```text
Traditional:
user profile + behavior + item pool
-> recall existing items
-> rank items
-> show items

Studio Quest:
world state + recent session + current attention object
-> generate quest possibilities
-> validate them
-> translate them into continuation offers
-> rank and price them
-> execute continuation
-> write back to world state
```

So the system is best described as:

> a generative continuation recommender

or

> a world-state-driven continuation recommendation engine

## 3. Core Technical Challenge

The core challenge is not "can the system generate 3 quest cards."

The real challenge is:

> Can the system reliably generate offers that feel like the natural next step for the current object, that the user wants to click, that produce meaningful new content, and that can be written back into the world to support another round?

This implies a full closed loop:

```text
world state
-> continuation opportunity
-> sellable offer
-> execution
-> new content
-> writeback
-> new world state
```

Three core requirements emerged:

1. The quest must be grounded in a specific object.
2. The offer must be executable, not just attractive.
3. The result must be writable back into the world and support further growth.

## 4. Why Recall Is Needed

Yes, a recall layer is needed, but not a traditional large-scale recommender recall system.

The current `Quest Validity Layer` already behaves like a candidate generation and filtering stage. Naming that explicitly helps engineering discipline.

Recommended architecture:

```text
Quest Recall / Candidate Generation
-> Validity Filter
-> Offer Translation
-> Cost-aware Ranking
-> UI Display
-> Continuation Execution
-> World Writeback
```

The key point is:

> recall does not retrieve content items; it retrieves or constructs possible next continuation opportunities.

What is recalled is the backend candidate unit:

```ts
type QuestPossibility = {
  id: string;
  dynamicType:
    | "tension"
    | "gap"
    | "promise"
    | "contradiction"
    | "escalation"
    | "resolution";
  sourceAtomIds: string[];
  sourceWorkIds: string[];
  worldReason: string;
  brief: string;
};
```

This means the recalled object is:

- not a work,
- not an atom,
- not a product,
- not a static template,
- but a possible next continuation that is justified by current world state.

## 5. Recommended MVP Recall Sources

For MVP, recall should be lightweight, interpretable, and grounded in world state.

Suggested recall sources:

1. `Recent Object Recall`
   - Around newly created or recently viewed atoms and works.
2. `Unresolved Tension Recall`
   - From secrets, contradictions, missing consequences, implied promises, dangerous relationships.
3. `Underdeveloped Object Recall`
   - From objects that are present but not yet sufficiently expressed.
4. `Follow-up Pattern Recall`
   - From result-type-aware continuation patterns, as long as they remain grounded in current objects.

Recommended recall discipline:

```text
recall many
filter hard
rank few
show 1-3
```

## 6. What Makes a Quest Actually Interesting

A good quest is not driven by generic dramatic wording. It must capture unresolved desire around the user's current attention object.

Working formula:

> Good Quest = specific object + unresolved tension + visible consequence + imaginable scene + low-friction action

Several principles matter:

1. Stay attached to the current attention object.
2. Grow from what remains unfinished.
3. Emphasize consequence, not just action.
4. Contain a visualizable scene.
5. Match the right narrative timing instead of always maximizing intensity.
6. Present 1-3 offers that reflect different desire modes.

Examples:

Weak:

- Continue her story

Stronger:

- Give Bai Jin her first public moment of visible instability

Stronger still:

- Turn this reunion into evidence she can never explain away

The point is not merely stronger copy. The point is sharper grounding in unresolved world state.

## 7. End-to-End vs Layered Recommendation in the Future

A broader question emerged: as agents get stronger, will end-to-end recommendation disappear and revert into a classic `profile + recall + rerank` structure?

The answer was: not exactly.

A more plausible future is:

> recommendation systems become agent-orchestrated, but still keep layered industrial structure underneath.

Pure end-to-end approaches have limits:

- controllability,
- latency and cost,
- policy constraints,
- observability,
- debugging,
- multi-objective optimization.

Traditional `profile + recall + rerank` also will not return unchanged.

Instead:

- `profile` evolves into dynamic user state, intent state, and memory,
- `recall` evolves into candidate construction,
- `rerank` evolves into a policy layer that balances value, risk, and cost.

So the likely future shape is:

```text
user state / memory
+ retrieval / candidate construction
+ policy / ranking
+ agent planning
+ action execution
+ writeback / memory update
```

For Studio Quest specifically:

```text
user/world state
-> quest recall
-> validity filter
-> offer ranking and pricing
-> agent execution
-> world writeback
```

## 8. Human Value in an Agent-Native Future

Another theme in the discussion was whether engineering value diminishes if systems become fully agent-native.

Conclusion:

> engineering value shifts upward, from manually producing implementation to defining goals, constraints, evaluation, and long-term system ownership.

Human value remains strongest in:

- defining the real problem,
- setting constraints,
- designing evolvable systems,
- verification and evaluation,
- ownership of outcomes and risk.

Agents are stronger at:

- expansion,
- local implementation,
- candidate generation,
- mechanical execution,
- context handling when objectives are clear.

Humans remain essential for:

- choosing what to optimize,
- making tradeoffs between conflicting goals,
- setting acceptable risk,
- deciding what should not be built,
- taking responsibility for consequences.

This yields a practical boundary:

> agents are the dynamic decision-and-execution layer; humans are the long-horizon value, policy, and accountability layer.

## 9. Human and Agent Roles in Next-Generation Recommendation Systems

In next-generation recommendation systems:

### Agent role

Agents increasingly act as:

- intent interpreters,
- candidate constructors,
- interaction managers,
- execution orchestrators.

They can:

- interpret current user goals,
- clarify intent through interaction,
- build candidate actions or content,
- execute downstream creative or transactional workflows,
- update memory and session state.

### Human role

Humans increasingly act as:

- objective designers,
- policy setters,
- evaluators,
- system owners.

They define:

- what the system should optimize,
- what the system must never optimize at the expense of everything else,
- what constraints apply,
- how success and failure are measured,
- what risks are acceptable,
- when to intervene or halt behavior.

This is especially important in recommendation because agents naturally drift toward local optimization or immediate gratification unless higher-order policy is enforced.

## 10. Practical Engineering Takeaways for Studio Quest

For the current MVP, the practical focus should remain:

1. Do not build a heavy quest object model first.
2. Implement lightweight runtime quest generation.
3. Separate candidate generation from ranking.
4. Make every surfaced offer executable.
5. Ensure continuation results can be written back into `works` or `atoms`.
6. Use pricing as a cost-aware layer, not as the product's conceptual center.

Minimal recommended implementation slices:

1. `quest-engine/`
   - `buildQuestPossibilities(snapshot, session)`
   - `filterValidQuestPossibilities(...)`
   - `rankContinuationOffers(...)`
2. `quest-pricing/`
   - `estimateQuestTokenCost(...)`
   - `toCreditPrice(...)`
3. UI
   - quest rail
   - quest card
   - confirm layer
4. continuation execution
   - run
   - writeback
   - respawn offers

## Closing Summary

Three statements summarize the discussion well:

1. `Studio Quest` is best understood as a world-state-driven continuation recommender.
2. The recommendation target is not an existing content item but a possible next creative step.
3. In the next generation of recommendation systems, agents run the dynamic recommendation and execution loop, while humans define value, boundaries, and accountability.
