import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ClusterCard } from '../../src/components/ClusterCard/ClusterCard';
import { ClusterConfig, ClusterState } from '@agcs/shared';

const mockConfig: ClusterConfig = {
  id: 'cluster-1',
  name: 'Creative Cluster',
  description: 'A test cluster',
  agentConfigs: [
    {
      id: 'agent-1',
      name: 'Text Agent',
      type: 'text',
      priority: 'normal',
      maxConcurrentTasks: 1,
      contextWindowSize: 4096,
      modelConfig: { provider: 'mock', modelId: 'mock' },
    },
  ],
  maxAgents: 5,
  loadBalancingStrategy: 'round-robin',
  autoScale: false,
  isolationLevel: 'none',
};

const mockState: ClusterState = {
  id: 'cluster-1',
  status: 'active',
  activeAgents: 1,
  totalAgents: 1,
  queuedTasks: 0,
  completedTasks: 5,
  failedTasks: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('ClusterCard', () => {
  it('renders cluster name', () => {
    render(<ClusterCard config={mockConfig} state={mockState} />);
    expect(screen.getByText('Creative Cluster')).toBeInTheDocument();
  });

  it('renders cluster description', () => {
    render(<ClusterCard config={mockConfig} state={mockState} />);
    expect(screen.getByText('A test cluster')).toBeInTheDocument();
  });

  it('shows cluster status', () => {
    render(<ClusterCard config={mockConfig} state={mockState} />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows cluster stats', () => {
    render(<ClusterCard config={mockConfig} state={mockState} />);
    expect(screen.getByText('1/1')).toBeInTheDocument(); // agents
    expect(screen.getByText('5')).toBeInTheDocument(); // completedTasks
  });

  it('calls onDelete when remove button is clicked', () => {
    const onDelete = jest.fn();
    render(
      <ClusterCard config={mockConfig} state={mockState} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByTestId('delete-cluster-cluster-1'));
    expect(onDelete).toHaveBeenCalledWith('cluster-1');
  });

  it('calls onSelect when card is clicked', () => {
    const onSelect = jest.fn();
    render(
      <ClusterCard config={mockConfig} state={mockState} onSelect={onSelect} />
    );
    fireEvent.click(screen.getByTestId('cluster-card-cluster-1'));
    expect(onSelect).toHaveBeenCalledWith('cluster-1');
  });

  it('has selected border when isSelected is true', () => {
    render(
      <ClusterCard config={mockConfig} state={mockState} isSelected={true} />
    );
    const card = screen.getByTestId('cluster-card-cluster-1');
    // jsdom keeps inline styles as hex; either format is valid
    expect(card.style.borderColor).toMatch(/6366f1|rgb\(99, 102, 241\)/);
  });

  it('shows task submission form when onSubmitTask is provided', () => {
    render(
      <ClusterCard
        config={mockConfig}
        state={mockState}
        onSubmitTask={jest.fn()}
      />
    );
    expect(screen.getByPlaceholderText('Enter creative prompt...')).toBeInTheDocument();
  });
});
