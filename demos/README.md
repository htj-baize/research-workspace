# Demo Layer

This directory holds scenario-specific and product-like examples built on top of the framework.

## Responsibilities

- Validate that real interaction changes future recommendation output.
- Exercise different scenarios such as `research-flow` and `social-feed`.
- Show how framework abstractions map to visible product behavior.

## Current layout

- `runtime/`
  - CLI samples, validation slices, and the interactive web feed demo.
  - Scenario overlays that implement the framework's overlay contract.
- `data/`
  - Scenario fixtures used by the demos.

## Important boundary

If a concern is needed for a packaged SDK, it should move into `framework/`.
If a concern only exists to make a scenario legible or product-like, it should stay in `demos/`.
