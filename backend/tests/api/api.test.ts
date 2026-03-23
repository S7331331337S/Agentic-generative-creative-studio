import request from 'supertest';
import { createApp } from '../../src/api/app';
import { Orchestrator } from '../../src/orchestration/Orchestrator';
import { Application } from 'express';
import { ClusterConfig } from '@agcs/shared';

describe('REST API Integration', () => {
  let app: Application;
  let orchestrator: Orchestrator;

  const testClusterConfig: Omit<ClusterConfig, 'id'> = {
    name: 'Test Cluster',
    agentConfigs: [
      {
        id: 'agent-api-test',
        name: 'Test Agent',
        type: 'text',
        priority: 'normal',
        maxConcurrentTasks: 1,
        contextWindowSize: 4096,
        modelConfig: { provider: 'mock', modelId: 'mock' },
      },
    ],
    maxAgents: 5,
    loadBalancingStrategy: 'round-robin',
    autoScale: false,
    isolationLevel: 'none',
  };

  beforeEach(() => {
    orchestrator = new Orchestrator();
    app = createApp(orchestrator);
  });

  afterEach(() => {
    orchestrator.stop();
  });

  // Health check
  describe('GET /health', () => {
    it('returns 200 with ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  // Clusters API
  describe('POST /api/clusters', () => {
    it('creates a cluster', async () => {
      const res = await request(app)
        .post('/api/clusters')
        .send(testClusterConfig);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.config.name).toBe('Test Cluster');
    });

    it('returns 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/clusters')
        .send({ agentConfigs: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/clusters', () => {
    it('lists all clusters', async () => {
      await request(app).post('/api/clusters').send(testClusterConfig);
      const res = await request(app).get('/api/clusters');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/clusters/:id', () => {
    it('returns cluster details', async () => {
      const create = await request(app)
        .post('/api/clusters')
        .send({ ...testClusterConfig, id: 'cluster-detail-test' });
      const clusterId = create.body.data.config.id;

      const res = await request(app).get(`/api/clusters/${clusterId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.config.id).toBe(clusterId);
      expect(Array.isArray(res.body.data.agents)).toBe(true);
    });

    it('returns 404 for unknown cluster', async () => {
      const res = await request(app).get('/api/clusters/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/clusters/:id', () => {
    it('removes a cluster', async () => {
      await request(app)
        .post('/api/clusters')
        .send({ ...testClusterConfig, id: 'cluster-to-delete' });

      const res = await request(app).delete('/api/clusters/cluster-to-delete');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/clusters/:id/tasks', () => {
    it('submits a task and returns result', async () => {
      await request(app)
        .post('/api/clusters')
        .send({ ...testClusterConfig, id: 'cluster-task-test' });

      const res = await request(app)
        .post('/api/clusters/cluster-task-test/tasks')
        .send({
          type: 'generate-text',
          payload: { prompt: 'Test prompt' },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });

    it('returns 400 if type or payload missing', async () => {
      await request(app)
        .post('/api/clusters')
        .send({ ...testClusterConfig, id: 'cluster-missing-test' });

      const res = await request(app)
        .post('/api/clusters/cluster-missing-test/tasks')
        .send({ type: 'generate-text' }); // missing payload

      expect(res.status).toBe(400);
    });
  });

  // Knowledge API
  describe('POST /api/knowledge', () => {
    it('adds a knowledge entry', async () => {
      const res = await request(app).post('/api/knowledge').send({
        type: 'document',
        title: 'Test Document',
        content: 'This is test content for the knowledge base.',
        tags: ['test'],
      });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.embedding).toBeDefined();
    });

    it('returns 400 if required fields are missing', async () => {
      const res = await request(app).post('/api/knowledge').send({
        title: 'Missing content',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/knowledge/search', () => {
    it('returns search results', async () => {
      await request(app).post('/api/knowledge').send({
        type: 'document',
        title: 'AI Systems',
        content: 'Artificial intelligence systems for creative generation.',
        tags: ['ai'],
      });

      const res = await request(app)
        .get('/api/knowledge/search')
        .query({ q: 'artificial intelligence', limit: '5' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 400 if q is missing', async () => {
      const res = await request(app).get('/api/knowledge/search');
      expect(res.status).toBe(400);
    });
  });

  // Metrics API
  describe('GET /api/metrics', () => {
    it('returns system metrics', async () => {
      const res = await request(app).get('/api/metrics');
      expect(res.status).toBe(200);
      expect(res.body.data.timestamp).toBeGreaterThan(0);
      expect(typeof res.body.data.totalClusters).toBe('number');
    });
  });

  describe('GET /api/metrics/health', () => {
    it('returns health status', async () => {
      const res = await request(app).get('/api/metrics/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('healthy');
    });
  });

  // Workflows API
  describe('POST /api/workflows', () => {
    it('registers a workflow', async () => {
      const res = await request(app).post('/api/workflows').send({
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            name: 'Generate Story',
            taskType: 'generate-text',
            agentType: 'text',
            payload: { prompt: 'Write a story' },
          },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Test Workflow');
    });

    it('returns 400 if name or steps missing', async () => {
      const res = await request(app)
        .post('/api/workflows')
        .send({ name: 'No Steps' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/workflows', () => {
    it('lists workflows', async () => {
      await request(app).post('/api/workflows').send({
        name: 'Listed Workflow',
        steps: [
          {
            id: 'step-1',
            name: 'Step',
            taskType: 'generate-text',
            agentType: 'text',
            payload: { prompt: 'Hello' },
          },
        ],
      });

      const res = await request(app).get('/api/workflows');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  // 404 handler
  describe('Unknown route', () => {
    it('returns 404', async () => {
      const res = await request(app).get('/api/unknown');
      expect(res.status).toBe(404);
    });
  });
});
