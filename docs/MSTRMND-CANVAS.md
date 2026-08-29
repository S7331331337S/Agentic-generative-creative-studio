# Studio → MSTRMND CANVAS

This studio is the **how** for a seat that already exists in MSTRMND: Content Engine **CANVAS**.

It is not a seventh product. The Express API and React dashboard in this repo stay here as a prototype. They are not vendored into mstrmnd.

## Map

| Studio | MSTRMND CANVAS |
|---|---|
| AgentCluster + capability routing | format → `draft_text_format` or `draft_visual_spec` |
| WorkflowEngine DAG / `toExecutionLevels` | independent formats in one level |
| TextAgent / ImageAgent | tools, not named agent seats |
| AudioAgent / MultiModalAgent | deferred (Phase 2 Creative Studio) |
| In-memory KnowledgeBase | CANON files + `ce_jobs` / `ce_items` |
| Express + React dashboard | not ported; mstrmnd-ops already mocks ENGINE |

## Package

[`canvas/`](../canvas/) is the extracted runtime: DAG, conditions, voice gate, draft tools, in-memory store, and the Content Engine SQL migration.

Canonical product home: eve agent `agents/canvas` in [S7331331337S/mstrmnd](https://github.com/S7331331337S/mstrmnd).

## Deferred

- CIPHER quality gate and Slack one-tap approval
- HERALD publish / AXIOM metrics writers
- Phase 2 video and audio pipelines

Human-in-loop stays required: jobs land in `awaiting_approval`.
