// Agent Types
export type AgentType = 'text' | 'image' | 'audio' | 'multimodal';
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'completed';
export type AgentPriority = 'low' | 'normal' | 'high' | 'critical';

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  priority: AgentPriority;
  maxConcurrentTasks: number;
  contextWindowSize: number;
  modelConfig: ModelConfig;
  metadata?: Record<string, unknown>;
}

export interface AgentState {
  id: string;
  status: AgentStatus;
  currentTask?: TaskDefinition;
  completedTasks: number;
  errorCount: number;
  lastHeartbeat: number;
  resourceUsage: ResourceUsage;
}

// Cluster Types
export type ClusterStatus = 'active' | 'idle' | 'scaling' | 'error' | 'stopped';

export interface ClusterConfig {
  id: string;
  name: string;
  description?: string;
  agentConfigs: AgentConfig[];
  maxAgents: number;
  loadBalancingStrategy: LoadBalancingStrategy;
  autoScale: boolean;
  isolationLevel: IsolationLevel;
}

export interface ClusterState {
  id: string;
  status: ClusterStatus;
  activeAgents: number;
  totalAgents: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  createdAt: number;
  updatedAt: number;
}

export type LoadBalancingStrategy = 'round-robin' | 'least-loaded' | 'priority-based' | 'capability-based';
export type IsolationLevel = 'none' | 'process' | 'container';

// Task and Workflow Types
export type TaskType = 'generate-text' | 'generate-image' | 'generate-audio' | 'analyze' | 'transform' | 'compose';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskDefinition {
  id: string;
  type: TaskType;
  payload: TaskPayload;
  priority: AgentPriority;
  clusterId?: string;
  agentId?: string;
  workflowId?: string;
  stepIndex?: number;
  contextIds?: string[];
  dependencies?: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface TaskPayload {
  prompt?: string;
  inputData?: unknown;
  outputFormat?: string;
  constraints?: Record<string, unknown>;
  style?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  output?: TaskOutput;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  agentId?: string;
  metrics?: TaskMetrics;
}

export interface TaskOutput {
  type: 'text' | 'image' | 'audio' | 'json' | 'binary';
  content: string | Buffer | Record<string, unknown>;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskMetrics {
  durationMs: number;
  tokensUsed?: number;
  modelCalls: number;
  contextRetrievals: number;
}

// Workflow Types
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'completed' | 'failed';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  triggers?: WorkflowTrigger[];
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  taskType: TaskType;
  agentType: AgentType;
  payload: TaskPayload;
  dependencies?: string[];
  condition?: string;
  onError?: 'fail' | 'skip' | 'retry';
  maxRetries?: number;
}

export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'event';
  config: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  stepResults: Record<string, TaskResult>;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

// Knowledge Base Types
export type KnowledgeEntryType = 'document' | 'dataset' | 'model-output' | 'context-snapshot';

export interface KnowledgeEntry {
  id: string;
  type: KnowledgeEntryType;
  title: string;
  content: string;
  embedding?: number[];
  tags: string[];
  sourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ContextSnapshot {
  id: string;
  agentId?: string;
  clusterId?: string;
  workflowRunId?: string;
  entries: string[];
  createdAt: number;
}

export interface SearchQuery {
  query: string;
  filters?: {
    types?: KnowledgeEntryType[];
    tags?: string[];
    dateRange?: { from: number; to: number };
  };
  limit?: number;
  includeEmbeddings?: boolean;
}

export interface SearchResult {
  entry: KnowledgeEntry;
  score: number;
}

// Model Configuration
export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'huggingface' | 'local' | 'mock';
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  parameters?: Record<string, unknown>;
}

// Resource Types
export interface ResourceUsage {
  cpuPercent: number;
  memoryMb: number;
  activeConnections: number;
}

export interface SystemMetrics {
  timestamp: number;
  totalAgents: number;
  activeAgents: number;
  totalClusters: number;
  activeClusters: number;
  tasksQueued: number;
  tasksCompleted: number;
  tasksFailed: number;
  knowledgeEntries: number;
  systemMemoryMb: number;
  systemCpuPercent: number;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// WebSocket Event Types
export type WsEventType =
  | 'agent:status'
  | 'agent:output'
  | 'agent:error'
  | 'cluster:status'
  | 'cluster:scaled'
  | 'task:queued'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'workflow:started'
  | 'workflow:step-completed'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'system:metrics'
  | 'knowledge:indexed';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  payload: T;
  timestamp: number;
}
