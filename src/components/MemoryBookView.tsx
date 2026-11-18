import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Expand,
  LayoutList,
  Link2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Shield,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { api, formatFriendlyDate } from '../lib/api';
import {
  MEMORY_CATEGORIES,
  type MemoryCategory,
  type MemoryRecord,
  type MemorySource,
  type PrivacyLevel,
  type VaultClientData,
  type VerificationStatus,
} from '../types/memory';

interface MemoryBookViewProps {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenNewMemory: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type ThematicBrowse =
  | 'All'
  | 'Family'
  | 'Important Events'
  | 'Travel & Places'
  | 'Personal Notes'
  | 'Photos & Voice';

const EDITORIAL_SERIF =
  "font-['Georgia','Palatino_Linotype','Book_Antiqua',serif]";
const HANDWRITTEN_CAPTION =
  "font-['Bradley_Hand','Segoe_Print','Apple_Chancery',Georgia,serif] italic";

function getMemoryTimestamp(mem: MemoryRecord): number {
  const raw = mem.eventDate || mem.createdAt;
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? 0 : ts;
}

function matchesThematicFilter(mem: MemoryRecord, theme: ThematicBrowse): boolean {
  if (theme === 'All') return true;
  const tagText = mem.tags.join(' ').toLowerCase();
  const titleDesc = `${mem.title} ${mem.description}`.toLowerCase();
  if (theme === 'Family') {
    return (
      mem.category === 'Family memories' ||
      mem.category === 'People' ||
      mem.category === 'Relationships' ||
      tagText.includes('family')
    );
  }
  if (theme === 'Important Events') {
    return (
      mem.category === 'Important events' ||
      mem.category === 'Appointments' ||
      tagText.includes('anniversary')
    );
  }
  if (theme === 'Travel & Places') {
    return (
      mem.category === 'Places' ||
      mem.associatedLocations.length > 0 ||
      tagText.includes('travel') ||
      titleDesc.includes('visit') ||
      titleDesc.includes('palace')
    );
  }
  if (theme === 'Personal Notes') {
    return (
      mem.category === 'Preferences' ||
      mem.category === 'Daily routines' ||
      mem.category === 'Personal belongings' ||
      mem.category === 'Activities' ||
      tagText.includes('reflection') ||
      tagText.includes('private')
    );
  }
  if (theme === 'Photos & Voice') {
    return (
      mem.category === 'Photographs' ||
      mem.category === 'Voice notes' ||
      Boolean(mem.imageUrl) ||
      Boolean(mem.audioDataUrl)
    );
  }
  return true;
}

function BookPhotoPlate({
  mem,
  onOpenDetail,
  onQuickAttachPhoto,
}: {
  mem: MemoryRecord;
  onOpenDetail: () => void;
  onQuickAttachPhoto: () => void;
}) {
  const [imgErrored, setImgErrored] = useState(false);

  useEffect(() => {
    setImgErrored(false);
  }, [mem.imageUrl]);

  if (!mem.imageUrl || imgErrored) {
    return (
      <div className="bg-[#FFFDF8] p-4 sm:p-5 rounded-sm border border-[#DED2BE] shadow-[0_10px_24px_-12px_rgba(48,34,24,0.22)] space-y-4">
        <div className="h-44 sm:h-52 rounded-xs bg-gradient-to-br from-[#F4ECE0] via-[#FAF6EE] to-[#EAE0CF] border border-[#E4D8C4] p-5 flex flex-col justify-between text-[#4A3D32]">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-[#7D6C5B]">
            <span>{mem.category}</span>
            <BookOpen className="w-4 h-4 opacity-75" />
          </div>
          <p className={`${EDITORIAL_SERIF} italic text-sm sm:text-base leading-relaxed line-clamp-4`}>
            &ldquo;{mem.description}&rdquo;
          </p>
          <div className="flex items-center justify-between text-xs text-[#7D6C5B]">
            <span>Written Memory</span>
            <span className="font-mono-tabular">
              {formatFriendlyDate(mem.eventDate || mem.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className={`${HANDWRITTEN_CAPTION} text-sm text-[#5A4B3E] truncate`}>
            {mem.title}
          </span>
          <button
            type="button"
            onClick={onQuickAttachPhoto}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7A442E] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Add photo</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFDF8] p-3 sm:p-4 pb-5 rounded-sm border border-[#DED2BE] shadow-[0_14px_30px_-14px_rgba(48,34,24,0.28)] space-y-3">
      <button
        type="button"
        onClick={onOpenDetail}
        className="group relative block w-full h-52 sm:h-60 overflow-hidden bg-[#EAE2D3] border border-[#E2D6C2] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#7A442E]"
        aria-label={`View full photograph for ${mem.title}`}
      >
        <img
          src={mem.imageUrl}
          alt={mem.title}
          referrerPolicy="no-referrer"
          onError={() => setImgErrored(true)}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#241B15]/75 text-[#FFFDF8] text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          <Expand className="w-3 h-3" />
          <span>View full</span>
        </span>
      </button>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <p className={`${HANDWRITTEN_CAPTION} text-base text-[#2F251E] truncate`}>
          {mem.title}
        </p>
        <span className="font-mono-tabular text-[11px] text-[#7D6C5B] shrink-0">
          {formatFriendlyDate(mem.eventDate || mem.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function MemoryBookView({
  vault,
  onVaultUpdate,
  onOpenNewMemory,
  onToast,
}: MemoryBookViewProps) {
  const [viewMode, setViewMode] = useState<'book' | 'list'>('book');
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState<ThematicBrowse>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | MemoryCategory>('All');
  const [sortBy, setSortBy] = useState<'chronological' | 'newest'>('chronological');

  // pageIndex 0 = Front Cover ("My Memory Book")
  // pageIndex 1..N = Individual Memory Spreads
  // pageIndex N+1 = Back Index Spread
  const [pageIndex, setPageIndex] = useState(0);
  const [flipDirection, setFlipDirection] = useState<1 | -1>(1);

  const [detailMemory, setDetailMemory] = useState<MemoryRecord | null>(null);
  const [editing, setEditing] = useState<MemoryRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemoryRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const touchStartX = useRef<number | null>(null);

  const prefersReducedMotion = useMemo(() => {
    if (vault.settings.reducedMotion) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, [vault.settings.reducedMotion]);

  const filteredMemories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vault.memories
      .filter((m) => {
        if (!matchesThematicFilter(m, themeFilter)) return false;
        if (categoryFilter !== 'All' && m.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.associatedPeople.some((p) => p.toLowerCase().includes(q)) ||
          m.associatedLocations.some((l) => l.toLowerCase().includes(q)) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const diff = getMemoryTimestamp(a) - getMemoryTimestamp(b);
        if (diff !== 0) {
          return sortBy === 'chronological' ? diff : -diff;
        }
        return sortBy === 'chronological'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt);
      });
  }, [vault.memories, search, themeFilter, categoryFilter, sortBy]);

  const totalBookPages = filteredMemories.length + 2; // Cover + N memories + Back Index

  // Keep pageIndex within bounds when memories are added/deleted/filtered
  useEffect(() => {
    if (pageIndex >= totalBookPages) {
      setPageIndex(Math.max(0, totalBookPages - 1));
    }
  }, [pageIndex, totalBookPages]);

  // When searching or filtering while on Cover, jump straight to first matching memory page if available
  const handleFilterChange = (updater: () => void) => {
    updater();
    setFlipDirection(1);
    setPageIndex(1);
  };

  const goToPage = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(totalBookPages - 1, nextIndex));
      if (clamped === pageIndex) return;
      setFlipDirection(clamped > pageIndex ? 1 : -1);
      setPageIndex(clamped);
    },
    [pageIndex, totalBookPages]
  );

  // Sync detailMemory if vault updates
  useEffect(() => {
    if (detailMemory) {
      const fresh = vault.memories.find((m) => m.id === detailMemory.id) || null;
      setDetailMemory(fresh);
    }
  }, [vault.memories, detailMemory]);

  // Keyboard navigation in Book View
  useEffect(() => {
    if (viewMode !== 'book' || detailMemory || editing || deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, pageIndex, goToPage, detailMemory, editing, deleteTarget]);

  // Escape closes dialogs
  useEffect(() => {
    if (!detailMemory && !editing && !deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null);
        else if (editing) setEditing(null);
        else setDetailMemory(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailMemory, editing, deleteTarget]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditing({ ...editing, imageUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateMemory(editing.id, {
        title: editing.title,
        category: editing.category,
        eventDate: editing.eventDate,
        description: editing.description,
        source: editing.source,
        verificationStatus: editing.verificationStatus,
        privacyLevel: editing.privacyLevel,
        associatedPeople: editing.associatedPeople,
        associatedLocations: editing.associatedLocations,
        tags: editing.tags,
        linkedMemoryIds: editing.linkedMemoryIds,
        imageUrl: editing.imageUrl,
      });
      onVaultUpdate(updated);
      onToast('Memory updated in your book.');
      setEditing(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const updated = await api.deleteMemory(id);
      onVaultUpdate(updated);
      onToast('Memory removed from your book.');
      setDeleteTarget(null);
      setDetailMemory(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const activeMemory =
    pageIndex >= 1 && pageIndex <= filteredMemories.length
      ? filteredMemories[pageIndex - 1]
      : null;

  const isBackCover = pageIndex === totalBookPages - 1 && filteredMemories.length > 0;
  const photosCount = vault.memories.filter((m) => Boolean(m.imageUrl)).length;

  const pageFlipVariants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: (dir: 1 | -1) => ({
          opacity: 0,
          rotateY: dir > 0 ? 16 : -16,
          x: dir > 0 ? 26 : -26,
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
          rotateY: dir > 0 ? -16 : 16,
          x: dir > 0 ? -26 : 26,
          scale: 0.985,
        }),
      };

  return (
    <div className="space-y-5">
      {/* Header & Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`${EDITORIAL_SERIF} text-2xl sm:text-3xl font-bold text-[#2B231D]`}>
            My Memories
          </h1>
          <p className="text-sm text-[#6B5B4B] mt-0.5">
            {vault.settings.userName}&apos;s personal memory book · {vault.memories.length} saved
            memories · {photosCount} photographs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Book Mode vs Simple List Alternative */}
          <div
            role="group"
            aria-label="Memory browsing mode"
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
              <span>Memory book</span>
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
            onClick={onOpenNewMemory}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] text-sm font-semibold text-white bg-[#7A442E] hover:bg-[#613422] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Save a memory</span>
          </button>
        </div>
      </div>

      {/* Search, Thematic Quick Browse & Category Filter Bar */}
      <div className="rounded-2xl bg-[#FAF4E8] border border-[#DFD3C0] p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#7B6B5B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (viewMode === 'book') {
                  setPageIndex(val.trim() ? 1 : 0);
                }
              }}
              placeholder="Search memory titles, people, places, or notes..."
              aria-label="Search memories"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#FFFDF8] text-[#2B231D] border border-[#D8CBB6] rounded-xl focus:outline-none focus:border-[#7A442E]"
            />
          </div>

          <div className="md:col-span-4">
            <select
              value={categoryFilter}
              onChange={(e) =>
                handleFilterChange(() =>
                  setCategoryFilter(e.target.value as 'All' | MemoryCategory)
                )
              }
              aria-label="Filter by exact memory category"
              className="w-full px-3.5 py-2.5 text-sm bg-[#FFFDF8] text-[#2B231D] border border-[#D8CBB6] rounded-xl cursor-pointer"
            >
              <option value="All">All Kindred categories ({vault.memories.length})</option>
              {MEMORY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'chronological' | 'newest')
              }
              aria-label="Sort memories"
              className="w-full px-3.5 py-2.5 text-sm bg-[#FFFDF8] text-[#2B231D] border border-[#D8CBB6] rounded-xl cursor-pointer"
            >
              <option value="chronological">Chronological (Oldest first)</option>
              <option value="newest">Newest memories first</option>
            </select>
          </div>
        </div>

        {/* Thematic Chapter Browse Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
          {(
            [
              'All',
              'Family',
              'Important Events',
              'Travel & Places',
              'Personal Notes',
              'Photos & Voice',
            ] as ThematicBrowse[]
          ).map((theme) => {
            const active = themeFilter === theme;
            return (
              <button
                key={theme}
                type="button"
                onClick={() =>
                  handleFilterChange(() => {
                    setThemeFilter(theme);
                    if (theme === 'All') setCategoryFilter('All');
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#7A442E] text-[#FFFDF8]'
                    : 'bg-[#FFFDF8] border border-[#DFD3C0] text-[#5A4B3E] hover:bg-[#EFE5D4]'
                }`}
              >
                {theme === 'All' ? 'All chapters' : theme}
              </button>
            );
          })}
        </div>
      </div>

      {/* BOOK VIEW */}
      {viewMode === 'book' ? (
        <div className="space-y-4">
          {/* Quick Page Tabs / Index Strip */}
          {filteredMemories.length > 0 && (
            <nav
              aria-label="Memory book pages"
              className="flex items-center gap-1.5 overflow-x-auto pb-1"
            >
              <button
                type="button"
                onClick={() => goToPage(0)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border ${
                  pageIndex === 0
                    ? 'bg-[#7A442E] border-[#7A442E] text-white'
                    : 'bg-[#F8F2E6] border-[#DFD3C0] text-[#54473B] hover:bg-[#EFE5D4]'
                }`}
              >
                Cover
              </button>
              {filteredMemories.map((mem, idx) => {
                const pIdx = idx + 1;
                const active = pageIndex === pIdx;
                return (
                  <button
                    key={mem.id}
                    type="button"
                    onClick={() => goToPage(pIdx)}
                    title={mem.title}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 max-w-[170px] truncate cursor-pointer border ${
                      active
                        ? 'bg-[#7A442E] border-[#7A442E] text-white font-semibold'
                        : 'bg-[#F8F2E6] border-[#DFD3C0] text-[#54473B] hover:bg-[#EFE5D4]'
                    }`}
                  >
                    <span className="font-mono-tabular mr-1.5 opacity-75">
                      {String(pIdx).padStart(2, '0')}
                    </span>
                    <span>{mem.title}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => goToPage(totalBookPages - 1)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border ${
                  isBackCover
                    ? 'bg-[#7A442E] border-[#7A442E] text-white'
                    : 'bg-[#F8F2E6] border-[#DFD3C0] text-[#54473B] hover:bg-[#EFE5D4]'
                }`}
              >
                Index
              </button>
            </nav>
          )}

          {/* Hardcover Book Binding & Layered Paper Edges */}
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
            className="rounded-[26px] p-2.5 sm:p-4 bg-gradient-to-br from-[#472F2B] via-[#35221F] to-[#261715] shadow-[0_24px_55px_-22px_rgba(32,18,14,0.5)] border border-[#5B3E38]"
            style={{ perspective: '2200px' }}
          >
            <div className="rounded-[18px] bg-[#E8DEC9] p-1 sm:p-1.5 shadow-inner border border-[#CDBEAA]">
              <AnimatePresence mode="wait" custom={flipDirection}>
                <motion.div
                  key={
                    filteredMemories.length === 0
                      ? 'empty'
                      : pageIndex === 0
                      ? 'cover'
                      : isBackCover
                      ? 'index'
                      : activeMemory?.id || pageIndex
                  }
                  custom={flipDirection}
                  variants={pageFlipVariants}
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
                  {/* EMPTY SEARCH / FILTER STATE */}
                  {filteredMemories.length === 0 && (
                    <div className="min-h-[420px] p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 bg-[linear-gradient(135deg,#FCF7EC_0%,#F4ECDA_100%)]">
                      <div className="w-12 h-12 rounded-2xl bg-[#EFE5D4] border border-[#D8CBB6] text-[#7A442E] flex items-center justify-center">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <h2 className={`${EDITORIAL_SERIF} text-2xl font-bold text-[#2B231D]`}>
                        No matching pages found
                      </h2>
                      <p className="text-sm text-[#6B5B4B] max-w-md">
                        Try clearing your search or category filter, or save a new memory directly into your book.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setThemeFilter('All');
                            setCategoryFilter('All');
                            setPageIndex(0);
                          }}
                          className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#EFE6D5] hover:bg-[#E4D6BE] text-[#2B231D] cursor-pointer"
                        >
                          Clear all filters
                        </button>
                        <button
                          type="button"
                          onClick={onOpenNewMemory}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#7A442E] hover:bg-[#613422] text-white cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Save a memory</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PAGE 0: FRONT COVER ("My Memory Book") */}
                  {filteredMemories.length > 0 && pageIndex === 0 && (
                    <div className="min-h-[480px] p-6 sm:p-10 lg:p-14 bg-[radial-gradient(circle_at_24%_20%,#4E342F_0%,#34211E_65%,#231614_100%)] text-[#FBF5E8] flex flex-col justify-between gap-8 relative">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-4 sm:inset-6 rounded-xl border border-[#D4B47B]/40"
                      />

                      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-[#DFC495]">
                        <span>{vault.settings.userName}&apos;s Personal Keepsake</span>
                        <span className="font-mono-tabular">
                          {filteredMemories.length}{' '}
                          {filteredMemories.length === 1 ? 'memory' : 'memories'}
                        </span>
                      </div>

                      <div className="relative z-10 max-w-2xl space-y-4 my-auto py-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#DFC495]">
                          Personal Journal &amp; Keepsake Album
                        </p>
                        <h2
                          className={`${EDITORIAL_SERIF} text-3xl sm:text-5xl font-bold leading-tight text-[#FFF8EC]`}
                        >
                          My Memory Book
                        </h2>
                        <p className="text-sm sm:text-base text-[#E6D9C5] leading-relaxed max-w-xl">
                          Welcome to your quiet personal treasury—keeping family stories,
                          meaningful visits, cherished photographs, and everyday notes safe in
                          your own hands.
                        </p>

                        <div className="pt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => goToPage(1)}
                            className="inline-flex items-center gap-2 px-6 py-3 min-h-[46px] rounded-xl bg-[#D9B675] hover:bg-[#E4C58B] text-[#241812] text-sm font-bold transition-colors cursor-pointer"
                          >
                            <span>Open Page 1</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={onOpenNewMemory}
                            className="inline-flex items-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-white/10 hover:bg-white/15 border border-[#D4B47B]/40 text-[#FFF8EC] text-sm font-medium transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Save a memory</span>
                          </button>
                        </div>
                      </div>

                      {/* Quick Preview Tiles on Cover */}
                      <div className="relative z-10 pt-5 border-t border-[#D4B47B]/25 space-y-2.5">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#DFC495]">
                          Jump straight to a saved memory
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {filteredMemories.slice(0, 3).map((mem, idx) => (
                            <button
                              key={mem.id}
                              type="button"
                              onClick={() => goToPage(idx + 1)}
                              className="text-left p-3.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/12 transition-colors cursor-pointer"
                            >
                              <p className="text-[11px] font-mono-tabular text-[#DFC495]">
                                {formatFriendlyDate(mem.eventDate || mem.createdAt)} ·{' '}
                                {mem.category}
                              </p>
                              <p className="text-sm font-semibold text-[#FFF8EC] truncate mt-1">
                                {mem.title}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MEMORY SPREAD (TWO-PAGE OPEN BOOK ON DESKTOP) */}
                  {filteredMemories.length > 0 && activeMemory && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px] relative">
                      {/* Center Spine Crease (Desktop) */}
                      <div
                        aria-hidden="true"
                        className="hidden lg:block pointer-events-none absolute inset-y-0 left-5/12 -translate-x-1/2 w-8 z-10 bg-gradient-to-r from-transparent via-[#B8A58B]/30 to-transparent"
                      />

                      {/* Left Page (Verso): Photo Plate + People & Place Metadata */}
                      <div className="lg:col-span-5 p-6 sm:p-8 lg:p-9 bg-[linear-gradient(135deg,#FCF7EC_0%,#F4ECDA_100%)] border-b lg:border-b-0 lg:border-r border-[#DDD0BC] flex flex-col justify-between gap-6">
                        <div className="space-y-5">
                          <div className="flex items-center justify-between text-xs text-[#7B6957]">
                            <span className="font-mono-tabular font-semibold text-[#7A442E]">
                              Memory {pageIndex} of {filteredMemories.length}
                            </span>
                            <span>{activeMemory.category}</span>
                          </div>

                          <BookPhotoPlate
                            mem={activeMemory}
                            onOpenDetail={() => setDetailMemory(activeMemory)}
                            onQuickAttachPhoto={() => setEditing({ ...activeMemory })}
                          />
                        </div>

                        {/* Metadata Ledger on Left Page */}
                        <div className="pt-4 border-t border-[#E1D4BE] space-y-2.5 text-xs text-[#54473B]">
                          <div className="flex items-start gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[#7A442E] mt-0.5 shrink-0" />
                            <div>
                              <span className="font-semibold text-[#2B231D]">Date: </span>
                              <span className="font-mono-tabular">
                                {formatFriendlyDate(
                                  activeMemory.eventDate || activeMemory.createdAt
                                )}
                              </span>
                            </div>
                          </div>

                          {activeMemory.associatedPeople.length > 0 && (
                            <div className="flex items-start gap-2">
                              <Users className="w-3.5 h-3.5 text-[#7A442E] mt-0.5 shrink-0" />
                              <div>
                                <span className="font-semibold text-[#2B231D]">People: </span>
                                <span>{activeMemory.associatedPeople.join(', ')}</span>
                              </div>
                            </div>
                          )}

                          {activeMemory.associatedLocations.length > 0 && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 text-[#7A442E] mt-0.5 shrink-0" />
                              <div>
                                <span className="font-semibold text-[#2B231D]">Place: </span>
                                <span>{activeMemory.associatedLocations.join(', ')}</span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-start gap-2">
                            <Shield className="w-3.5 h-3.5 text-[#7A442E] mt-0.5 shrink-0" />
                            <div>
                              <span className="font-semibold text-[#2B231D]">Record: </span>
                              <span>
                                {activeMemory.source} · {activeMemory.verificationStatus} ·{' '}
                                {activeMemory.privacyLevel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Page (Recto): Full Story, Audio, Tags, Related Links & Actions */}
                      <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 bg-[linear-gradient(225deg,#FFFDF8_0%,#F8F2E4_100%)] flex flex-col justify-between gap-6">
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5D9C5] text-xs text-[#7B6957]">
                            <span className="uppercase tracking-[0.14em] font-semibold text-[#7A442E]">
                              {activeMemory.category}
                            </span>
                            <span className="font-mono-tabular">
                              {activeMemory.confidenceScore}% confidence
                            </span>
                          </div>

                          <h2
                            className={`${EDITORIAL_SERIF} text-2xl sm:text-3xl font-bold leading-snug text-[#2B231D]`}
                          >
                            {activeMemory.title}
                          </h2>

                          <p className="text-sm sm:text-base text-[#3D3229] leading-relaxed whitespace-pre-line">
                            {activeMemory.description}
                          </p>

                          {activeMemory.audioDataUrl && (
                            <div className="pt-2">
                              <p className="text-xs font-semibold text-[#6B5B4B] mb-1.5">
                                Saved Voice Recording
                              </p>
                              <audio
                                controls
                                src={activeMemory.audioDataUrl}
                                className="w-full h-10"
                              />
                            </div>
                          )}

                          {activeMemory.evidenceNote && (
                            <div className="p-3.5 rounded-xl bg-[#F5EDE0] border border-[#E4D7C3] text-xs text-[#5A4B3E]">
                              <span className="font-semibold text-[#2B231D]">Source note: </span>
                              {activeMemory.evidenceNote}
                            </div>
                          )}

                          {activeMemory.tags.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-[#6B5B4B] pt-1">
                              <Tag className="w-3.5 h-3.5 text-[#7A442E] shrink-0" />
                              <span>{activeMemory.tags.join(' · ')}</span>
                            </div>
                          )}

                          {activeMemory.linkedMemoryIds.length > 0 && (
                            <div className="pt-3 border-t border-[#EAE0CF] space-y-2">
                              <p className="text-xs font-semibold text-[#2B231D] flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 text-[#7A442E]" />
                                <span>Related memories</span>
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {vault.memories
                                  .filter((other) =>
                                    activeMemory.linkedMemoryIds.includes(other.id)
                                  )
                                  .map((rel) => (
                                    <button
                                      key={rel.id}
                                      type="button"
                                      onClick={() => {
                                        const idxInBook = filteredMemories.findIndex(
                                          (m) => m.id === rel.id
                                        );
                                        if (idxInBook !== -1) {
                                          goToPage(idxInBook + 1);
                                        } else {
                                          setDetailMemory(rel);
                                        }
                                      }}
                                      className="px-3 py-1.5 rounded-lg bg-[#F4ECE0] hover:bg-[#E7DAC5] border border-[#DDD0BC] text-xs font-medium text-[#2B231D] cursor-pointer"
                                    >
                                      {rel.title}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Page Action Controls */}
                        <div className="pt-4 border-t border-[#E5D9C5] flex flex-wrap items-center justify-between gap-2.5">
                          <button
                            type="button"
                            onClick={() => setDetailMemory(activeMemory)}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#EFE6D5] hover:bg-[#E4D6BE] border border-[#D4C3A8] text-xs font-semibold text-[#2B231D] cursor-pointer"
                          >
                            <Expand className="w-3.5 h-3.5" />
                            <span>Open full view</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditing({ ...activeMemory })}
                              className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-white border border-[#D8CBB6] hover:bg-[#F4EDE0] text-xs font-semibold text-[#2B231D] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(activeMemory)}
                              className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-white border border-[#E5C5C2] hover:bg-[#FCECEB] text-xs font-semibold text-[#A32929] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LAST PAGE: BACK INDEX SPREAD */}
                  {filteredMemories.length > 0 && isBackCover && (
                    <div className="min-h-[480px] p-6 sm:p-10 bg-[linear-gradient(135deg,#FCF7EC_0%,#F3E9D6_100%)] flex flex-col justify-between gap-6">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#DFD2BC] pb-5">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-[#7A442E] font-semibold">
                            Memory Book Index
                          </p>
                          <h2 className={`${EDITORIAL_SERIF} text-2xl sm:text-3xl font-bold text-[#2B231D] mt-1`}>
                            All {filteredMemories.length} Chapters in This View
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenNewMemory}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#7A442E] hover:bg-[#613422] text-white cursor-pointer self-start sm:self-auto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add another memory</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredMemories.map((mem, idx) => (
                          <button
                            key={mem.id}
                            type="button"
                            onClick={() => goToPage(idx + 1)}
                            className="text-left p-4 rounded-xl bg-[#FFFDF8] hover:bg-[#F5EDE0] border border-[#E2D6C1] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="text-[11px] font-mono-tabular text-[#7A442E]">
                                Page {idx + 1} · {formatFriendlyDate(mem.eventDate || mem.createdAt)} ·{' '}
                                {mem.category}
                              </p>
                              <p className={`${EDITORIAL_SERIF} text-sm font-bold text-[#2B231D] truncate mt-0.5`}>
                                {mem.title}
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-[#7B6957] shrink-0" />
                          </button>
                        ))}
                      </div>

                      <div className="pt-4 border-t border-[#DFD2BC] flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => goToPage(0)}
                          className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#EFE6D5] hover:bg-[#E4D6BE] text-[#2B231D] cursor-pointer"
                        >
                          Return to Front Cover
                        </button>
                        <span className="text-xs text-[#6B5B4B] font-mono-tabular">
                          End of Memory Book
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Large Previous / Next Page Navigation */}
          {filteredMemories.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => goToPage(pageIndex - 1)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-white border border-[#DFD3C0] text-sm font-semibold text-[#2B231D] hover:bg-[#F6EFE2] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>
                  {pageIndex === 0
                    ? 'Front cover'
                    : pageIndex === 1
                    ? 'Previous: Cover'
                    : `Previous: Page ${pageIndex - 1}`}
                </span>
              </button>

              <p className="text-xs text-center text-[#6B5B4B] font-mono-tabular">
                {pageIndex === 0
                  ? 'Front Cover · My Memory Book'
                  : isBackCover
                  ? 'Memory Book Index'
                  : `Memory ${pageIndex} of ${filteredMemories.length}`}
                {' · '}Use arrows or swipe
              </p>

              <button
                type="button"
                disabled={pageIndex >= totalBookPages - 1}
                onClick={() => goToPage(pageIndex + 1)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-[#7A442E] hover:bg-[#613422] text-sm font-semibold text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <span>
                  {pageIndex === 0
                    ? 'Open Page 1'
                    : pageIndex === filteredMemories.length
                    ? 'Next: Index'
                    : pageIndex >= totalBookPages - 1
                    ? 'End of book'
                    : `Next: Page ${pageIndex + 1}`}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* SIMPLE LIST ACCESSIBLE ALTERNATIVE */
        <div className="space-y-4">
          {filteredMemories.length === 0 ? (
            <div className="rounded-2xl bg-[#FAF4E8] border border-[#DFD3C0] p-10 text-center space-y-3">
              <p className={`${EDITORIAL_SERIF} text-lg font-bold text-[#2B231D]`}>
                No matching memories found
              </p>
              <p className="text-sm text-[#6B5B4B]">
                Try clearing your filters or save a new personal memory.
              </p>
              <button
                type="button"
                onClick={onOpenNewMemory}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#7A442E] rounded-xl cursor-pointer"
              >
                Save a memory
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMemories.map((mem) => (
                <article
                  key={mem.id}
                  className="rounded-2xl bg-[#FAF4E8] border border-[#DFD3C0] overflow-hidden flex flex-col justify-between"
                >
                  {mem.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setDetailMemory(mem)}
                      className="h-44 w-full overflow-hidden border-b border-[#DFD3C0] cursor-pointer"
                    >
                      <img
                        src={mem.imageUrl}
                        alt={mem.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}

                  <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="text-xs font-mono-tabular text-[#7A442E]">
                        {formatFriendlyDate(mem.eventDate || mem.createdAt)} · {mem.category} ·{' '}
                        {mem.privacyLevel}
                      </p>
                      <h2 className={`${EDITORIAL_SERIF} text-lg font-bold text-[#2B231D]`}>
                        <button
                          type="button"
                          onClick={() => setDetailMemory(mem)}
                          className="text-left hover:text-[#7A442E] transition-colors cursor-pointer"
                        >
                          {mem.title}
                        </button>
                      </h2>
                      <p className="text-sm text-[#3D3229] leading-relaxed line-clamp-3">
                        {mem.description}
                      </p>
                      {mem.audioDataUrl && (
                        <audio controls src={mem.audioDataUrl} className="mt-2 w-full h-9" />
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#E5D9C5] flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-[#6B5B4B] space-x-2">
                        {mem.associatedPeople.length > 0 && (
                          <span>With {mem.associatedPeople.join(', ')}</span>
                        )}
                        {mem.associatedLocations.length > 0 && (
                          <span>· {mem.associatedLocations.join(', ')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDetailMemory(mem)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#FFFDF8] border border-[#D8CBB6] text-[#2B231D] hover:bg-[#EFE5D4] cursor-pointer"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing({ ...mem })}
                          aria-label={`Edit ${mem.title}`}
                          className="p-2 rounded-lg text-[#54473B] hover:bg-[#EFE5D4] cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(mem)}
                          aria-label={`Delete ${mem.title}`}
                          className="p-2 rounded-lg text-[#7A4B47] hover:bg-[#FCECEB] hover:text-[#A32929] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full Memory Detail Modal */}
      {detailMemory && !editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-book-detail-title"
        >
          <div
            className="fixed inset-0 bg-[#241814]/55 backdrop-blur-[2px]"
            onClick={() => setDetailMemory(null)}
          />
          <div className="relative z-10 w-full max-w-2xl bg-[#FFFDF8] text-[#2B231D] rounded-2xl border border-[#DFD3C0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#F6EFE2] border-b border-[#E5D9C5] flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono-tabular text-[#7A442E]">
                  {formatFriendlyDate(detailMemory.eventDate || detailMemory.createdAt)} ·{' '}
                  {detailMemory.category} · {detailMemory.source}
                </p>
                <h2
                  id="memory-book-detail-title"
                  className={`${EDITORIAL_SERIF} text-xl font-bold text-[#2B231D] mt-0.5`}
                >
                  {detailMemory.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailMemory(null)}
                aria-label="Close memory detail"
                className="p-2 rounded-xl text-[#6B5B4B] hover:bg-[#EAE0CE] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {detailMemory.imageUrl && (
                <div className="p-2 bg-white border border-[#E5D9C5] shadow-xs rounded-sm">
                  <img
                    src={detailMemory.imageUrl}
                    alt={detailMemory.title}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-72 object-cover"
                  />
                </div>
              )}

              <p className="text-sm sm:text-[15px] text-[#3D3229] leading-relaxed whitespace-pre-line">
                {detailMemory.description}
              </p>

              {detailMemory.audioDataUrl && (
                <audio controls src={detailMemory.audioDataUrl} className="w-full h-10" />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#EFE7D8] text-xs text-[#6B5B4B]">
                <p>
                  <strong className="text-[#2B231D]">People: </strong>
                  {detailMemory.associatedPeople.length > 0
                    ? detailMemory.associatedPeople.join(', ')
                    : 'None tagged'}
                </p>
                <p>
                  <strong className="text-[#2B231D]">Places: </strong>
                  {detailMemory.associatedLocations.length > 0
                    ? detailMemory.associatedLocations.join(', ')
                    : 'Not specified'}
                </p>
                <p>
                  <strong className="text-[#2B231D]">Verification: </strong>
                  {detailMemory.verificationStatus} ({detailMemory.confidenceScore}%)
                </p>
                <p>
                  <strong className="text-[#2B231D]">Privacy: </strong>
                  {detailMemory.privacyLevel}
                </p>
              </div>

              {detailMemory.tags.length > 0 && (
                <p className="text-xs text-[#6B5B4B]">
                  <strong className="text-[#2B231D]">Tags: </strong>
                  {detailMemory.tags.join(', ')}
                </p>
              )}
              {detailMemory.evidenceNote && (
                <p className="text-xs text-[#6B5B4B]">
                  <strong className="text-[#2B231D]">Note: </strong>
                  {detailMemory.evidenceNote}
                </p>
              )}

              {detailMemory.linkedMemoryIds.length > 0 && (
                <div className="pt-3 border-t border-[#EFE7D8] space-y-2">
                  <p className="text-xs font-semibold text-[#2B231D] flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#7A442E]" />
                    <span>Related memories</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {vault.memories
                      .filter((m) => detailMemory.linkedMemoryIds.includes(m.id))
                      .map((rel) => (
                        <button
                          key={rel.id}
                          type="button"
                          onClick={() => setDetailMemory(rel)}
                          className="px-3 py-1.5 rounded-lg bg-[#F6EFE2] hover:bg-[#EAE0CE] text-xs font-medium text-[#2B231D] cursor-pointer"
                        >
                          {rel.title} · {rel.category}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#EFE7D8] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing({ ...detailMemory })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#F6EFE2] border border-[#D8CBB6] text-[#2B231D] cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit memory</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(detailMemory)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-[#FCECEB] text-[#A32929] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Memory Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-book-edit-title"
        >
          <div
            className="fixed inset-0 bg-[#241814]/55 backdrop-blur-[2px]"
            onClick={() => setEditing(null)}
          />
          <div className="relative z-10 w-full max-w-lg bg-[#FFFDF8] text-[#2B231D] rounded-2xl border border-[#DFD3C0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#F6EFE2] border-b border-[#E5D9C5] flex items-center justify-between">
              <h2 id="memory-book-edit-title" className={`${EDITORIAL_SERIF} text-lg font-bold`}>
                Edit Memory
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close edit dialog"
                className="p-2 rounded-xl text-[#6B5B4B] hover:bg-[#EAE0CE] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#54473B] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl focus:outline-none focus:border-[#7A442E]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">
                    Category
                  </label>
                  <select
                    value={editing.category}
                    onChange={(e) =>
                      setEditing({ ...editing, category: e.target.value as MemoryCategory })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  >
                    {MEMORY_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">Date</label>
                  <input
                    type="date"
                    value={(editing.eventDate || editing.createdAt).slice(0, 10)}
                    onChange={(e) => setEditing({ ...editing, eventDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">
                    Privacy
                  </label>
                  <select
                    value={editing.privacyLevel}
                    onChange={(e) =>
                      setEditing({ ...editing, privacyLevel: e.target.value as PrivacyLevel })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  >
                    <option value="Family-shared">Family-shared</option>
                    <option value="Caregiver-visible">Caregiver-visible</option>
                    <option value="Private">Private</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">
                    Places
                  </label>
                  <input
                    type="text"
                    value={editing.associatedLocations.join(', ')}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        associatedLocations: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="e.g., Home Sunroom"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">
                    Source
                  </label>
                  <select
                    value={editing.source}
                    onChange={(e) =>
                      setEditing({ ...editing, source: e.target.value as MemorySource })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="User-reported">User-reported</option>
                    <option value="Caregiver-reported">Caregiver-reported</option>
                    <option value="Inferred">Inferred</option>
                    <option value="Outdated">Outdated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">
                    Verification status
                  </label>
                  <select
                    value={editing.verificationStatus}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        verificationStatus: e.target.value as VerificationStatus,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  >
                    <option value="Verified">Verified</option>
                    <option value="Unverified">Unverified</option>
                    <option value="Needs review">Needs review</option>
                    <option value="Outdated">Outdated</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54473B] mb-1">
                  Description or personal note
                </label>
                <textarea
                  rows={3}
                  required
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl focus:outline-none focus:border-[#7A442E]"
                />
              </div>

              <label className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#7A442E] bg-[#F6EFE2] hover:bg-[#EAE0CE] border border-[#DFD3C0] rounded-xl cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>{editing.imageUrl ? 'Replace photograph' : 'Attach photograph'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>

              <div>
                <label className="block text-xs font-semibold text-[#54473B] mb-1.5">
                  Link related memories
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 border border-[#DFD3C0] rounded-xl p-2.5 bg-[#FAF4E8]">
                  {vault.memories
                    .filter((other) => other.id !== editing.id)
                    .map((other) => {
                      const linked = editing.linkedMemoryIds.includes(other.id);
                      return (
                        <label key={other.id} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linked}
                            onChange={() =>
                              setEditing({
                                ...editing,
                                linkedMemoryIds: linked
                                  ? editing.linkedMemoryIds.filter((i) => i !== other.id)
                                  : [...editing.linkedMemoryIds, other.id],
                              })
                            }
                            className="accent-[#7A442E]"
                          />
                          <span className="truncate">{other.title}</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-sm font-semibold text-[#54473B] bg-[#F2EADF] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#7A442E] hover:bg-[#613422] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-book-delete-title"
        >
          <div
            className="fixed inset-0 bg-[#241814]/55 backdrop-blur-[2px]"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-10 w-full max-w-md bg-[#FFFDF8] text-[#2B231D] rounded-2xl border border-[#DFD3C0] shadow-2xl p-6 space-y-4">
            <h2 id="memory-book-delete-title" className={`${EDITORIAL_SERIF} text-lg font-bold`}>
              Delete memory from book?
            </h2>
            <p className="text-sm text-[#54473B] leading-relaxed">
              Are you sure you want to remove &ldquo;{deleteTarget.title}&rdquo;? This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-[#54473B] bg-[#F2EADF] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteTarget.id)}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#B83232] hover:bg-[#992626] rounded-xl cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Memory'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
