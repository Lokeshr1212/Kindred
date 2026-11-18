import type {
  BelongingRecord,
  ChatMessage,
  MemoryCapsule,
  MemoryRecord,
  PersonRecord,
  PlaceRecord,
  RoutineRecord,
  UserSettings,
  VaultClientData,
} from '../types/memory';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  getVault: () => requestJson<VaultClientData>('/api/vault'),

  updateSettings: (patch: Partial<UserSettings>) =>
    requestJson<VaultClientData>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  checkDuplicates: (title: string, description: string) =>
    requestJson<{ duplicates: MemoryRecord[] }>('/api/memories/check-duplicates', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),

  createMemory: (payload: Partial<MemoryRecord>) =>
    requestJson<{ memory: MemoryRecord; vault: VaultClientData }>('/api/memories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMemory: (id: string, patch: Partial<MemoryRecord>) =>
    requestJson<VaultClientData>(`/api/memories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteMemory: (id: string) =>
    requestJson<VaultClientData>(`/api/memories/${id}`, {
      method: 'DELETE',
    }),

  createPerson: (payload: Partial<PersonRecord>) =>
    requestJson<{ person: PersonRecord; vault: VaultClientData }>('/api/people', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updatePerson: (id: string, patch: Partial<PersonRecord>) =>
    requestJson<VaultClientData>(`/api/people/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deletePerson: (id: string) =>
    requestJson<VaultClientData>(`/api/people/${id}`, {
      method: 'DELETE',
    }),

  createPlace: (payload: Partial<PlaceRecord>) =>
    requestJson<{ place: PlaceRecord; vault: VaultClientData }>('/api/places', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deletePlace: (id: string) =>
    requestJson<VaultClientData>(`/api/places/${id}`, {
      method: 'DELETE',
    }),

  createRoutine: (payload: Partial<RoutineRecord>) =>
    requestJson<{ routine: RoutineRecord; vault: VaultClientData }>('/api/routines', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateRoutine: (id: string, patch: Partial<RoutineRecord>) =>
    requestJson<VaultClientData>(`/api/routines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteRoutine: (id: string) =>
    requestJson<VaultClientData>(`/api/routines/${id}`, {
      method: 'DELETE',
    }),

  createBelonging: (payload: Partial<BelongingRecord>) =>
    requestJson<{ item: BelongingRecord; vault: VaultClientData }>('/api/belongings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateBelonging: (id: string, patch: Partial<BelongingRecord>) =>
    requestJson<VaultClientData>(`/api/belongings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteBelonging: (id: string) =>
    requestJson<VaultClientData>(`/api/belongings/${id}`, {
      method: 'DELETE',
    }),

  createCapsule: (payload: Partial<MemoryCapsule>) =>
    requestJson<{ capsule: MemoryCapsule; vault: VaultClientData }>('/api/capsules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCapsule: (id: string, patch: Partial<MemoryCapsule>) =>
    requestJson<VaultClientData>(`/api/capsules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  markNotificationRead: (id: string) =>
    requestJson<VaultClientData>(`/api/notifications/${id}/read`, {
      method: 'POST',
    }),

  markAllNotificationsRead: () =>
    requestJson<VaultClientData>('/api/notifications/mark-all-read', {
      method: 'POST',
    }),

  askCompanion: (question: string, threadId?: string) =>
    requestJson<{
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      vault: VaultClientData;
    }>('/api/companion/ask', {
      method: 'POST',
      body: JSON.stringify({ question, threadId }),
    }),

  confirmSaveSuggestedMemory: (payload: {
    threadId?: string;
    messageId?: string;
    title: string;
    category: MemoryRecord['category'];
    description: string;
  }) =>
    requestJson<{ memory: MemoryRecord; vault: VaultClientData }>('/api/companion/confirm-save', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  newConversation: () =>
    requestJson<{ threadId: string; vault: VaultClientData }>('/api/conversations/new', {
      method: 'POST',
    }),

  deleteConversation: (id: string) =>
    requestJson<VaultClientData>(`/api/conversations/${id}`, {
      method: 'DELETE',
    }),

  clearConversations: () =>
    requestJson<VaultClientData>('/api/conversations/clear', {
      method: 'POST',
    }),

  verifyCaregiverPin: (pin: string) =>
    requestJson<{ valid: boolean; token: string; expiresAt: number }>('/api/caregiver/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  logoutCaregiver: (token: string) =>
    requestJson<{ success: boolean }>('/api/caregiver/logout', {
      method: 'POST',
      headers: { 'x-caregiver-token': token },
    }),

  updateCaregiverPin: (currentPin: string, newPin: string) =>
    requestJson<{ success: boolean; vault: VaultClientData }>('/api/caregiver/update-pin', {
      method: 'POST',
      body: JSON.stringify({ currentPin, newPin }),
    }),

  getCaregiverSummary: (token: string) =>
    requestJson<{
      userName: string;
      caregiverName: string;
      totalMemoriesShared: number;
      privateHiddenCount: number;
      routines: RoutineRecord[];
      missedOrOverdueRoutines: RoutineRecord[];
      needsReviewMemories: MemoryRecord[];
      visibleMemories: MemoryRecord[];
      visibleBelongings: BelongingRecord[];
      people: PersonRecord[];
      auditLog: VaultClientData['auditLog'];
      weeklyHistory: VaultClientData['weeklyHistory'];
    }>('/api/caregiver/summary', {
      headers: { 'x-caregiver-token': token },
    }),

  postCaregiverNote: (
    token: string,
    payload: {
      title?: string;
      description?: string;
      category?: MemoryRecord['category'];
      verifyMemoryId?: string;
    }
  ) =>
    requestJson<{ summary: unknown; vault: VaultClientData }>('/api/caregiver/note', {
      method: 'POST',
      headers: { 'x-caregiver-token': token },
      body: JSON.stringify(payload),
    }),

  importVault: (snapshot: VaultClientData) =>
    requestJson<VaultClientData>('/api/vault/import', {
      method: 'POST',
      body: JSON.stringify(snapshot),
    }),

  resetVault: () =>
    requestJson<VaultClientData>('/api/vault/reset', {
      method: 'POST',
    }),
};

export function formatFriendlyDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimeAgo(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return formatFriendlyDate(iso);
}
