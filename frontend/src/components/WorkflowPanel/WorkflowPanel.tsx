import React, { useState, useEffect } from 'react';
import { WorkflowDefinition, WorkflowRun } from '@agcs/shared';
import { api } from '../../utils/api';

interface WorkflowPanelProps {
  clusterIds: string[];
}

export function WorkflowPanel({ clusterIds }: WorkflowPanelProps) {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [name, setName] = useState('');
  const [selectedCluster, setSelectedCluster] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getWorkflows()
      .then((data) => setWorkflows(data as WorkflowDefinition[]))
      .catch(() => {/* ignore on load */});
  }, []);

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const workflow = await api.createWorkflow({
        name,
        steps: [
          {
            id: 'step-1',
            name: 'Generate Text',
            taskType: 'generate-text',
            agentType: 'text',
            payload: { prompt: `Creative output for: ${name}` },
          },
          {
            id: 'step-2',
            name: 'Generate Image',
            taskType: 'generate-image',
            agentType: 'image',
            payload: { prompt: `Visual for: ${name}` },
            dependencies: ['step-1'],
          },
        ],
      }) as WorkflowDefinition;
      setWorkflows((prev) => [...prev, workflow]);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRunWorkflow = async (workflowId: string) => {
    if (!selectedCluster) {
      setError('Please select a cluster first');
      return;
    }
    try {
      const run = await api.runWorkflow(workflowId, {
        clusterId: selectedCluster,
      }) as WorkflowRun;
      setRuns((prev) => [run, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run workflow');
    }
  };

  return (
    <div data-testid="workflow-panel">
      <h2 style={{ color: '#f8fafc', fontSize: 18, marginBottom: 16 }}>Workflows</h2>

      {/* Create workflow */}
      <form
        onSubmit={handleCreateWorkflow}
        style={{
          background: '#1e293b',
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <h4 style={{ color: '#cbd5e1', margin: '0 0 10px', fontSize: 14 }}>
          New Workflow
        </h4>
        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workflow name..."
            style={{
              flex: 1,
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#e2e8f0',
              borderRadius: 4,
              padding: '6px 10px',
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            disabled={isCreating || !name.trim()}
            style={{
              background: '#6366f1',
              border: 'none',
              color: 'white',
              borderRadius: 4,
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 13,
              opacity: isCreating || !name.trim() ? 0.6 : 1,
            }}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>

      {/* Cluster selector */}
      {clusterIds.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 4 }}>
            Run on cluster:
          </label>
          <select
            value={selectedCluster}
            onChange={(e) => setSelectedCluster(e.target.value)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#cbd5e1',
              borderRadius: 4,
              padding: '6px 10px',
              fontSize: 13,
              width: '100%',
            }}
          >
            <option value="">Select cluster...</option>
            {clusterIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
      )}

      {/* Workflow list */}
      <div>
        {workflows.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>No workflows yet. Create one above.</p>
        ) : (
          workflows.map((wf) => (
            <div
              key={wf.id}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>
                    {wf.name}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {wf.steps.length} step{wf.steps.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleRunWorkflow(wf.id)}
                  style={{
                    background: '#0d9488',
                    border: 'none',
                    color: 'white',
                    borderRadius: 4,
                    padding: '4px 12px',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  ▶ Run
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent runs */}
      {runs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 8 }}>Recent Runs</h4>
          {runs.slice(0, 5).map((run) => (
            <div
              key={run.id}
              style={{
                background: '#1e293b',
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>{run.id.slice(0, 8)}...</span>
                <span
                  style={{
                    color:
                      run.status === 'completed'
                        ? '#22c55e'
                        : run.status === 'failed'
                        ? '#ef4444'
                        : '#f59e0b',
                    textTransform: 'capitalize',
                  }}
                >
                  {run.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
