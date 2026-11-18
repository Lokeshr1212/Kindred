import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Armchair,
  Check,
  Clock,
  Compass,
  Expand,
  FileText,
  Gem,
  Glasses,
  HeartPulse,
  KeyRound,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api, formatFriendlyDate, formatTimeAgo } from '../lib/api';
import type { BelongingRecord, PrivacyLevel, VaultClientData } from '../types/memory';
import { ConfirmDialog, Modal, SafeImage } from './ui/CommonUI';

interface BelongingsCollectionViewProps {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenAddBelonging: () => void;
  onAskAiAboutItem: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type CuratedBelongingCategory =
  | 'All'
  | 'Everyday Essentials'
  | 'Electronics'
  | 'Documents and Cards'
  | 'Clothing and Accessories'
  | 'Household Items'
  | 'Personal Valuables'
  | 'Frequently Used Items'
  | 'Other Important Belongings';

const CURATED_CATEGORIES: CuratedBelongingCategory[] = [
  'All',
  'Everyday Essentials',
  'Electronics',
  'Documents and Cards',
  'Clothing and Accessories',
  'Household Items',
  'Personal Valuables',
  'Frequently Used Items',
  'Other Important Belongings',
];

const BACKEND_CATEGORIES: BelongingRecord['category'][] = [
  'Eyewear',
  'Keys',
  'Documents & Wallet',
  'Health',
  'Electronics',
  'Keepsakes',
];

const PRIVACY_LEVELS: PrivacyLevel[] = ['Caregiver-visible', 'Family-shared', 'Private'];

function matchesCuratedCategory(
  item: BelongingRecord,
  cat: CuratedBelongingCategory
): boolean {
  if (cat === 'All') return true;
  const text = `${item.name} ${item.category} ${item.room} ${item.exactLocation} ${item.visualCue} ${item.notes}`.toLowerCase();

  switch (cat) {
    case 'Everyday Essentials':
      return (
        item.category === 'Eyewear' ||
        item.category === 'Keys' ||
        item.category === 'Health' ||
        /\b(glasses|keys|wallet|pill|medication|umbrella|watch|bag)\b/.test(text)
      );
    case 'Electronics':
      return (
        item.category === 'Electronics' ||
        /\b(phone|tablet|charger|hearing aid|remote|watch|radio|camera|laptop)\b/.test(text)
      );
    case 'Documents and Cards':
      return (
        item.category === 'Documents & Wallet' ||
        /\b(wallet|passport|id|card|license|notebook|document|insurance|clinic card)\b/.test(text)
      );
    case 'Clothing and Accessories':
      return (
        item.category === 'Eyewear' ||
        /\b(coat|jacket|scarf|hat|shoes|umbrella|watch|sweater|glasses|ring)\b/.test(text)
      );
    case 'Household Items':
      return /\b(kitchen|kettle|drawer|tray|hook|cabinet|shelf|living|hallway|lamp|blanket)\b/.test(text);
    case 'Personal Valuables':
      return (
        item.category === 'Keepsakes' ||
        /\b(ring|jewelry|heirloom|photo|album|gold|watch|keepsake|silver|locket)\b/.test(text)
      );
    case 'Frequently Used Items': {
      const hoursSinceVerified =
        (Date.now() - new Date(item.lastVerifiedAt).getTime()) / 3600000;
      return (
        item.category === 'Keys' ||
        item.category === 'Eyewear' ||
        item.category === 'Health' ||
        hoursSinceVerified <= 48
      );
    }
    case 'Other Important Belongings':
      return (
        item.category === 'Keepsakes' &&
        !/\b(glasses|keys|wallet|phone|charger|ring|heirloom)\b/.test(text)
      );
    default:
      return true;
  }
}

function getCategoryVisual(category: BelongingRecord['category']) {
  switch (category) {
    case 'Eyewear':
      return {
        Icon: Glasses,
        bg: 'from-[#EEEAF9] via-[#F5F2FC] to-[#E6F0EC]',
        iconColor: 'text-[#4C3FB2]',
        label: 'Eyewear & Reading',
      };
    case 'Keys':
      return {
        Icon: KeyRound,
        bg: 'from-[#F7EFE2] via-[#FBF7EE] to-[#ECE8F7]',
        iconColor: 'text-[#8C5619]',
        label: 'Keys & Entry',
      };
    case 'Documents & Wallet':
      return {
        Icon: FileText,
        bg: 'from-[#E8EFF8] via-[#F3F7FC] to-[#EDE9F7]',
        iconColor: 'text-[#28538A]',
        label: 'Documents & Cards',
      };
    case 'Health':
      return {
        Icon: HeartPulse,
        bg: 'from-[#E4F2EB] via-[#F2F9F5] to-[#EBF2F7]',
        iconColor: 'text-[#1D6A4A]',
        label: 'Health & Care',
      };
    case 'Electronics':
      return {
        Icon: Smartphone,
        bg: 'from-[#EAEFF4] via-[#F5F7FA] to-[#ECEAF6]',
        iconColor: 'text-[#334155]',
        label: 'Electronics',
      };
    case 'Keepsakes':
    default:
      return {
        Icon: Gem,
        bg: 'from-[#F6ECEA] via-[#FCF6F5] to-[#F3EDE3]',
        iconColor: 'text-[#8E4132]',
        label: 'Personal Keepsake',
      };
  }
}

export function BelongingsCollectionView({
  vault,
  onVaultUpdate,
  onOpenAddBelonging: _onOpenAddBelonging,
  onAskAiAboutItem,
  onToast,
}: BelongingsCollectionViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CuratedBelongingCategory>('All');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Add / Edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BelongingRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<BelongingRecord['category']>('Eyewear');
  const [formRoom, setFormRoom] = useState('');
  const [formExactLocation, setFormExactLocation] = useState('');
  const [formVisualCue, setFormVisualCue] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPrivacy, setFormPrivacy] = useState<PrivacyLevel>('Caregiver-visible');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<BelongingRecord | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const prefersReducedMotion = useMemo(() => {
    if (vault.settings.reducedMotion) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, [vault.settings.reducedMotion]);

  const categoryCounts = useMemo(() => {
    const map = {} as Record<CuratedBelongingCategory, number>;
    CURATED_CATEGORIES.forEach((cat) => {
      map[cat] = vault.belongings.filter((b) => matchesCuratedCategory(b, cat)).length;
    });
    return map;
  }, [vault.belongings]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vault.belongings.filter((item) => {
      if (!matchesCuratedCategory(item, selectedCategory)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.room.toLowerCase().includes(q) ||
        item.exactLocation.toLowerCase().includes(q) ||
        item.visualCue.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q)
      );
    });
  }, [vault.belongings, selectedCategory, search]);

  // Group filtered items smoothly by Room for curated scrolling sections
  const groupedByRoom = useMemo(() => {
    const groups = new Map<string, BelongingRecord[]>();
    filteredItems.forEach((item) => {
      const roomName = item.room.trim() || 'Home';
      const list = groups.get(roomName) || [];
      list.push(item);
      groups.set(roomName, list);
    });
    return Array.from(groups.entries()).map(([room, items]) => ({ room, items }));
  }, [filteredItems]);

  const selectedItem = useMemo(
    () => (selectedItemId ? vault.belongings.find((b) => b.id === selectedItemId) || null : null),
    [selectedItemId, vault.belongings]
  );

  const openAddDialog = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('Eyewear');
    setFormRoom('');
    setFormExactLocation('');
    setFormVisualCue('');
    setFormNotes('');
    setFormPrivacy('Caregiver-visible');
    setFormOpen(true);
  };

  const openEditDialog = (item: BelongingRecord) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormRoom(item.room);
    setFormExactLocation(item.exactLocation);
    setFormVisualCue(item.visualCue);
    setFormNotes(item.notes);
    setFormPrivacy(item.privacyLevel);
    setFormOpen(true);
  };

  const handleSaveBelonging = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formExactLocation.trim()) return;
    setSaving(true);
    try {
      if (editingItem) {
        const updated = await api.updateBelonging(editingItem.id, {
          name: formName.trim(),
          category: formCategory,
          room: formRoom.trim() || 'Home',
          exactLocation: formExactLocation.trim(),
          visualCue: formVisualCue.trim(),
          notes: formNotes.trim(),
          privacyLevel: formPrivacy,
        });
        onVaultUpdate(updated);
        onToast(`Updated storage spot for "${formName.trim()}".`);
      } else {
        const res = await api.createBelonging({
          name: formName.trim(),
          category: formCategory,
          room: formRoom.trim() || 'Home',
          exactLocation: formExactLocation.trim(),
          visualCue: formVisualCue.trim(),
          notes: formNotes.trim(),
          privacyLevel: formPrivacy,
        });
        onVaultUpdate(res.vault);
        onToast(`Saved "${res.item.name}" to My Important Belongings.`);
        setSelectedCategory('All');
        setSearch('');
      }
      setFormOpen(false);
      setEditingItem(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifySpot = async (item: BelongingRecord) => {
    setVerifyingId(item.id);
    try {
      const updated = await api.updateBelonging(item.id, {
        lastVerifiedAt: new Date().toISOString(),
      });
      onVaultUpdate(updated);
      onToast(`Confirmed "${item.name}" is in ${item.room}.`);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (item: BelongingRecord) => {
    try {
      const updated = await api.deleteBelonging(item.id);
      onVaultUpdate(updated);
      if (selectedItemId === item.id) {
        setSelectedItemId(null);
      }
      onToast(`Removed "${item.name}" from My Belongings.`);
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const scrollToRoom = (roomName: string) => {
    const id = `belongings-room-${roomName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 text-sm bg-[#FAF9F6] border border-[#DED9CE] rounded-xl text-[#191816] placeholder:text-[#7A746B] focus:outline-none focus:border-[#5B4DC4] focus:bg-white transition-colors';

  return (
    <div className="space-y-9 pb-10">
      {/* Section 1: Curated Editorial Intro Hero */}
      <header className="rounded-3xl bg-[#F7F5F0] border border-[#E5E0D5] px-6 py-7 sm:px-9 sm:py-9">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#5B4DC4]">
              Curated Everyday Locations
            </p>
            <h1
              className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-[#191816] text-balance"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              My Important Belongings
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-[#5D5850] leading-relaxed">
              A clear, comforting visual guide to where your everyday essentials, keys, eyewear,
              important documents, and personal keepsakes are safely stored.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onAskAiAboutItem}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-medium text-[#3C3394] bg-[#ECE8FA] hover:bg-[#E1DCF7] rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ask AI where something is</span>
            </button>
            <button
              type="button"
              onClick={openAddDialog}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium text-white bg-[#191816] hover:bg-[#302D29] rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add belonging</span>
            </button>
          </div>
        </div>

        {/* Curated Featured Highlights Strip (Fanning Curatorial Preview of Top Real Belongings) */}
        {vault.belongings.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#E5E0D5]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-xs font-semibold text-[#5D5850]">
                Quick Spot Check — Tap any essential to inspect or confirm its spot
              </p>
              <p className="text-xs font-medium text-[#191816] tabular-nums">
                {vault.belongings.length} tracked{' '}
                {vault.belongings.length === 1 ? 'item' : 'items'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {vault.belongings.slice(0, 4).map((item, idx) => {
                const { Icon, bg, iconColor } = getCategoryVisual(item.category);
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    whileHover={prefersReducedMotion ? undefined : { y: -3 }}
                    transition={{ duration: 0.16 }}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`group text-left rounded-2xl bg-white border border-[#E5E0D5] hover:border-[#5B4DC4] p-4 transition-shadow hover:shadow-md cursor-pointer ${
                      !prefersReducedMotion && idx % 2 === 1 ? 'lg:translate-y-1' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bg} flex items-center justify-center ${iconColor}`}
                      >
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-[11px] font-medium text-[#5D5850] tabular-nums">
                        {formatTimeAgo(item.lastVerifiedAt)}
                      </span>
                    </div>
                    <h2 className="text-sm font-bold text-[#191816] line-clamp-1 group-hover:text-[#5B4DC4] transition-colors">
                      {item.name}
                    </h2>
                    <p className="mt-1 text-xs font-medium text-[#1E6B52] flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.room}</span>
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Section 2: Search, Category Filters & Smooth Room Navigator */}
      <section aria-label="Search and filter belongings" className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#7A746B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search glasses, keys, wallet, room, or visual cue..."
              aria-label="Search saved belongings"
              className="w-full min-h-[44px] pl-10 pr-10 py-2 text-sm bg-white border border-[#DED9CE] rounded-xl text-[#191816] placeholder:text-[#7A746B] focus:outline-none focus:border-[#5B4DC4]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#7A746B] hover:text-[#191816] hover:bg-[#F3EFE6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Smooth-Scroll Room Jump */}
          {groupedByRoom.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-[#5D5850] mr-1 inline-flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-[#5B4DC4]" />
                <span>Jump to room:</span>
              </span>
              {groupedByRoom.map(({ room, items }) => (
                <button
                  key={room}
                  type="button"
                  onClick={() => scrollToRoom(room)}
                  className="min-h-[38px] px-3 py-1 text-xs font-medium text-[#2F2B25] bg-[#F3F0E9] hover:bg-[#E7E2D7] border border-[#DED9CE] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  {room} <span className="text-[#6F6A61] tabular-nums">({items.length})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Curated Category Filter Tabs */}
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter belongings by category"
        >
          {CURATED_CATEGORIES.map((cat) => {
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
                    ? 'bg-[#191816] text-white border-[#191816]'
                    : 'bg-white text-[#3F3B34] border-[#DED9CE] hover:bg-[#F3F0E9] hover:text-[#191816]'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`tabular-nums text-[11px] ${
                    active ? 'text-white/75' : 'text-[#7A746B]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 3: Empty States or Scrolling Room-by-Room Curated Collections */}
      {vault.belongings.length === 0 ? (
        <section className="rounded-3xl bg-white border border-[#E5E0D5] px-6 py-14 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F3F1FC] text-[#5B4DC4] flex items-center justify-center mb-4">
            <KeyRound className="w-7 h-7" />
          </div>
          <h2
            className="text-xl font-bold text-[#191816]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            No personal belongings recorded yet
          </h2>
          <p className="mt-2 text-sm text-[#5D5850] max-w-md mx-auto leading-relaxed">
            Save where your reading glasses, house keys, wallet, medication organizer, or favorite
            keepsakes are kept so you can find them effortlessly anytime.
          </p>
          <button
            type="button"
            onClick={openAddDialog}
            className="mt-6 inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium text-white bg-[#191816] hover:bg-[#302D29] rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add your first belonging</span>
          </button>
        </section>
      ) : filteredItems.length === 0 ? (
        <section className="rounded-3xl bg-white border border-[#E5E0D5] px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-[#191816]">
            No belongings match this search or category
          </h2>
          <p className="mt-1.5 text-sm text-[#5D5850]">
            Clear your search or choose &ldquo;All&rdquo; to see every saved item and storage spot.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedCategory('All');
            }}
            className="mt-5 inline-flex items-center gap-2 min-h-[44px] px-4 py-2 text-sm font-medium text-[#191816] bg-[#F3F0E9] hover:bg-[#E7E2D7] rounded-xl cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset filters</span>
          </button>
        </section>
      ) : (
        <div className="space-y-10">
          {groupedByRoom.map(({ room, items }, groupIdx) => {
            const roomAnchorId = `belongings-room-${room.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            return (
              <section
                key={room}
                id={roomAnchorId}
                aria-label={`${room} belongings collection`}
                className="scroll-mt-6 space-y-4"
              >
                {/* Curated Room Collection Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-[#E5E0D5]">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-[#F3F0E9] border border-[#E2DDD2] text-[#5B4DC4] flex items-center justify-center shrink-0">
                      <Armchair className="w-5 h-5" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-[#5D5850] tabular-nums">
                        Collection {String(groupIdx + 1).padStart(2, '0')}
                      </p>
                      <h2
                        className="text-2xl font-bold text-[#191816]"
                        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                      >
                        {room}
                      </h2>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-[#5D5850] tabular-nums">
                    {items.length} {items.length === 1 ? 'item kept here' : 'items kept here'}
                  </p>
                </div>

                {/* Curated Belonging Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {items.map((item, idx) => {
                    const { Icon, bg, iconColor, label } = getCategoryVisual(item.category);
                    const optionalImage = (item as BelongingRecord & { imageUrl?: string }).imageUrl;

                    return (
                      <motion.article
                        key={item.id}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.15 }}
                        transition={
                          prefersReducedMotion
                            ? { duration: 0.01 }
                            : { duration: 0.22, delay: Math.min(idx * 0.04, 0.18) }
                        }
                        className="group bg-white rounded-3xl border border-[#E5E0D5] hover:border-[#C7C0B2] overflow-hidden flex flex-col justify-between transition-all hover:shadow-md"
                      >
                        {/* Visual Item Stage (Image if available, or Curated Object Visual Frame) */}
                        <div>
                          <button
                            type="button"
                            onClick={() => setSelectedItemId(item.id)}
                            className="w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#5B4DC4]"
                          >
                            <div
                              className={`relative h-40 w-full bg-gradient-to-br ${bg} border-b border-[#EAE5DA] overflow-hidden flex items-center justify-center`}
                            >
                              {optionalImage ? (
                                <SafeImage
                                  src={optionalImage}
                                  alt={item.name}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-2 px-4 text-center">
                                  <div
                                    className={`w-16 h-16 rounded-2xl bg-white/85 border border-white shadow-xs flex items-center justify-center ${iconColor} transition-transform duration-300 group-hover:scale-105`}
                                  >
                                    <Icon className="w-8 h-8" />
                                  </div>
                                  <span className="text-xs font-medium text-[#5D5850]">
                                    {label}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="p-5 sm:p-6 pb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-[#5D5850]">
                                    {item.category} · Updated {formatTimeAgo(item.lastVerifiedAt)}
                                  </p>
                                  <h3
                                    className="mt-1 text-xl font-bold text-[#191816] leading-snug group-hover:text-[#5B4DC4] transition-colors"
                                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                                  >
                                    {item.name}
                                  </h3>
                                </div>
                                <span
                                  aria-hidden="true"
                                  className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#F7F5F0] text-[#5D5850] group-hover:text-[#191816] shrink-0"
                                >
                                  <Expand className="w-4 h-4" />
                                </span>
                              </div>
                            </div>
                          </button>

                          {/* Prominent Storage Location Highlight Box */}
                          <div className="px-5 sm:px-6 space-y-3">
                            <div className="p-4 rounded-2xl bg-[#F6F9F7] border border-[#D4E6DC] space-y-1.5">
                              <p className="text-xs font-semibold text-[#1E6B52] flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <span>Kept in {item.room}</span>
                              </p>
                              <p className="text-[15px] font-semibold text-[#191816] leading-relaxed">
                                {item.exactLocation}
                              </p>
                              {item.visualCue && (
                                <p className="text-xs text-[#43534A] leading-relaxed">
                                  <strong>Look for:</strong> {item.visualCue}
                                </p>
                              )}
                            </div>

                            {item.notes && (
                              <p className="text-sm text-[#5D5850] leading-relaxed line-clamp-2">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Large Accessible Item Controls */}
                        <div className="m-5 sm:mx-6 mt-4 pt-4 border-t border-[#EFECE4] flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={verifyingId === item.id}
                            onClick={() => handleVerifySpot(item)}
                            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-xs font-semibold text-[#1A523B] bg-[#DCF1E6] hover:bg-[#CBE9D9] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            <span>
                              {verifyingId === item.id ? 'Confirming...' : 'I see it here now'}
                            </span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditDialog(item)}
                              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 text-xs font-semibold text-[#191816] bg-[#F3F0E9] hover:bg-[#E7E2D7] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Update spot</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              aria-label={`Remove ${item.name}`}
                              className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-[#6F6A61] hover:text-[#C93B3B] hover:bg-[#FEECEC] transition-colors cursor-pointer"
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
            );
          })}
        </div>
      )}

      {/* Full Belonging Details Modal */}
      <Modal
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItemId(null)}
        title={selectedItem?.name || 'Belonging Details'}
        subtitle={
          selectedItem ? `${selectedItem.category} · ${selectedItem.room}` : undefined
        }
        maxWidth="max-w-xl"
      >
        {selectedItem && (
          <div className="space-y-5">
            {(() => {
              const { Icon, bg, iconColor, label } = getCategoryVisual(selectedItem.category);
              return (
                <div
                  className={`p-5 rounded-2xl bg-gradient-to-br ${bg} border border-[#E5E0D5] flex items-center gap-4`}
                >
                  <div
                    className={`w-14 h-14 rounded-2xl bg-white shadow-xs flex items-center justify-center shrink-0 ${iconColor}`}
                  >
                    <Icon className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#5D5850]">{label}</p>
                    <p className="text-lg font-bold text-[#191816]">{selectedItem.name}</p>
                    <p className="text-xs text-[#5D5850] mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Last confirmed {formatTimeAgo(selectedItem.lastVerifiedAt)} (
                        {formatFriendlyDate(selectedItem.lastVerifiedAt)})
                      </span>
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="p-4 rounded-2xl bg-[#F6F9F7] border border-[#D4E6DC] space-y-2">
              <p className="text-xs font-semibold text-[#1E6B52] flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>Storage Location — {selectedItem.room}</span>
              </p>
              <p className="text-base font-semibold text-[#191816] leading-relaxed">
                {selectedItem.exactLocation}
              </p>
              {selectedItem.visualCue && (
                <p className="text-sm text-[#43534A]">
                  <strong>Visual cue:</strong> {selectedItem.visualCue}
                </p>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#5D5850] mb-1">Helpful notes</h4>
              <p className="text-sm text-[#191816] leading-relaxed">
                {selectedItem.notes || 'No extra notes recorded for this belonging yet.'}
              </p>
            </div>

            <div className="pt-4 border-t border-[#EFECE4] flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => handleVerifySpot(selectedItem)}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-medium text-[#1A523B] bg-[#DCF1E6] hover:bg-[#CBE9D9] rounded-xl cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>I see it here now</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedItem;
                    setSelectedItemId(null);
                    openEditDialog(target);
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-[#191816] hover:bg-[#302D29] rounded-xl cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Edit spot & details</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Belonging Modal */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? `Update — ${editingItem.name}` : 'Add a Personal Belonging'}
        subtitle="Record the exact room, spot, and visual cue so it is always easy to find."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveBelonging} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#3F3B34] mb-1.5">
                Item name
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Reading glasses"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3F3B34] mb-1.5">
                Category
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as BelongingRecord['category'])}
                className={inputClass}
              >
                {BACKEND_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#3F3B34] mb-1.5">Room</label>
              <input
                type="text"
                required
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
                placeholder="e.g., Entry Hallway, Bedroom"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3F3B34] mb-1.5">
                Who can view this
              </label>
              <select
                value={formPrivacy}
                onChange={(e) => setFormPrivacy(e.target.value as PrivacyLevel)}
                className={inputClass}
              >
                {PRIVACY_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3F3B34] mb-1.5">
              Exact storage spot
            </label>
            <input
              type="text"
              required
              value={formExactLocation}
              onChange={(e) => setFormExactLocation(e.target.value)}
              placeholder="e.g., Top drawer of walnut console table"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3F3B34] mb-1.5">
              Visual cue (what to look for)
            </label>
            <input
              type="text"
              value={formVisualCue}
              onChange={(e) => setFormVisualCue(e.target.value)}
              placeholder="e.g., Inside the navy leather case beside the brass dish"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3F3B34] mb-1.5">
              Helpful notes
            </label>
            <textarea
              rows={3}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Spare location, backup keys, or gentle reminders..."
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingItem(null);
              }}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#3F3B34] bg-[#F3F0E9] hover:bg-[#E7E2D7] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 py-2 text-sm font-medium text-white bg-[#191816] hover:bg-[#302D29] disabled:opacity-60 rounded-xl cursor-pointer"
            >
              {saving ? 'Saving...' : editingItem ? 'Save spot' : 'Save belonging'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="Remove belonging?"
        message={`Remove "${deleteTarget?.name}" from My Important Belongings?`}
        confirmLabel="Remove"
        destructive
      />
    </div>
  );
}
