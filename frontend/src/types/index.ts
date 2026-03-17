import { SystemMetrics, ClusterState, ClusterConfig, AgentState, AgentConfig } from '@agcs/shared';

export interface ClusterWithAgents {
  config: ClusterConfig;
  state: ClusterState;
  agents: Array<{ config: AgentConfig; state: AgentState }>;
}

export interface ApiCluster {
  config: ClusterConfig;
  state: ClusterState;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface AppState {
  clusters: ApiCluster[];
  metrics: SystemMetrics | null;
  connectionStatus: ConnectionStatus;
  selectedClusterId: string | null;
  activePanel: 'clusters' | 'workflows' | 'knowledge' | 'metrics';
}
