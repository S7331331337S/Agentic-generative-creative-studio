const BASE_URL = '/api';

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }
  return data.data as T;
}

export const api = {
  // Clusters
  getClusters: () => request<Array<{ config: unknown; state: unknown }>>('/clusters'),
  getCluster: (id: string) => request<{ config: unknown; state: unknown; agents: unknown[] }>(`/clusters/${id}`),
  createCluster: (data: unknown) =>
    request('/clusters', { method: 'POST', body: JSON.stringify(data) }),
  deleteCluster: (id: string) =>
    request(`/clusters/${id}`, { method: 'DELETE' }),
  submitTask: (clusterId: string, task: unknown) =>
    request(`/clusters/${clusterId}/tasks`, { method: 'POST', body: JSON.stringify(task) }),

  // Workflows
  getWorkflows: () => request<unknown[]>('/workflows'),
  createWorkflow: (data: unknown) =>
    request('/workflows', { method: 'POST', body: JSON.stringify(data) }),
  runWorkflow: (id: string, data: unknown) =>
    request(`/workflows/${id}/run`, { method: 'POST', body: JSON.stringify(data) }),
  getWorkflowRuns: (id: string) => request<unknown[]>(`/workflows/${id}/runs`),

  // Knowledge
  getKnowledge: () => request<unknown[]>('/knowledge'),
  addKnowledge: (data: unknown) =>
    request('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  searchKnowledge: (query: string, limit = 10) =>
    request<unknown[]>(`/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  deleteKnowledge: (id: string) =>
    request(`/knowledge/${id}`, { method: 'DELETE' }),

  // Metrics
  getMetrics: () => request<unknown>('/metrics'),
  getHealth: () => request<unknown>('/metrics/health'),
};
