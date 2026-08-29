# @agcs/canvas

Portable **CANVAS** runtime extracted from this studio.

This package is the scheduling/DAG reference MSTRMND Content Engine uses for the creation seat. It is **not** the Express API and **not** the React dashboard. Those stay here as a prototype UI and are not merged into mstrmnd.

## What this is

- DESK-shaped intake (`template`, `voice`, `thesis` / SCOUT packet)
- Level-parallel fan-out (`press_card` + `linkedin` in one level)
- Tools, not agents: `draft_text_format`, `draft_visual_spec`, `index_item`
- OPERATOR banned-vocabulary gate at write time
- `ce_jobs` / `ce_items` shaped store (in-memory here; Supabase in mstrmnd)

## What this is not

- A seventh MSTRMND product
- Four new agent seats (text / image / audio / multimodal)
- CIPHER, HERALD, Slack approval, or Phase 2 video/audio

## Run tests

```bash
npm test -w canvas
```
