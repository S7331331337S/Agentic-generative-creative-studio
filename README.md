# Agentic Generative Creative Studio

A full-stack studio for orchestrating parallel clusters of generative agents. This monorepo contains the backend runtime, the React dashboard, and the shared types that bind them.

[![CI](https://github.com/S7331331337S/Agentic-generative-creative-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/S7331331337S/Agentic-generative-creative-studio/actions/workflows/ci.yml)

> **Status: prototype.** The orchestration, scheduling, and workflow layers are real and tested. The
> agents themselves are mocks — they simulate latency and return templated content rather than
> calling a model provider. See [Current limitations](#current-limitations) before building on this.

---

## What Is This?

The Studio lets you define **clusters** of generative agents, submit **tasks** to them, and compose
those tasks into **workflows** expressed as a dependency graph. A knowledge base gives agents shared
context between steps, and a WebSocket feed streams cluster and task state to the dashboard live.

The reusable engine is also published separately as
[`agentic-framework-core`](https://github.com/S7331331337S/agentic-framework-core); see
[MIGRATION.md](MIGRATION.md) for how the two relate.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  Dashboard · Cluster Monitor · Workflow Builder · Knowledge  │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                   Backend (Node.js + Express)                │
│                                                              │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ Orchestrator │  │  WorkflowEngine│  │  KnowledgeBase  │  │
│  └──────┬───────┘  └───────┬────────┘  └────────┬────────┘  │
│         │                  │                    │            │
│  ┌──────▼───────────────────────────────────────▼────────┐   │
│  │               ClusterManager                          │   │
│  │  ┌──────────────────┐  ┌──────────────────┐           │   │
│  │  │   AgentCluster A │  │   AgentCluster B │  ...      │   │
│  │  │ ┌───┐ ┌───┐ ┌──┐ │  │ ┌───┐ ┌───┐ ┌──┐│           │   │
│  │  │ │Txt│ │Img│ │MM│ │  │ │Aud│ │Txt│ │Img││           │   │
│  │  │ └───┘ └───┘ └──┘ │  │ └───┘ └───┘ └──┘│           │   │
│  │  └──────────────────┘  └──────────────────┘           │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Agents
- **Text, Image, Audio, MultiModal** agent types built on a common `BaseAgent` interface
- Per-agent concurrency ceiling (`maxConcurrentTasks`) and priority
- Per-task timeout (`taskTimeoutMs`, default 30s) so a hung task cannot pin a worker slot
- Agents currently return **mock output**; swap `processTask` for a provider call to go live

### Cluster Management
- Parallel agent clusters with four load-balancing strategies: `round-robin`, `least-loaded`
  (by in-flight task count), `priority-based`, and `capability-based`
- **Capability-aware routing**: a task is only ever dispatched to an agent type that can serve it,
  preferring a specialist over a multimodal generalist
- Priority-ordered queue — `critical` work overtakes queued `normal` work
- Backpressure: work queues when every capable agent is at its concurrency ceiling

### Workflow Engine
- DAG-based orchestration. The graph is **validated at registration**: cycles, dangling dependency
  references, duplicate step IDs, and malformed conditions are rejected before a run can start
- **Level-parallel execution** — independent steps run concurrently, not one after another
- Step guards with a small, explicit expression language (see [Step conditions](#step-conditions)).
  An unparseable guard fails the run rather than silently skipping the step
- Retries with exponential backoff (`maxRetries` = retries *after* the first attempt, default 0)
- Upstream step output is passed to dependents as `payload.inputData`
- A step whose dependency did not complete is recorded as `cancelled`, never run on missing input

### Knowledge Base
- Vector search using cosine similarity with tag/type filtering. Embeddings are a **character-frequency
  mock**, not a semantic model — results approximate text similarity, not meaning
- In-memory only: all entries are lost on restart
- Context snapshots that give agents a relevant "memory window" at execution time

### API & Realtime
- **REST API**: full CRUD for clusters, workflows, knowledge entries, and task submission
- **WebSocket Server**: real-time event broadcasting (agent status, task progress, system metrics)
- Helmet.js security headers, rate limiting, CORS, structured Winston logging, graceful shutdown

---

## Project Structure

```
├── shared/           # Shared TypeScript types
├── backend/          # Node.js + Express API server
│   ├── src/
│   │   ├── agents/           # TextAgent, ImageAgent, AudioAgent, MultiModalAgent
│   │   ├── clusters/         # AgentCluster, ClusterManager
│   │   ├── orchestration/    # Orchestrator, WorkflowEngine
│   │   ├── knowledge/        # KnowledgeBase, ContextAggregator
│   │   └── api/              # REST routes, WebSocket server
│   └── tests/
├── frontend/         # React + Vite dashboard
│   ├── src/
│   │   ├── components/       # ClusterCard, AgentCard, MetricsPanel, WorkflowPanel, KnowledgePanel
│   │   ├── hooks/            # useWebSocket
│   │   └── utils/            # API client
│   └── tests/
└── .github/workflows/ci.yml  # GitHub Actions CI
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Development

```bash
# Run backend and frontend concurrently
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- WebSocket: ws://localhost:3001/ws

### Test

```bash
npm test
```

---

## API Reference

### Clusters
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clusters` | List all clusters |
| POST | `/api/clusters` | Create a new cluster |
| GET | `/api/clusters/:id` | Get cluster details and agents |
| DELETE | `/api/clusters/:id` | Remove a cluster |
| POST | `/api/clusters/:id/tasks` | Submit a task to a cluster |
| GET | `/api/clusters/:id/metrics` | Get cluster metrics |

### Workflows
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows` | Register a workflow |
| POST | `/api/workflows/:id/run` | Execute a workflow on a cluster |
| GET | `/api/workflows/:id/runs` | List workflow runs |

### Knowledge
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/knowledge` | List all entries |
| POST | `/api/knowledge` | Add an entry |
| GET | `/api/knowledge/search?q=...` | Vector similarity search (mock embeddings) |
| PUT | `/api/knowledge/:id` | Update an entry |
| DELETE | `/api/knowledge/:id` | Delete an entry |

### Metrics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/metrics` | System metrics |
| GET | `/api/metrics/health` | Health check |

---

## Step conditions

A workflow step may carry a `condition` that decides whether it runs. The grammar is deliberately
tiny and is parsed, not `eval`'d:

```
always | never
steps.<stepId>.status  ==|!=  <literal>
steps.<stepId>.output  ==|!=  <literal>
```

Terms combine with `&&` / `||` and group with parentheses. Literals may be single-quoted,
double-quoted, or bare.

```jsonc
{
  "id": "publish",
  "dependencies": ["draft", "review"],
  "condition": "steps.review.status == 'completed' && steps.draft.output != ''"
}
```

Anything outside this grammar throws. A condition that cannot be understood is treated as an
authoring bug and fails the run — it is never quietly interpreted as "skip".

Conditions are validated at registration time, so a typo surfaces from `POST /api/workflows`
with a 400 rather than at midnight during a run.

---

## Execution model

Steps are grouped into dependency **levels**. Every step in a level is independent of its siblings,
so the whole level is dispatched concurrently and the cluster absorbs as much of that concurrency as
its agents allow.

```
        ┌────────┐
        │  root  │                    level 0  ─ 1 task
        └───┬────┘
      ┌─────┴─────┐
 ┌────▼───┐  ┌────▼───┐
 │  left  │  │ right  │              level 1  ─ 2 tasks, dispatched together
 └────┬───┘  └────┬───┘
      └─────┬─────┘
        ┌───▼────┐
        │  join  │                    level 2  ─ 1 task
        └────────┘
```

A level is fully awaited before the next begins, so `join` always sees settled results from both
branches. If a step fails with `onError: 'fail'` (the default), the run aborts once the current
level settles — siblings already in flight are never abandoned mid-task.

---

## Current limitations

Known and deliberate, so you can judge what this is ready for:

| Area | State |
|------|-------|
| **Agents** | Mocked. `processTask` simulates latency and returns templated content; no model provider is called. |
| **Authentication** | None. Every REST route and the WebSocket are unauthenticated — do not expose this to a network you do not control. |
| **Request validation** | Route handlers cast `req.body`; there is no runtime schema validation yet. Workflow graphs *are* validated. |
| **Persistence** | None. Clusters, workflows, runs, and knowledge entries live in memory and vanish on restart. |
| **Embeddings** | `mockEmbedding` is a character-frequency hash, not a semantic model. |
| **Scaling** | Single process. `autoScale` and `isolationLevel` are accepted in config but not acted on. |

---

## Real-World Creative Applications

1. **AI Story Generator** – Text agents collaborate to write, edit, and illustrate long-form narratives
2. **Music Video Pipeline** – Audio agents compose music while image agents generate synchronized visual frames
3. **Brand Asset Creator** – Multi-modal agents produce logos, taglines, and marketing copy in parallel
4. **Interactive Game World Builder** – Clustered agents collaboratively design characters, environments, and storylines
5. **Podcast Production Suite** – Agents handle script writing, voice synthesis, audio mixing, and thumbnail generation

---

## License

MIT © 2026 S73313
