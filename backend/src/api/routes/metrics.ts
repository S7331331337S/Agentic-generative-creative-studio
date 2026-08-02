import { Router, Request, Response } from 'express';
import { Orchestrator } from '../../orchestration/Orchestrator';
import { now } from '../../utils/helpers';

export function createMetricsRouter(orchestrator: Orchestrator): Router {
  const router = Router();

  // GET /metrics
  router.get('/', (_req: Request, res: Response) => {
    res.json({ success: true, data: orchestrator.getSystemMetrics(), timestamp: now() });
  });

  // GET /metrics/health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: now(),
      },
      timestamp: now(),
    });
  });

  return router;
}
