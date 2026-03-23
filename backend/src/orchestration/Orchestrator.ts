import { EventEmitter } from 'events';
import { ClusterManager } from '../clusters/ClusterManager';
import { KnowledgeBase } from '../knowledge/KnowledgeBase';
import { ContextAggregator } from '../knowledge/ContextAggregator';
import { WorkflowEngine } from './WorkflowEngine';
import { logger } from '../utils/logger';

/**
 * The Orchestrator is the top-level coordinator that wires together
 * the cluster manager, knowledge base, context aggregator, and workflow
 * engine, while broadcasting real-time events to connected WebSocket clients.
 */
export class Orchestrator extends EventEmitter {
  public readonly clusterManager: ClusterManager;
  public readonly knowledgeBase: KnowledgeBase;
  public readonly contextAggregator: ContextAggregator;
  public readonly workflowEngine: WorkflowEngine;

  constructor() {
    super();
    this.knowledgeBase = new KnowledgeBase();
    this.contextAggregator = new ContextAggregator(this.knowledgeBase);
    this.clusterManager = new ClusterManager();
    this.workflowEngine = new WorkflowEngine(
      this.clusterManager,
      this.knowledgeBase,
      this.contextAggregator
    );

    this.wireEvents();
  }

  private wireEvents(): void {
    // Forward all events from sub-systems to Orchestrator's event emitter
    this.clusterManager.on('event', (event) => this.emit('event', event));
    this.workflowEngine.on('event', (event) => this.emit('event', event));
    this.knowledgeBase.on('entry:added', (entry) => {
      this.emit('event', {
        type: 'knowledge:indexed',
        payload: entry,
        timestamp: Date.now(),
      });
    });
  }

  start(metricsIntervalMs = 5000): void {
    this.clusterManager.startMetricsBroadcast(metricsIntervalMs);
    logger.info('Orchestrator started');
  }

  stop(): void {
    this.clusterManager.stopMetricsBroadcast();
    logger.info('Orchestrator stopped');
  }
}
