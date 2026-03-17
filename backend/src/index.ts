import http from 'http';
import { Orchestrator } from './orchestration/Orchestrator';
import { createApp } from './api/app';
import { WsServer } from './api/wsServer';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main() {
  const orchestrator = new Orchestrator();

  const app = createApp(orchestrator);
  const server = http.createServer(app);
  const wsServer = new WsServer(server, orchestrator);

  orchestrator.start();

  server.listen(PORT, () => {
    logger.info(`AGCS Backend running on http://localhost:${PORT}`);
    logger.info(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    orchestrator.stop();
    wsServer.close();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
