import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MetricsPanel } from '../../src/components/MetricsPanel/MetricsPanel';
import { SystemMetrics } from '@agcs/shared';

const mockMetrics: SystemMetrics = {
  timestamp: Date.now(),
  totalAgents: 4,
  activeAgents: 2,
  totalClusters: 2,
  activeClusters: 1,
  tasksQueued: 3,
  tasksCompleted: 15,
  tasksFailed: 1,
  knowledgeEntries: 8,
  systemMemoryMb: 512.5,
  systemCpuPercent: 34.2,
};

describe('MetricsPanel', () => {
  it('renders metrics panel', () => {
    render(<MetricsPanel metrics={mockMetrics} connectionStatus="connected" />);
    expect(screen.getByTestId('metrics-panel')).toBeInTheDocument();
  });

  it('shows system metrics values', () => {
    render(<MetricsPanel metrics={mockMetrics} connectionStatus="connected" />);
    expect(screen.getByText('4')).toBeInTheDocument(); // totalAgents
    expect(screen.getByText('15')).toBeInTheDocument(); // tasksCompleted
  });

  it('shows loading state when no metrics', () => {
    render(<MetricsPanel metrics={null} connectionStatus="connecting" />);
    expect(screen.getByText(/waiting for metrics/i)).toBeInTheDocument();
  });

  it('displays connection status', () => {
    render(<MetricsPanel metrics={null} connectionStatus="error" />);
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('shows status dot', () => {
    render(<MetricsPanel metrics={mockMetrics} connectionStatus="connected" />);
    expect(screen.getByTestId('status-dot')).toBeInTheDocument();
  });
});
