import { SystemMetrics } from '@agcs/shared';
import { ConnectionStatus } from '../../types';

interface MetricsPanelProps {
  metrics: SystemMetrics | null;
  connectionStatus: ConnectionStatus;
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    connected: '#22c55e',
    connecting: '#f59e0b',
    disconnected: '#94a3b8',
    error: '#ef4444',
  };
  return (
    <span
      data-testid="status-dot"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: colors[status],
        marginRight: 6,
      }}
    />
  );
}

function MetricItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ color: '#94a3b8', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
    </div>
  );
}

export function MetricsPanel({ metrics, connectionStatus }: MetricsPanelProps) {
  return (
    <div
      data-testid="metrics-panel"
      style={{
        background: '#1e293b',
        borderRadius: 8,
        padding: '16px',
        minWidth: 220,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <StatusDot status={connectionStatus} />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
          System Metrics
        </h3>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: '#94a3b8',
            textTransform: 'capitalize',
          }}
        >
          {connectionStatus}
        </span>
      </div>

      {metrics ? (
        <div>
          <MetricItem label="Total Clusters" value={metrics.totalClusters} />
          <MetricItem label="Active Clusters" value={metrics.activeClusters} />
          <MetricItem label="Total Agents" value={metrics.totalAgents} />
          <MetricItem label="Active Agents" value={metrics.activeAgents} />
          <MetricItem label="Tasks Queued" value={metrics.tasksQueued} />
          <MetricItem label="Tasks Completed" value={metrics.tasksCompleted} />
          <MetricItem label="Tasks Failed" value={metrics.tasksFailed} />
          <MetricItem label="Knowledge Entries" value={metrics.knowledgeEntries} />
          <MetricItem
            label="Memory (MB)"
            value={metrics.systemMemoryMb.toFixed(0)}
          />
          <MetricItem
            label="CPU (%)"
            value={metrics.systemCpuPercent.toFixed(1)}
          />
        </div>
      ) : (
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
          Waiting for metrics...
        </p>
      )}
    </div>
  );
}
