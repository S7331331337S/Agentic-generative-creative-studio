# Migration Guide — `copilot/create-conceptual-framework-prototype` → `agentic-framework-core`

This document records the one-time migration of the Agentic Framework from a feature branch in the
[Agentic-generative-creative-studio](https://github.com/S7331331337S/Agentic-generative-creative-studio)
repository into this dedicated repository (`agentic-framework-core`).

---

## What Was Migrated

The entire contents of the
`copilot/create-conceptual-framework-prototype` branch were promoted to the `main` branch of this
repository, including:

| Path | Description |
|------|-------------|
| `shared/` | Shared TypeScript types consumed by both the backend and frontend |
| `backend/` | Node.js + Express API server — agents, clusters, orchestration, knowledge, WebSocket |
| `frontend/` | React + Vite dashboard |
| `package.json` / `package-lock.json` | Root npm workspace manifest |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |
| `LICENSE` | MIT license |

---

## Verifying the Migration

Before deleting the source branch, confirm the following:

1. **CI passes** – The [CI workflow](../../actions/workflows/ci.yml) on `main` in this repository
   shows a green badge.
2. **All tests pass locally** – Run `npm ci && npm run build && npm test` and confirm there are no
   failures.
3. **Content parity** – Spot-check a few key source files (e.g. `backend/src/orchestration/Orchestrator.ts`)
   against the original branch to ensure nothing was lost.
4. **Downstream consumers updated** – Any project that previously referenced
   `Agentic-generative-creative-studio` at that branch should now point to this repository instead.

---

## Cleaning Up the Source Branch

Once the migration is verified, delete the `copilot/create-conceptual-framework-prototype` branch
from the original repository to prevent stale references and keep the repo tidy.

### Option A — GitHub Web UI

1. Navigate to
   [https://github.com/S7331331337S/Agentic-generative-creative-studio/branches](https://github.com/S7331331337S/Agentic-generative-creative-studio/branches).
2. Find `copilot/create-conceptual-framework-prototype` in the list.
3. Click the **trash icon** (🗑) to the right of the branch name.
4. Confirm the deletion when prompted.

### Option B — Git CLI

```bash
# Delete the remote branch
git push origin --delete copilot/create-conceptual-framework-prototype

# Optional: prune your local tracking references
git fetch origin --prune
```

---

## Post-Migration Checklist

- [ ] CI is green on `main` in `agentic-framework-core`
- [ ] All tests pass locally
- [ ] Source branch deleted from `Agentic-generative-creative-studio`
- [ ] Any downstream references updated to point at the new repository
