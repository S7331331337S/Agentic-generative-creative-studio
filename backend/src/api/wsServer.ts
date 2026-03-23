import { IncomingMessage, Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { WsEvent } from '@agcs/shared';
import { Orchestrator } from '../orchestration/Orchestrator';
import { logger } from '../utils/logger';

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  connectedAt: number;
}

export class WsServer {
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private orchestrator: Orchestrator;

  constructor(server: Server, orchestrator: Orchestrator) {
    this.orchestrator = orchestrator;
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setup();
  }

  private setup(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const client: ConnectedClient = { id: clientId, ws, connectedAt: Date.now() };
      this.clients.set(clientId, client);

      logger.info(`WebSocket client connected: ${clientId}`, {
        remoteAddress: req.socket.remoteAddress,
        totalClients: this.clients.size,
      });

      // Send current system metrics on connect
      const metrics = this.orchestrator.clusterManager.getSystemMetrics();
      this.send(ws, { type: 'system:metrics', payload: metrics, timestamp: Date.now() });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as { type: string; payload?: unknown };
          this.handleClientMessage(clientId, msg);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`, {
          totalClients: this.clients.size,
        });
      });

      ws.on('error', (err) => {
        logger.warn(`WebSocket error for client ${clientId}`, { error: err.message });
        this.clients.delete(clientId);
      });
    });

    // Forward orchestrator events to all WebSocket clients
    this.orchestrator.on('event', (event: WsEvent) => {
      this.broadcast(event);
    });
  }

  private handleClientMessage(
    clientId: string,
    msg: { type: string; payload?: unknown }
  ): void {
    logger.debug('Received WS message', { clientId, type: msg.type });
    // Future: support client-initiated commands
  }

  private send(ws: WebSocket, event: WsEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  broadcast(event: WsEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    this.wss.close();
  }
}
