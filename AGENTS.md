# GitHub Copilot Chat Agent Guide

## Repository intent
This repository is organized around vendor self-service documentation and helper scripts. It is not yet a complete software product.

## What agents should do
- Maintain documentation quality in `docs/`.
- Review helper scripts for correctness and consistency.
- Keep any new automation narrowly scoped and documented.
- Preserve the existing naming conventions and folder organization.
- Assume Jira is the preferred issue/story tracker and Confluence is the preferred docs/wiki reference when designing connectors.

## Key artifact locations
- `.copilot/agents/` — Copilot agent guidance and example use cases.
- `.copilot/skills/` — skill descriptions that help Copilot understand repo-specific tasks.
- `.copilot/tools/` — tool descriptions or helper scripts that support Copilot workflows.
- `docs/` — project requirements, BRD, clarifications, NFRs, and user stories.
- `app/` — intended application module area.
- `db/` — intended data models and persistence layer.

## Execution notes
- Run Node.js scripts directly; no `package.json` exists yet.

## Important caution
- Do not expose sensitive credentials.
- If new dependencies are needed, add `package.json` and document installation steps.
