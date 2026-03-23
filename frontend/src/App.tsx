import React, { useState, useCallback, useEffect } from 'react';
import { WsEvent, SystemMetrics, ClusterConfig } from '@agcs/shared';
import { ApiCluster, ConnectionStatus } from './types';
import { api } from './utils/api';
import { useWebSocket } from './hooks/useWebSocket';
import { MetricsPanel } from './components/MetricsPanel';
import { ClusterCard } from './components/ClusterCard';
import { WorkflowPanel } from './components/WorkflowPanel';
import { KnowledgePanel } from './components/KnowledgePanel';

type ActivePanel = 'clusters' | 'workflows' | 'knowledge';

const DEFAULT_AGENT_CONFIG = {
  id: '',
  name: 'Text Agent',
  type: 'text' as const,
  priority: 'normal' as const,
  maxConcurrentTasks: 2,
  contextWindowSize: 4096,
  modelConfig: { provider: 'mock' as const, modelId: 'mock-model' },
};

export default function App() {
  const [clusters, setClusters] = useState<ApiCluster[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>('clusters');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [isCreatingCluster, setIsCreatingCluster] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [taskResults, setTaskResults] = useState<Array<{ id: string; status: string; output: string }>>([]);

  const handleWsEvent = useCallback((event: WsEvent) => {
    if (event.type === 'system:metrics') {
      setMetrics(event.payload as SystemMetrics);
    } else if (event.type === 'cluster:status') {
      // Update cluster state
      setClusters((prev) =>
        prev.map((c) => {
          const payload = event.payload as { id: string; status: string };
          if (c.state.id === payload.id) {
            return { ...c, state: { ...c.state, ...payload } };
          }
          return c;
        })
      );
    }
  }, []);

  const { connectionStatus } = useWebSocket(handleWsEvent);

  // Load clusters on mount
  useEffect(() => {
    api.getClusters()
      .then((data) => setClusters(data as ApiCluster[]))
      .catch(() => {/* handle gracefully */});
  }, []);

  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClusterName.trim()) return;
    setIsCreatingCluster(true);
    try {
      const config: Omit<ClusterConfig, 'id'> = {
        name: newClusterName,
        agentConfigs: [
          { ...DEFAULT_AGENT_CONFIG, id: `agent-text-${Date.now()}`, name: 'Text Agent' },
          { ...DEFAULT_AGENT_CONFIG, id: `agent-image-${Date.now()}`, name: 'Image Agent', type: 'image' },
        ],
        maxAgents: 10,
        loadBalancingStrategy: 'round-robin',
        autoScale: false,
        isolationLevel: 'none',
      };
      const result = await api.createCluster(config) as ApiCluster;
      setClusters((prev) => [...prev, result]);
      setNewClusterName('');
    } finally {
      setIsCreatingCluster(false);
    }
  };

  const handleDeleteCluster = async (clusterId: string) => {
    await api.deleteCluster(clusterId);
    setClusters((prev) => prev.filter((c) => c.config.id !== clusterId));
    if (selectedClusterId === clusterId) setSelectedClusterId(null);
  };

  const handleSubmitTask = async (
    clusterId: string,
    task: { type: string; payload: { prompt: string } }
  ) => {
    const result = await api.submitTask(clusterId, task) as {
      taskId: string;
      status: string;
      output?: { content: unknown };
    };
    const outputStr = result.output
      ? typeof result.output.content === 'string'
        ? result.output.content
        : JSON.stringify(result.output.content, null, 2)
      : '';
    setTaskResults((prev) => [
      { id: result.taskId, status: result.status, output: outputStr },
      ...prev.slice(0, 9),
    ]);
  };

  const navItems: Array<{ key: ActivePanel; label: string; icon: string }> = [
    { key: 'clusters', label: 'Clusters', icon: '⚡' },
    { key: 'workflows', label: 'Workflows', icon: '🔄' },
    { key: 'knowledge', label: 'Knowledge', icon: '📚' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0f1e',
        color: '#e2e8f0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          height: 56,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎨</span>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#f8fafc' }}>
            Agentic Creative Studio
          </span>
        </div>

        <nav style={{ display: 'flex', gap: 4, marginLeft: 24 }}>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActivePanel(item.key)}
              style={{
                background: activePanel === item.key ? '#1e293b' : 'transparent',
                border: 'none',
                color: activePanel === item.key ? '#f8fafc' : '#64748b',
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: activePanel === item.key ? 600 : 400,
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ConnectionBadge status={connectionStatus} />
        </div>
      </header>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar metrics */}
        <aside
          style={{
            width: 240,
            background: '#0f172a',
            borderRight: '1px solid #1e293b',
            padding: 16,
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          <MetricsPanel metrics={metrics} connectionStatus={connectionStatus} />
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {activePanel === 'clusters' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
                  Agent Clusters
                </h2>
                <form
                  onSubmit={handleCreateCluster}
                  style={{ display: 'flex', gap: 8 }}
                >
                  <input
                    type="text"
                    value={newClusterName}
                    onChange={(e) => setNewClusterName(e.target.value)}
                    placeholder="New cluster name..."
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#e2e8f0',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 13,
                      width: 200,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isCreatingCluster || !newClusterName.trim()}
                    style={{
                      background: '#6366f1',
                      border: 'none',
                      color: 'white',
                      borderRadius: 6,
                      padding: '6px 16px',
                      cursor: 'pointer',
                      fontSize: 13,
                      opacity: isCreatingCluster || !newClusterName.trim() ? 0.6 : 1,
                    }}
                  >
                    + Create
                  </button>
                </form>
              </div>

              {clusters.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 0',
                    color: '#64748b',
                  }}
                >
                  <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
                  <p>No clusters yet. Create your first agent cluster above.</p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                    gap: 16,
                  }}
                >
                  {clusters.map((cluster) => (
                    <ClusterCard
                      key={cluster.config.id}
                      config={cluster.config}
                      state={cluster.state}
                      onSubmitTask={handleSubmitTask}
                      onDelete={handleDeleteCluster}
                      isSelected={selectedClusterId === cluster.config.id}
                      onSelect={setSelectedClusterId}
                    />
                  ))}
                </div>
              )}

              {/* Task output log */}
              {taskResults.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ color: '#cbd5e1', fontSize: 15, marginBottom: 12 }}>
                    Recent Outputs
                  </h3>
                  {taskResults.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '10px 14px',
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: '#64748b' }}>{r.id.slice(0, 8)}...</span>
                        <span
                          style={{
                            color: r.status === 'completed' ? '#22c55e' : '#ef4444',
                            textTransform: 'capitalize',
                          }}
                        >
                          {r.status}
                        </span>
                      </div>
                      {r.output && (
                        <div
                          style={{
                            color: '#94a3b8',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            fontSize: 12,
                          }}
                        >
                          {r.output.slice(0, 300)}
                          {r.output.length > 300 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activePanel === 'workflows' && (
            <WorkflowPanel clusterIds={clusters.map((c) => c.config.id)} />
          )}

          {activePanel === 'knowledge' && <KnowledgePanel />}
        </main>
      </div>
    </div>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    connected: '#22c55e',
    connecting: '#f59e0b',
    disconnected: '#64748b',
    error: '#ef4444',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: colors[status],
          display: 'inline-block',
        }}
      />
      <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>
        {status}
      </span>
    </div>
  );
}
