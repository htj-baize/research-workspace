# Framework Layer

This directory holds the runtime pieces that are meant to become the packaged SDK / framework surface.

## Responsibilities

- Define stable protocol objects and service interfaces.
- Provide a reference in-memory runtime implementation.
- Manage context state, compression, promotion, and storage adapters.
- Stay scenario-agnostic as much as possible.

## Non-goals

- Product-specific UI.
- Scenario-specific feed wording and card rendering.
- Demo-only behavior instrumentation.

## Current layout

- `index.ts`
  - Public package surface for SDK consumers.
- `core/`
  - Shared protocol and service contracts.
  - Feedback protocol for event -> signal -> state projection.
  - Scenario overlay contract for business-specific templates, feedback mapping, and explanations.
- `runtime/`
  - Default retrieval, candidate construction, policy, and feedback services.
  - In-memory runtime implementation, including `handleFeedback()` for feedback -> signal -> projection -> context-state writes.
  - `buildReferenceRuntime()` for assembling a reference runtime without importing internal files one by one.
- `adapters/`
  - Business-facing adapter layer such as `RecommendationSessionAdapter`.
- `storage/`
  - File-backed and in-memory state helpers used by the demos and validation slices.

## Recommended consumer entrypoint

Business-side code should prefer:

- [index.ts](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/framework/index.ts)
- [package.json](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/framework/package.json)

Instead of importing deep internal paths directly.

## Example integration

There is now a minimal business-side customization example at:

- [business-customization.ts](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/examples/business-customization.ts)

It shows how to:

- override one feedback rule
- add one durable projection rule
- customize one overlay's feedback event type / metadata
- assemble the runtime through `buildReferenceRuntime()`

## Runtime layering

The framework now has a more explicit runtime split:

- retrieval service
- retrieval planner
- candidate construction
- policy scorer
- explainable policy service
- session adapter

This keeps business integrations off the lower-level runtime plumbing in common cases.

## Extension points

The framework now exposes finer-grained extension points instead of forcing whole-block replacement:

- feedback key resolver
- feedback signal rules
- feedback projection rules
- overlay feedback type resolver
- overlay feedback metadata builder
- overlay explanation builder
