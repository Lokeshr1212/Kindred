import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Link2,
  MapPin,
  Pencil,
  Plus,
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
  type PrivacyLevel,
  type VaultClientData,
} from '../types/memory';

interface MemoryTimelineAlbumProps {
  vault: VaultClientData;
  onVaultUpdate?: (v: VaultClientData) => void;
  onOpenNewMemory?: () => void;
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

const PRINT_TILTS = [
  '-rotate-[1.2deg]',
  'rotate-[0.9deg]',
  '-rotate-[0.6deg]',
  'rotate-[1.1deg]',
  '-rotate-[0.9deg]',
];

const PRINT_WIDTHS = [
  'w-[290px] sm:w-[320px]',
  'w-[310px] sm:w-[360px]',
  'w-[280px] sm:w-[305px]',
];

const PRINT_IMAGE_HEIGHTS = ['h-48 sm:h-52', 'h-44 sm:h-48', 'h-52 sm:h-56'];

const HANDWRITTEN_FONT_CLASS =
  "font-['Bradley_Hand','Segoe_Print','Apple_Chancery',Georgia,serif] italic";
const EDITORIAL_SERIF_CLASS =
  "font-['Georgia','Palatino_Linotype','Book_Antiqua',serif]";

function getMemoryTimestamp(mem: MemoryRecord): number {
  const raw = mem.eventDate || mem.createdAt;
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? 0 : ts;
}

function getMemoryYear(mem: MemoryRecord): string {
  const raw = mem.eventDate || mem.createdAt;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getFullYear());
}

function AlbumPhotoFrame({
  mem,
  heightClass,
}: {
  mem: MemoryRecord;
  heightClass: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [mem.imageUrl]);

  if (!mem.imageUrl || imgFailed) {
    return (
      <div
        className={`relative w-full ${heightClass} overflow-hidden bg-gradient-to-br from-[#F3ECE0] via-[#FAF6EE] to-[#EAE0CF] border border-[#E5DAC8] flex flex-col justify-between p-4 text-[#4A3E35]`}
      >
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] text-[#8A7968]">
          <span className="truncate">{mem.category}</span>
          <BookOpen className="w-3.5 h-3.5 shrink-0 opacity-75" />
        </div>
        <p
          className={`${EDITORIAL_SERIF_CLASS} text-sm leading-relaxed text-[#3B312B] line-clamp-4 my-auto py-2`}
        >
          &ldquo;{mem.description}&rdquo;
        </p>
        <div className="flex items-center justify-between text-[11px] text-[#8A7968]">
          <span>Written Keepsake</span>
          <span>{formatFriendlyDate(mem.eventDate || mem.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full ${heightClass} overflow-hidden bg-[#EAE2D3] border border-[#E5DAC8]`}
    >
      <img
        src={mem.imageUrl}
        alt={mem.title}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#241D17]/25 via-transparent to-transparent"
      />
    </div>
  );
}

export function MemoryTimelineAlbum({
  vault,
  onVaultUpdate,
  onOpenNewMemory,
  onToast,
}: MemoryTimelineAlbumProps) {
  const [personFilter, setPersonFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'chronological' | 'newest'>('chronological');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [editingMemory, setEditingMemory] = useState<MemoryRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  const prefersReducedMotion = useMemo(() => {
    if (vault.settings.reducedMotion) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, [vault.settings.reducedMotion]);

  const sortedMemories = useMemo(() => {
    const filtered = vault.memories.filter(
      (m) =>
        personFilter === 'All' ||
        m.associatedPeople.some(
          (p) => p.toLowerCase() === personFilter.toLowerCase()
        )
    );
    return [...filtered].sort((a, b) => {
      const diff = getMemoryTimestamp(a) - getMemoryTimestamp(b);
      if (diff !== 0) {
        return sortOrder === 'chronological' ? diff : -diff;
      }
      return sortOrder === 'chronological'
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt);
    });
  }, [vault.memories, personFilter, sortOrder]);

  const dateSpanLabel = useMemo(() => {
    if (sortedMemories.length === 0) return 'Personal Archive';
    const years = sortedMemories
      .map(getMemoryYear)
      .filter(Boolean)
      .sort();
    if (years.length === 0) return 'Personal Archive';
    const first = years[0];
    const last = years[years.length - 1];
    return first === last ? first : `${first} – ${last}`;
  }, [sortedMemories]);

  const photoCount = useMemo(
    () => sortedMemories.filter((m) => Boolean(m.imageUrl)).length,
    [sortedMemories]
  );

  const selectedMemory = useMemo(
    () => sortedMemories.find((m) => m.id === selectedMemoryId) || null,
    [sortedMemories, selectedMemoryId]
  );

  const selectedModalIndex = useMemo(
    () =>
      selectedMemory
        ? sortedMemories.findIndex((m) => m.id === selectedMemory.id)
        : -1,
    [sortedMemories, selectedMemory]
  );

  // Clear modal if selected memory was deleted externally
  useEffect(() => {
    if (selectedMemoryId && !vault.memories.some((m) => m.id === selectedMemoryId)) {
      setSelectedMemoryId(null);
      setEditingMemory(null);
      setConfirmDelete(false);
    }
  }, [vault.memories, selectedMemoryId]);

  // Translate vertical mouse wheel movement into smooth horizontal album scrolling
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 4) return;

      // Preserve native horizontal trackpad gestures when deltaX dominates
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;

      const atStart = el.scrollLeft <= 1 && e.deltaY < 0;
      const atEnd = el.scrollLeft >= maxScroll - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [sortedMemories.length]);

  const syncScrollMetrics = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) {
      setScrollProgress(0);
      setActiveIndex(0);
      return;
    }
    const progress = Math.min(1, Math.max(0, el.scrollLeft / maxScroll));
    setScrollProgress(progress);

    const viewportCenter = el.scrollLeft + el.clientWidth / 2;
    let closestIdx = 0;
    let minDistance = Number.POSITIVE_INFINITY;
    cardRefs.current.forEach((card, idx) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(cardCenter - viewportCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });
    setActiveIndex(closestIdx);
  }, []);

  useEffect(() => {
    syncScrollMetrics();
  }, [sortedMemories.length, syncScrollMetrics]);

  const scrollToCard = useCallback(
    (index: number) => {
      const el = trackRef.current;
      const target = cardRefs.current[index];
      if (!el || !target) return;
      const left = Math.max(
        0,
        target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2
      );
      el.scrollTo({
        left,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    },
    [prefersReducedMotion]
  );

  const scrollByStep = useCallback(
    (direction: -1 | 1) => {
      const el = trackRef.current;
      if (!el) return;
      const step = Math.max(300, Math.round(el.clientWidth * 0.65));
      el.scrollBy({
        left: direction * step,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    },
    [prefersReducedMotion]
  );

  // Close modal on Escape
  useEffect(() => {
    if (!selectedMemory && !editingMemory) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingMemory) {
          setEditingMemory(null);
        } else {
          setSelectedMemoryId(null);
          setConfirmDelete(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedMemory, editingMemory]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingMemory) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditingMemory({ ...editingMemory, imageUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemory) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateMemory(editingMemory.id, {
        title: editingMemory.title,
        category: editingMemory.category,
        description: editingMemory.description,
        eventDate: editingMemory.eventDate,
        privacyLevel: editingMemory.privacyLevel,
        associatedLocations: editingMemory.associatedLocations,
        imageUrl: editingMemory.imageUrl,
      });
      onVaultUpdate?.(updated);
      onToast?.('Memory updated in your album.');
      setEditingMemory(null);
    } catch (err) {
      onToast?.((err as Error).message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    setDeleting(true);
    try {
      const updated = await api.deleteMemory(id);
      onVaultUpdate?.(updated);
      onToast?.('Memory removed from timeline.');
      setConfirmDelete(false);
      setSelectedMemoryId(null);
    } catch (err) {
      onToast?.((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Warm Archival Photo Album Shell */}
      <section
        aria-label="Memory Timeline Photo Album"
        className="rounded-3xl border border-[#DFD3BF] bg-[radial-gradient(circle_at_18%_12%,#FFFDF9_0%,#F6F1E7_56%,#EDE3D2_100%)] text-[#2B2520] shadow-[0_18px_45px_-24px_rgba(61,46,30,0.22)] overflow-hidden"
      >
        {/* Top Album Ledger Header */}
        <header className="px-5 sm:px-8 pt-6 pb-5 border-b border-[#E4D9C6] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#7B6B5B]">
              <span className="font-medium text-[#8C4E32]">Kindred Keepsake Album</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{dateSpanLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {sortedMemories.length} {sortedMemories.length === 1 ? 'memory' : 'memories'}
              </span>
            </div>
            <h1 className={`${EDITORIAL_SERIF_CLASS} text-2xl sm:text-3xl font-semibold tracking-tight text-[#2B2520]`}>
              Memory Timeline
            </h1>
            <p className="text-sm text-[#6B5F54] max-w-2xl">
              Flip horizontally through your saved photographs, travels, and everyday notes in warm chronological order.
            </p>
          </div>

          {/* Album Filter & Add Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              aria-label="Filter timeline by person"
              className="px-3.5 py-2 text-xs sm:text-sm bg-[#FFFDF9] text-[#2B2520] border border-[#D8CBB6] rounded-xl focus:outline-none focus:border-[#8C4E32] cursor-pointer min-h-[40px]"
            >
              <option value="All">Everyone</option>
              {vault.people.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>

            <div
              role="group"
              aria-label="Timeline sort order"
              className="inline-flex items-center p-1 bg-[#ECE3D4] border border-[#DDD0BC] rounded-xl"
            >
              <button
                type="button"
                onClick={() => setSortOrder('chronological')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sortOrder === 'chronological'
                    ? 'bg-[#FFFDF9] text-[#2B2520] shadow-xs'
                    : 'text-[#6B5F54] hover:text-[#2B2520]'
                }`}
              >
                Earliest first
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('newest')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sortOrder === 'newest'
                    ? 'bg-[#FFFDF9] text-[#2B2520] shadow-xs'
                    : 'text-[#6B5F54] hover:text-[#2B2520]'
                }`}
              >
                Latest first
              </button>
            </div>

            {onOpenNewMemory && (
              <button
                type="button"
                onClick={onOpenNewMemory}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium text-[#FFFDF9] bg-[#8C4E32] hover:bg-[#733E26] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                <span>Add memory</span>
              </button>
            )}
          </div>
        </header>

        {/* Horizontal Photo Album Scroll Viewport */}
        {sortedMemories.length === 0 ? (
          <div className="px-6 py-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#ECE3D4] border border-[#D8CBB6] flex items-center justify-center text-[#8C4E32]">
              <Camera className="w-5 h-5" />
            </div>
            <h2 className={`${EDITORIAL_SERIF_CLASS} text-xl font-semibold text-[#2B2520]`}>
              No album pages match this filter yet
            </h2>
            <p className="text-sm text-[#6B5F54] max-w-md mx-auto">
              Switch back to Everyone or add a new photograph and story to start this chapter of your album.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              {personFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => setPersonFilter('All')}
                  className="px-4 py-2 text-xs font-medium bg-[#FFFDF9] border border-[#D8CBB6] text-[#2B2520] rounded-xl hover:bg-[#F3ECE0] cursor-pointer"
                >
                  Show all people
                </button>
              )}
              {onOpenNewMemory && (
                <button
                  type="button"
                  onClick={onOpenNewMemory}
                  className="px-4 py-2 text-xs font-medium bg-[#8C4E32] text-[#FFFDF9] rounded-xl hover:bg-[#733E26] cursor-pointer"
                >
                  Add a memory
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              {/* Subtle Paper Edge Fade Indicators */}
              <div
                aria-hidden="true"
                className="pointer-events-none hidden sm:block absolute inset-y-0 left-0 w-8 z-10 bg-gradient-to-r from-[#F4EDE1]/85 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none hidden sm:block absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-[#EFE5D5]/85 to-transparent"
              />

              <div
                ref={trackRef}
                onScroll={syncScrollMetrics}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    scrollByStep(1);
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    scrollByStep(-1);
                  }
                }}
                aria-label="Horizontal photo album pages"
                className="flex items-center gap-7 sm:gap-9 overflow-x-auto px-5 sm:px-9 py-8 sm:py-11 focus:outline-none scroll-pl-6"
              >
                {/* Opening Linen Folio Spread */}
                <div className="w-[250px] sm:w-[280px] shrink-0 self-stretch flex flex-col justify-between rounded-2xl bg-[#EFE6D6]/90 border border-[#D9CCB7] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8C4E32] font-medium">
                      Volume I · {dateSpanLabel}
                    </p>
                    <h2 className={`${EDITORIAL_SERIF_CLASS} text-2xl font-semibold leading-snug text-[#2B2520]`}>
                      {vault.settings.userName}&apos;s Family &amp; Life Album
                    </h2>
                    <p className="text-xs sm:text-sm text-[#6B5F54] leading-relaxed">
                      Every cherished photograph, afternoon walk, and family dinner arranged in sequence.
                    </p>
                  </div>

                  <div className="pt-6 border-t border-[#DFD3BF] space-y-2 text-xs text-[#6B5F54]">
                    <div className="flex items-center justify-between font-mono-tabular">
                      <span>Total prints &amp; notes</span>
                      <span className="font-semibold text-[#2B2520]">{sortedMemories.length}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono-tabular">
                      <span>Photographs</span>
                      <span className="font-semibold text-[#2B2520]">{photoCount}</span>
                    </div>
                    <p className="pt-2 inline-flex items-center gap-1.5 text-[11px] text-[#8C4E32] font-medium">
                      <span>Scroll or swipe right to browse</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </p>
                  </div>
                </div>

                {/* Chronological Photo-Print Spreads */}
                {sortedMemories.map((mem, idx) => {
                  const tiltClass = prefersReducedMotion
                    ? ''
                    : `${PRINT_TILTS[idx % PRINT_TILTS.length]} hover:rotate-0 hover:-translate-y-1.5`;
                  const widthClass = PRINT_WIDTHS[idx % PRINT_WIDTHS.length];
                  const imageHeightClass = PRINT_IMAGE_HEIGHTS[idx % PRINT_IMAGE_HEIGHTS.length];
                  const dateText = formatFriendlyDate(mem.eventDate || mem.createdAt);
                  const entryNumber = String(idx + 1).padStart(2, '0');

                  return (
                    <article
                      key={mem.id}
                      ref={(el) => {
                        cardRefs.current[idx] = el;
                      }}
                      className={`group relative shrink-0 ${widthClass} transition-transform duration-300 ease-out ${tiltClass}`}
                    >
                      {/* Subtle Archival Tape Accent */}
                      <div
                        aria-hidden="true"
                        className="mx-auto -mb-2 w-16 h-4 bg-[#E6D9C2]/80 border border-[#D4C4A8]/70 rotate-[-1.5deg] relative z-10 shadow-2xs"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDelete(false);
                          setSelectedMemoryId(mem.id);
                        }}
                        className="w-full text-left bg-[#FFFDF9] p-3.5 pb-5 rounded-sm border border-[#E2D6C3] shadow-[0_14px_30px_-14px_rgba(43,37,32,0.28)] hover:shadow-[0_20px_38px_-14px_rgba(43,37,32,0.34)] focus-visible:outline-2 focus-visible:outline-[#8C4E32] transition-shadow duration-300 cursor-pointer"
                      >
                        {/* Top Archival Plate Index & Date */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 text-[11px] text-[#7B6B5B]">
                          <span className="font-mono-tabular font-medium text-[#8C4E32]">
                            No. {entryNumber}
                          </span>
                          <span className="font-mono-tabular truncate">{dateText}</span>
                        </div>

                        {/* Photo Print / Written Keepsake Placeholder */}
                        <AlbumPhotoFrame mem={mem} heightClass={imageHeightClass} />

                        {/* Handwritten-Style Caption & Real Context */}
                        <div className="pt-3.5 space-y-2">
                          <h3
                            className={`${HANDWRITTEN_FONT_CLASS} text-lg leading-snug text-[#2B2520] group-hover:text-[#733E26] transition-colors line-clamp-2`}
                          >
                            {mem.title}
                          </h3>
                          <p className="text-xs text-[#61554A] leading-relaxed line-clamp-2">
                            {mem.description}
                          </p>

                          <div className="pt-2 border-t border-[#EFE7D8] flex flex-col gap-1 text-[11px] text-[#7B6B5B]">
                            {mem.associatedPeople.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 truncate">
                                <Users className="w-3 h-3 shrink-0 text-[#8C4E32]" />
                                <span className="truncate">
                                  {mem.associatedPeople.join(', ')}
                                </span>
                              </span>
                            )}
                            {mem.associatedLocations.length > 0 && (
                              <span className="inline-flex items-center gap-1.5 truncate">
                                <MapPin className="w-3 h-3 shrink-0 text-[#8C4E32]" />
                                <span className="truncate">
                                  {mem.associatedLocations.join(', ')}
                                </span>
                              </span>
                            )}
                            <span className="text-[11px] text-[#8C4E32] font-medium pt-0.5">
                              {mem.category} · Open print →
                            </span>
                          </div>
                        </div>
                      </button>
                    </article>
                  );
                })}

                {/* End-of-Album Add Memory Slot */}
                {onOpenNewMemory && (
                  <button
                    type="button"
                    onClick={onOpenNewMemory}
                    className="w-[240px] sm:w-[270px] h-[340px] shrink-0 rounded-2xl border-2 border-dashed border-[#D3C3AA] bg-[#FAF5EC]/70 hover:bg-[#FFFDF9] hover:border-[#8C4E32] transition-colors flex flex-col items-center justify-center text-center p-6 gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#8C4E32]"
                  >
                    <div className="w-11 h-11 rounded-full bg-[#ECE2D0] text-[#8C4E32] flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className={`${EDITORIAL_SERIF_CLASS} text-base font-semibold text-[#2B2520]`}>
                        Add another memory
                      </p>
                      <p className="text-xs text-[#6B5F54]">
                        Attach a photo or write a story to place it on this timeline.
                      </p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Album Navigation & Chronological Scrubber */}
            <footer className="px-5 sm:px-8 py-4 border-t border-[#E4D9C6] bg-[#F2EADF]/85 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollByStep(-1)}
                  aria-label="Scroll album left"
                  className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-xl bg-[#FFFDF9] border border-[#D8CBB6] text-[#2B2520] hover:bg-[#EAE0CF] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollByStep(1)}
                  aria-label="Scroll album right"
                  className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-xl bg-[#FFFDF9] border border-[#D8CBB6] text-[#2B2520] hover:bg-[#EAE0CF] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-[#6B5F54] pl-2 font-mono-tabular whitespace-nowrap">
                  Page {Math.min(activeIndex + 1, sortedMemories.length)} of {sortedMemories.length}
                </span>
              </div>

              {/* Chronological Index Dots / Progress Track */}
              <div className="flex-1 max-w-xl flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {sortedMemories.map((mem, idx) => {
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={mem.id}
                        type="button"
                        onClick={() => scrollToCard(idx)}
                        title={`${formatFriendlyDate(mem.eventDate || mem.createdAt)} — ${mem.title}`}
                        aria-label={`Jump to ${mem.title}`}
                        className={`px-2 py-1 rounded-md text-[11px] font-mono-tabular whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#8C4E32] text-[#FFFDF9] font-medium'
                            : 'text-[#6B5F54] hover:bg-[#E6DAC7] hover:text-[#2B2520]'
                        }`}
                      >
                        {formatFriendlyDate(mem.eventDate || mem.createdAt) || `#${idx + 1}`}
                      </button>
                    );
                  })}
                </div>
                <div className="h-1 w-full rounded-full bg-[#DFD3BF] overflow-hidden">
                  <div
                    className="h-full bg-[#8C4E32] origin-left transition-transform duration-150"
                    style={{
                      transform: `scaleX(${Math.max(0.08, scrollProgress)})`,
                    }}
                  />
                </div>
              </div>
            </footer>
          </>
        )}
      </section>

      {/* Memory Detail Lightbox Modal (Timeline-Specific Warm Archival Frame) */}
      {selectedMemory && !editingMemory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="album-modal-title"
        >
          <div
            className="fixed inset-0 bg-[#231D18]/55 backdrop-blur-[2px]"
            onClick={() => {
              setSelectedMemoryId(null);
              setConfirmDelete(false);
            }}
          />
          <div className="relative z-10 w-full max-w-2xl bg-[#FFFDF9] text-[#2B2520] rounded-2xl border border-[#DFD3BF] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#F6F1E7] border-b border-[#E4D9C6] flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono-tabular text-[#8C4E32]">
                  {formatFriendlyDate(selectedMemory.eventDate || selectedMemory.createdAt)} ·{' '}
                  {selectedMemory.category} · {selectedMemory.source}
                </p>
                <h2
                  id="album-modal-title"
                  className={`${EDITORIAL_SERIF_CLASS} text-xl font-semibold text-[#2B2520] mt-0.5`}
                >
                  {selectedMemory.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMemoryId(null);
                  setConfirmDelete(false);
                }}
                aria-label="Close memory print"
                className="p-2 rounded-xl text-[#6B5F54] hover:text-[#2B2520] hover:bg-[#EAE0CF] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {selectedMemory.imageUrl ? (
                <div className="p-2.5 bg-white border border-[#E5DAC8] shadow-sm rounded-sm">
                  <img
                    src={selectedMemory.imageUrl}
                    alt={selectedMemory.title}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-72 object-cover"
                  />
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-[#F6F1E7] border border-[#E5DAC8] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Camera className="w-5 h-5 text-[#8C4E32] shrink-0" />
                    <p className="text-xs text-[#6B5F54]">
                      No photograph is attached to this memory yet.
                    </p>
                  </div>
                  {onVaultUpdate && (
                    <button
                      type="button"
                      onClick={() => setEditingMemory({ ...selectedMemory })}
                      className="text-xs font-medium text-[#8C4E32] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Attach photo
                    </button>
                  )}
                </div>
              )}

              <p className="text-sm sm:text-[15px] text-[#3B312B] leading-relaxed">
                {selectedMemory.description}
              </p>

              {selectedMemory.audioDataUrl && (
                <audio controls src={selectedMemory.audioDataUrl} className="w-full h-10" />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#EFE7D8] text-xs text-[#6B5F54]">
                <div className="flex items-start gap-2">
                  <Users className="w-3.5 h-3.5 text-[#8C4E32] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-[#2B2520]">People: </span>
                    {selectedMemory.associatedPeople.length > 0
                      ? selectedMemory.associatedPeople.join(', ')
                      : 'None tagged'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#8C4E32] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-[#2B2520]">Location: </span>
                    {selectedMemory.associatedLocations.length > 0
                      ? selectedMemory.associatedLocations.join(', ')
                      : 'Not specified'}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#8C4E32] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-[#2B2520]">Status: </span>
                    {selectedMemory.verificationStatus} · {selectedMemory.privacyLevel} ·{' '}
                    {selectedMemory.confidenceScore}% confidence
                  </div>
                </div>
                {selectedMemory.evidenceNote && (
                  <div>
                    <span className="font-medium text-[#2B2520]">Note: </span>
                    {selectedMemory.evidenceNote}
                  </div>
                )}
              </div>

              {selectedMemory.linkedMemoryIds.length > 0 && (
                <div className="pt-3 border-t border-[#EFE7D8]">
                  <p className="text-xs font-semibold text-[#2B2520] mb-2 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#8C4E32]" />
                    <span>Connected memories</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {vault.memories
                      .filter((other) => selectedMemory.linkedMemoryIds.includes(other.id))
                      .map((rel) => (
                        <button
                          key={rel.id}
                          type="button"
                          onClick={() => setSelectedMemoryId(rel.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#F6F1E7] hover:bg-[#EAE0CF] border border-[#DFD3BF] text-xs font-medium text-[#2B2520] cursor-pointer"
                        >
                          {rel.title}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Footer Modal Actions */}
              <div className="pt-4 border-t border-[#EFE7D8] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedModalIndex <= 0}
                    onClick={() => {
                      const prev = sortedMemories[selectedModalIndex - 1];
                      if (prev) setSelectedMemoryId(prev.id);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-xl bg-[#F6F1E7] border border-[#DFD3BF] text-[#2B2520] hover:bg-[#EAE0CF] disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <button
                    type="button"
                    disabled={
                      selectedModalIndex < 0 ||
                      selectedModalIndex >= sortedMemories.length - 1
                    }
                    onClick={() => {
                      const next = sortedMemories[selectedModalIndex + 1];
                      if (next) setSelectedMemoryId(next.id);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-xl bg-[#F6F1E7] border border-[#DFD3BF] text-[#2B2520] hover:bg-[#EAE0CF] disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {onVaultUpdate && (
                  <div className="flex items-center gap-2">
                    {!confirmDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingMemory({ ...selectedMemory })}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-[#F6F1E7] border border-[#DFD3BF] text-[#2B2520] hover:bg-[#EAE0CF] cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl text-[#A12F2F] hover:bg-[#FBEAE8] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6B5F54]">Remove this memory?</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#F6F1E7] text-[#2B2520] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => handleDeleteMemory(selectedMemory.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#B83232] text-white hover:bg-[#9C2727] cursor-pointer disabled:opacity-50"
                        >
                          {deleting ? 'Removing...' : 'Confirm Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline-Specific Edit Memory Modal */}
      {editingMemory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="album-edit-title"
        >
          <div
            className="fixed inset-0 bg-[#231D18]/55 backdrop-blur-[2px]"
            onClick={() => setEditingMemory(null)}
          />
          <div className="relative z-10 w-full max-w-lg bg-[#FFFDF9] text-[#2B2520] rounded-2xl border border-[#DFD3BF] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#F6F1E7] border-b border-[#E4D9C6] flex items-center justify-between">
              <h2 id="album-edit-title" className={`${EDITORIAL_SERIF_CLASS} text-lg font-semibold`}>
                Edit Album Memory
              </h2>
              <button
                type="button"
                onClick={() => setEditingMemory(null)}
                aria-label="Close editor"
                className="p-2 rounded-xl text-[#6B5F54] hover:bg-[#EAE0CF] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6B5F54] mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingMemory.title}
                  onChange={(e) =>
                    setEditingMemory({ ...editingMemory, title: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl focus:outline-none focus:border-[#8C4E32]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6B5F54] mb-1">
                    Category
                  </label>
                  <select
                    value={editingMemory.category}
                    onChange={(e) =>
                      setEditingMemory({
                        ...editingMemory,
                        category: e.target.value as MemoryCategory,
                      })
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
                  <label className="block text-xs font-medium text-[#6B5F54] mb-1">Date</label>
                  <input
                    type="date"
                    value={(editingMemory.eventDate || editingMemory.createdAt).slice(0, 10)}
                    onChange={(e) =>
                      setEditingMemory({ ...editingMemory, eventDate: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6B5F54] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editingMemory.associatedLocations.join(', ')}
                    onChange={(e) =>
                      setEditingMemory({
                        ...editingMemory,
                        associatedLocations: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="e.g., Willow Botanical Park"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6B5F54] mb-1">
                    Privacy
                  </label>
                  <select
                    value={editingMemory.privacyLevel}
                    onChange={(e) =>
                      setEditingMemory({
                        ...editingMemory,
                        privacyLevel: e.target.value as PrivacyLevel,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl"
                  >
                    <option value="Family-shared">Family-shared</option>
                    <option value="Caregiver-visible">Caregiver-visible</option>
                    <option value="Private">Private</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B5F54] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingMemory.description}
                  onChange={(e) =>
                    setEditingMemory({ ...editingMemory, description: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#D8CBB6] rounded-xl focus:outline-none focus:border-[#8C4E32]"
                />
              </div>
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-[#8C4E32] bg-[#F6F1E7] hover:bg-[#EAE0CF] border border-[#DFD3BF] rounded-xl cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>
                  {editingMemory.imageUrl ? 'Replace photograph' : 'Attach photograph'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMemory(null)}
                  className="px-4 py-2 text-sm font-medium text-[#6B5F54] bg-[#F6F1E7] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-sm font-medium text-white bg-[#8C4E32] hover:bg-[#733E26] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
