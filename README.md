# Agentic Generative Creative Studio

A fullstack agentic cross-platform generative creative studio for parallel clustered agents with context tools, knowledge integration, and creative workflow orchestration.

[![CI](https://github.com/S7331331337S/Agentic-generative-creative-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/S7331331337S/Agentic-generative-creative-studio/actions/workflows/ci.yml)

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

## Features

### Frontend
- **React + TypeScript** dashboard with real-time WebSocket updates
- **Cluster Manager** – create, monitor, and delete agent clusters
- **Workflow Builder** – define multi-step creative workflows with dependency resolution
- **Knowledge Base** – semantic search, entry management, context snapshots
- **Real-time Metrics** – live CPU, memory, task queue, and agent status

### Backend
- **Agent Types**: Text, Image, Audio, MultiModal
- **Cluster Management**: parallel agent clusters with configurable load-balancing strategies (round-robin, least-loaded, priority-based)
- **Workflow Engine**: DAG-based workflow orchestration with automatic topological sorting, dependency resolution, and retry logic
- **Knowledge Base**: semantic search using cosine similarity, tag/type filtering, context snapshots for agent augmentation
- **Context Aggregator**: builds context windows for agents by aggregating relevant knowledge entries
- **WebSocket Server**: real-time event broadcasting (agent status, task progress, system metrics)
- **REST API**: full CRUD for clusters, workflows, knowledge entries; task submission

### Security
- Helmet.js HTTP security headers
- Rate limiting (200 req/min per IP)
- CORS configuration
- Structured logging (Winston)
- Graceful shutdown

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
| GET | `/api/knowledge/search?q=...` | Semantic search |
| PUT | `/api/knowledge/:id` | Update an entry |
| DELETE | `/api/knowledge/:id` | Delete an entry |

### Metrics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/metrics` | System metrics |
| GET | `/api/metrics/health` | Health check |

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
