import { Router, Request, Response } from 'express';
import { WorkflowDefinition } from '@agcs/shared';
import { Orchestrator } from '../../orchestration/Orchestrator';
import { generateId, now } from '../../utils/helpers';

export function createWorkflowsRouter(orchestrator: Orchestrator): Router {
  const router = Router();
  const { workflowEngine } = orchestrator;

  // GET /workflows
  router.get('/', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: workflowEngine.listWorkflows(),
      timestamp: now(),
    });
  });

  // POST /workflows
  router.post('/', (req: Request, res: Response) => {
    const body = req.body as Partial<WorkflowDefinition>;
    if (!body.name || !body.steps?.length) {
      res.status(400).json({
        success: false,
        error: 'name and steps are required',
        timestamp: now(),
      });
      return;
    }

    const definition: WorkflowDefinition = {
      id: body.id ?? generateId(),
      name: body.name,
      description: body.description,
      steps: body.steps,
      triggers: body.triggers,
      metadata: body.metadata,
      createdAt: now(),
    };

    workflowEngine.registerWorkflow(definition);
    res.status(201).json({ success: true, data: definition, timestamp: now() });
  });

  // GET /workflows/:id
  router.get('/:id', (req: Request, res: Response) => {
    const workflow = workflowEngine.getWorkflow(req.params.id);
    if (!workflow) {
      res.status(404).json({ success: false, error: 'Workflow not found', timestamp: now() });
      return;
    }
    res.json({ success: true, data: workflow, timestamp: now() });
  });

  // POST /workflows/:id/run
  router.post('/:id/run', async (req: Request, res: Response) => {
    const { clusterId, inputOverrides } = req.body as {
      clusterId?: string;
      inputOverrides?: Record<string, unknown>;
    };

    if (!clusterId) {
      res.status(400).json({
        success: false,
        error: 'clusterId is required',
        timestamp: now(),
      });
      return;
    }

    try {
      const run = await workflowEngine.runWorkflow(
        req.params.id,
        clusterId,
        inputOverrides
      );
      res.json({ success: true, data: run, timestamp: now() });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, error, timestamp: now() });
    }
  });

  // GET /workflows/:id/runs
  router.get('/:id/runs', (req: Request, res: Response) => {
    const runs = workflowEngine.listRuns(req.params.id);
    res.json({ success: true, data: runs, timestamp: now() });
  });

  // GET /workflows/runs/:runId
  router.get('/runs/:runId', (req: Request, res: Response) => {
    const run = workflowEngine.getRunStatus(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: 'Run not found', timestamp: now() });
      return;
    }
    res.json({ success: true, data: run, timestamp: now() });
  });

  return router;
}
