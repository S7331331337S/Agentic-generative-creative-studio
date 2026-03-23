import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { Orchestrator } from '../orchestration/Orchestrator';
import { createClustersRouter } from './routes/clusters';
import { createWorkflowsRouter } from './routes/workflows';
import { createKnowledgeRouter } from './routes/knowledge';
import { createMetricsRouter } from './routes/metrics';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(orchestrator: Orchestrator): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many requests', timestamp: Date.now() },
    })
  );

  // Request logging
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/api/clusters', createClustersRouter(orchestrator));
  app.use('/api/workflows', createWorkflowsRouter(orchestrator));
  app.use('/api/knowledge', createKnowledgeRouter(orchestrator));
  app.use('/api/metrics', createMetricsRouter(orchestrator));

  // Health check (unauthenticated)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // 404 and error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
