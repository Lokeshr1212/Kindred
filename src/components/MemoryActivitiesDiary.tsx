import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Clock,
  Expand,
  Heart,
  Link2,
  MapPin,
  Moon,
  NotebookPen,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { api, formatFriendlyDate } from '../lib/api';
import type { MemoryRecord, VaultClientData } from '../types/memory';
import { ConfirmDialog, Modal, SafeImage } from './ui/CommonUI';

interface MemoryActivitiesDiaryProps {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export type ActivityDiaryCategory =
  | 'Daily Activities'
  | 'Family Time'
  | 'Social Activities'
  | 'Learning'
  | 'Exercise and Wellness'
  | 'Special Occasions'
  | 'Travel and Outings'
  | 'Personal Achievements';

const ACTIVITY_CATEGORIES: ActivityDiaryCategory[] = [
  'Daily Activities',
  'Family Time',
  'Social Activities',
  'Learning',
  'Exercise and Wellness',
  'Special Occasions',
  'Travel and Outings',
  'Personal Achievements',
];

type DateRangeFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

function getTodayIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrentTimeHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function extractActivityCategory(memory: MemoryRecord): ActivityDiaryCategory {
  const catTag = memory.tags.find((t) => t.startsWith('diary-cat:'));
  if (catTag) {
    const label = catTag.replace('diary-cat:', '') as ActivityDiaryCategory;
    if (ACTIVITY_CATEGORIES.includes(label)) return label;
  }

  const text = `${memory.title} ${memory.description} ${memory.tags.join(' ')}`.toLowerCase();
  if (/\b(travel|palace|trip|outing|park|walk|museum|picnic)\b/.test(text)) {
    return /\b(walk|exercise|yoga|health|doctor|checkup|clinic)\b/.test(text) && !/\bpalace|trip\b/.test(text)
      ? 'Exercise and Wellness'
      : 'Travel and Outings';
  }
  if (/\b(doctor|clinic|checkup|wellness|exercise|walk|yoga|stretch|medication)\b/.test(text)) {
    return 'Exercise and Wellness';
  }
  if (/\b(anniversary|birthday|celebration|festival|occasion|wedding)\b/.test(text)) {
    return 'Special Occasions';
  }
  if (/\b(learn|book|read|sketch|watercolor|puzzle|music|class|garden project|herb)\b/.test(text)) {
    return /\b(project|finished|completed|built|achieved|milestone)\b/.test(text)
      ? 'Personal Achievements'
      : 'Learning';
  }
  if (/\b(family|dinner|visit|visiting|son|daughter|rahul|maya|tea)\b/.test(text) || memory.category === 'Family memories' || memory.category === 'People') {
    return 'Family Time';
  }
  if (/\b(neighbor|community|friend|club|coffee|social)\b/.test(text)) {
    return 'Social Activities';
  }
  if (memory.category === 'Daily routines') {
    return 'Daily Activities';
  }
  return 'Daily Activities';
}

function extractEntryDate(memory: MemoryRecord): string {
  if (memory.eventDate && /^\d{4}-\d{2}-\d{2}/.test(memory.eventDate)) {
    return memory.eventDate.slice(0, 10);
  }
  return memory.createdAt.slice(0, 10);
}

function extractEntryTimeDisplay(memory: MemoryRecord): string {
  const timeTag = memory.tags.find((t) => t.startsWith('time:'));
  const raw = timeTag ? timeTag.replace('time:', '') : '';
  if (raw && /^\d{2}:\d{2}$/.test(raw)) {
    const [hStr, mStr] = raw.split(':');
    const h = Number(hStr);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hr12 = h % 12 || 12;
    return `${hr12}:${mStr} ${suffix}`;
  }
  const d = new Date(memory.createdAt);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return 'Journal Entry';
}

function extractTimeInputValue(memory: MemoryRecord): string {
  const timeTag = memory.tags.find((t) => t.startsWith('time:'));
  if (timeTag) {
    const val = timeTag.replace('time:', '');
    if (/^\d{2}:\d{2}$/.test(val)) return val;
  }
  const d = new Date(memory.createdAt);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return '10:00';
}

function isActivityDiaryMemory(memory: MemoryRecord): boolean {
  if (memory.category === 'Activities') return true;
  if (memory.tags.some((t) => t === 'activity' || t === 'reflection' || t === 'diary')) return true;
  if (memory.category === 'Personal belongings' || memory.category === 'Preferences') return false;
  return true;
}

export function MemoryActivitiesDiary({
  vault,
  onVaultUpdate,
  onToast,
}: MemoryActivitiesDiaryProps) {
  const [diaryTone, setDiaryTone] = useState<'daylight' | 'evening'>('daylight');
  const [liveNow, setLiveNow] = useState(() => new Date());

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ActivityDiaryCategory>('All');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [customDate, setCustomDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Add / Edit activity modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MemoryRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ActivityDiaryCategory>('Daily Activities');
  const [formDate, setFormDate] = useState(getTodayIsoDate());
  const [formTime, setFormTime] = useState(getCurrentTimeHHMM());
  const [formDescription, setFormDescription] = useState('');
  const [formPeople, setFormPeople] = useState('');
  const [formPlaces, setFormPlaces] = useState('');
  const [formLinkedMemoryId, setFormLinkedMemoryId] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MemoryRecord | null>(null);

  // Gentle daily reflection prompt drawer inside diary
  const [promptIdx, setPromptIdx] = useState(0);
  const [quickReflection, setQuickReflection] = useState('');
  const [savingQuickReflection, setSavingQuickReflection] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const prefersReducedMotion = useMemo(() => {
    if (vault.settings.reducedMotion) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, [vault.settings.reducedMotion]);

  const activityEntries = useMemo(() => {
    const entries = vault.memories.filter(isActivityDiaryMemory);
    return entries.sort((a, b) => {
      const da = `${extractEntryDate(a)}T${extractTimeInputValue(a)}`;
      const db = `${extractEntryDate(b)}T${extractTimeInputValue(b)}`;
      return sortOrder === 'newest' ? db.localeCompare(da) : da.localeCompare(db);
    });
  }, [vault.memories, sortOrder]);

  const categoryCounts = useMemo(() => {
    const counts: Record<'All' | ActivityDiaryCategory, number> = {
      All: activityEntries.length,
      'Daily Activities': 0,
      'Family Time': 0,
      'Social Activities': 0,
      Learning: 0,
      'Exercise and Wellness': 0,
      'Special Occasions': 0,
      'Travel and Outings': 0,
      'Personal Achievements': 0,
    };
    activityEntries.forEach((m) => {
      const cat = extractActivityCategory(m);
      counts[cat] += 1;
    });
    return counts;
  }, [activityEntries]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const todayIso = getTodayIsoDate();
    const nowMs = Date.now();

    return activityEntries.filter((entry) => {
      if (selectedCategory !== 'All' && extractActivityCategory(entry) !== selectedCategory) {
        return false;
      }

      const entryDate = extractEntryDate(entry);
      if (dateRange === 'today' && entryDate !== todayIso) return false;
      if (dateRange === 'week') {
        const diffDays = (nowMs - new Date(entryDate).getTime()) / 86400000;
        if (diffDays > 7 || diffDays < -1) return false;
      }
      if (dateRange === 'month') {
        if (entryDate.slice(0, 7) !== todayIso.slice(0, 7)) return false;
      }
      if (dateRange === 'custom' && customDate && entryDate !== customDate) return false;

      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        extractActivityCategory(entry).toLowerCase().includes(q) ||
        entry.associatedPeople.some((p) => p.toLowerCase().includes(q)) ||
        entry.associatedLocations.some((l) => l.toLowerCase().includes(q))
      );
    });
  }, [activityEntries, search, selectedCategory, dateRange, customDate]);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedEntryId(null);
      return;
    }
    if (!selectedEntryId || !filteredEntries.some((e) => e.id === selectedEntryId)) {
      setSelectedEntryId(filteredEntries[0].id);
    }
  }, [filteredEntries, selectedEntryId]);

  const activeIdx = useMemo(
    () => (selectedEntryId ? filteredEntries.findIndex((e) => e.id === selectedEntryId) : -1),
    [filteredEntries, selectedEntryId]
  );

  const activeEntry = activeIdx >= 0 ? filteredEntries[activeIdx] : null;

  const stepEntry = useCallback(
    (delta: 1 | -1) => {
      if (filteredEntries.length <= 1 || activeIdx < 0) return;
      const nextIdx = (activeIdx + delta + filteredEntries.length) % filteredEntries.length;
      setSelectedEntryId(filteredEntries[nextIdx].id);
    },
    [filteredEntries, activeIdx]
  );

  useEffect(() => {
    if (formOpen || detailModalOpen || deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepEntry(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepEntry(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen, detailModalOpen, deleteTarget, stepEntry]);

  const prompts = useMemo(() => {
    const firstPlace = vault.places[0]?.name || 'a favorite quiet spot';
    const firstPerson = vault.people[0]?.name || 'someone close to you';
    return [
      `What small moment brought comfort or a smile when visiting ${firstPlace}?`,
      `What did you and ${firstPerson} talk about or enjoy together recently?`,
      'What activity today helped you feel grounded, rested, or proud?',
    ];
  }, [vault.places, vault.people]);

  const openAddForm = () => {
    setEditingEntry(null);
    setFormTitle('');
    setFormCategory('Daily Activities');
    setFormDate(getTodayIsoDate());
    setFormTime(getCurrentTimeHHMM());
    setFormDescription('');
    setFormPeople('');
    setFormPlaces('');
    setFormLinkedMemoryId('');
    setFormImageUrl('');
    setFormOpen(true);
  };

  const openEditForm = (entry: MemoryRecord) => {
    setEditingEntry(entry);
    setFormTitle(entry.title);
    setFormCategory(extractActivityCategory(entry));
    setFormDate(extractEntryDate(entry));
    setFormTime(extractTimeInputValue(entry));
    setFormDescription(entry.description);
    setFormPeople(entry.associatedPeople.join(', '));
    setFormPlaces(entry.associatedLocations.join(', '));
    setFormLinkedMemoryId(entry.linkedMemoryIds[0] || '');
    setFormImageUrl(entry.imageUrl || '');
    setFormOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setFormImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) return;
    setSaving(true);
    const peopleList = formPeople
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const placesList = formPlaces
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const linkedIds = formLinkedMemoryId ? [formLinkedMemoryId] : [];

    try {
      if (editingEntry) {
        const preservedTags = editingEntry.tags.filter(
          (t) => !t.startsWith('diary-cat:') && !t.startsWith('time:')
        );
        const nextTags = Array.from(
          new Set([
            ...preservedTags,
            'activity',
            `diary-cat:${formCategory}`,
            ...(formTime ? [`time:${formTime}`] : []),
          ])
        );
        const updated = await api.updateMemory(editingEntry.id, {
          title: formTitle.trim(),
          description: formDescription.trim(),
          eventDate: formDate || getTodayIsoDate(),
          associatedPeople: peopleList,
          associatedLocations: placesList,
          linkedMemoryIds: linkedIds,
          imageUrl: formImageUrl || undefined,
          tags: nextTags,
        });
        onVaultUpdate(updated);
        onToast(`Updated "${formTitle.trim()}" in your activity diary.`);
      } else {
        const res = await api.createMemory({
          title: formTitle.trim(),
          category: 'Activities',
          description: formDescription.trim(),
          eventDate: formDate || getTodayIsoDate(),
          associatedPeople: peopleList,
          associatedLocations: placesList,
          linkedMemoryIds: linkedIds,
          imageUrl: formImageUrl || undefined,
          privacyLevel: 'Family-shared',
          tags: [
            'activity',
            `diary-cat:${formCategory}`,
            ...(formTime ? [`time:${formTime}`] : []),
          ],
          evidenceNote: 'Recorded in My Memory Activities personal diary',
        });
        onVaultUpdate(res.vault);
        setSelectedEntryId(res.memory.id);
        onToast(`Saved "${res.memory.title}" to your diary.`);
      }
      setFormOpen(false);
      setEditingEntry(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuickReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReflection.trim()) return;
    setSavingQuickReflection(true);
    try {
      const promptText = prompts[promptIdx];
      const res = await api.createMemory({
        title: `Journal note: ${promptText.slice(0, 44)}`,
        category: 'Activities',
        description: quickReflection.trim(),
        eventDate: getTodayIsoDate(),
        privacyLevel: 'Family-shared',
        tags: [
          'activity',
          'reflection',
          'diary-cat:Daily Activities',
          `time:${getCurrentTimeHHMM()}`,
        ],
        evidenceNote: 'Saved from My Memory Activities daily reflection',
      });
      onVaultUpdate(res.vault);
      setQuickReflection('');
      setSelectedEntryId(res.memory.id);
      onToast('Saved your reflection to your activity diary.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSavingQuickReflection(false);
    }
  };

  const handleDeleteEntry = async (entry: MemoryRecord) => {
    try {
      const updated = await api.deleteMemory(entry.id);
      onVaultUpdate(updated);
      setDetailModalOpen(false);
      onToast(`Removed "${entry.title}" from your activity diary.`);
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const getLinkedMemories = (entry: MemoryRecord): MemoryRecord[] => {
    const byId = vault.memories.filter(
      (m) => m.id !== entry.id && entry.linkedMemoryIds.includes(m.id)
    );
    if (byId.length > 0) return byId;
    // Fallback: match by shared person or place if explicitly associated
    return vault.memories.filter(
      (m) =>
        m.id !== entry.id &&
        (entry.associatedPeople.some((p) => m.associatedPeople.includes(p)) ||
          entry.associatedLocations.some((l) => m.associatedLocations.includes(l)))
    ).slice(0, 2);
  };

  const isEvening = diaryTone === 'evening';
  const greetingPrefix =
    liveNow.getHours() < 12 ? 'Good morning' : liveNow.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const liveClockLabel = liveNow.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const liveDayLabel = liveNow.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const inputClass = isEvening
    ? 'w-full px-3.5 py-2.5 text-sm bg-[#25263A] border border-[#3E405C] rounded-xl text-[#F5F3EC] placeholder:text-[#A5A6BF] focus:outline-none focus:border-[#A497F5]'
    : 'w-full px-3.5 py-2.5 text-sm bg-white border border-[#DCD6C8] rounded-xl text-[#211E1A] placeholder:text-[#787166] focus:outline-none focus:border-[#5B4DC4]';

  const modalInputClass =
    'w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#DCD6C8] rounded-xl text-[#211E1A] placeholder:text-[#787166] focus:outline-none focus:border-[#5B4DC4] focus:bg-white transition-colors';

  return (
    <div
      className={`relative rounded-3xl overflow-hidden border transition-colors duration-300 ${
        isEvening
          ? 'border-[#333652] bg-[#161829] text-[#F5F3EC]'
          : 'border-[#E2DDD2] bg-[#F4F0E7] text-[#211E1A]'
      }`}
    >
      {/* Outdoor Landscape Scenery Backdrop inspired by Personal Diary Website Template */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <img
          src="/src/assets/images/place_botanical_park_1794977877475.jpg"
          alt=""
          aria-hidden="true"
          className={`w-full h-full object-cover transition-all duration-500 ${
            isEvening ? 'opacity-20 brightness-50 saturate-75' : 'opacity-25 saturate-90'
          }`}
        />
        <div
          className={`absolute inset-0 ${
            isEvening
              ? 'bg-gradient-to-b from-[#161829]/85 via-[#1C1E33]/92 to-[#141524]/95'
              : 'bg-gradient-to-b from-[#FBF8F1]/82 via-[#F6F2E9]/90 to-[#F2ECE0]/96'
          }`}
        />
      </div>

      {/* Frosted Diary Glass Board */}
      <div className="relative z-10 p-5 sm:p-8 space-y-7">
        {/* Top Greeting, Live Date/Clock Widget & Diary Controls */}
        <header
          className={`rounded-2xl backdrop-blur-md border p-5 sm:p-7 ${
            isEvening
              ? 'bg-[#1F2238]/88 border-[#383B5A]'
              : 'bg-[#FFFDF9]/90 border-[#E5DFD2]'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div
                className={`inline-flex flex-wrap items-center gap-2 text-xs font-medium mb-2 ${
                  isEvening ? 'text-[#C6C2F2]' : 'text-[#5B4DC4]'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>
                  {greetingPrefix}, {vault.settings.userName} · {liveDayLabel} ·{' '}
                  <span className="tabular-nums">{liveClockLabel}</span>
                </span>
              </div>

              <h1
                className={`text-3xl sm:text-4xl font-bold tracking-tight text-balance ${
                  isEvening ? 'text-[#FAF8F2]' : 'text-[#1E1B16]'
                }`}
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                My Memory Activities
              </h1>
              <p
                className={`mt-2 text-sm sm:text-base leading-relaxed ${
                  isEvening ? 'text-[#CFCDE0]' : 'text-[#575148]'
                }`}
              >
                A calm personal journal where you can record, revisit, and explore meaningful daily
                activities, shared moments, outings, and reflections.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setDiaryTone((t) => (t === 'daylight' ? 'evening' : 'daylight'))}
                aria-label={isEvening ? 'Switch to daylight paper theme' : 'Switch to calm evening theme'}
                className={`inline-flex items-center gap-2 min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isEvening
                    ? 'bg-[#2A2D48] text-[#F5F3EC] border-[#42466B] hover:bg-[#34385A]'
                    : 'bg-[#F5F1E8] text-[#3F3A32] border-[#DCD5C7] hover:bg-[#EAE4D6]'
                }`}
              >
                {isEvening ? <Sun className="w-4 h-4 text-[#F3D17A]" /> : <Moon className="w-4 h-4 text-[#5B4DC4]" />}
                <span>{isEvening ? 'Daylight Paper' : 'Evening Paper'}</span>
              </button>

              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium text-white bg-[#5B4DC4] hover:bg-[#4B3DB3] rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add activity</span>
              </button>
            </div>
          </div>

          {/* Search, Date Range & Chronological Sort Controls */}
          <div
            className={`mt-6 pt-5 border-t space-y-4 ${
              isEvening ? 'border-[#333652]' : 'border-[#E7E1D5]'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isEvening ? 'text-[#A5A6BF]' : 'text-[#787166]'
                  }`}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search journal entries, people, or places..."
                  aria-label="Search memory activities"
                  className={`w-full min-h-[44px] pl-10 pr-9 py-2 text-sm rounded-xl border focus:outline-none ${
                    isEvening
                      ? 'bg-[#25263A] border-[#3E405C] text-[#F5F3EC] placeholder:text-[#A5A6BF] focus:border-[#A497F5]'
                      : 'bg-white border-[#DCD6C8] text-[#211E1A] placeholder:text-[#787166] focus:border-[#5B4DC4]'
                  }`}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear activity search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by date range"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
                  className={`min-h-[44px] px-3 py-2 text-xs font-medium rounded-xl border cursor-pointer ${
                    isEvening
                      ? 'bg-[#25263A] border-[#3E405C] text-[#F5F3EC]'
                      : 'bg-white border-[#DCD6C8] text-[#211E1A]'
                  }`}
                >
                  <option value="all">All dates</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                  <option value="custom">Specific date...</option>
                </select>

                {dateRange === 'custom' && (
                  <input
                    type="date"
                    aria-label="Choose specific activity date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className={`min-h-[44px] px-3 py-2 text-xs rounded-xl border ${
                      isEvening
                        ? 'bg-[#25263A] border-[#3E405C] text-[#F5F3EC]'
                        : 'bg-white border-[#DCD6C8] text-[#211E1A]'
                    }`}
                  />
                )}

                <button
                  type="button"
                  onClick={() => setSortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
                  className={`inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer whitespace-nowrap ${
                    isEvening
                      ? 'bg-[#25263A] border-[#3E405C] text-[#E6E4F0] hover:bg-[#2F324D]'
                      : 'bg-white border-[#DCD6C8] text-[#3F3A32] hover:bg-[#F5F1E8]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-[#5B4DC4]" />
                  <span>{sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}</span>
                </button>
              </div>
            </div>

            {/* Activity Category Filter Strip */}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by activity category">
              {(['All', ...ACTIVITY_CATEGORIES] as const).map((cat) => {
                const active = selectedCategory === cat;
                const count = categoryCounts[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#5B4DC4] text-white border-[#5B4DC4]'
                        : isEvening
                        ? 'bg-[#25263A] text-[#D7D5E8] border-[#3A3D58] hover:bg-[#30334E]'
                        : 'bg-white text-[#443F37] border-[#DDD6C8] hover:bg-[#F5F0E6]'
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`tabular-nums text-[11px] ${
                        active ? 'text-white/80' : isEvening ? 'text-[#9E9FB8]' : 'text-[#787166]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Main Diary Content: Chronological Entries + Open Journal Page Reader */}
        {activityEntries.length === 0 ? (
          <section
            className={`rounded-2xl border p-12 text-center ${
              isEvening
                ? 'bg-[#1F2238]/90 border-[#383B5A]'
                : 'bg-[#FFFDF9]/95 border-[#E5DFD2]'
            }`}
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#EDEAF9] text-[#5B4DC4] flex items-center justify-center mb-4">
              <NotebookPen className="w-7 h-7" />
            </div>
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Your activity journal is ready for its first entry
            </h2>
            <p
              className={`mt-2 text-sm max-w-md mx-auto leading-relaxed ${
                isEvening ? 'text-[#C6C5D8]' : 'text-[#575148]'
              }`}
            >
              Record a walk in the park, a family dinner, a class, or any quiet daily moment you
              would like to remember later.
            </p>
            <button
              type="button"
              onClick={openAddForm}
              className="mt-6 inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium text-white bg-[#5B4DC4] hover:bg-[#4B3DB3] rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Write your first activity</span>
            </button>
          </section>
        ) : filteredEntries.length === 0 ? (
          <section
            className={`rounded-2xl border p-10 text-center ${
              isEvening
                ? 'bg-[#1F2238]/90 border-[#383B5A]'
                : 'bg-[#FFFDF9]/95 border-[#E5DFD2]'
            }`}
          >
            <h2 className="text-lg font-semibold">No journal entries match these filters</h2>
            <p className={`mt-1.5 text-sm ${isEvening ? 'text-[#C6C5D8]' : 'text-[#575148]'}`}>
              Try clearing your search or choosing &ldquo;All&rdquo; to see every saved activity.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
                setDateRange('all');
                setCustomDate('');
              }}
              className={`mt-5 inline-flex items-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium rounded-xl cursor-pointer ${
                isEvening
                  ? 'bg-[#2B2E4A] text-[#F5F3EC] hover:bg-[#363A5E]'
                  : 'bg-[#EAE4D6] text-[#211E1A] hover:bg-[#DED7C7]'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset filters</span>
            </button>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Chronological Diary Index */}
            <section
              aria-label="Chronological activity journal entries"
              className="lg:col-span-6 space-y-3"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">
                  Chronological Journal ({filteredEntries.length})
                </h2>
                <span className={`text-xs ${isEvening ? 'text-[#A5A6BF]' : 'text-[#787166]'}`}>
                  Select an entry to read or edit
                </span>
              </div>

              <div className="space-y-3">
                {filteredEntries.map((entry, idx) => {
                  const isActive = entry.id === activeEntry?.id;
                  const entryDate = extractEntryDate(entry);
                  const entryTime = extractEntryTimeDisplay(entry);
                  const entryCat = extractActivityCategory(entry);

                  return (
                    <motion.article
                      key={entry.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0.01 }
                          : { duration: 0.16, delay: Math.min(idx * 0.025, 0.2) }
                      }
                      className={`rounded-2xl border transition-colors ${
                        isActive
                          ? isEvening
                            ? 'bg-[#282B47] border-[#8D82EE]'
                            : 'bg-white border-[#5B4DC4] shadow-sm'
                          : isEvening
                          ? 'bg-[#1F2238]/90 border-[#343754] hover:border-[#4D517A]'
                          : 'bg-[#FFFDF9]/92 border-[#E5DFD2] hover:border-[#C7BFA9]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedEntryId(entry.id)}
                        className="w-full text-left p-4 sm:p-5 flex gap-4 items-start cursor-pointer focus-visible:outline-2 focus-visible:outline-[#5B4DC4] rounded-2xl"
                      >
                        {entry.imageUrl && (
                          <SafeImage
                            src={entry.imageUrl}
                            alt={entry.title}
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0 border border-[#E5DFD2]"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div
                            className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${
                              isEvening ? 'text-[#B5B4CE]' : 'text-[#6D665B]'
                            }`}
                          >
                            <span className={`font-medium ${isEvening ? 'text-[#C4BCF8]' : 'text-[#5B4DC4]'}`}>
                              {entryCat}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{formatFriendlyDate(entryDate)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{entryTime}</span>
                          </div>

                          <h3
                            className={`mt-1 text-base sm:text-lg font-bold leading-snug ${
                              isEvening ? 'text-[#FAF8F2]' : 'text-[#1E1B16]'
                            }`}
                            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                          >
                            {entry.title}
                          </h3>

                          <p
                            className={`mt-1.5 text-sm line-clamp-2 leading-relaxed ${
                              isEvening ? 'text-[#CFCDE0]' : 'text-[#575148]'
                            }`}
                          >
                            {entry.description}
                          </p>

                          {(entry.associatedPeople.length > 0 || entry.associatedLocations.length > 0) && (
                            <div
                              className={`mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${
                                isEvening ? 'text-[#A9A9C5]' : 'text-[#6D665B]'
                              }`}
                            >
                              {entry.associatedPeople.length > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{entry.associatedPeople.join(', ')}</span>
                                </span>
                              )}
                              {entry.associatedLocations.length > 0 && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span>{entry.associatedLocations.join(', ')}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    </motion.article>
                  );
                })}
              </div>
            </section>

            {/* Right Column: Open Diary Page Reader & Reflection Corner */}
            <div className="lg:col-span-6 space-y-5 lg:sticky lg:top-6">
              {activeEntry && (
                <AnimatePresence mode="wait">
                  <motion.article
                    key={activeEntry.id}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.18 }}
                    className={`rounded-2xl border p-6 sm:p-7 space-y-5 ${
                      isEvening
                        ? 'bg-[#22253E]/95 border-[#3A3E5E]'
                        : 'bg-[#FFFDF9] border-[#E5DFD2] shadow-sm'
                    }`}
                  >
                    {/* Page Header & Pagination Scrubber */}
                    <div
                      className={`flex items-center justify-between gap-3 pb-4 border-b ${
                        isEvening ? 'border-[#333652]' : 'border-[#EAE3D5]'
                      }`}
                    >
                      <div>
                        <p className={`text-xs font-semibold ${isEvening ? 'text-[#C4BCF8]' : 'text-[#5B4DC4]'}`}>
                          {extractActivityCategory(activeEntry)}
                        </p>
                        <div
                          className={`mt-0.5 flex flex-wrap items-center gap-2 text-xs ${
                            isEvening ? 'text-[#B8B8CE]' : 'text-[#6D665B]'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatFriendlyDate(extractEntryDate(activeEntry))}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="w-3.5 h-3.5" />
                            {extractEntryTimeDisplay(activeEntry)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => stepEntry(-1)}
                          disabled={filteredEntries.length <= 1}
                          aria-label="Previous diary entry"
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors cursor-pointer disabled:opacity-40 ${
                            isEvening
                              ? 'bg-[#2B2E4B] border-[#42466B] text-[#F5F3EC] hover:bg-[#35395C]'
                              : 'bg-[#F5F1E8] border-[#DCD6C8] text-[#211E1A] hover:bg-[#EAE4D6]'
                          }`}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium tabular-nums px-1.5">
                          {activeIdx + 1} / {filteredEntries.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => stepEntry(1)}
                          disabled={filteredEntries.length <= 1}
                          aria-label="Next diary entry"
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-colors cursor-pointer disabled:opacity-40 ${
                            isEvening
                              ? 'bg-[#2B2E4B] border-[#42466B] text-[#F5F3EC] hover:bg-[#35395C]'
                              : 'bg-[#F5F1E8] border-[#DCD6C8] text-[#211E1A] hover:bg-[#EAE4D6]'
                          }`}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Photo if available */}
                    {activeEntry.imageUrl && (
                      <div className="rounded-2xl overflow-hidden border border-[#E5DFD2] bg-[#F2EDE2]">
                        <SafeImage
                          src={activeEntry.imageUrl}
                          alt={activeEntry.title}
                          className="w-full h-56 sm:h-64 object-cover"
                        />
                      </div>
                    )}

                    {/* Title & Diary Prose */}
                    <div>
                      <h2
                        className="text-2xl font-bold leading-snug text-balance"
                        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                      >
                        {activeEntry.title}
                      </h2>
                      <p
                        className={`mt-3 text-sm sm:text-base leading-relaxed ${
                          isEvening ? 'text-[#DCDCEB]' : 'text-[#3B3630]'
                        }`}
                      >
                        {activeEntry.description}
                      </p>
                    </div>

                    {/* Related People & Places */}
                    {(activeEntry.associatedPeople.length > 0 ||
                      activeEntry.associatedLocations.length > 0) && (
                      <div
                        className={`pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs ${
                          isEvening ? 'border-[#333652]' : 'border-[#EAE3D5]'
                        }`}
                      >
                        {activeEntry.associatedPeople.length > 0 && (
                          <div
                            className={`p-3 rounded-xl ${
                              isEvening ? 'bg-[#292C48]' : 'bg-[#F7F3EA]'
                            }`}
                          >
                            <p className="font-semibold flex items-center gap-1.5 mb-1">
                              <Users className="w-3.5 h-3.5 text-[#5B4DC4]" />
                              <span>People together</span>
                            </p>
                            <p className={isEvening ? 'text-[#CFCDE0]' : 'text-[#575148]'}>
                              {activeEntry.associatedPeople.join(', ')}
                            </p>
                          </div>
                        )}
                        {activeEntry.associatedLocations.length > 0 && (
                          <div
                            className={`p-3 rounded-xl ${
                              isEvening ? 'bg-[#292C48]' : 'bg-[#F7F3EA]'
                            }`}
                          >
                            <p className="font-semibold flex items-center gap-1.5 mb-1">
                              <MapPin className="w-3.5 h-3.5 text-[#5B4DC4]" />
                              <span>Place visited</span>
                            </p>
                            <p className={isEvening ? 'text-[#CFCDE0]' : 'text-[#575148]'}>
                              {activeEntry.associatedLocations.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Linked Memories if supported */}
                    {(() => {
                      const linked = getLinkedMemories(activeEntry);
                      if (linked.length === 0) return null;
                      return (
                        <div
                          className={`pt-4 border-t space-y-2 ${
                            isEvening ? 'border-[#333652]' : 'border-[#EAE3D5]'
                          }`}
                        >
                          <p className="text-xs font-semibold flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5 text-[#5B4DC4]" />
                            <span>Associated memories</span>
                          </p>
                          <div className="space-y-1.5">
                            {linked.map((m) => (
                              <div
                                key={m.id}
                                className={`p-3 rounded-xl border text-xs ${
                                  isEvening
                                    ? 'bg-[#272A45] border-[#393D60]'
                                    : 'bg-[#F9F6EE] border-[#E6DFD1]'
                                }`}
                              >
                                <p className="font-semibold">{m.title}</p>
                                <p
                                  className={`mt-0.5 line-clamp-2 ${
                                    isEvening ? 'text-[#C6C5D8]' : 'text-[#575148]'
                                  }`}
                                >
                                  {m.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Entry Controls */}
                    <div
                      className={`pt-4 border-t flex flex-wrap items-center justify-between gap-2.5 ${
                        isEvening ? 'border-[#333652]' : 'border-[#EAE3D5]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailModalOpen(true)}
                        className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                          isEvening
                            ? 'bg-[#2D304F] text-[#F5F3EC] hover:bg-[#383C62]'
                            : 'bg-[#F3EFE5] text-[#211E1A] hover:bg-[#E8E2D4]'
                        }`}
                      >
                        <Expand className="w-3.5 h-3.5" />
                        <span>Open full view</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(activeEntry)}
                          className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-[#5B4DC4] hover:bg-[#4B3DB3] rounded-xl transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit entry</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(activeEntry)}
                          aria-label={`Delete ${activeEntry.title}`}
                          className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors cursor-pointer ${
                            isEvening
                              ? 'text-[#D0CEE2] hover:text-[#FCA5A5] hover:bg-[#3B2632]'
                              : 'text-[#6D665B] hover:text-[#C93B3B] hover:bg-[#FEECEC]'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.article>
                </AnimatePresence>
              )}

              {/* Daily Journal Prompt Card */}
              <section
                aria-label="Daily activity reflection prompt"
                className={`rounded-2xl border p-5 sm:p-6 space-y-3.5 ${
                  isEvening
                    ? 'bg-[#1F2238]/92 border-[#383B5A]'
                    : 'bg-[#FFFDF9]/94 border-[#E5DFD2]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`w-4 h-4 ${isEvening ? 'text-[#C4BCF8]' : 'text-[#5B4DC4]'}`} />
                    <h3 className="text-sm font-semibold">Today&rsquo;s gentle journal prompt</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPromptIdx((i) => (i + 1) % prompts.length)}
                    className={`text-xs font-medium hover:underline cursor-pointer ${isEvening ? 'text-[#C4BCF8]' : 'text-[#5B4DC4]'}`}
                  >
                    Another prompt
                  </button>
                </div>

                <p
                  className="text-sm sm:text-[15px] font-medium leading-relaxed"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  &ldquo;{prompts[promptIdx]}&rdquo;
                </p>

                <form onSubmit={handleSaveQuickReflection} className="space-y-3">
                  <textarea
                    rows={3}
                    value={quickReflection}
                    onChange={(e) => setQuickReflection(e.target.value)}
                    placeholder="Write a few quiet sentences about your day..."
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={savingQuickReflection || !quickReflection.trim()}
                    className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-[#5B4DC4] hover:bg-[#4B3DB3] disabled:opacity-50 rounded-xl cursor-pointer"
                  >
                    <Heart className="w-4 h-4" />
                    <span>{savingQuickReflection ? 'Saving...' : 'Save to my diary'}</span>
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* Full Activity Reading Lightbox Modal */}
      <Modal
        open={detailModalOpen && Boolean(activeEntry)}
        onClose={() => setDetailModalOpen(false)}
        title={activeEntry?.title || 'Diary Entry'}
        subtitle={
          activeEntry
            ? `${extractActivityCategory(activeEntry)} · ${formatFriendlyDate(extractEntryDate(activeEntry))} at ${extractEntryTimeDisplay(activeEntry)}`
            : undefined
        }
        maxWidth="max-w-2xl"
      >
        {activeEntry && (
          <div className="space-y-5">
            {activeEntry.imageUrl && (
              <SafeImage
                src={activeEntry.imageUrl}
                alt={activeEntry.title}
                className="w-full h-64 sm:h-72 rounded-2xl object-cover border border-[#E5DFD2]"
              />
            )}

            <p className="text-base text-[#211E1A] leading-relaxed">{activeEntry.description}</p>

            {(activeEntry.associatedPeople.length > 0 || activeEntry.associatedLocations.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {activeEntry.associatedPeople.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD2]">
                    <p className="text-xs font-semibold text-[#575148] mb-1">People together</p>
                    <p className="font-medium text-[#211E1A]">
                      {activeEntry.associatedPeople.join(', ')}
                    </p>
                  </div>
                )}
                {activeEntry.associatedLocations.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD2]">
                    <p className="text-xs font-semibold text-[#575148] mb-1">Place visited</p>
                    <p className="font-medium text-[#211E1A]">
                      {activeEntry.associatedLocations.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {(() => {
              const linked = getLinkedMemories(activeEntry);
              if (linked.length === 0) return null;
              return (
                <div className="pt-4 border-t border-[#EAE3D5] space-y-2.5">
                  <h4 className="text-xs font-semibold text-[#575148]">Associated memories</h4>
                  {linked.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl bg-[#FAF8F4] border border-[#E5DFD2] text-sm"
                    >
                      <p className="font-semibold text-[#211E1A]">{m.title}</p>
                      <p className="text-xs text-[#575148] mt-1 leading-relaxed">{m.description}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="pt-4 border-t border-[#EAE3D5] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => stepEntry(-1)}
                  disabled={filteredEntries.length <= 1}
                  className="inline-flex items-center gap-1 min-h-[44px] px-3.5 py-2 text-xs font-medium text-[#211E1A] bg-[#F3EFE5] hover:bg-[#E8E2D4] rounded-xl cursor-pointer disabled:opacity-40"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => stepEntry(1)}
                  disabled={filteredEntries.length <= 1}
                  className="inline-flex items-center gap-1 min-h-[44px] px-3.5 py-2 text-xs font-medium text-[#211E1A] bg-[#F3EFE5] hover:bg-[#E8E2D4] rounded-xl cursor-pointer disabled:opacity-40"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const entry = activeEntry;
                    setDetailModalOpen(false);
                    openEditForm(entry);
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-[#5B4DC4] hover:bg-[#4B3DB3] rounded-xl cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#211E1A] bg-[#F3EFE5] hover:bg-[#E8E2D4] rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Activity Modal */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingEntry(null);
        }}
        title={editingEntry ? 'Edit Activity Entry' : 'Record a New Activity'}
        subtitle="Saved privately in your Kindred activity journal."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveEntry} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#3B3630] mb-1.5">
              Activity title
            </label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g., Afternoon walk by the lavender garden"
              className={modalInputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-[#3B3630] mb-1.5">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ActivityDiaryCategory)}
                className={modalInputClass}
              >
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3B3630] mb-1.5">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className={modalInputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3B3630] mb-1.5">Time</label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className={modalInputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3B3630] mb-1.5">
              What happened & how it felt
            </label>
            <textarea
              required
              rows={4}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Write down details about this activity so you can revisit it warmly later..."
              className={modalInputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#3B3630] mb-1.5">
                Related people (comma-separated)
              </label>
              <input
                type="text"
                value={formPeople}
                onChange={(e) => setFormPeople(e.target.value)}
                placeholder="e.g., Maya, Rahul"
                className={modalInputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3B3630] mb-1.5">
                Related places (comma-separated)
              </label>
              <input
                type="text"
                value={formPlaces}
                onChange={(e) => setFormPlaces(e.target.value)}
                placeholder="e.g., Willow Botanical Park"
                className={modalInputClass}
              />
            </div>
          </div>

          {vault.memories.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[#3B3630] mb-1.5">
                Associated memory (optional)
              </label>
              <select
                value={formLinkedMemoryId}
                onChange={(e) => setFormLinkedMemoryId(e.target.value)}
                className={modalInputClass}
              >
                <option value="">None linked</option>
                {vault.memories
                  .filter((m) => m.id !== editingEntry?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-xs font-semibold text-[#5B4DC4] bg-[#F3F1FC] hover:bg-[#E8E4FA] border border-[#DDD8F6] rounded-xl cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span>{formImageUrl ? 'Change activity photo' : 'Attach photo'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>
            {formImageUrl && (
              <button
                type="button"
                onClick={() => setFormImageUrl('')}
                className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-[#575148] bg-[#F3EFE5] hover:bg-[#E8E2D4] rounded-xl cursor-pointer"
              >
                Remove photo
              </button>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingEntry(null);
              }}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#3B3630] bg-[#F3EFE5] hover:bg-[#E8E2D4] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-[#5B4DC4] hover:bg-[#4B3DB3] disabled:opacity-60 rounded-xl cursor-pointer"
            >
              {saving ? 'Saving...' : editingEntry ? 'Save changes' : 'Save activity'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteEntry(deleteTarget)}
        title="Delete activity entry?"
        message={`Remove "${deleteTarget?.title}" from My Memory Activities?`}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
