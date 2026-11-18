import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  Download,
  HeartHandshake,
  Lock,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { api, formatFriendlyDate, formatTimeAgo } from '../lib/api';
import type {
  MemoryRecord,
  NavSection,
  RoutineRecord,
  UserSettings,
  VaultClientData,
} from '../types/memory';
import { ConfirmDialog, MetadataLine, SafeImage } from './ui/CommonUI';

interface CaregiverSummary {
  userName: string;
  caregiverName: string;
  totalMemoriesShared: number;
  privateHiddenCount: number;
  routines: RoutineRecord[];
  missedOrOverdueRoutines: RoutineRecord[];
  needsReviewMemories: MemoryRecord[];
  visibleMemories: MemoryRecord[];
  auditLog: VaultClientData['auditLog'];
}

export function CaregiverView({
  vault,
  onVaultUpdate,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [pin, setPin] = useState('');
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem('kindred_caregiver_token')
  );
  const [summary, setSummary] = useState<CaregiverSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteDesc, setNoteDesc] = useState('');
  const [noteCategory, setNoteCategory] = useState<MemoryRecord['category']>('Appointments');

  const fetchSummary = async (activeToken: string) => {
    setLoading(true);
    try {
      const data = await api.getCaregiverSummary(activeToken);
      setSummary(data);
    } catch {
      sessionStorage.removeItem('kindred_caregiver_token');
      setToken(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSummary(token);
    }
  }, [token]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.verifyCaregiverPin(pin);
      sessionStorage.setItem('kindred_caregiver_token', res.token);
      setToken(res.token);
      setPin('');
      onToast('Caregiver dashboard unlocked.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleLock = () => {
    if (token) {
      api.logoutCaregiver(token).catch(() => {});
    }
    sessionStorage.removeItem('kindred_caregiver_token');
    setToken(null);
    setSummary(null);
  };

  const handleConfirmMemory = async (memoryId: string) => {
    if (!token) return;
    try {
      const res = await api.postCaregiverNote(token, { verifyMemoryId: memoryId });
      onVaultUpdate(res.vault);
      await fetchSummary(token);
      onToast('Memory verified as Caregiver-reported.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !noteTitle.trim() || !noteDesc.trim()) return;
    try {
      const res = await api.postCaregiverNote(token, {
        title: noteTitle,
        description: noteDesc,
        category: noteCategory,
      });
      onVaultUpdate(res.vault);
      await fetchSummary(token);
      setNoteTitle('');
      setNoteDesc('');
      onToast('Added Caregiver-reported note.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  if (!token || !summary) {
    return (
      <div className="max-w-md mx-auto py-12">
        <div className="bg-white rounded-2xl border border-[#E6E3F1] p-7 space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#EDEAF9] text-[#5B4DC4] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#29283A]">Caregiver Dashboard</h1>
            <p className="text-sm text-[#68667D] mt-1">
              Authorized family view for {vault.settings.caregiverName} ({vault.settings.caregiverRelation}). Enter your PIN to view missed routine alerts and family notes.
            </p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-3 text-left">
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1">
                Caregiver PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 4-digit PIN (demo: 2468)"
                className="w-full px-3.5 py-2.5 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl focus:outline-none focus:border-[#6D5FD1]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl transition-colors cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Unlock Caregiver View'}
            </button>
          </form>
          <p className="text-xs text-[#68667D]">
            Private entries classified as &ldquo;Private&rdquo; remain hidden unless explicitly shared in Privacy &amp; Security.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#29283A]">Caregiver Dashboard</h1>
          <p className="text-sm text-[#68667D] mt-0.5">
            Authorized family check-in for {summary.userName} · Viewing as {summary.caregiverName}.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLock}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#4A485E] bg-white border border-[#E6E3F1] hover:bg-[#F2F0F9] rounded-xl cursor-pointer shrink-0"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Lock caregiver session</span>
        </button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#E6E3F1] p-5">
          <p className="text-xs font-medium text-[#68667D]">Missed or overdue routines</p>
          <p className="text-2xl font-bold text-[#29283A] mt-1 tabular-nums">
            {summary.missedOrOverdueRoutines.length}
          </p>
          <p className="text-xs text-[#68667D] mt-1">
            Only routines with caregiver alerts enabled
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E6E3F1] p-5">
          <p className="text-xs font-medium text-[#68667D]">Needs family confirmation</p>
          <p className="text-2xl font-bold text-[#29283A] mt-1 tabular-nums">
            {summary.needsReviewMemories.length}
          </p>
          <p className="text-xs text-[#68667D] mt-1">Inferred or unverified notes</p>
        </div>
        <div className="bg-white rounded-2xl border border-[#E6E3F1] p-5">
          <p className="text-xs font-medium text-[#68667D]">Privacy boundary</p>
          <p className="text-2xl font-bold text-[#29283A] mt-1 tabular-nums">
            {summary.privateHiddenCount} hidden
          </p>
          <p className="text-xs text-[#68667D] mt-1">
            {summary.totalMemoriesShared} shared memories visible
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Missed Routine Alerts & Pending Verification */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white rounded-2xl border border-[#E6E3F1] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[#29283A] flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-[#6D5FD1]" />
              <span>Important routine status</span>
            </h2>
            {summary.missedOrOverdueRoutines.length === 0 ? (
              <p className="text-sm text-[#1E4D36] bg-[#DDF3E8]/55 p-3.5 rounded-xl">
                No missed or overdue alert routines right now.
              </p>
            ) : (
              <div className="space-y-2.5">
                {summary.missedOrOverdueRoutines.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-[#FBE6DC]/65 border border-[#E8C5B5] flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#29283A]">{r.title}</p>
                      <MetadataLine
                        items={[
                          r.displayTime,
                          r.status === 'skipped'
                            ? `Skipped (${r.skipReason || 'no reason'})`
                            : 'Past scheduled time',
                        ]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 divide-y divide-[#F0EEF7]">
              {summary.routines.map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="text-[#29283A] font-medium">
                    <span className="font-mono-tabular text-[#5B4DC4] mr-2">
                      {r.displayTime}
                    </span>
                    {r.title}
                  </span>
                  <span className="text-[#68667D] capitalize">{r.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-[#E6E3F1] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[#29283A]">
              Memories awaiting verification
            </h2>
            {summary.needsReviewMemories.length === 0 ? (
              <p className="text-sm text-[#68667D]">
                All shared memories are verified.
              </p>
            ) : (
              <div className="space-y-3">
                {summary.needsReviewMemories.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl bg-[#F8F7FC] border border-[#E6E3F1] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#29283A]">{m.title}</p>
                      <MetadataLine
                        items={[m.source, m.verificationStatus, `${m.confidenceScore}%`]}
                      />
                      <p className="text-xs text-[#4A485E] mt-1">{m.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConfirmMemory(m.id)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-[#1A7F54] hover:bg-[#156945] rounded-lg cursor-pointer shrink-0"
                    >
                      Verify accuracy
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Add Caregiver Note + Audit Log */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white rounded-2xl border border-[#E6E3F1] p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#29283A]">
              Add a caregiver-reported note
            </h2>
            <p className="text-xs text-[#68667D]">
              Notes added here are clearly labeled &ldquo;Caregiver-reported&rdquo; so {summary.userName} and the AI Companion always know the source.
            </p>
            <form onSubmit={handlePostNote} className="space-y-3">
              <input
                type="text"
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g., Grocery delivery arriving Thursday morning"
                className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
              />
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value as MemoryRecord['category'])}
                className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
              >
                <option value="Appointments">Appointments</option>
                <option value="People">People</option>
                <option value="Daily routines">Daily routines</option>
                <option value="Personal belongings">Personal belongings</option>
              </select>
              <textarea
                rows={3}
                required
                value={noteDesc}
                onChange={(e) => setNoteDesc(e.target.value)}
                placeholder="Clear details for Alex..."
                className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
              />
              <button
                type="submit"
                className="w-full py-2 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl cursor-pointer"
              >
                Save Caregiver Note
              </button>
            </form>
          </section>

          <section className="bg-white rounded-2xl border border-[#E6E3F1] p-5 space-y-3">
            <h2 className="text-base font-semibold text-[#29283A]">Access & audit log</h2>
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {summary.auditLog.map((entry) => (
                <div key={entry.id} className="text-xs border-b border-[#F0EEF7] pb-2">
                  <p className="font-medium text-[#29283A]">
                    {entry.actor} · {entry.action}
                  </p>
                  <p className="text-[#68667D] mt-0.5">
                    {entry.detail} · {formatTimeAgo(entry.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function NotificationsView({
  vault,
  onVaultUpdate,
  onNavigate,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onNavigate: (section: NavSection) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const handleMarkRead = async (id: string) => {
    try {
      const updated = await api.markNotificationRead(id);
      onVaultUpdate(updated);
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleMarkAll = async () => {
    try {
      const updated = await api.markAllNotificationsRead();
      onVaultUpdate(updated);
      onToast('All notifications marked read.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#29283A]">Notifications</h1>
          <p className="text-sm text-[#68667D] mt-0.5">
            Gentle reminders for upcoming routines, appointments, and family visits.
          </p>
        </div>
        <button
          type="button"
          onClick={handleMarkAll}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#4E3FB8] bg-[#EDEAF9] hover:bg-[#E1DCF7] rounded-xl cursor-pointer shrink-0"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Mark all read</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E6E3F1] divide-y divide-[#F0EEF7]">
        {vault.notifications.map((n) => (
          <div
            key={n.id}
            className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              n.read ? 'opacity-70' : 'bg-[#FAF9FE]'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="p-2 rounded-xl bg-[#EDEAF9] text-[#5B4DC4] mt-0.5 shrink-0">
                <Bell className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#29283A]">{n.title}</h3>
                <MetadataLine items={[n.category, n.time, n.read ? 'Read' : 'Unread']} />
                <p className="text-sm text-[#4A485E] mt-1">{n.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
              {n.actionTarget && (
                <button
                  type="button"
                  onClick={() => onNavigate(n.actionTarget as NavSection)}
                  className="px-3 py-1.5 text-xs font-medium text-[#29283A] bg-white border border-[#E6E3F1] hover:bg-[#F2F0F9] rounded-lg cursor-pointer"
                >
                  Open
                </button>
              )}
              {!n.read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className="px-3 py-1.5 text-xs font-medium text-[#5B4DC4] hover:bg-[#EDEAF9] rounded-lg cursor-pointer inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark read</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PrivacySecurityView({
  vault,
  onVaultUpdate,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const toggleSetting = async (key: keyof UserSettings, value: boolean) => {
    try {
      const updated = await api.updateSettings({ [key]: value });
      onVaultUpdate(updated);
      onToast('Privacy setting updated.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.updateCaregiverPin(currentPin, newPin);
      onVaultUpdate(res.vault);
      setCurrentPin('');
      setNewPin('');
      onToast('Caregiver PIN updated.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const updated = await api.importVault(parsed);
        onVaultUpdate(updated);
        onToast('Memory backup restored.');
      } catch (err) {
        onToast((err as Error).message || 'Invalid backup file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetVault = async () => {
    try {
      const fresh = await api.resetVault();
      onVaultUpdate(fresh);
      onToast('Vault restored to default sample data.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#29283A]">Privacy &amp; Security</h1>
        <p className="text-sm text-[#68667D] mt-0.5">
          Control local vault encryption, caregiver boundaries, conversation retention, and backups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-[#E6E3F1] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#29283A] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1A7F54]" />
            <span>Local-first data protection</span>
          </h2>

          {[
            {
              key: 'encryptVaultAtRest' as const,
              title: 'AES-256-GCM Vault Encryption at Rest',
              desc: 'Encrypts your local personal knowledge base on disk so raw records cannot be read outside Kindred.',
              checked: vault.settings.encryptVaultAtRest,
            },
            {
              key: 'retainConversations' as const,
              title: 'Retain AI Companion conversations',
              desc: 'Turn off for temporary conversations that clear automatically without saving chat transcripts.',
              checked: vault.settings.retainConversations,
            },
            {
              key: 'sharePrivateWithCaregiver' as const,
              title: 'Allow Caregiver access to Private entries',
              desc: 'Recommended OFF. When off, memories marked "Private" never appear in Caregiver Dashboard.',
              checked: vault.settings.sharePrivateWithCaregiver,
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-[#F8F7FC] border border-[#ECEAF5] cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium text-[#29283A]">{item.title}</p>
                <p className="text-xs text-[#68667D] mt-0.5">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => toggleSetting(item.key, e.target.checked)}
                className="w-4 h-4 mt-1 accent-[#6D5FD1] shrink-0"
              />
            </label>
          ))}
        </section>

        <section className="bg-white rounded-2xl border border-[#E6E3F1] p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[#29283A]">Update Caregiver PIN</h2>
            <p className="text-xs text-[#68667D] mt-0.5">
              Current default demo PIN is 2468. Change it anytime to keep caregiver access private.
            </p>
            <form onSubmit={handlePinChange} className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="password"
                required
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Current PIN"
                className="px-3 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
              />
              <input
                type="password"
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="New PIN (4+ digits)"
                className="px-3 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
              />
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl cursor-pointer"
              >
                Update PIN
              </button>
            </form>
          </div>

          <div className="pt-4 border-t border-[#E6E3F1] space-y-3">
            <h2 className="text-base font-semibold text-[#29283A]">Backup &amp; Portability</h2>
            <div className="flex flex-wrap gap-2.5">
              <a
                href="/api/vault/export"
                download="kindred-memory-backup.json"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#29283A] bg-[#F2F0F9] hover:bg-[#E6E3F1] rounded-xl"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON backup</span>
              </a>
              <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#4E3FB8] bg-[#EDEAF9] hover:bg-[#E1DCF7] rounded-xl cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Restore backup</span>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImport}
                />
              </label>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#C93B3B] bg-[#FBE6DC]/60 hover:bg-[#FBE6DC] rounded-xl cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset sample vault</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white rounded-2xl border border-[#E6E3F1] p-6">
        <h2 className="text-base font-semibold text-[#29283A] mb-3">Recent security &amp; access log</h2>
        <div className="divide-y divide-[#F0EEF7]">
          {vault.auditLog.slice(0, 8).map((entry) => (
            <div key={entry.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <div>
                <span className="font-semibold text-[#29283A]">{entry.actor}</span>
                <span className="text-[#68667D]"> — {entry.action}: {entry.detail}</span>
              </div>
              <span className="text-[#68667D] font-mono-tabular shrink-0">
                {formatFriendlyDate(entry.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={handleResetVault}
        title="Reset vault to sample memories?"
        message="This restores the original sample memories, people, and routines. Export a backup first if you want to keep your edits."
        confirmLabel="Reset Vault"
        destructive
      />
    </div>
  );
}

export function SettingsView({
  vault,
  onVaultUpdate,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [form, setForm] = useState<UserSettings>(vault.settings);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateSettings(form);
      onVaultUpdate(updated);
      onToast('Settings saved.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm({ ...form, avatarUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#29283A]">Settings</h1>
        <p className="text-sm text-[#68667D] mt-0.5">
          Personalize your profile, reading comfort, motion preferences, and reminder timing.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-[#E6E3F1] p-6 space-y-6"
      >
        <div className="flex items-center gap-4">
          <SafeImage
            src={form.avatarUrl}
            alt={form.userName}
            fallbackLabel={form.userName[0]}
            className="w-16 h-16 rounded-2xl object-cover border border-[#E6E3F1]"
          />
          <div>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#4E3FB8] bg-[#EDEAF9] hover:bg-[#E1DCF7] rounded-xl cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Change profile photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1">Your name</label>
            <input
              type="text"
              required
              value={form.userName}
              onChange={(e) => setForm({ ...form, userName: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1">Greeting style</label>
            <select
              value={form.greetingStyle}
              onChange={(e) =>
                setForm({ ...form, greetingStyle: e.target.value as 'warm' | 'concise' })
              }
              className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
            >
              <option value="warm">Warm &amp; reassuring</option>
              <option value="concise">Short &amp; simple</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1">
              Primary caregiver name
            </label>
            <input
              type="text"
              value={form.caregiverName}
              onChange={(e) => setForm({ ...form, caregiverName: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1">
              Caregiver relationship
            </label>
            <input
              type="text"
              value={form.caregiverRelation}
              onChange={(e) => setForm({ ...form, caregiverRelation: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E6E3F1]">
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1">Text readability</label>
            <select
              value={form.textScale}
              onChange={(e) =>
                setForm({
                  ...form,
                  textScale: e.target.value as UserSettings['textScale'],
                })
              }
              className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
            >
              <option value="standard">Standard comfortable size</option>
              <option value="comfortable">Larger easy-read text</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1">
              Reminder lead time (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={60}
              value={form.reminderLeadMinutes}
              onChange={(e) =>
                setForm({ ...form, reminderLeadMinutes: Number(e.target.value) || 15 })
              }
              className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl font-mono-tabular"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-[#29283A] cursor-pointer">
          <input
            type="checkbox"
            checked={form.reducedMotion}
            onChange={(e) => setForm({ ...form, reducedMotion: e.target.checked })}
            className="w-4 h-4 accent-[#6D5FD1]"
          />
          <span>Reduce interface animations and transitions</span>
        </label>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}
