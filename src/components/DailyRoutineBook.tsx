import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  BellOff,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Droplets,
  Footprints,
  HeartPulse,
  LayoutList,
  Moon,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { RoutineRecord, VaultClientData } from '../types/memory';

interface DailyRoutineBookProps {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenAddRoutine: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type ChapterKey = 'morning' | 'afternoon' | 'evening' | 'night';
type BookPageId = 'cover' | ChapterKey | 'summary';

interface ChapterConfig {
  id: ChapterKey;
  roman: string;
  title: string;
  timeRange: string;
  subtitle: string;
  guidingNote: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CHAPTERS: ChapterConfig[] = [
  {
    id: 'morning',
    roman: 'Chapter I',
    title: 'Morning Routine',
    timeRange: 'Before 12:00 PM',
    subtitle: 'Gentle starts, hydration, breakfast, and morning movement.',
    guidingNote: 'Begin slowly with warm water, daylight, and your steady morning anchors.',
    accentBg: 'bg-[#FDF3DF]',
    accentText: 'text-[#8C5319]',
    accentBorder: 'border-[#EBD4AA]',
    icon: Sunrise,
  },
  {
    id: 'afternoon',
    roman: 'Chapter II',
    title: 'Afternoon Routine',
    timeRange: '12:00 PM – 4:59 PM',
    subtitle: 'Midday meals, quiet reading, and restorative rest.',
    guidingNote: 'A calm midday pace keeps energy steady without rushing.',
    accentBg: 'bg-[#EAF4EE]',
    accentText: 'text-[#215C41]',
    accentBorder: 'border-[#C5E0D0]',
    icon: Sun,
  },
  {
    id: 'evening',
    roman: 'Chapter III',
    title: 'Evening Routine',
    timeRange: '5:00 PM – 7:59 PM',
    subtitle: 'Family visits, warm tea, and early evening dinner.',
    guidingNote: 'A welcoming time for conversation, shared meals, and winding down.',
    accentBg: 'bg-[#FBECE6]',
    accentText: 'text-[#8E3F29]',
    accentBorder: 'border-[#EAC8BC]',
    icon: Sunset,
  },
  {
    id: 'night',
    roman: 'Chapter IV',
    title: 'Night Routine',
    timeRange: '8:00 PM onwards',
    subtitle: 'Belongings in place, herbal tea, and restful preparation for sleep.',
    guidingNote: 'Set your essentials in their familiar spots so tomorrow morning feels effortless.',
    accentBg: 'bg-[#ECEBF8]',
    accentText: 'text-[#433A85]',
    accentBorder: 'border-[#D0CCE9]',
    icon: Moon,
  },
];

const BOOK_PAGES: { id: BookPageId; label: string; shortLabel: string }[] = [
  { id: 'cover', label: 'Front Cover', shortLabel: 'Cover' },
  { id: 'morning', label: 'Morning Routine', shortLabel: 'Morning' },
  { id: 'afternoon', label: 'Afternoon Routine', shortLabel: 'Afternoon' },
  { id: 'evening', label: 'Evening Routine', shortLabel: 'Evening' },
  { id: 'night', label: 'Night Routine', shortLabel: 'Night' },
  { id: 'summary', label: 'Daily Summary', shortLabel: 'Summary' },
];

const EDITORIAL_SERIF =
  "font-['Georgia','Palatino_Linotype','Book_Antiqua',serif]";

function getRoutineChapter(routine: RoutineRecord): ChapterKey {
  const [hhStr] = (routine.time || '').split(':');
  const hour = Number(hhStr);
  if (!Number.isNaN(hour)) {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 20) return 'evening';
    return 'night';
  }
  if (routine.period === 'Morning') return 'morning';
  if (routine.period === 'Afternoon') return 'afternoon';
  return 'evening';
}

function getRoutineIllustration(routine: RoutineRecord): React.ComponentType<{ className?: string }> {
  const titleLower = routine.title.toLowerCase();
  if (titleLower.includes('water') || titleLower.includes('hydration')) return Droplets;
  if (titleLower.includes('tea') || titleLower.includes('chai') || titleLower.includes('coffee')) {
    return Coffee;
  }
  if (titleLower.includes('walk') || titleLower.includes('exercise') || titleLower.includes('stroll')) {
    return Footprints;
  }
  if (routine.category === 'Meals') return Utensils;
  if (routine.category === 'Health') return HeartPulse;
  if (routine.category === 'Movement') return Footprints;
  if (routine.category === 'Family') return Users;
  if (routine.category === 'Rest') return Moon;
  return Sparkles;
}

export function DailyRoutineBook({
  vault,
  onVaultUpdate,
  onOpenAddRoutine,
  onToast,
}: DailyRoutineBookProps) {
  const [viewMode, setViewMode] = useState<'book' | 'list'>('book');
  const [pageIndex, setPageIndex] = useState<number>(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 1; // Morning
    if (hr < 17) return 2; // Afternoon
    if (hr < 20) return 3; // Evening
    return 4; // Night
  });
  const [flipDirection, setFlipDirection] = useState<1 | -1>(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [editingRoutine, setEditingRoutine] = useState<RoutineRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoutineRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const prefersReducedMotion = useMemo(() => {
    if (vault.settings.reducedMotion) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, [vault.settings.reducedMotion]);

  const routinesByChapter = useMemo(() => {
    const grouped: Record<ChapterKey, RoutineRecord[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };
    const sorted = [...vault.routines].sort((a, b) => a.time.localeCompare(b.time));
    for (const r of sorted) {
      grouped[getRoutineChapter(r)].push(r);
    }
    return grouped;
  }, [vault.routines]);

  const totals = useMemo(() => {
    const total = vault.routines.length;
    const completed = vault.routines.filter((r) => r.status === 'completed').length;
    const pending = vault.routines.filter((r) => r.status !== 'completed').length;
    const remindersOn = vault.routines.filter((r) => r.caregiverAlertOnMiss).length;
    return { total, completed, pending, remindersOn };
  }, [vault.routines]);

  const goToPage = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(BOOK_PAGES.length - 1, nextIndex));
      if (clamped === pageIndex) return;
      setFlipDirection(clamped > pageIndex ? 1 : -1);
      setPageIndex(clamped);
    },
    [pageIndex]
  );

  // Keyboard navigation between pages (Left/Right arrows when not typing or inside modal)
  useEffect(() => {
    if (viewMode !== 'book' || editingRoutine || deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPage(pageIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPage(pageIndex - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewMode, pageIndex, goToPage, editingRoutine, deleteTarget]);

  // Escape closes dialogs
  useEffect(() => {
    if (!editingRoutine && !deleteTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingRoutine(null);
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingRoutine, deleteTarget]);

  const handleToggleStatus = async (r: RoutineRecord) => {
    const next = r.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await api.updateRoutine(r.id, { status: next });
      onVaultUpdate(updated);
      onToast(
        next === 'completed'
          ? `Marked "${r.title}" as completed.`
          : `Marked "${r.title}" as pending.`
      );
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleToggleReminder = async (r: RoutineRecord) => {
    const nextAlert = !r.caregiverAlertOnMiss;
    try {
      const updated = await api.updateRoutine(r.id, {
        caregiverAlertOnMiss: nextAlert,
      });
      onVaultUpdate(updated);
      onToast(
        nextAlert
          ? `Reminder enabled for "${r.title}".`
          : `Reminder disabled for "${r.title}".`
      );
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoutine || !editingRoutine.title.trim()) return;
    setSavingEdit(true);
    try {
      // Do not pass stale displayTime/period so server.ts recomputes them cleanly from time
      const updated = await api.updateRoutine(editingRoutine.id, {
        title: editingRoutine.title.trim(),
        time: editingRoutine.time,
        category: editingRoutine.category,
        priority: editingRoutine.priority,
        status: editingRoutine.status,
        caregiverAlertOnMiss: editingRoutine.caregiverAlertOnMiss,
        notes: editingRoutine.notes,
        daysOfWeek: editingRoutine.daysOfWeek,
      });
      onVaultUpdate(updated);
      onToast(`Updated "${editingRoutine.title.trim()}".`);
      setEditingRoutine(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const updated = await api.deleteRoutine(deleteTarget.id);
      onVaultUpdate(updated);
      onToast(`Removed "${deleteTarget.title}" from your routine book.`);
      setDeleteTarget(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const filterList = (items: RoutineRecord[]) => {
    if (statusFilter === 'completed') {
      return items.filter((r) => r.status === 'completed');
    }
    if (statusFilter === 'pending') {
      return items.filter((r) => r.status !== 'completed');
    }
    return items;
  };

  const renderRoutineEntry = (r: RoutineRecord) => {
    const done = r.status === 'completed';
    const Icon = getRoutineIllustration(r);

    return (
      <article
        key={r.id}
        className={`rounded-2xl border p-4 sm:p-5 transition-colors ${
          done
            ? 'bg-[#EFF6F1] border-[#C5DEC9]'
            : 'bg-[#FFFDF8] border-[#E3D8C5] hover:border-[#CBBBA0]'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Left: Large Accessible Completion Control + Details */}
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => handleToggleStatus(r)}
              aria-label={
                done
                  ? `Mark "${r.title}" as pending`
                  : `Mark "${r.title}" as completed`
              }
              aria-pressed={done}
              className={`mt-0.5 w-11 h-11 rounded-xl border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6E4932] ${
                done
                  ? 'bg-[#267350] border-[#267350] text-white'
                  : 'bg-white border-[#B9A78E] text-[#6B5B4B] hover:border-[#6E4932]'
              }`}
            >
              {done ? <Check className="w-5 h-5 stroke-[2.5]" /> : <Icon className="w-5 h-5" />}
            </button>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5 font-mono-tabular text-xs font-semibold text-[#6E4932] bg-[#F2E9D8] px-2.5 py-0.5 rounded-md">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{r.displayTime}</span>
                </span>
                <span className="text-xs font-medium text-[#6B5B4B]">
                  {r.category}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    done ? 'text-[#1E5C40]' : 'text-[#8C5319]'
                  }`}
                >
                  {done ? 'Completed' : r.status === 'skipped' ? 'Skipped' : 'Pending'}
                </span>
              </div>

              <h3
                className={`${EDITORIAL_SERIF} text-lg font-semibold leading-snug ${
                  done ? 'line-through text-[#63786B]' : 'text-[#2B231D]'
                }`}
              >
                {r.title}
              </h3>

              {r.notes && (
                <p className="text-sm text-[#54473B] leading-relaxed">{r.notes}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#746658] pt-0.5">
                <span>
                  Reminder:{' '}
                  <strong className="font-medium text-[#3D3127]">
                    {r.caregiverAlertOnMiss ? 'Active (caregiver alert)' : 'Off'}
                  </strong>
                </span>
                {r.daysOfWeek.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{r.daysOfWeek.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Clear Large Action Controls */}
          <div className="flex flex-wrap sm:flex-col items-center sm:items-end gap-2 pl-14 sm:pl-0 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleStatus(r)}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                done
                  ? 'bg-white border border-[#B5D1BC] text-[#1E5C40] hover:bg-[#E4F0E7]'
                  : 'bg-[#6E4932] text-white hover:bg-[#573825]'
              }`}
            >
              {done ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Mark pending</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark done</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleToggleReminder(r)}
                aria-label={
                  r.caregiverAlertOnMiss
                    ? `Disable reminder for ${r.title}`
                    : `Enable reminder for ${r.title}`
                }
                title={r.caregiverAlertOnMiss ? 'Reminder enabled' : 'Reminder disabled'}
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  r.caregiverAlertOnMiss
                    ? 'bg-[#FDF4DF] border-[#E0C58F] text-[#784A14] hover:bg-[#F7E8C6]'
                    : 'bg-white border-[#DFD3C0] text-[#6B5B4B] hover:bg-[#F4EDE0]'
                }`}
              >
                {r.caregiverAlertOnMiss ? (
                  <Bell className="w-3.5 h-3.5" />
                ) : (
                  <BellOff className="w-3.5 h-3.5" />
                )}
                <span>{r.caregiverAlertOnMiss ? 'Reminder on' : 'Reminder off'}</span>
              </button>

              <button
                type="button"
                onClick={() => setEditingRoutine({ ...r })}
                aria-label={`Edit ${r.title}`}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-[#DFD3C0] text-[#54473B] hover:bg-[#F4EDE0] hover:text-[#2B231D] transition-colors cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setDeleteTarget(r)}
                aria-label={`Delete ${r.title}`}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-[#DFD3C0] text-[#7A4B47] hover:bg-[#FCECEB] hover:text-[#A32929] transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const currentPage = BOOK_PAGES[pageIndex];
  const currentChapter = CHAPTERS.find((c) => c.id === currentPage.id) || null;

  const pageTransitionVariants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: (dir: 1 | -1) => ({
          opacity: 0,
          rotateY: dir > 0 ? 18 : -18,
          x: dir > 0 ? 28 : -28,
          scale: 0.985,
        }),
        animate: {
          opacity: 1,
          rotateY: 0,
          x: 0,
          scale: 1,
        },
        exit: (dir: 1 | -1) => ({
          opacity: 0,
          rotateY: dir > 0 ? -18 : 18,
          x: dir > 0 ? -28 : 28,
          scale: 0.985,
        }),
      };

  return (
    <div className="space-y-5">
      {/* Top Routine Book Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`${EDITORIAL_SERIF} text-2xl sm:text-3xl font-bold text-[#2B231D]`}>
            Daily Routines
          </h1>
          <p className="text-sm text-[#6B5B4B] mt-0.5">
            {vault.settings.userName}&apos;s interactive routine book · {totals.completed} of{' '}
            {totals.total} completed today · {totals.remindersOn} reminders active
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div
            role="group"
            aria-label="Filter routines by status"
            className="inline-flex items-center p-1 bg-[#EFE7D8] border border-[#DDD0BC] rounded-xl"
          >
            {(['all', 'pending', 'completed'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === status
                    ? 'bg-[#FFFDF8] text-[#2B231D] shadow-xs'
                    : 'text-[#6B5B4B] hover:text-[#2B231D]'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>

          {/* Book Mode vs Simple List Accessible Alternative */}
          <div
            role="group"
            aria-label="Reading view mode"
            className="inline-flex items-center p-1 bg-[#EFE7D8] border border-[#DDD0BC] rounded-xl"
          >
            <button
              type="button"
              onClick={() => setViewMode('book')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'book'
                  ? 'bg-[#FFFDF8] text-[#2B231D] shadow-xs'
                  : 'text-[#6B5B4B] hover:text-[#2B231D]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Book view</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#FFFDF8] text-[#2B231D] shadow-xs'
                  : 'text-[#6B5B4B] hover:text-[#2B231D]'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Simple list</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenAddRoutine}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] text-sm font-semibold text-white bg-[#6E4932] hover:bg-[#573825] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add routine</span>
          </button>
        </div>
      </div>

      {viewMode === 'book' ? (
        <div className="space-y-4">
          {/* Chapter Ribbon Bookmarks */}
          <nav
            aria-label="Routine book chapters"
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
          >
            {BOOK_PAGES.map((page, idx) => {
              const active = idx === pageIndex;
              const isChapter =
                page.id === 'morning' ||
                page.id === 'afternoon' ||
                page.id === 'evening' ||
                page.id === 'night';
              const count = isChapter ? routinesByChapter[page.id as ChapterKey].length : null;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => goToPage(idx)}
                  aria-current={active ? 'page' : undefined}
                  className={`px-3.5 py-2 min-h-[40px] rounded-t-xl rounded-b-md border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#6E4932] border-[#6E4932] text-[#FFFDF8] shadow-sm'
                      : 'bg-[#F8F2E6] border-[#DFD3C0] text-[#54473B] hover:bg-[#EFE5D4]'
                  }`}
                >
                  <span>{page.shortLabel}</span>
                  {count !== null && (
                    <span className="ml-1.5 font-mono-tabular opacity-80">({count})</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Outer Hardcover Book Case with Layered Page Edges */}
          <div
            onTouchStart={(e) => {
              touchStartX.current = e.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
              const diff = touchStartX.current - endX;
              touchStartX.current = null;
              if (Math.abs(diff) > 55) {
                goToPage(diff > 0 ? pageIndex + 1 : pageIndex - 1);
              }
            }}
            className="rounded-[26px] p-2.5 sm:p-4 bg-gradient-to-br from-[#4D372A] via-[#3A281F] to-[#2C1E17] shadow-[0_24px_55px_-22px_rgba(32,20,12,0.5)] border border-[#5B4334]"
            style={{ perspective: '2200px' }}
          >
            {/* Layered Paper Deck Rim */}
            <div className="rounded-[18px] bg-[#E8DEC9] p-1 sm:p-1.5 shadow-inner border border-[#CDBEAA]">
              <AnimatePresence mode="wait" custom={flipDirection}>
                <motion.div
                  key={currentPage.id}
                  custom={flipDirection}
                  variants={pageTransitionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{
                    duration: prefersReducedMotion ? 0.08 : 0.36,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className="rounded-[14px] overflow-hidden bg-[#FAF4E8] border border-[#DDD0BC] shadow-[0_6px_24px_rgba(52,38,24,0.14)]"
                >
                  {/* PAGE 0: FRONT COVER */}
                  {currentPage.id === 'cover' && (
                    <div className="min-h-[460px] p-6 sm:p-10 lg:p-14 bg-[radial-gradient(circle_at_25%_20%,#4A3529_0%,#33231A_65%,#241812_100%)] text-[#FBF5E8] flex flex-col justify-between gap-8 relative">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-4 sm:inset-6 rounded-xl border border-[#C9A86A]/40"
                      />
                      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#DFC79C] tracking-[0.16em] uppercase">
                        <span>Kindred Personal Edition</span>
                        <span className="font-mono-tabular">
                          {new Date().toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="relative z-10 max-w-2xl space-y-4 my-auto py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#DFC79C]">
                          Daily Life Companion
                        </p>
                        <h2
                          className={`${EDITORIAL_SERIF} text-3xl sm:text-5xl font-bold leading-tight text-[#FFF8EC]`}
                        >
                          {vault.settings.userName}&apos;s Daily Routine Book
                        </h2>
                        <p className="text-sm sm:text-base text-[#E6DAC4] leading-relaxed max-w-xl">
                          Every steady rhythm of your day—from morning hydration and walks to
                          evening family tea and quiet rest—arranged chapter by chapter.
                        </p>

                        <div className="pt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => goToPage(1)}
                            className="inline-flex items-center gap-2 px-6 py-3 min-h-[46px] rounded-xl bg-[#D9B675] hover:bg-[#E4C58B] text-[#241812] text-sm font-bold transition-colors cursor-pointer"
                          >
                            <span>Open Chapter I: Morning</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={onOpenAddRoutine}
                            className="inline-flex items-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-white/10 hover:bg-white/15 border border-[#C9A86A]/40 text-[#FFF8EC] text-sm font-medium transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add new routine</span>
                          </button>
                        </div>
                      </div>

                      <div className="relative z-10 pt-5 border-t border-[#C9A86A]/25 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        {CHAPTERS.map((chap, idx) => {
                          const list = routinesByChapter[chap.id];
                          const done = list.filter((r) => r.status === 'completed').length;
                          return (
                            <button
                              key={chap.id}
                              type="button"
                              onClick={() => goToPage(idx + 1)}
                              className="text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
                            >
                              <p className="text-[#DFC79C] font-medium">{chap.roman}</p>
                              <p className="text-sm font-semibold text-[#FFF8EC] mt-0.5">
                                {chap.title.replace(' Routine', '')}
                              </p>
                              <p className="text-[11px] text-[#D8CBB5] font-mono-tabular mt-1">
                                {done}/{list.length} completed
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* CHAPTER SPREADS (TWO-PAGE OPEN BOOK ON DESKTOP) */}
                  {currentChapter && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px] relative">
                      {/* Center Book Spine Crease (Desktop) */}
                      <div
                        aria-hidden="true"
                        className="hidden lg:block pointer-events-none absolute inset-y-0 left-5/12 -translate-x-1/2 w-8 z-10 bg-gradient-to-r from-transparent via-[#B8A58B]/30 to-transparent"
                      />

                      {/* Left Page (Verso): Chapter Index & Encouragement */}
                      <div className="lg:col-span-5 p-6 sm:p-8 lg:p-9 bg-[linear-gradient(135deg,#FCF7EC_0%,#F4ECDA_100%)] border-b lg:border-b-0 lg:border-r border-[#DDD0BC] flex flex-col justify-between gap-6">
                        <div className="space-y-5">
                          <div className="flex items-center justify-between text-xs text-[#7B6957]">
                            <span className="uppercase tracking-[0.16em] font-semibold">
                              {currentChapter.roman}
                            </span>
                            <span className="font-mono-tabular">{currentChapter.timeRange}</span>
                          </div>

                          <div
                            className={`w-14 h-14 rounded-2xl border ${currentChapter.accentBg} ${currentChapter.accentBorder} ${currentChapter.accentText} flex items-center justify-center`}
                          >
                            <currentChapter.icon className="w-7 h-7" />
                          </div>

                          <div className="space-y-2">
                            <h2
                              className={`${EDITORIAL_SERIF} text-2xl sm:text-3xl font-bold text-[#2B231D]`}
                            >
                              {currentChapter.title}
                            </h2>
                            <p className="text-sm text-[#5A4C3F] leading-relaxed">
                              {currentChapter.subtitle}
                            </p>
                          </div>

                          <div className="p-4 rounded-2xl bg-[#FFFDF8]/85 border border-[#E4D8C4]">
                            <p className={`${EDITORIAL_SERIF} italic text-sm text-[#4A3E33] leading-relaxed`}>
                              &ldquo;{currentChapter.guidingNote}&rdquo;
                            </p>
                          </div>
                        </div>

                        {/* Chapter Progress Summary */}
                        {(() => {
                          const allInChap = routinesByChapter[currentChapter.id];
                          const doneCount = allInChap.filter(
                            (r) => r.status === 'completed'
                          ).length;
                          const pendingCount = allInChap.length - doneCount;
                          return (
                            <div className="pt-5 border-t border-[#E1D4BE] space-y-3">
                              <div className="flex items-center justify-between text-xs text-[#6B5B4B] font-mono-tabular">
                                <span>Chapter progress</span>
                                <span className="font-semibold text-[#2B231D]">
                                  {doneCount} completed · {pendingCount} pending
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-[#E5DAC7] overflow-hidden">
                                <div
                                  className="h-full bg-[#267350] rounded-full transition-all duration-300"
                                  style={{
                                    width: `${
                                      allInChap.length > 0
                                        ? Math.round((doneCount / allInChap.length) * 100)
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={onOpenAddRoutine}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#EFE6D5] hover:bg-[#E4D6BE] border border-[#D4C3A8] text-xs font-semibold text-[#3B2E24] transition-colors cursor-pointer"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Add a routine to your day</span>
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Right Page (Recto): Ruled Routine Entries */}
                      <div className="lg:col-span-7 p-6 sm:p-8 lg:p-9 bg-[linear-gradient(225deg,#FFFDF8_0%,#F8F2E4_100%)] flex flex-col justify-between gap-5">
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5D9C5]">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7B6957]">
                              Today&apos;s {currentChapter.title}
                            </span>
                            <span className="text-xs font-mono-tabular text-[#7B6957]">
                              Page {pageIndex} of {BOOK_PAGES.length - 1}
                            </span>
                          </div>

                          {(() => {
                            const visible = filterList(routinesByChapter[currentChapter.id]);
                            if (visible.length === 0) {
                              return (
                                <div className="py-12 px-6 text-center rounded-2xl bg-[#FFFDF8] border border-dashed border-[#D6C7B0] space-y-3">
                                  <p className={`${EDITORIAL_SERIF} text-lg font-semibold text-[#2B231D]`}>
                                    {statusFilter === 'all'
                                      ? `No routines scheduled for ${currentChapter.title.toLowerCase()} yet`
                                      : `No ${statusFilter} routines in ${currentChapter.title.toLowerCase()}`}
                                  </p>
                                  <p className="text-sm text-[#6B5B4B]">
                                    {statusFilter !== 'all'
                                      ? 'Switch the filter back to All or add a new routine for this time of day.'
                                      : 'Add a calm reminder or daily step and it will appear right on this page.'}
                                  </p>
                                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                                    {statusFilter !== 'all' && (
                                      <button
                                        type="button"
                                        onClick={() => setStatusFilter('all')}
                                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#EFE6D5] text-[#2B231D] cursor-pointer"
                                      >
                                        Show all routines
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={onOpenAddRoutine}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#6E4932] text-white cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add routine</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-3.5">
                                {visible.map(renderRoutineEntry)}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LAST PAGE: SUMMARY & BACK COVER */}
                  {currentPage.id === 'summary' && (
                    <div className="min-h-[460px] p-6 sm:p-10 bg-[linear-gradient(135deg,#FCF7EC_0%,#F3E9D6_100%)] flex flex-col justify-between gap-8">
                      <div className="space-y-2 border-b border-[#DFD2BC] pb-5">
                        <p className="text-xs uppercase tracking-[0.16em] text-[#7B6957] font-semibold">
                          End of Day Overview
                        </p>
                        <h2 className={`${EDITORIAL_SERIF} text-2xl sm:text-3xl font-bold text-[#2B231D]`}>
                          Today&apos;s Routine Summary
                        </h2>
                        <p className="text-sm text-[#5A4C3F]">
                          A clear snapshot across Morning, Afternoon, Evening, and Night chapters.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {CHAPTERS.map((chap, idx) => {
                          const list = routinesByChapter[chap.id];
                          const done = list.filter((r) => r.status === 'completed').length;
                          const pending = list.length - done;
                          return (
                            <div
                              key={chap.id}
                              className="rounded-2xl bg-[#FFFDF8] border border-[#E2D6C1] p-5 flex flex-col justify-between gap-4"
                            >
                              <div className="space-y-2">
                                <div
                                  className={`w-10 h-10 rounded-xl border ${chap.accentBg} ${chap.accentBorder} ${chap.accentText} flex items-center justify-center`}
                                >
                                  <chap.icon className="w-5 h-5" />
                                </div>
                                <h3 className={`${EDITORIAL_SERIF} text-base font-bold text-[#2B231D]`}>
                                  {chap.title}
                                </h3>
                                <p className="text-xs text-[#6B5B4B] font-mono-tabular">
                                  {done} completed · {pending} pending
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => goToPage(idx + 1)}
                                className="self-start text-xs font-semibold text-[#6E4932] hover:underline cursor-pointer"
                              >
                                Turn to {chap.roman} →
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-5 rounded-2xl bg-[#FFFDF8] border border-[#E2D6C1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[#2B231D]">
                            Overall today: {totals.completed} completed, {totals.pending} pending
                          </p>
                          <p className="text-xs text-[#6B5B4B] mt-0.5">
                            {totals.remindersOn} routines currently have caregiver alerts enabled.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => goToPage(0)}
                            className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#EFE6D5] hover:bg-[#E4D6BE] text-[#2B231D] cursor-pointer"
                          >
                            Back to Front Cover
                          </button>
                          <button
                            type="button"
                            onClick={onOpenAddRoutine}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#6E4932] hover:bg-[#573825] text-white cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add routine</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Large Accessible Page-Turn Footer Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={pageIndex === 0}
              onClick={() => goToPage(pageIndex - 1)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-white border border-[#DFD3C0] text-sm font-semibold text-[#2B231D] hover:bg-[#F6EFE2] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>
                {pageIndex > 0
                  ? `Previous: ${BOOK_PAGES[pageIndex - 1].shortLabel}`
                  : 'First page'}
              </span>
            </button>

            <p className="text-xs text-center text-[#6B5B4B] font-mono-tabular">
              {currentPage.label} · Use arrow keys, buttons, or swipe to flip pages
            </p>

            <button
              type="button"
              disabled={pageIndex === BOOK_PAGES.length - 1}
              onClick={() => goToPage(pageIndex + 1)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-[#6E4932] hover:bg-[#573825] text-sm font-semibold text-white disabled:opacity-40 transition-colors cursor-pointer"
            >
              <span>
                {pageIndex < BOOK_PAGES.length - 1
                  ? `Next: ${BOOK_PAGES[pageIndex + 1].shortLabel}`
                  : 'End of book'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Accessible Simple List View Alternative (Zero Page Flipping) */
        <div className="space-y-6">
          {CHAPTERS.map((chap) => {
            const visible = filterList(routinesByChapter[chap.id]);
            return (
              <section
                key={chap.id}
                className="rounded-2xl bg-[#FAF4E8] border border-[#DFD3C0] p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E5D9C5]">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl border ${chap.accentBg} ${chap.accentBorder} ${chap.accentText} flex items-center justify-center`}
                    >
                      <chap.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className={`${EDITORIAL_SERIF} text-lg font-bold text-[#2B231D]`}>
                        {chap.title}
                      </h2>
                      <p className="text-xs text-[#6B5B4B]">{chap.timeRange}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono-tabular text-[#6B5B4B]">
                    {visible.length} {visible.length === 1 ? 'routine' : 'routines'}
                  </span>
                </div>

                {visible.length === 0 ? (
                  <p className="text-sm text-[#6B5B4B] py-2">
                    No {statusFilter === 'all' ? '' : `${statusFilter} `}routines in{' '}
                    {chap.title.toLowerCase()}.
                  </p>
                ) : (
                  <div className="space-y-3">{visible.map(renderRoutineEntry)}</div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Daily-Routines-Specific Edit Routine Modal */}
      {editingRoutine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-routine-title"
        >
          <div
            className="fixed inset-0 bg-[#241A13]/50 backdrop-blur-[2px]"
            onClick={() => setEditingRoutine(null)}
          />
          <div className="relative z-10 w-full max-w-lg bg-[#FFFDF8] text-[#2B231D] rounded-2xl border border-[#DFD3C0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#F6EFE2] border-b border-[#E5D9C5] flex items-center justify-between">
              <h2 id="edit-routine-title" className={`${EDITORIAL_SERIF} text-lg font-bold`}>
                Edit Routine
              </h2>
              <button
                type="button"
                onClick={() => setEditingRoutine(null)}
                aria-label="Close edit dialog"
                className="p-2 rounded-xl text-[#6B5B4B] hover:bg-[#EAE0CE] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#54473B] mb-1.5">
                  Routine name
                </label>
                <input
                  type="text"
                  required
                  value={editingRoutine.title}
                  onChange={(e) =>
                    setEditingRoutine({ ...editingRoutine, title: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8CBB6] rounded-xl focus:outline-none focus:border-[#6E4932]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1.5">
                    Scheduled time
                  </label>
                  <input
                    type="time"
                    required
                    value={editingRoutine.time}
                    onChange={(e) =>
                      setEditingRoutine({ ...editingRoutine, time: e.target.value })
                    }
                    className="w-full px-3 py-2.5 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1.5">
                    Category
                  </label>
                  <select
                    value={editingRoutine.category}
                    onChange={(e) =>
                      setEditingRoutine({
                        ...editingRoutine,
                        category: e.target.value as RoutineRecord['category'],
                      })
                    }
                    className="w-full px-3 py-2.5 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  >
                    <option value="Self-care">Self-care</option>
                    <option value="Meals">Meals</option>
                    <option value="Movement">Movement</option>
                    <option value="Health">Health</option>
                    <option value="Family">Family</option>
                    <option value="Rest">Rest</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1.5">
                    Status
                  </label>
                  <select
                    value={editingRoutine.status}
                    onChange={(e) =>
                      setEditingRoutine({
                        ...editingRoutine,
                        status: e.target.value as RoutineRecord['status'],
                      })
                    }
                    className="w-full px-3 py-2.5 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="snoozed">Snoozed</option>
                    <option value="skipped">Skipped</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54473B] mb-1.5">
                  Short description / helpful notes
                </label>
                <textarea
                  rows={3}
                  value={editingRoutine.notes}
                  onChange={(e) =>
                    setEditingRoutine({ ...editingRoutine, notes: e.target.value })
                  }
                  placeholder="Helpful steps or cues for this routine..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#D8CBB6] rounded-xl focus:outline-none focus:border-[#6E4932]"
                />
              </div>

              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F6EFE2] border border-[#E5D9C5] text-sm text-[#2B231D] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingRoutine.caregiverAlertOnMiss}
                  onChange={(e) =>
                    setEditingRoutine({
                      ...editingRoutine,
                      caregiverAlertOnMiss: e.target.checked,
                    })
                  }
                  className="w-5 h-5 accent-[#6E4932]"
                />
                <span>Enable caregiver reminder if this routine is missed</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRoutine(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-[#54473B] bg-[#F2EADF] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#6E4932] hover:bg-[#573825] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily-Routines-Specific Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-routine-title"
        >
          <div
            className="fixed inset-0 bg-[#241A13]/50 backdrop-blur-[2px]"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-10 w-full max-w-md bg-[#FFFDF8] text-[#2B231D] rounded-2xl border border-[#DFD3C0] shadow-2xl p-6 space-y-4">
            <h2 id="delete-routine-title" className={`${EDITORIAL_SERIF} text-lg font-bold`}>
              Remove routine from book?
            </h2>
            <p className="text-sm text-[#54473B] leading-relaxed">
              Are you sure you want to remove &ldquo;{deleteTarget.title}&rdquo; ({deleteTarget.displayTime}) from your daily schedule?
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 text-sm font-semibold text-[#54473B] bg-[#F2EADF] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingId)}
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-[#B83232] hover:bg-[#992626] rounded-xl cursor-pointer disabled:opacity-50"
              >
                {deletingId ? 'Removing...' : 'Delete routine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
