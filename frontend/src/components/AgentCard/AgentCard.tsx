import { AgentConfig, AgentState, AgentStatus } from '@agcs/shared';

interface AgentCardProps {
  config: AgentConfig;
  state: AgentState;
}

const statusColors: Record<AgentStatus, string> = {
  idle: '#22c55e',
  running: '#3b82f6',
  paused: '#f59e0b',
  error: '#ef4444',
  completed: '#a855f7',
};

const agentTypeIcons: Record<AgentConfig['type'], string> = {
  text: '📝',
  image: '🖼️',
  audio: '🎵',
  multimodal: '🎨',
};

export function AgentCard({ config, state }: AgentCardProps) {
  return (
    <div
      data-testid={`agent-card-${config.id}`}
      style={{
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{agentTypeIcons[config.type]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#f1f5f9',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {config.name}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {config.type} · {config.modelConfig.modelId}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: statusColors[state.status],
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>
            {state.status}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
          marginTop: 8,
        }}
      >
        <Stat label="Done" value={state.completedTasks} />
        <Stat label="Errors" value={state.errorCount} />
        <Stat label="CPU%" value={`${state.resourceUsage.cpuPercent.toFixed(0)}%`} />
      </div>

      {state.currentTask && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: '#64748b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Task: {state.currentTask.id}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
    </div>
  );
}
