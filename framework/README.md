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

- `core/`
  - Shared protocol and service contracts.
  - Feedback protocol for event -> signal -> state projection.
- `runtime/`
  - Default retrieval, candidate construction, policy, and in-memory runtime implementation.
- `storage/`
  - File-backed and in-memory state helpers used by the demos and validation slices.
