import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Cake,
  CalendarHeart,
  Check,
  Expand,
  HeartHandshake,
  LayoutGrid,
  Layers,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import type { MemoryRecord, PersonRecord, VaultClientData } from '../types/memory';
import { ConfirmDialog, MetadataLine, Modal, SafeImage } from './ui/CommonUI';

interface PeopleViewProps {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenAddPerson: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type RelationshipCategoryFilter =
  | 'All'
  | 'Family'
  | 'Friends'
  | 'Relatives'
  | 'Caregivers'
  | 'Doctors'
  | 'Teachers'
  | 'Other Important People';

const RELATIONSHIP_FILTERS: RelationshipCategoryFilter[] = [
  'All',
  'Family',
  'Friends',
  'Relatives',
  'Caregivers',
  'Doctors',
  'Teachers',
  'Other Important People',
];

const RELATIONSHIP_GROUP_OPTIONS: PersonRecord['relationshipGroup'][] = [
  'Immediate Family',
  'Extended Family',
  'Friends',
  'Care & Medical',
  'Community',
];

const SUGGESTED_RELATIONSHIPS = [
  'Daughter',
  'Son',
  'Spouse',
  'Friend',
  'Neighbor',
  'Caregiver',
  'Doctor',
  'Teacher',
];

function classifyPersonCategory(person: PersonRecord): Exclude<RelationshipCategoryFilter, 'All'> {
  const rel = (person.relationship || '').toLowerCase();
  const group = person.relationshipGroup;

  if (/\b(doctor|dr\.?|physician|specialist|therapist|clinic|dentist|cardiologist|neurologist)\b/.test(rel)) {
    return 'Doctors';
  }
  if (/\b(caregiver|carer|aide|nurse|caretaker|attendant|support worker)\b/.test(rel)) {
    return 'Caregivers';
  }
  if (/\b(teacher|professor|prof\.?|instructor|tutor|coach|mentor|educator)\b/.test(rel)) {
    return 'Teachers';
  }
  if (/\b(aunt|uncle|cousin|niece|nephew|relative|in-law)\b/.test(rel) || group === 'Extended Family') {
    return 'Relatives';
  }
  if (
    /\b(daughter|son|wife|husband|spouse|partner|mother|mom|father|dad|sister|brother|granddaughter|grandson|grandchild|family)\b/.test(
      rel
    ) ||
    group === 'Immediate Family'
  ) {
    return 'Family';
  }
  if (/\b(friend|neighbor|neighbour|buddy|pal)\b/.test(rel) || group === 'Friends') {
    return 'Friends';
  }
  if (group === 'Care & Medical') {
    return 'Doctors';
  }
  return 'Other Important People';
}

function getAssociatedMemoriesForPerson(
  person: PersonRecord,
  memories: MemoryRecord[]
): MemoryRecord[] {
  const nameLower = person.name.trim().toLowerCase();
  if (!nameLower) return [];
  const firstToken = nameLower.split(/\s+/)[0] || nameLower;

  return memories.filter((m) =>
    m.associatedPeople.some((ap) => {
      const target = ap.trim().toLowerCase();
      return (
        target === nameLower ||
        target.includes(nameLower) ||
        nameLower.includes(target) ||
        (firstToken.length >= 3 && target === firstToken)
      );
    })
  );
}

function PersonPortrait({
  person,
  className = '',
  size = 'lg',
}: {
  person: PersonRecord;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initials = person.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  if (person.avatarUrl) {
    return (
      <SafeImage
        key={`${person.id}-${person.avatarUrl}`}
        src={person.avatarUrl}
        alt={`Portrait of ${person.name}`}
        fallbackLabel={initials || person.name[0]}
        className={className}
      />
    );
  }

  const textSize =
    size === 'sm' ? 'text-base' : size === 'md' ? 'text-2xl' : 'text-4xl sm:text-5xl';
  const subSize = size === 'sm' ? 'hidden' : 'text-xs mt-1.5 text-[#5D5770] font-medium';

  return (
    <div
      role="img"
      aria-label={`Portrait placeholder for ${person.name}`}
      className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F2EFEA] via-[#EBE8F4] to-[#E3EBE6] text-[#2F2A44] select-none ${className}`}
    >
      <span className={`font-semibold tracking-tight ${textSize}`} style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {initials || '?'}
      </span>
      <span className={subSize}>{person.relationship}</span>
    </div>
  );
}

export function PeopleView({
  vault,
  onVaultUpdate,
  onOpenAddPerson: _onOpenAddPerson,
  onToast,
}: PeopleViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RelationshipCategoryFilter>('All');
  const [viewMode, setViewMode] = useState<'deck' | 'grid'>('deck');
  const [activeIndex, setActiveIndex] = useState(0);
  const [deckDirection, setDeckDirection] = useState<1 | -1>(1);

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonRecord | null>(null);

  // Add / Edit modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonRecord | null>(null);
  const [savingForm, setSavingForm] = useState(false);

  // Form fields shared between Add & Edit dialogs
  const [formName, setFormName] = useState('');
  const [formRelationship, setFormRelationship] = useState('');
  const [formGroup, setFormGroup] = useState<PersonRecord['relationshipGroup']>('Immediate Family');
  const [formBirthday, setFormBirthday] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formVisitingNext, setFormVisitingNext] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');

  // Quick note inline editor for active spotlight / full modal
  const [editingQuickNoteFor, setEditingQuickNoteFor] = useState<string | null>(null);
  const [quickNoteDraft, setQuickNoteDraft] = useState('');
  const [savingQuickNote, setSavingQuickNote] = useState(false);

  // Private local photo lookup helper
  const [photoMatchOpen, setPhotoMatchOpen] = useState(false);
  const [matchPreview, setMatchPreview] = useState<string>('');
  const [matchQueryHint, setMatchQueryHint] = useState('');

  const prefersReducedMotion = useMemo(() => {
    if (vault.settings.reducedMotion) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, [vault.settings.reducedMotion]);

  const categoryCounts = useMemo(() => {
    const counts: Record<RelationshipCategoryFilter, number> = {
      All: vault.people.length,
      Family: 0,
      Friends: 0,
      Relatives: 0,
      Caregivers: 0,
      Doctors: 0,
      Teachers: 0,
      'Other Important People': 0,
    };
    vault.people.forEach((p) => {
      const cat = classifyPersonCategory(p);
      counts[cat] += 1;
    });
    return counts;
  }, [vault.people]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vault.people.filter((p) => {
      if (categoryFilter !== 'All' && classifyPersonCategory(p) !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.relationship.toLowerCase().includes(q) ||
        p.relationshipGroup.toLowerCase().includes(q) ||
        p.importantDetails.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q) ||
        (p.birthday && p.birthday.toLowerCase().includes(q)) ||
        (p.visitingNext && p.visitingNext.toLowerCase().includes(q))
      );
    });
  }, [vault.people, search, categoryFilter]);

  useEffect(() => {
    if (filtered.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length - 1);
    }
  }, [filtered.length, activeIndex]);

  const activePerson = filtered[activeIndex] || null;
  const selectedPerson = useMemo(
    () => (selectedPersonId ? vault.people.find((p) => p.id === selectedPersonId) || null : null),
    [selectedPersonId, vault.people]
  );

  const stepDeck = useCallback(
    (delta: 1 | -1) => {
      if (filtered.length <= 1) return;
      setDeckDirection(delta);
      setActiveIndex((prev) => (prev + delta + filtered.length) % filtered.length);
      setEditingQuickNoteFor(null);
    },
    [filtered.length]
  );

  const selectDeckPerson = (idx: number) => {
    if (idx === activeIndex) return;
    setDeckDirection(idx > activeIndex ? 1 : -1);
    setActiveIndex(idx);
    setEditingQuickNoteFor(null);
  };

  // Keyboard arrow navigation when viewing deck without an open dialog or typing field
  useEffect(() => {
    if (viewMode !== 'deck' || filtered.length <= 1) return;
    if (addModalOpen || editingPerson || selectedPerson || deleteTarget || photoMatchOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepDeck(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepDeck(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewMode,
    filtered.length,
    stepDeck,
    addModalOpen,
    editingPerson,
    selectedPerson,
    deleteTarget,
    photoMatchOpen,
  ]);

  const handleCardDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (filtered.length <= 1) return;
    if (info.offset.x < -65 || info.velocity.x < -300) {
      stepDeck(1);
    } else if (info.offset.x > 65 || info.velocity.x > 300) {
      stepDeck(-1);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormRelationship('');
    setFormGroup('Immediate Family');
    setFormBirthday('');
    setFormPhone('');
    setFormVisitingNext('');
    setFormDetails('');
    setFormNotes('');
    setFormAvatarUrl('');
  };

  const openAddDialog = () => {
    resetForm();
    setEditingPerson(null);
    setAddModalOpen(true);
  };

  const openEditDialog = (person: PersonRecord) => {
    setFormName(person.name);
    setFormRelationship(person.relationship);
    setFormGroup(person.relationshipGroup);
    setFormBirthday(person.birthday === 'Not specified' ? '' : person.birthday);
    setFormPhone(person.phone || '');
    setFormVisitingNext(person.visitingNext || '');
    setFormDetails(person.importantDetails);
    setFormNotes(person.notes);
    setFormAvatarUrl(person.avatarUrl || '');
    setAddModalOpen(false);
    setEditingPerson(person);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSavingForm(true);
    try {
      const res = await api.createPerson({
        name: formName.trim(),
        relationship: formRelationship.trim() || 'Family',
        relationshipGroup: formGroup,
        birthday: formBirthday.trim() || 'Not specified',
        phone: formPhone.trim() || undefined,
        visitingNext: formVisitingNext.trim() || undefined,
        importantDetails: formDetails.trim(),
        notes: formNotes.trim(),
        avatarUrl: formAvatarUrl || undefined,
      });
      onVaultUpdate(res.vault);
      onToast(`${res.person.name} added to People Who Matter.`);
      setAddModalOpen(false);
      setCategoryFilter('All');
      setSearch('');
      setActiveIndex(0);
      resetForm();
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSavingForm(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson || !formName.trim()) return;
    setSavingForm(true);
    try {
      const updated = await api.updatePerson(editingPerson.id, {
        name: formName.trim(),
        relationship: formRelationship.trim() || 'Family',
        relationshipGroup: formGroup,
        birthday: formBirthday.trim() || 'Not specified',
        phone: formPhone.trim() || undefined,
        visitingNext: formVisitingNext.trim() || undefined,
        importantDetails: formDetails.trim(),
        notes: formNotes.trim(),
        avatarUrl: formAvatarUrl || undefined,
      });
      onVaultUpdate(updated);
      onToast(`Updated details for ${formName.trim()}.`);
      setEditingPerson(null);
      resetForm();
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSavingForm(false);
    }
  };

  const handleSaveQuickNote = async (person: PersonRecord) => {
    setSavingQuickNote(true);
    try {
      const updated = await api.updatePerson(person.id, {
        notes: quickNoteDraft.trim(),
      });
      onVaultUpdate(updated);
      onToast(`Saved note for ${person.name}.`);
      setEditingQuickNoteFor(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSavingQuickNote(false);
    }
  };

  const handleDelete = async (person: PersonRecord) => {
    try {
      const updated = await api.deletePerson(person.id);
      onVaultUpdate(updated);
      if (selectedPersonId === person.id) {
        setSelectedPersonId(null);
      }
      onToast(`${person.name} removed from People.`);
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handlePhotoUploadForMatch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMatchQueryHint(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setMatchPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const suggestedMatches = useMemo(() => {
    if (!matchPreview && !matchQueryHint) return [];
    const hint = matchQueryHint.toLowerCase();
    return vault.people.filter(
      (p) =>
        hint.includes(p.name.toLowerCase()) ||
        p.importantDetails.toLowerCase().includes(hint) ||
        p.relationship.toLowerCase().includes(hint) ||
        (matchPreview && p.avatarUrl === matchPreview)
    );
  }, [matchPreview, matchQueryHint, vault.people]);

  // Visible cards for stacked deck ordering (active card on top + up to 3 trailing cards behind)
  const visibleDeckStack = useMemo(() => {
    if (filtered.length === 0) return [];
    const count = Math.min(filtered.length, 4);
    const items: { person: PersonRecord; offset: number; realIndex: number }[] = [];
    for (let offset = 0; offset < count; offset++) {
      const realIndex = (activeIndex + offset) % filtered.length;
      items.push({ person: filtered[realIndex], offset, realIndex });
    }
    return items.reverse();
  }, [filtered, activeIndex]);

  const inputClass =
    'w-full px-3.5 py-2.5 text-sm bg-[#FAF9F7] border border-[#DFDCD6] rounded-xl text-[#18181B] placeholder:text-[#71717A] focus:outline-none focus:border-[#5B4DC4] focus:bg-white transition-colors';

  const activeAssociatedMemories = useMemo(
    () => (activePerson ? getAssociatedMemoriesForPerson(activePerson, vault.memories) : []),
    [activePerson, vault.memories]
  );

  const selectedAssociatedMemories = useMemo(
    () => (selectedPerson ? getAssociatedMemoriesForPerson(selectedPerson, vault.memories) : []),
    [selectedPerson, vault.memories]
  );

  return (
    <div className="space-y-8 pb-8">
      {/* Editorial Gallery Header */}
      <header className="rounded-3xl bg-[#F7F5F2] border border-[#E5E2DC] px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium tracking-wide text-[#5B4DC4]">
              Personal Circle Gallery
            </p>
            <h1
              className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-[#18181B] text-balance"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              People Who Matter
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-[#52525B] leading-relaxed">
              Flip through your personal gallery of family, friends, doctors, and caregivers to
              recognize familiar faces, birthdays, upcoming visits, and shared memories at a glance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setPhotoMatchOpen(true)}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-medium text-[#27272A] bg-white hover:bg-[#EFECE7] border border-[#DDDAD3] rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4 text-[#5B4DC4]" />
              <span>Identify from photo</span>
            </button>
            <button
              type="button"
              onClick={openAddDialog}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium text-white bg-[#5B4DC4] hover:bg-[#4C3FB2] rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add person</span>
            </button>
          </div>
        </div>

        {/* Summary strip + Search + Relationship Filters */}
        <div className="mt-7 pt-6 border-t border-[#E5E2DC] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search by name, relationship, birthday, or detail..."
                aria-label="Search saved people"
                className="w-full min-h-[44px] pl-10 pr-10 py-2 text-sm bg-white border border-[#DDDAD3] rounded-xl text-[#18181B] placeholder:text-[#71717A] focus:outline-none focus:border-[#5B4DC4]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#71717A] hover:text-[#18181B] hover:bg-[#F4F2EE] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Deck vs Simple Gallery Accessibility Mode Toggle */}
            <div
              className="inline-flex items-center gap-1 p-1 bg-[#EAE7E0] rounded-xl border border-[#DDDAD3] self-start lg:self-auto"
              role="group"
              aria-label="Gallery presentation mode"
            >
              <button
                type="button"
                onClick={() => setViewMode('deck')}
                aria-pressed={viewMode === 'deck'}
                className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'deck'
                    ? 'bg-white text-[#18181B] shadow-xs'
                    : 'text-[#52525B] hover:text-[#18181B]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Card Deck</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#18181B] shadow-xs'
                    : 'text-[#52525B] hover:text-[#18181B]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Simple Gallery</span>
              </button>
            </div>
          </div>

          {/* Relationship Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by relationship">
            {RELATIONSHIP_FILTERS.map((cat) => {
              const active = categoryFilter === cat;
              const count = categoryCounts[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat);
                    setActiveIndex(0);
                  }}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#18181B] text-white border-[#18181B]'
                      : 'bg-white text-[#3F3F46] border-[#DDDAD3] hover:bg-[#EFECE7] hover:text-[#18181B]'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`tabular-nums text-[11px] ${
                      active ? 'text-white/75' : 'text-[#71717A]'
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

      {/* Empty States */}
      {vault.people.length === 0 ? (
        <section className="rounded-3xl bg-white border border-[#E5E2DC] px-6 py-14 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F3F1FC] text-[#5B4DC4] flex items-center justify-center mb-4">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-semibold text-[#18181B]">Your people gallery is empty</h2>
          <p className="mt-2 text-sm text-[#52525B] max-w-md mx-auto leading-relaxed">
            Add family members, close friends, neighbors, caregivers, or doctors so Kindred can help
            you recognize faces, remember birthdays, and link shared moments.
          </p>
          <button
            type="button"
            onClick={openAddDialog}
            className="mt-6 inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium text-white bg-[#5B4DC4] hover:bg-[#4C3FB2] rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add your first person</span>
          </button>
        </section>
      ) : filtered.length === 0 ? (
        <section className="rounded-3xl bg-white border border-[#E5E2DC] px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-[#18181B]">No saved people match this filter</h2>
          <p className="mt-1.5 text-sm text-[#52525B]">
            Try clearing your search or choosing &ldquo;All&rdquo; to browse everyone in your
            gallery.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategoryFilter('All');
            }}
            className="mt-5 inline-flex items-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-[#18181B] bg-[#F4F2EE] hover:bg-[#EAE7E0] rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset filters</span>
          </button>
        </section>
      ) : (
        <>
          {/* Interactive Stacked Card-Deck Stage */}
          {viewMode === 'deck' && activePerson && (
            <section
              aria-label="Interactive People Card Deck"
              className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-stretch"
            >
              {/* Left Column: Layered Card Deck Canvas */}
              <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl bg-[#F4F2EE] border border-[#E5E2DC] p-5 sm:p-7">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs font-medium text-[#52525B]">
                      {filtered.length > 1
                        ? 'Drag card, tap next, or use arrow keys'
                        : 'Featured person card'}
                    </p>
                  </div>
                  <div className="text-sm font-medium text-[#18181B] tabular-nums">
                    {String(activeIndex + 1).padStart(2, '0')} /{' '}
                    {String(filtered.length).padStart(2, '0')}
                  </div>
                </div>

                {/* Stacked Card Deck */}
                <div className="relative w-full max-w-[440px] mx-auto my-2 h-[440px] sm:h-[470px]">
                  <AnimatePresence initial={false} mode="popLayout">
                    {visibleDeckStack.map(({ person, offset, realIndex }) => {
                      const isTop = offset === 0;
                      const rotateDeg =
                        prefersReducedMotion || isTop
                          ? 0
                          : offset === 1
                          ? 3.2
                          : offset === 2
                          ? -2.8
                          : 5.2;
                      const translateX = prefersReducedMotion ? 0 : offset * 12;
                      const translateY = offset * 10;
                      const scale = 1 - offset * 0.045;
                      const cardMemories = getAssociatedMemoriesForPerson(person, vault.memories);

                      return (
                        <motion.article
                          key={`${person.id}-${offset}`}
                          style={{
                            zIndex: 20 - offset,
                            transformOrigin: 'center center',
                          }}
                          initial={
                            isTop && !prefersReducedMotion
                              ? {
                                  scale: 0.94,
                                  opacity: 0.85,
                                  x: deckDirection * 48,
                                  rotate: deckDirection * 4,
                                }
                              : false
                          }
                          animate={{
                            x: translateX,
                            y: translateY,
                            scale,
                            rotate: rotateDeg,
                            opacity: isTop ? 1 : Math.max(0.74, 1 - offset * 0.14),
                          }}
                          exit={
                            isTop && !prefersReducedMotion
                              ? {
                                  x: -deckDirection * 220,
                                  opacity: 0,
                                  rotate: -deckDirection * 8,
                                  scale: 0.92,
                                }
                              : { opacity: 0 }
                          }
                          transition={
                            prefersReducedMotion
                              ? { duration: 0.01 }
                              : { type: 'spring', stiffness: 260, damping: 26 }
                          }
                          drag={isTop && filtered.length > 1 && !prefersReducedMotion ? 'x' : false}
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.45}
                          onDragEnd={isTop ? handleCardDragEnd : undefined}
                          whileDrag={isTop ? { scale: 1.02, cursor: 'grabbing' } : undefined}
                          onClick={() => {
                            if (!isTop) {
                              selectDeckPerson(realIndex);
                            }
                          }}
                          className={`absolute inset-0 bg-white rounded-3xl border border-[#DFDCD6] p-4 sm:p-5 flex flex-col justify-between shadow-md ${
                            isTop
                              ? filtered.length > 1 && !prefersReducedMotion
                                ? 'cursor-grab'
                                : ''
                              : 'cursor-pointer hover:border-[#BDB8AE]'
                          }`}
                        >
                          {/* Portrait Matte */}
                          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#ECE9E2] border border-[#EAE7E0]">
                            <PersonPortrait
                              person={person}
                              size="lg"
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Card Gallery Caption */}
                          <div className="pt-4 flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h2
                                    className="text-xl sm:text-2xl font-bold text-[#18181B] truncate"
                                    style={{ fontFamily: 'var(--font-display)' }}
                                  >
                                    {person.name}
                                  </h2>
                                  <p
                                    className="text-sm text-[#5B4DC4] font-medium mt-0.5"
                                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                                  >
                                    {person.relationship} · {person.relationshipGroup}
                                  </p>
                                </div>
                                {isTop && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPersonId(person.id);
                                    }}
                                    aria-label={`Open full profile for ${person.name}`}
                                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#F4F2EE] hover:bg-[#E7E3DB] text-[#18181B] transition-colors shrink-0 cursor-pointer"
                                  >
                                    <Expand className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              {person.importantDetails && (
                                <p className="mt-2.5 text-sm text-[#3F3F46] line-clamp-2 leading-relaxed">
                                  {person.importantDetails}
                                </p>
                              )}
                            </div>

                            <div className="pt-2.5 border-t border-[#EFECE6] flex items-center justify-between gap-2 text-xs text-[#52525B]">
                              <span className="truncate">
                                {person.visitingNext
                                  ? `Next visit: ${person.visitingNext}`
                                  : `Birthday: ${person.birthday}`}
                              </span>
                              <span className="tabular-nums shrink-0 font-medium text-[#18181B]">
                                {cardMemories.length}{' '}
                                {cardMemories.length === 1 ? 'memory' : 'memories'}
                              </span>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Deck Navigation & Thumbnail Strip */}
                <div className="mt-6 pt-5 border-t border-[#E5E2DC] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => stepDeck(-1)}
                      disabled={filtered.length <= 1}
                      aria-label="Previous person card"
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-medium text-[#18181B] bg-white hover:bg-[#EAE7E0] disabled:opacity-45 disabled:cursor-not-allowed border border-[#DDDAD3] rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => stepDeck(1)}
                      disabled={filtered.length <= 1}
                      aria-label="Next person card"
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-[#18181B] hover:bg-[#27272A] disabled:opacity-45 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quick Jump Mini Portraits */}
                  <div
                    className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0"
                    role="tablist"
                    aria-label="Select person card"
                  >
                    {filtered.map((person, idx) => {
                      const active = idx === activeIndex;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          aria-label={`Show ${person.name}`}
                          onClick={() => selectDeckPerson(idx)}
                          className={`relative w-11 h-11 rounded-xl overflow-hidden border-2 transition-transform shrink-0 cursor-pointer ${
                            active
                              ? 'border-[#5B4DC4] scale-105'
                              : 'border-white opacity-75 hover:opacity-100'
                          }`}
                        >
                          <PersonPortrait
                            person={person}
                            size="sm"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Focused Person Recognition & Details Spotlight */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-[#E5E2DC] p-6 sm:p-7 flex flex-col justify-between gap-6">
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#E5E2DC] shrink-0">
                        <PersonPortrait
                          person={activePerson}
                          size="sm"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#5B4DC4]">
                          {classifyPersonCategory(activePerson)}
                        </p>
                        <h2
                          className="text-2xl font-bold text-[#18181B] truncate"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {activePerson.name}
                        </h2>
                        <MetadataLine
                          items={[activePerson.relationship, activePerson.relationshipGroup]}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Key Recognition Facts */}
                  <div className="space-y-2.5 pt-4 border-t border-[#EFECE6] text-sm text-[#27272A]">
                    <div className="flex items-center gap-3">
                      <Cake className="w-4 h-4 text-[#5B4DC4] shrink-0" />
                      <span>
                        <strong className="font-medium text-[#18181B]">Birthday:</strong>{' '}
                        {activePerson.birthday || 'Not specified'}
                      </span>
                    </div>

                    {activePerson.phone && (
                      <div className="flex items-center gap-3 tabular-nums">
                        <Phone className="w-4 h-4 text-[#5B4DC4] shrink-0" />
                        <span>
                          <strong className="font-medium text-[#18181B]">Phone:</strong>{' '}
                          {activePerson.phone}
                        </span>
                      </div>
                    )}

                    {activePerson.visitingNext && (
                      <div className="flex items-center gap-3">
                        <CalendarHeart className="w-4 h-4 text-[#5B4DC4] shrink-0" />
                        <span>
                          <strong className="font-medium text-[#18181B]">Next visit:</strong>{' '}
                          {activePerson.visitingNext}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Important Details */}
                  <div className="pt-4 border-t border-[#EFECE6]">
                    <h3 className="text-xs font-semibold text-[#52525B] mb-1.5">
                      Important details to remember
                    </h3>
                    <p className="text-sm sm:text-[15px] text-[#18181B] leading-relaxed">
                      {activePerson.importantDetails || 'No important details added yet.'}
                    </p>
                  </div>

                  {/* Editable Personal Notes */}
                  <div className="pt-4 border-t border-[#EFECE6]">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h3 className="text-xs font-semibold text-[#52525B]">Personal notes</h3>
                      {editingQuickNoteFor !== activePerson.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuickNoteFor(activePerson.id);
                            setQuickNoteDraft(activePerson.notes || '');
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#5B4DC4] hover:underline cursor-pointer"
                        >
                          <NotebookPen className="w-3.5 h-3.5" />
                          <span>{activePerson.notes ? 'Edit note' : 'Add note'}</span>
                        </button>
                      )}
                    </div>

                    {editingQuickNoteFor === activePerson.id ? (
                      <div className="space-y-2.5 mt-2">
                        <textarea
                          rows={3}
                          value={quickNoteDraft}
                          onChange={(e) => setQuickNoteDraft(e.target.value)}
                          placeholder="Write a comforting reminder, favorite topic, or visit note..."
                          className={inputClass}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingQuickNoteFor(null)}
                            className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#3F3F46] bg-[#F4F2EE] hover:bg-[#EAE7E0] rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingQuickNote}
                            onClick={() => handleSaveQuickNote(activePerson)}
                            className="inline-flex items-center gap-1 min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-white bg-[#5B4DC4] hover:bg-[#4C3FB2] rounded-lg cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{savingQuickNote ? 'Saving...' : 'Save note'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[#52525B] leading-relaxed">
                        {activePerson.notes ||
                          'No personal notes yet. Click "Add note" to record helpful context.'}
                      </p>
                    )}
                  </div>

                  {/* Associated Memories Preview */}
                  <div className="pt-4 border-t border-[#EFECE6]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-xs font-semibold text-[#52525B]">
                        Associated memories ({activeAssociatedMemories.length})
                      </h3>
                      {activeAssociatedMemories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedPersonId(activePerson.id)}
                          className="text-xs font-medium text-[#5B4DC4] hover:underline cursor-pointer"
                        >
                          See all
                        </button>
                      )}
                    </div>

                    {activeAssociatedMemories.length === 0 ? (
                      <p className="text-xs text-[#71717A]">
                        {activePerson.lastAssociatedMemory
                          ? `Recent moment: ${activePerson.lastAssociatedMemory}`
                          : 'No linked memories recorded with this name yet.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeAssociatedMemories.slice(0, 2).map((mem) => (
                          <button
                            key={mem.id}
                            type="button"
                            onClick={() => setSelectedPersonId(activePerson.id)}
                            className="w-full text-left p-3 rounded-xl bg-[#FAF9F7] hover:bg-[#F2EFEA] border border-[#EAE7E0] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[#18181B] truncate">
                                {mem.title}
                              </span>
                              <span className="text-[11px] text-[#71717A] tabular-nums shrink-0">
                                {mem.eventDate || mem.createdAt.slice(0, 10)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#52525B] line-clamp-2">
                              {mem.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Spotlight Primary Controls */}
                <div className="pt-4 border-t border-[#EFECE6] flex flex-wrap items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedPersonId(activePerson.id)}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-[#18181B] hover:bg-[#27272A] rounded-xl transition-colors cursor-pointer flex-1 sm:flex-none whitespace-nowrap"
                  >
                    <HeartHandshake className="w-4 h-4" />
                    <span>View full profile</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditDialog(activePerson)}
                      aria-label={`Edit details for ${activePerson.name}`}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 text-sm font-medium text-[#18181B] bg-[#F4F2EE] hover:bg-[#EAE7E0] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Pencil className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(activePerson)}
                      aria-label={`Remove ${activePerson.name}`}
                      className="inline-flex items-center justify-center w-11 h-11 text-[#71717A] hover:text-[#C93B3B] hover:bg-[#FEECEC] rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Simple Accessible Gallery Grid (Primary in Grid mode, Companion Directory in Deck mode) */}
          <section aria-label="Saved People Gallery" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[#18181B]">
                  {viewMode === 'deck' ? 'Everyone in this view' : 'Simple People Gallery'}
                </h2>
                <p className="text-xs text-[#52525B]">
                  {viewMode === 'deck'
                    ? 'Select any portrait card to bring them to the front of the deck, or open full details.'
                    : 'Clear flat cards with easy-to-read names, photos, and controls.'}
                </p>
              </div>
              <p className="text-xs font-medium text-[#52525B] tabular-nums">
                Showing {filtered.length} of {vault.people.length} saved{' '}
                {vault.people.length === 1 ? 'person' : 'people'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((person, idx) => {
                const relatedMemories = getAssociatedMemoriesForPerson(person, vault.memories);
                const isActiveDeckCard = viewMode === 'deck' && idx === activeIndex;

                return (
                  <motion.article
                    key={person.id}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.01 }
                        : { duration: 0.18, delay: Math.min(idx * 0.03, 0.24) }
                    }
                    className={`bg-white rounded-3xl border p-4 flex flex-col justify-between gap-4 transition-colors ${
                      isActiveDeckCard
                        ? 'border-[#5B4DC4] ring-2 ring-[#5B4DC4]/15'
                        : 'border-[#E5E2DC] hover:border-[#C8C3B8]'
                    }`}
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          if (viewMode === 'deck') {
                            selectDeckPerson(idx);
                          } else {
                            setSelectedPersonId(person.id);
                          }
                        }}
                        className="w-full text-left group cursor-pointer focus-visible:outline-2 focus-visible:outline-[#5B4DC4] rounded-2xl"
                      >
                        <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[#F2EFEA] border border-[#EAE7E0]">
                          <PersonPortrait
                            person={person}
                            size="md"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        </div>

                        <div className="mt-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-lg font-bold text-[#18181B] leading-snug">
                              {person.name}
                            </h3>
                            {isActiveDeckCard && (
                              <span className="text-[11px] font-semibold text-[#5B4DC4] shrink-0 pt-1">
                                On top
                              </span>
                            )}
                          </div>
                          <MetadataLine
                            items={[person.relationship, classifyPersonCategory(person)]}
                          />
                        </div>
                      </button>

                      <div className="mt-3 space-y-1.5 text-xs text-[#3F3F46]">
                        <p className="flex items-center gap-2">
                          <Cake className="w-3.5 h-3.5 text-[#5B4DC4] shrink-0" />
                          <span>Birthday: {person.birthday || 'Not specified'}</span>
                        </p>
                        {person.phone && (
                          <p className="flex items-center gap-2 tabular-nums">
                            <Phone className="w-3.5 h-3.5 text-[#5B4DC4] shrink-0" />
                            <span>{person.phone}</span>
                          </p>
                        )}
                        <p className="text-sm text-[#18181B] leading-relaxed pt-1 line-clamp-2">
                          {person.importantDetails || 'No important details recorded yet.'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#EFECE6] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPersonId(person.id)}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs font-semibold text-[#5B4DC4] bg-[#F3F1FC] hover:bg-[#E8E4FA] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>
                          Details{' '}
                          <span className="tabular-nums">({relatedMemories.length})</span>
                        </span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditDialog(person)}
                          aria-label={`Edit ${person.name}`}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-[#52525B] hover:text-[#18181B] hover:bg-[#F4F2EE] transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(person)}
                          aria-label={`Remove ${person.name}`}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-[#52525B] hover:text-[#C93B3B] hover:bg-[#FEECEC] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Full Person Details & Associated Memories Lightbox Modal */}
      <Modal
        open={Boolean(selectedPerson)}
        onClose={() => setSelectedPersonId(null)}
        title={selectedPerson ? `${selectedPerson.name} — ${selectedPerson.relationship}` : ''}
        subtitle={
          selectedPerson
            ? `${classifyPersonCategory(selectedPerson)} · ${selectedPerson.relationshipGroup}`
            : undefined
        }
        maxWidth="max-w-2xl"
      >
        {selectedPerson && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-5">
              <div className="w-full sm:w-48 aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden border border-[#E5E2DC] shrink-0">
                <PersonPortrait
                  person={selectedPerson}
                  size="lg"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-xs font-semibold text-[#52525B]">Important details</h3>
                  <p className="mt-1 text-sm sm:text-base text-[#18181B] leading-relaxed">
                    {selectedPerson.importantDetails || 'No important details recorded yet.'}
                  </p>
                </div>

                <div className="space-y-1.5 text-sm text-[#3F3F46] pt-2 border-t border-[#EFECE6]">
                  <p className="flex items-center gap-2">
                    <Cake className="w-4 h-4 text-[#5B4DC4] shrink-0" />
                    <span>Birthday: {selectedPerson.birthday || 'Not specified'}</span>
                  </p>
                  {selectedPerson.phone && (
                    <p className="flex items-center gap-2 tabular-nums">
                      <Phone className="w-4 h-4 text-[#5B4DC4] shrink-0" />
                      <span>{selectedPerson.phone}</span>
                    </p>
                  )}
                  {selectedPerson.visitingNext && (
                    <p className="flex items-center gap-2">
                      <CalendarHeart className="w-4 h-4 text-[#5B4DC4] shrink-0" />
                      <span>Next visit: {selectedPerson.visitingNext}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Notes */}
            <div className="pt-4 border-t border-[#EFECE6]">
              <h4 className="text-xs font-semibold text-[#52525B] mb-1.5">Personal notes</h4>
              <p className="text-sm text-[#27272A] leading-relaxed">
                {selectedPerson.notes || 'No personal notes added yet.'}
              </p>
            </div>

            {/* Associated Memories */}
            <div className="pt-4 border-t border-[#EFECE6]">
              <h4 className="text-xs font-semibold text-[#52525B] mb-3">
                Associated memories ({selectedAssociatedMemories.length})
              </h4>
              {selectedAssociatedMemories.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#FAF9F7] border border-[#EAE7E0] text-sm text-[#52525B]">
                  {selectedPerson.lastAssociatedMemory ? (
                    <p>
                      <strong className="font-medium text-[#18181B]">Last remembered moment:</strong>{' '}
                      {selectedPerson.lastAssociatedMemory}
                    </p>
                  ) : (
                    <p>
                      No saved memories mention {selectedPerson.name} yet. Whenever you save a
                      memory tagging {selectedPerson.name}, it will appear here automatically.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedAssociatedMemories.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-2xl bg-[#FAF9F7] border border-[#EAE7E0] flex flex-col sm:flex-row sm:items-start gap-3"
                    >
                      {m.imageUrl && (
                        <SafeImage
                          src={m.imageUrl}
                          alt={m.title}
                          className="w-full sm:w-20 h-28 sm:h-20 rounded-xl object-cover shrink-0 border border-[#E5E2DC]"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#18181B]">{m.title}</p>
                          <span className="text-xs text-[#71717A] tabular-nums shrink-0">
                            {m.eventDate || m.createdAt.slice(0, 10)}
                          </span>
                        </div>
                        <p className="text-xs text-[#5B4DC4] mt-0.5">{m.category}</p>
                        <p className="text-sm text-[#3F3F46] mt-1.5 leading-relaxed">
                          {m.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#EFECE6] flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const personToEdit = selectedPerson;
                  setSelectedPersonId(null);
                  openEditDialog(personToEdit);
                }}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-[#18181B] bg-[#F4F2EE] hover:bg-[#EAE7E0] rounded-xl cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                <span>Edit details</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedPersonId(null)}
                className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-[#18181B] hover:bg-[#27272A] rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add or Edit Person Modal */}
      <Modal
        open={addModalOpen || Boolean(editingPerson)}
        onClose={() => {
          setAddModalOpen(false);
          setEditingPerson(null);
        }}
        title={editingPerson ? `Edit ${editingPerson.name}` : 'Add a Person Who Matters'}
        subtitle="Saved securely in your personal Kindred vault."
        maxWidth="max-w-lg"
      >
        <form
          onSubmit={editingPerson ? handleSubmitEdit : handleSubmitAdd}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#3F3F46] mb-1.5">Name</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Maya Patel"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3F3F46] mb-1.5">
                Relationship
              </label>
              <input
                type="text"
                required
                value={formRelationship}
                onChange={(e) => setFormRelationship(e.target.value)}
                placeholder="e.g., Daughter, Caregiver, Doctor"
                className={inputClass}
              />
            </div>
          </div>

          {/* Quick Relationship Label Helpers */}
          <div className="flex flex-wrap items-center gap-1.5">
            {SUGGESTED_RELATIONSHIPS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setFormRelationship(suggestion);
                  if (suggestion === 'Caregiver' || suggestion === 'Doctor') {
                    setFormGroup('Care & Medical');
                  } else if (suggestion === 'Friend' || suggestion === 'Neighbor') {
                    setFormGroup('Friends');
                  } else {
                    setFormGroup('Immediate Family');
                  }
                }}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                  formRelationship.toLowerCase() === suggestion.toLowerCase()
                    ? 'bg-[#5B4DC4] text-white border-[#5B4DC4]'
                    : 'bg-[#FAF9F7] text-[#52525B] border-[#E5E2DC] hover:bg-[#EFECE7]'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#3F3F46] mb-1.5">Circle</label>
              <select
                value={formGroup}
                onChange={(e) =>
                  setFormGroup(e.target.value as PersonRecord['relationshipGroup'])
                }
                className={inputClass}
              >
                {RELATIONSHIP_GROUP_OPTIONS.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3F3F46] mb-1.5">
                Birthday
              </label>
              <input
                type="text"
                value={formBirthday}
                onChange={(e) => setFormBirthday(e.target.value)}
                placeholder="e.g., 14 September"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#3F3F46] mb-1.5">
                Phone number
              </label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g., (555) 234-8910"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3F3F46] mb-1.5">
                Next planned visit
              </label>
              <input
                type="text"
                value={formVisitingNext}
                onChange={(e) => setFormVisitingNext(e.target.value)}
                placeholder="e.g., This Sunday, 4:00 PM"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3F3F46] mb-1.5">
              Important details
            </label>
            <input
              type="text"
              value={formDetails}
              onChange={(e) => setFormDetails(e.target.value)}
              placeholder="How you know them, hobbies, favorite tea or memories..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3F3F46] mb-1.5">
              Personal notes
            </label>
            <textarea
              rows={3}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Helpful reminders, usual visit days, or conversation starters..."
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 text-xs font-semibold text-[#5B4DC4] bg-[#F3F1FC] hover:bg-[#E8E4FA] border border-[#DDD8F6] rounded-xl cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span>{formAvatarUrl ? 'Change portrait photo' : 'Upload portrait photo'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
            </label>
            {formAvatarUrl && (
              <button
                type="button"
                onClick={() => setFormAvatarUrl('')}
                className="min-h-[44px] px-3.5 py-2 text-xs font-medium text-[#52525B] bg-[#F4F2EE] hover:bg-[#EAE7E0] rounded-xl cursor-pointer"
              >
                Remove photo
              </button>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setAddModalOpen(false);
                setEditingPerson(null);
              }}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#3F3F46] bg-[#F4F2EE] hover:bg-[#EAE7E0] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingForm}
              className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-[#5B4DC4] hover:bg-[#4C3FB2] disabled:opacity-60 rounded-xl cursor-pointer"
            >
              {savingForm ? 'Saving...' : editingPerson ? 'Save changes' : 'Save person'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Private Local Photo Match Helper Modal */}
      <Modal
        open={photoMatchOpen}
        onClose={() => {
          setPhotoMatchOpen(false);
          setMatchPreview('');
          setMatchQueryHint('');
        }}
        title="Private Photo Lookup"
        subtitle="Compare a family photo locally against your saved People gallery—nothing leaves your device."
      >
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-[#FAF9F7] border border-dashed border-[#C8C3B8] hover:border-[#5B4DC4] cursor-pointer transition-colors">
            <Upload className="w-6 h-6 text-[#5B4DC4]" />
            <span className="text-sm font-medium text-[#18181B]">
              Choose a photo to compare locally
            </span>
            <span className="text-xs text-[#71717A]">
              Optional local matching with zero external biometric uploads
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUploadForMatch}
            />
          </label>

          {matchPreview && (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E2DC]">
              <SafeImage
                src={matchPreview}
                alt="Uploaded preview"
                className="w-16 h-16 rounded-xl object-cover shrink-0"
              />
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Describe appearance or context (optional)
                </label>
                <input
                  type="text"
                  value={matchQueryHint}
                  onChange={(e) => setMatchQueryHint(e.target.value)}
                  placeholder="e.g., glasses, garden, Sunday visit..."
                  className="w-full px-3 py-1.5 text-sm bg-white border border-[#DFDCD6] rounded-lg"
                />
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-[#52525B] mb-2">
              {suggestedMatches.length > 0
                ? 'Closest saved profiles'
                : 'Your saved people gallery'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(suggestedMatches.length > 0 ? suggestedMatches : vault.people).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPhotoMatchOpen(false);
                    setSelectedPersonId(p.id);
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white hover:bg-[#FAF9F7] border border-[#E5E2DC] text-left cursor-pointer transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[#EAE7E0]">
                    <PersonPortrait
                      person={p}
                      size="sm"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#18181B] truncate">{p.name}</p>
                    <p className="text-xs text-[#52525B] truncate">{p.relationship}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Remove person?"
        message={`Remove ${deleteTarget?.name} from People Who Matter? Associated memories will remain safely stored in My Memories.`}
        confirmLabel="Remove"
        destructive
      />
    </div>
  );
}
