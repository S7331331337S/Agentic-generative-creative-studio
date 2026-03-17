import React, { useState } from 'react';
import { ClusterConfig, ClusterState, AgentConfig, AgentState } from '@agcs/shared';
import { AgentCard } from '../AgentCard/AgentCard';

interface ClusterCardProps {
  config: ClusterConfig;
  state: ClusterState;
  agents?: Array<{ config: AgentConfig; state: AgentState }>;
  onSubmitTask?: (clusterId: string, task: { type: string; payload: { prompt: string } }) => void;
  onDelete?: (clusterId: string) => void;
  isSelected?: boolean;
  onSelect?: (clusterId: string) => void;
}

const statusColors: Record<ClusterState['status'], string> = {
  active: '#22c55e',
  idle: '#94a3b8',
  scaling: '#f59e0b',
  error: '#ef4444',
  stopped: '#64748b',
};

export function ClusterCard({
  config,
  state,
  agents = [],
  onSubmitTask,
  onDelete,
  isSelected = false,
  onSelect,
}: ClusterCardProps) {
  const [taskPrompt, setTaskPrompt] = useState('');
  const [taskType, setTaskType] = useState<'generate-text' | 'generate-image' | 'generate-audio'>('generate-text');
  const [showAgents, setShowAgents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim() || !onSubmitTask) return;
    setIsSubmitting(true);
    try {
      await onSubmitTask(config.id, { type: taskType, payload: { prompt: taskPrompt } });
      setTaskPrompt('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid={`cluster-card-${config.id}`}
      onClick={() => onSelect?.(config.id)}
      style={{
        background: '#1e293b',
        border: `2px solid ${isSelected ? '#6366f1' : '#334155'}`,
        borderRadius: 10,
        padding: 16,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#f8fafc' }}>{config.name}</h3>
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
          {config.description && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
              {config.description}
            </p>
          )}
        </div>
        {onDelete && (
          <button
            data-testid={`delete-cluster-${config.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(config.id);
            }}
            style={{
              background: 'transparent',
              border: '1px solid #ef4444',
              color: '#ef4444',
              borderRadius: 4,
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <StatBox label="Agents" value={`${state.activeAgents}/${state.totalAgents}`} />
        <StatBox label="Queued" value={state.queuedTasks} />
        <StatBox label="Done" value={state.completedTasks} />
        <StatBox label="Failed" value={state.failedTasks} />
      </div>

      {/* Task submission */}
      {onSubmitTask && (
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          style={{ marginBottom: 10 }}
        >
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <select
              value={taskType}
              onChange={(e) =>
                setTaskType(e.target.value as typeof taskType)
              }
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#cbd5e1',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 12,
              }}
            >
              <option value="generate-text">Text</option>
              <option value="generate-image">Image</option>
              <option value="generate-audio">Audio</option>
            </select>
            <input
              type="text"
              value={taskPrompt}
              onChange={(e) => setTaskPrompt(e.target.value)}
              placeholder="Enter creative prompt..."
              style={{
                flex: 1,
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#e2e8f0',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 12,
              }}
            />
            <button
              type="submit"
              disabled={isSubmitting || !taskPrompt.trim()}
              style={{
                background: '#6366f1',
                border: 'none',
                color: 'white',
                borderRadius: 4,
                padding: '4px 12px',
                cursor: isSubmitting || !taskPrompt.trim() ? 'not-allowed' : 'pointer',
                fontSize: 12,
                opacity: isSubmitting || !taskPrompt.trim() ? 0.6 : 1,
              }}
            >
              {isSubmitting ? '...' : 'Run'}
            </button>
          </div>
        </form>
      )}

      {/* Agents toggle */}
      {agents.length > 0 && (
        <div onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowAgents(!showAgents)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 12,
              padding: 0,
              marginBottom: 6,
            }}
          >
            {showAgents ? '▾' : '▸'} {agents.length} Agent{agents.length !== 1 ? 's' : ''}
          </button>
          {showAgents && (
            <div>
              {agents.map((a) => (
                <AgentCard key={a.config.id} config={a.config} state={a.state} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: '#0f172a',
        borderRadius: 6,
        padding: '6px 8px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
    </div>
  );
}
