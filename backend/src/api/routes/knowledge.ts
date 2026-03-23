import { Router, Request, Response } from 'express';
import { KnowledgeEntry, SearchQuery } from '@agcs/shared';
import { Orchestrator } from '../../orchestration/Orchestrator';
import { now } from '../../utils/helpers';

export function createKnowledgeRouter(orchestrator: Orchestrator): Router {
  const router = Router();
  const { knowledgeBase } = orchestrator;

  // GET /knowledge
  router.get('/', (_req: Request, res: Response) => {
    const entries = knowledgeBase.getAll();
    res.json({ success: true, data: entries, timestamp: now() });
  });

  // POST /knowledge
  router.post('/', async (req: Request, res: Response) => {
    const body = req.body as Partial<KnowledgeEntry>;
    if (!body.title || !body.content || !body.type) {
      res.status(400).json({
        success: false,
        error: 'title, content, and type are required',
        timestamp: now(),
      });
      return;
    }

    const entry = await knowledgeBase.addEntry({
      type: body.type,
      title: body.title,
      content: body.content,
      tags: body.tags ?? [],
      sourceId: body.sourceId,
      metadata: body.metadata,
    });

    res.status(201).json({ success: true, data: entry, timestamp: now() });
  });

  // GET /knowledge/search
  router.get('/search', async (req: Request, res: Response) => {
    const { q, limit, types, tags } = req.query as {
      q?: string;
      limit?: string;
      types?: string;
      tags?: string;
    };

    if (!q) {
      res.status(400).json({
        success: false,
        error: 'q (query) parameter is required',
        timestamp: now(),
      });
      return;
    }

    const query: SearchQuery = {
      query: q,
      limit: limit ? parseInt(limit, 10) : 10,
      filters: {
        types: types
          ? (types.split(',') as KnowledgeEntry['type'][])
          : undefined,
        tags: tags ? tags.split(',') : undefined,
      },
    };

    const results = await knowledgeBase.search(query);
    res.json({ success: true, data: results, timestamp: now() });
  });

  // GET /knowledge/:id
  router.get('/:id', async (req: Request, res: Response) => {
    const entry = await knowledgeBase.getEntry(req.params.id);
    if (!entry) {
      res.status(404).json({ success: false, error: 'Entry not found', timestamp: now() });
      return;
    }
    res.json({ success: true, data: entry, timestamp: now() });
  });

  // PUT /knowledge/:id
  router.put('/:id', async (req: Request, res: Response) => {
    const updated = await knowledgeBase.updateEntry(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Entry not found', timestamp: now() });
      return;
    }
    res.json({ success: true, data: updated, timestamp: now() });
  });

  // DELETE /knowledge/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    const deleted = await knowledgeBase.deleteEntry(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Entry not found', timestamp: now() });
      return;
    }
    res.json({ success: true, message: 'Entry deleted', timestamp: now() });
  });

  return router;
}
