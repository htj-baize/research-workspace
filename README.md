# Research Workspace

This repository now separates the **framework** layer from the **demo** layer.

## Structure

- `framework/`
  - Runtime protocol and core types intended to evolve into an SDK surface for product teams.
  - In-memory runtime, retrieval, policy, context-state, and storage helpers.
- `demos/`
  - Vertical slices, sample usage, and interactive demos that exercise the framework.
  - Scenario data for `research-flow` and `social-feed`.
- `推荐系统/`
  - Chinese design notes for next-generation recommendation systems, runtime layering, validation plans, and related design drafts.
- `notes/`
  - English working notes from the earlier exploration phase.

## Framework

- `framework/core/recommendation-runtime-protocol.ts`
- `framework/core/recommendation-runtime-services.ts`
- `framework/core/recommendation-runtime-candidate.ts`
- `framework/core/recommendation-runtime-feedback.ts`
- `framework/core/recommendation-runtime-context.ts`
- `framework/runtime/default-services.ts`
- `framework/runtime/in-memory-recommendation-runtime.ts`
- `framework/storage/file-state-storage.mjs`
- `framework/storage/in-memory-context-state-service.mjs`

## Demos

- `demos/runtime/sample-usage.ts`
- `demos/runtime/runtime-trace-sample.ts`
- `demos/runtime/research-flow-validation-demo.mjs`
- `demos/runtime/web-sdk-server.mjs`
- `demos/data/research-flow/`
- `demos/data/social-feed/`

## Notes

- Older design notes may still mention the previous `reference/` layout. The canonical code locations are now under `framework/` and `demos/`.
