export const getApiUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any)._env_?.VITE_API_URL) {
    return (window as any)._env_.VITE_API_URL;
  }
  const metaEnv = (import.meta as any).env;
  if (metaEnv?.VITE_API_URL) {
    return metaEnv.VITE_API_URL;
  }
  return 'http://localhost:5000';
};

const API_BASE = `${getApiUrl()}/api`;

function getAuthToken(): string | null {
  return localStorage.getItem('zaptaria_jwt_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('zaptaria_jwt_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('zaptaria_jwt_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {})
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    removeAuthToken();
    window.dispatchEvent(new Event('unauthorized'));
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: Request failed`);
  }

  return data as T;
}

export const api = {
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: { id: string; email: string; name?: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  getDashboard: () =>
    request<{
      activeTasks: number;
      waitingTasks: number;
      completedToday: number;
      humanAttention: number;
      globalEmergencyStop: boolean;
      keyPoolActiveCount: number;
      whatsappStatus: string;
    }>('/dashboard'),

  getWhatsAppStatus: () =>
    request<{
      status: string;
      qrCode?: string | null;
      sessionName: string;
      connectedAt?: string | null;
    }>('/whatsapp/status'),

  connectWhatsApp: () =>
    request<{ message: string }>('/whatsapp/connect', { method: 'POST' }),

  disconnectWhatsApp: () =>
    request<{ message: string }>('/whatsapp/disconnect', { method: 'POST' }),

  getContacts: () =>
    request<Array<{ id: string; whatsappId: string; phoneNumber: string; name?: string; pushName?: string }>>('/whatsapp/contacts'),

  getConversations: () =>
    request<Array<{
      id: string;
      whatsappChatId: string;
      autonomousMode: boolean;
      contact: { id: string; name?: string; phoneNumber: string; whatsappId: string };
      tasks: any[];
      messages: any[];
    }>>('/conversations'),

  getConversationMessages: (conversationId: string) =>
    request<Array<{
      id: string;
      senderType: string;
      body: string;
      timestamp: string;
      hasMedia?: boolean;
      mediaType?: string | null;
    }>>(`/conversations/${conversationId}/messages`),

  getTasks: () =>
    request<Array<{
      id: string;
      contactId: string;
      conversationId?: string | null;
      title: string;
      objective: string;
      successCriteria?: string;
      failureCriteria?: string;
      autonomyLevel: string;
      status: string;
      priority: string;
      maxMessages: number;
      messageCount: number;
      createdAt: string;
      contact: { id: string; name?: string; phoneNumber: string; whatsappId: string };
    }>>('/tasks'),

  createTask: (data: {
    contactId: string;
    title: string;
    objective: string;
    successCriteria?: string;
    failureCriteria?: string;
    autonomyLevel?: string;
    priority?: string;
    maxMessages?: number;
  }) =>
    request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  takeoverTask: (taskId: string) =>
    request<{ message: string }>(`/tasks/${taskId}/takeover`, { method: 'POST' }),

  getGeminiKeys: () =>
    request<Array<{
      id: string;
      name?: string;
      maskedKey: string;
      last4: string;
      status: string;
      requestCount: number;
      errorCount: number;
      createdAt: string;
    }>>('/gemini/keys'),

  addGeminiKey: (key: string, name?: string) =>
    request<any>('/gemini/keys', {
      method: 'POST',
      body: JSON.stringify({ key, name })
    }),

  addBulkGeminiKeys: (bulkText: string) =>
    request<{ submitted: number; added: number; duplicates: number; failed: number }>('/gemini/keys/bulk', {
      method: 'POST',
      body: JSON.stringify({ bulkText })
    }),

  uploadGeminiKeysFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ submitted: number; added: number; duplicates: number; failed: number }>('/gemini/keys/upload', {
      method: 'POST',
      body: formData
    });
  },

  setEmergencyStop: (enabled: boolean) =>
    request<{ enabled: boolean }>('/settings/emergency-stop', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }),

  getActivityLogs: () =>
    request<Array<{
      id: string;
      taskId?: string;
      action: string;
      decision: string;
      reason: string;
      createdAt: string;
      task?: { title: string };
    }>>('/activity')
};
