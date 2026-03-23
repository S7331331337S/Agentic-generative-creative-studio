import { Router, Request, Response } from 'express';
import {
  AgentConfig,
  ApiResponse,
  ClusterConfig,
  TaskDefinition,
} from '@agcs/shared';
import { Orchestrator } from '../../orchestration/Orchestrator';
import { generateId, now } from '../../utils/helpers';

export function createClustersRouter(orchestrator: Orchestrator): Router {
  const router = Router();
  const { clusterManager } = orchestrator;

  // GET /clusters
  router.get('/', (_req: Request, res: Response) => {
    const clusters = clusterManager.getAllClusters().map((c) => ({
      config: c.getConfig(),
      state: c.getState(),
    }));
    const response: ApiResponse = {
      success: true,
      data: clusters,
      timestamp: now(),
    };
    res.json(response);
  });

  // POST /clusters
  router.post('/', async (req: Request, res: Response) => {
    try {
      const body = req.body as Omit<ClusterConfig, 'id'> & { id?: string };
      if (!body.name) {
        res.status(400).json({ success: false, error: 'name is required', timestamp: now() });
        return;
      }

      // Default values
      const config: ClusterConfig = {
        id: body.id ?? generateId(),
        name: body.name,
        description: body.description,
        agentConfigs: (body.agentConfigs ?? []).map((ac: AgentConfig) => ({
          ...ac,
          id: ac.id ?? generateId(),
        })),
        maxAgents: body.maxAgents ?? 10,
        loadBalancingStrategy: body.loadBalancingStrategy ?? 'round-robin',
        autoScale: body.autoScale ?? false,
        isolationLevel: body.isolationLevel ?? 'none',
      };

      const cluster = await clusterManager.createCluster(config);
      const response: ApiResponse = {
        success: true,
        data: { config: cluster.getConfig(), state: cluster.getState() },
        timestamp: now(),
      };
      res.status(201).json(response);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, error, timestamp: now() });
    }
  });

  // GET /clusters/:id
  router.get('/:id', (req: Request, res: Response) => {
    const cluster = clusterManager.getCluster(req.params.id);
    if (!cluster) {
      res.status(404).json({ success: false, error: 'Cluster not found', timestamp: now() });
      return;
    }
    res.json({
      success: true,
      data: {
        config: cluster.getConfig(),
        state: cluster.getState(),
        agents: cluster.getAgents().map((a) => ({
          config: a.getConfig(),
          state: a.getState(),
        })),
      },
      timestamp: now(),
    });
  });

  // DELETE /clusters/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await clusterManager.removeCluster(req.params.id);
      res.json({ success: true, message: 'Cluster removed', timestamp: now() });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      res.status(404).json({ success: false, error, timestamp: now() });
    }
  });

  // POST /clusters/:id/tasks
  router.post('/:id/tasks', async (req: Request, res: Response) => {
    try {
      const cluster = clusterManager.getCluster(req.params.id);
      if (!cluster) {
        res.status(404).json({ success: false, error: 'Cluster not found', timestamp: now() });
        return;
      }

      const body = req.body as Partial<TaskDefinition>;
      if (!body.type || !body.payload) {
        res.status(400).json({
          success: false,
          error: 'type and payload are required',
          timestamp: now(),
        });
        return;
      }

      const task: TaskDefinition = {
        id: generateId(),
        type: body.type,
        payload: body.payload,
        priority: body.priority ?? 'normal',
        clusterId: req.params.id,
        contextIds: body.contextIds,
        createdAt: now(),
      };

      const result = await clusterManager.submitTask(req.params.id, task);
      res.json({ success: true, data: result, timestamp: now() });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error, timestamp: now() });
    }
  });

  // GET /clusters/:id/metrics
  router.get('/:id/metrics', (req: Request, res: Response) => {
    const cluster = clusterManager.getCluster(req.params.id);
    if (!cluster) {
      res.status(404).json({ success: false, error: 'Cluster not found', timestamp: now() });
      return;
    }
    res.json({ success: true, data: cluster.getState(), timestamp: now() });
  });

  return router;
}
