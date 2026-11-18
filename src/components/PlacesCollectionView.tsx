import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Camera,
  Clock,
  Compass,
  Expand,
  MapPin,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { api, formatFriendlyDate, formatTimeAgo } from '../lib/api';
import type { MemoryRecord, PlaceRecord, VaultClientData } from '../types/memory';

interface PlacesCollectionViewProps {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenAddPlace: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

type PlaceCategoryBrowse =
  | 'All'
  | 'Home'
  | 'Family'
  | 'Friends'
  | 'Work or College'
  | 'Hospitals or Clinics'
  | 'Places of Worship'
  | 'Favourite Places'
  | 'Frequently Visited Places'
  | 'Park & Outdoors'
  | 'Community'
  | 'Travel & Heritage';

const BROWSE_CATEGORIES: PlaceCategoryBrowse[] = [
  'All',
  'Home',
  'Family',
  'Friends',
  'Work or College',
  'Hospitals or Clinics',
  'Places of Worship',
  'Favourite Places',
  'Frequently Visited Places',
  'Park & Outdoors',
  'Community',
  'Travel & Heritage',
];

const PLACE_SCHEMA_CATEGORIES: PlaceRecord['category'][] = [
  'Home',
  'Park & Outdoors',
  'Medical',
  'Community',
  'Travel & Heritage',
];

const EDITORIAL_SERIF =
  "font-['Georgia','Palatino_Linotype','Book_Antiqua',serif]";

function getRelatedMemoriesForPlace(
  place: PlaceRecord,
  memories: MemoryRecord[]
): MemoryRecord[] {
  const placeNameLower = place.name.trim().toLowerCase();
  if (!placeNameLower) return [];
  return memories.filter((m) =>
    m.associatedLocations.some((loc) => {
      const l = loc.trim().toLowerCase();
      return l === placeNameLower || l.includes(placeNameLower) || placeNameLower.includes(l);
    })
  );
}

function matchesPlaceFilter(
  place: PlaceRecord,
  filter: PlaceCategoryBrowse,
  relatedCount: number
): boolean {
  if (filter === 'All') return true;
  if (filter === 'Home') return place.category === 'Home';
  if (filter === 'Park & Outdoors') return place.category === 'Park & Outdoors';
  if (filter === 'Community') return place.category === 'Community';
  if (filter === 'Travel & Heritage') return place.category === 'Travel & Heritage';
  if (filter === 'Hospitals or Clinics') return place.category === 'Medical';

  const haystack = `${place.name} ${place.notes} ${place.landmarkCue} ${place.address}`.toLowerCase();

  if (filter === 'Family') {
    return (
      place.category === 'Home' ||
      place.associatedPeople.length > 0 ||
      haystack.includes('family')
    );
  }
  if (filter === 'Friends') {
    return place.category === 'Community' || haystack.includes('friend');
  }
  if (filter === 'Work or College') {
    return (
      haystack.includes('work') ||
      haystack.includes('office') ||
      haystack.includes('college') ||
      haystack.includes('school') ||
      haystack.includes('university')
    );
  }
  if (filter === 'Places of Worship') {
    return (
      haystack.includes('temple') ||
      haystack.includes('church') ||
      haystack.includes('mosque') ||
      haystack.includes('chapel') ||
      haystack.includes('worship') ||
      haystack.includes('prayer')
    );
  }
  if (filter === 'Favourite Places') {
    return (
      haystack.includes('favorite') ||
      haystack.includes('favourite') ||
      haystack.includes('best spot') ||
      place.category === 'Park & Outdoors' ||
      place.category === 'Travel & Heritage'
    );
  }
  if (filter === 'Frequently Visited Places') {
    return (
      relatedCount > 0 ||
      haystack.includes('morning walk') ||
      haystack.includes('usually') ||
      Boolean(place.visitingHours)
    );
  }
  return true;
}

function PlaceImageFrame({
  place,
  heightClass = 'h-52',
  dark = false,
}: {
  place: PlaceRecord;
  heightClass?: string;
  dark?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [place.imageUrl]);

  if (!place.imageUrl || imgError) {
    return (
      <div
        className={`w-full ${heightClass} flex flex-col justify-between p-5 border-b ${
          dark
            ? 'bg-gradient-to-br from-[#2F2621] via-[#261E1A] to-[#1C1613] border-[#3F332C] text-[#EADFD1]'
            : 'bg-gradient-to-br from-[#F3ECE0] via-[#F9F5EC] to-[#E8DEC9] border-[#E3D9CA] text-[#4E3F33]'
        }`}
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] opacity-80">
          <span>{place.category}</span>
          <Compass className="w-4 h-4 shrink-0" />
        </div>
        <div className="my-auto space-y-1.5">
          <p className={`${EDITORIAL_SERIF} text-lg font-semibold leading-snug`}>
            {place.name}
          </p>
          {place.landmarkCue && (
            <p className="text-xs opacity-85 line-clamp-2 leading-relaxed">
              {place.landmarkCue}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs opacity-80 truncate">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{place.address || 'Saved personal location'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden bg-[#E8DEC9]`}>
      <img
        src={place.imageUrl}
        alt={place.name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1E1713]/45 via-transparent to-transparent"
      />
    </div>
  );
}

export function PlacesCollectionView({
  vault,
  onVaultUpdate,
  onOpenAddPlace,
  onToast,
}: PlacesCollectionViewProps) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<PlaceCategoryBrowse>('All');
  const [selectedPlace, setSelectedPlace] = useState<PlaceRecord | null>(null);
  const [editingPlace, setEditingPlace] = useState<PlaceRecord | null>(null);
  const [editPeopleInput, setEditPeopleInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PlaceRecord | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openEditPlace = (place: PlaceRecord) => {
    setEditingPlace({ ...place });
    setEditPeopleInput(place.associatedPeople.join(', '));
  };

  const prefersReducedMotion = useMemo(() => {
    if (vault.settings.reducedMotion) return true;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, [vault.settings.reducedMotion]);

  const relatedMemoriesByPlaceId = useMemo(() => {
    const map = new Map<string, MemoryRecord[]>();
    for (const place of vault.places) {
      map.set(place.id, getRelatedMemoriesForPlace(place, vault.memories));
    }
    return map;
  }, [vault.places, vault.memories]);

  const filteredPlaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vault.places.filter((p) => {
      const relatedCount = relatedMemoriesByPlaceId.get(p.id)?.length || 0;
      if (!matchesPlaceFilter(p, catFilter, relatedCount)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.landmarkCue.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q) ||
        p.associatedPeople.some((person) => person.toLowerCase().includes(q))
      );
    });
  }, [vault.places, relatedMemoriesByPlaceId, search, catFilter]);

  const featuredPlaces = useMemo(() => {
    return [...vault.places]
      .sort((a, b) => {
        const aScore =
          (a.imageUrl ? 2 : 0) +
          (a.category === 'Home' || a.category === 'Medical' ? 2 : 0) +
          (relatedMemoriesByPlaceId.get(a.id)?.length || 0);
        const bScore =
          (b.imageUrl ? 2 : 0) +
          (b.category === 'Home' || b.category === 'Medical' ? 2 : 0) +
          (relatedMemoriesByPlaceId.get(b.id)?.length || 0);
        return bScore - aScore;
      })
      .slice(0, 2);
  }, [vault.places, relatedMemoriesByPlaceId]);

  const recentPlaces = useMemo(() => {
    return [...vault.places]
      .sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
      )
      .slice(0, 3);
  }, [vault.places]);

  const heroSpotlight = featuredPlaces[0] || null;

  // Keep detail modal synced if vault changes
  useEffect(() => {
    if (selectedPlace) {
      const fresh = vault.places.find((p) => p.id === selectedPlace.id) || null;
      setSelectedPlace(fresh);
    }
  }, [vault.places, selectedPlace]);

  // Escape key handling for modals
  useEffect(() => {
    if (!selectedPlace && !editingPlace && !deleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) setDeleteTarget(null);
        else if (editingPlace) setEditingPlace(null);
        else setSelectedPlace(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedPlace, editingPlace, deleteTarget]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingPlace) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditingPlace({ ...editingPlace, imageUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlace || !editingPlace.name.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/places/${editingPlace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingPlace.name.trim(),
          category: editingPlace.category,
          address: editingPlace.address,
          landmarkCue: editingPlace.landmarkCue,
          visitingHours: editingPlace.visitingHours,
          safetyNotes: editingPlace.safetyNotes,
          notes: editingPlace.notes,
          associatedPeople: editPeopleInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          imageUrl: editingPlace.imageUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Unable to update place.');
      }
      onVaultUpdate(data as VaultClientData);
      onToast(`Updated "${editingPlace.name.trim()}".`);
      setEditingPlace(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const updated = await api.deletePlace(id);
      onVaultUpdate(updated);
      onToast('Place removed from your collection.');
      setDeleteTarget(null);
      setSelectedPlace(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const totalPlaceMemories = useMemo(() => {
    let count = 0;
    relatedMemoriesByPlaceId.forEach((mems) => {
      count += mems.length;
    });
    return count;
  }, [relatedMemoriesByPlaceId]);

  return (
    <div className="space-y-8">
      {/* Dark Roasted-Umber Editorial Hero Section (Coffee-Roaster Inspired Layout) */}
      <section className="rounded-3xl bg-[radial-gradient(circle_at_15%_15%,#2F2520_0%,#211A17_55%,#181311_100%)] text-[#FAF5EC] border border-[#3B302A] overflow-hidden shadow-[0_24px_55px_-26px_rgba(24,18,14,0.65)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Hero Column */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between gap-8">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#D7A983] font-medium">
                {vault.settings.userName}&apos;s Personal Places Collection
              </p>
              <h1
                className={`${EDITORIAL_SERIF} text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-[#FFFDF8]`}
              >
                Places That Matter
              </h1>
              <p className="text-sm sm:text-base text-[#D7CCC0] leading-relaxed max-w-xl">
                Keep every familiar neighborhood corner, family home, clinic, and peaceful walking
                path close at hand—complete with clear addresses, visual landmarks, and shared memories.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenAddPlace}
                  className="inline-flex items-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-[#A85432] hover:bg-[#8E4427] text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save a place</span>
                </button>
                {heroSpotlight && (
                  <button
                    type="button"
                    onClick={() => setSelectedPlace(heroSpotlight)}
                    className="inline-flex items-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 text-[#FAF5EC] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Explore featured guide</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="pt-5 border-t border-white/12 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-[#BDB0A2]">Saved places</p>
                  <p className="text-xl font-bold font-mono-tabular text-[#FFFDF8] mt-0.5">
                    {vault.places.length}
                  </p>
                </div>
                <div>
                  <p className="text-[#BDB0A2]">Linked memories</p>
                  <p className="text-xl font-bold font-mono-tabular text-[#FFFDF8] mt-0.5">
                    {totalPlaceMemories}
                  </p>
                </div>
                <div>
                  <p className="text-[#BDB0A2]">With visual cues</p>
                  <p className="text-xl font-bold font-mono-tabular text-[#FFFDF8] mt-0.5">
                    {vault.places.filter((p) => Boolean(p.landmarkCue)).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Hero Column: Featured Place Editorial Card */}
          <div className="lg:col-span-5 bg-[#191311]/70 border-t lg:border-t-0 lg:border-l border-[#382D27] p-6 sm:p-8 flex flex-col justify-center">
            {heroSpotlight ? (
              <div className="group rounded-2xl bg-[#261E1A] border border-[#3E322B] overflow-hidden flex flex-col">
                <PlaceImageFrame place={heroSpotlight} heightClass="h-52 sm:h-56" dark />
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#D7A983]">
                    <span className="uppercase tracking-[0.14em] font-semibold">
                      Featured Location · {heroSpotlight.category}
                    </span>
                  </div>
                  <h2 className={`${EDITORIAL_SERIF} text-xl font-bold text-[#FFFDF8]`}>
                    {heroSpotlight.name}
                  </h2>
                  {heroSpotlight.address && (
                    <p className="text-xs text-[#D7CCC0] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#D7A983] shrink-0" />
                      <span>{heroSpotlight.address}</span>
                    </p>
                  )}
                  {heroSpotlight.landmarkCue && (
                    <p className="text-xs text-[#C7B9AA] leading-relaxed line-clamp-2">
                      Landmark: {heroSpotlight.landmarkCue}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPlace(heroSpotlight)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E5B893] hover:underline pt-1 cursor-pointer"
                  >
                    <span>Open full details &amp; memories</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#493B33] p-8 text-center space-y-3">
                <MapPin className="w-6 h-6 text-[#D7A983] mx-auto" />
                <p className={`${EDITORIAL_SERIF} text-lg font-semibold text-[#FFFDF8]`}>
                  Start Your Places Collection
                </p>
                <p className="text-xs text-[#C7B9AA]">
                  Add your home, local park, clinic, or favorite family spots with simple cues.
                </p>
                <button
                  type="button"
                  onClick={onOpenAddPlace}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#A85432] text-white cursor-pointer"
                >
                  Add first place
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Warm Parchment Search & Category Filter Strip */}
      <section
        aria-label="Search and filter saved places"
        className="rounded-2xl bg-[#F6F1E9] border border-[#E3D9CA] p-4 sm:p-5 space-y-3.5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#746557] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search place names, addresses, landmarks, or people..."
              aria-label="Search places"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white text-[#261E19] border border-[#DBD0BF] rounded-xl focus:outline-none focus:border-[#A85432]"
            />
          </div>

          <div className="text-xs text-[#6E5F52] font-mono-tabular">
            Showing {filteredPlaces.length} of {vault.places.length} saved places
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {BROWSE_CATEGORIES.map((cat) => {
            const active = catFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(cat)}
                className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#261E19] text-[#FAF5EC]'
                    : 'bg-white border border-[#E1D6C5] text-[#57493E] hover:bg-[#EDE4D6]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Important Places Section (Only shown when unfiltered & multiple places exist) */}
      {search === '' && catFilter === 'All' && featuredPlaces.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#A85432] font-semibold">
                Key Orientation Anchors
              </p>
              <h2 className={`${EDITORIAL_SERIF} text-2xl font-bold text-[#261E19] mt-0.5`}>
                Important Everyday Places
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {featuredPlaces.map((place) => {
              const related = relatedMemoriesByPlaceId.get(place.id) || [];
              return (
                <article
                  key={`featured-${place.id}`}
                  className="group rounded-2xl bg-[#FCF9F3] border border-[#E3D9CA] overflow-hidden flex flex-col sm:flex-row hover:border-[#CBBBA3] transition-colors shadow-[0_8px_24px_-16px_rgba(38,30,25,0.22)]"
                >
                  <div className="sm:w-56 shrink-0">
                    <PlaceImageFrame place={place} heightClass="h-48 sm:h-full" />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[#A85432]">
                        {place.category}
                        {place.visitingHours ? ` · ${place.visitingHours}` : ''}
                      </p>
                      <h3 className={`${EDITORIAL_SERIF} text-xl font-bold text-[#261E19]`}>
                        {place.name}
                      </h3>
                      {place.address && (
                        <p className="text-xs text-[#57493E] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#A85432] shrink-0" />
                          <span>{place.address}</span>
                        </p>
                      )}
                      {place.landmarkCue && (
                        <p className="text-xs text-[#4A3D33] bg-[#F3ECE0] px-3 py-2 rounded-xl leading-relaxed">
                          <strong className="font-semibold">Visual cue:</strong>{' '}
                          {place.landmarkCue}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-[#6E5F52] font-mono-tabular">
                        {related.length} {related.length === 1 ? 'memory' : 'memories'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedPlace(place)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#261E19] hover:bg-[#3A2E26] text-[#FAF5EC] transition-colors cursor-pointer"
                      >
                        <span>Open guide</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Collection of Saved Places */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#A85432] font-semibold">
              Personal Directory
            </p>
            <h2 className={`${EDITORIAL_SERIF} text-2xl font-bold text-[#261E19] mt-0.5`}>
              {catFilter === 'All' ? 'All Saved Places' : catFilter}
            </h2>
          </div>
        </div>

        {filteredPlaces.length === 0 ? (
          <div className="rounded-2xl bg-[#FAF6EE] border border-[#E3D9CA] p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EFE6D7] border border-[#DDD0BC] text-[#A85432] flex items-center justify-center mx-auto">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className={`${EDITORIAL_SERIF} text-xl font-bold text-[#261E19]`}>
              {vault.places.length === 0
                ? 'No saved places yet'
                : 'No matching places found'}
            </h3>
            <p className="text-sm text-[#6E5F52] max-w-md mx-auto">
              {vault.places.length === 0
                ? 'Save meaningful places like your home, neighborhood park, or clinic with easy-to-remember landmarks.'
                : 'Try clearing your search or choosing another category filter.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              {(search !== '' || catFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCatFilter('All');
                  }}
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white border border-[#DBD0BF] text-[#261E19] cursor-pointer"
                >
                  Clear filters
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAddPlace}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#A85432] text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Save a place</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredPlaces.map((place, idx) => {
              const related = relatedMemoriesByPlaceId.get(place.id) || [];
              return (
                <motion.article
                  key={place.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.2,
                    delay: prefersReducedMotion ? 0 : Math.min(idx * 0.04, 0.2),
                  }}
                  className="group rounded-2xl bg-white border border-[#E3D9CA] overflow-hidden flex flex-col justify-between hover:border-[#C8B79E] transition-colors shadow-[0_10px_26px_-18px_rgba(38,30,25,0.22)]"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedPlace(place)}
                      className="block w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#A85432]"
                      aria-label={`Open details for ${place.name}`}
                    >
                      <PlaceImageFrame place={place} heightClass="h-48" />
                    </button>

                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-[#746557]">
                            <span className="font-semibold text-[#A85432]">{place.category}</span>
                            {place.visitingHours && <span> · {place.visitingHours}</span>}
                          </p>
                          <h3 className={`${EDITORIAL_SERIF} text-xl font-bold text-[#261E19] mt-0.5`}>
                            <button
                              type="button"
                              onClick={() => setSelectedPlace(place)}
                              className="text-left hover:text-[#A85432] transition-colors cursor-pointer"
                            >
                              {place.name}
                            </button>
                          </h3>
                        </div>
                      </div>

                      {place.address && (
                        <p className="text-xs sm:text-sm text-[#4E3F33] flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-[#A85432] shrink-0" />
                          <span>{place.address}</span>
                        </p>
                      )}

                      {place.landmarkCue && (
                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-[#EAE0CF] text-xs text-[#3D3127] flex items-start gap-2">
                          <Compass className="w-4 h-4 text-[#A85432] shrink-0 mt-0.5" />
                          <span>
                            <strong className="font-semibold">Visual cue:</strong>{' '}
                            {place.landmarkCue}
                          </span>
                        </div>
                      )}

                      {place.notes && (
                        <p className="text-sm text-[#54473B] leading-relaxed line-clamp-3">
                          {place.notes}
                        </p>
                      )}

                      {place.safetyNotes && (
                        <div className="p-3 rounded-xl bg-[#E8F3EC] border border-[#C8E1D1] text-xs text-[#1D4E35] flex items-start gap-2">
                          <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{place.safetyNotes}</span>
                        </div>
                      )}

                      {related.length > 0 && (
                        <div className="pt-1 flex items-center gap-1.5 text-xs text-[#6E5F52]">
                          <BookOpen className="w-3.5 h-3.5 text-[#A85432] shrink-0" />
                          <span className="truncate">
                            Related memory: {related[0].title}
                            {related.length > 1 ? ` (+${related.length - 1} more)` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-3.5 bg-[#FAF6EE] border-t border-[#EAE0CF] flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-[#6E5F52] truncate">
                      {place.associatedPeople.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#A85432]" />
                          <span>{place.associatedPeople.join(', ')}</span>
                        </span>
                      ) : (
                        <span>Updated {formatTimeAgo(place.updatedAt || place.createdAt)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlace(place)}
                        className="inline-flex items-center gap-1 px-3 py-2 min-h-[38px] text-xs font-semibold rounded-xl bg-white border border-[#DBD0BF] text-[#261E19] hover:bg-[#EFE6D7] cursor-pointer"
                      >
                        <Expand className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditPlace(place)}
                        aria-label={`Edit ${place.name}`}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-[#DBD0BF] text-[#4E3F33] hover:bg-[#EFE6D7] cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(place)}
                        aria-label={`Delete ${place.name}`}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-[#E5C6C3] text-[#8F3434] hover:bg-[#FCECEB] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {/* Recently Updated / Added Places Strip (From Real Vault Timestamps) */}
      {recentPlaces.length > 0 && (
        <section className="rounded-2xl bg-[#F6F1E9] border border-[#E3D9CA] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#A85432] font-semibold">
                Recent Entries
              </p>
              <h2 className={`${EDITORIAL_SERIF} text-xl font-bold text-[#261E19] mt-0.5`}>
                Recently Added &amp; Updated Places
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {recentPlaces.map((place) => (
              <button
                key={`recent-${place.id}`}
                type="button"
                onClick={() => setSelectedPlace(place)}
                className="text-left p-4 rounded-xl bg-white hover:bg-[#FCF9F3] border border-[#E3D9CA] transition-colors flex flex-col justify-between gap-2 cursor-pointer"
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-mono-tabular text-[#A85432]">
                    {place.category} · {formatTimeAgo(place.updatedAt || place.createdAt)}
                  </p>
                  <p className={`${EDITORIAL_SERIF} text-base font-bold text-[#261E19]`}>
                    {place.name}
                  </p>
                  {place.address && (
                    <p className="text-xs text-[#6E5F52] truncate">{place.address}</p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#A85432] pt-1">
                  <span>View place</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Place Complete Detail Modal */}
      {selectedPlace && !editingPlace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="place-detail-title"
        >
          <div
            className="fixed inset-0 bg-[#1C1512]/60 backdrop-blur-[2px]"
            onClick={() => setSelectedPlace(null)}
          />
          <div className="relative z-10 w-full max-w-2xl bg-[#FFFDF9] text-[#261E19] rounded-2xl border border-[#DFD3C0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#F6F1E9] border-b border-[#E3D9CA] flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#A85432] uppercase tracking-[0.12em]">
                  {selectedPlace.category}
                  {selectedPlace.visitingHours ? ` · ${selectedPlace.visitingHours}` : ''}
                </p>
                <h2
                  id="place-detail-title"
                  className={`${EDITORIAL_SERIF} text-2xl font-bold text-[#261E19] mt-0.5`}
                >
                  {selectedPlace.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlace(null)}
                aria-label="Close place details"
                className="p-2 rounded-xl text-[#6E5F52] hover:bg-[#EAE0CE] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {selectedPlace.imageUrl ? (
                <div className="rounded-xl overflow-hidden border border-[#E3D9CA]">
                  <img
                    src={selectedPlace.imageUrl}
                    alt={selectedPlace.name}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-64 object-cover"
                  />
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#E3D9CA] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-xs text-[#6E5F52]">
                    <Camera className="w-4 h-4 text-[#A85432] shrink-0" />
                    <span>No photograph attached to this place yet.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditPlace(selectedPlace)}
                    className="text-xs font-semibold text-[#A85432] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Attach photo
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3.5 rounded-xl bg-[#FAF6EE] border border-[#EAE0CF] space-y-1">
                  <p className="text-xs font-semibold text-[#746557] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#A85432]" />
                    <span>Address</span>
                  </p>
                  <p className="text-sm font-medium text-[#261E19]">
                    {selectedPlace.address || 'No street address saved'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF6EE] border border-[#EAE0CF] space-y-1">
                  <p className="text-xs font-semibold text-[#746557] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#A85432]" />
                    <span>Visiting hours</span>
                  </p>
                  <p className="text-sm font-medium text-[#261E19]">
                    {selectedPlace.visitingHours || 'Open / flexible hours'}
                  </p>
                </div>
              </div>

              {selectedPlace.landmarkCue && (
                <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#EAE0CF] space-y-1">
                  <p className="text-xs font-semibold text-[#A85432] flex items-center gap-1.5">
                    <Compass className="w-4 h-4" />
                    <span>Visual landmark cue</span>
                  </p>
                  <p className="text-sm text-[#261E19] leading-relaxed">
                    {selectedPlace.landmarkCue}
                  </p>
                </div>
              )}

              {selectedPlace.notes && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#746557]">
                    Personal notes
                  </h3>
                  <p className="text-sm sm:text-[15px] text-[#3D3127] leading-relaxed">
                    {selectedPlace.notes}
                  </p>
                </div>
              )}

              {selectedPlace.safetyNotes && (
                <div className="p-4 rounded-xl bg-[#E8F3EC] border border-[#C8E1D1] text-sm text-[#1D4E35] flex items-start gap-2.5">
                  <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] mb-0.5">
                      Helpful safety reminder
                    </p>
                    <p className="leading-relaxed">{selectedPlace.safetyNotes}</p>
                  </div>
                </div>
              )}

              {selectedPlace.associatedPeople.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#57493E]">
                  <Users className="w-4 h-4 text-[#A85432] shrink-0" />
                  <span>
                    <strong className="text-[#261E19]">Familiar people here:</strong>{' '}
                    {selectedPlace.associatedPeople.join(', ')}
                  </span>
                </div>
              )}

              {/* Associated Memories (From existing vault.memories.associatedLocations) */}
              {(() => {
                const related = relatedMemoriesByPlaceId.get(selectedPlace.id) || [];
                if (related.length === 0) return null;
                return (
                  <div className="pt-3 border-t border-[#EAE0CF] space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A85432] flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Memories connected to {selectedPlace.name}</span>
                    </h3>
                    <div className="space-y-2">
                      {related.map((mem) => (
                        <div
                          key={mem.id}
                          className="p-3.5 rounded-xl bg-[#FAF6EE] border border-[#EAE0CF] space-y-1"
                        >
                          <p className="text-[11px] font-mono-tabular text-[#746557] flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-[#A85432]" />
                            <span>
                              {formatFriendlyDate(mem.eventDate || mem.createdAt)} · {mem.category}
                            </span>
                          </p>
                          <p className={`${EDITORIAL_SERIF} text-sm font-bold text-[#261E19]`}>
                            {mem.title}
                          </p>
                          <p className="text-xs text-[#54473B] line-clamp-2 leading-relaxed">
                            {mem.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="pt-4 border-t border-[#EAE0CF] flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEditPlace(selectedPlace)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#F6F1E9] border border-[#DBD0BF] text-[#261E19] hover:bg-[#EDE4D6] cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit place</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(selectedPlace)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#FCECEB] text-[#A32929] hover:bg-[#F8DAD7] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove place</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Place Modal (Uses Existing PUT /api/places/:id) */}
      {editingPlace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="place-edit-title"
        >
          <div
            className="fixed inset-0 bg-[#1C1512]/60 backdrop-blur-[2px]"
            onClick={() => setEditingPlace(null)}
          />
          <div className="relative z-10 w-full max-w-lg bg-[#FFFDF9] text-[#261E19] rounded-2xl border border-[#DFD3C0] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#F6F1E9] border-b border-[#E3D9CA] flex items-center justify-between">
              <h2 id="place-edit-title" className={`${EDITORIAL_SERIF} text-lg font-bold`}>
                Edit Place Details
              </h2>
              <button
                type="button"
                onClick={() => setEditingPlace(null)}
                aria-label="Close edit place dialog"
                className="p-2 rounded-xl text-[#6E5F52] hover:bg-[#EAE0CE] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">
                    Place name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPlace.name}
                    onChange={(e) =>
                      setEditingPlace({ ...editingPlace, name: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#DBD0BF] rounded-xl focus:outline-none focus:border-[#A85432]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">
                    Category
                  </label>
                  <select
                    value={editingPlace.category}
                    onChange={(e) =>
                      setEditingPlace({
                        ...editingPlace,
                        category: e.target.value as PlaceRecord['category'],
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-[#DBD0BF] rounded-xl"
                  >
                    {PLACE_SCHEMA_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={editingPlace.address}
                    onChange={(e) =>
                      setEditingPlace({ ...editingPlace, address: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#DBD0BF] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#54473B] mb-1">
                    Visiting hours
                  </label>
                  <input
                    type="text"
                    value={editingPlace.visitingHours || ''}
                    onChange={(e) =>
                      setEditingPlace({ ...editingPlace, visitingHours: e.target.value })
                    }
                    placeholder="e.g., 8:00 AM – 5:00 PM"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#DBD0BF] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54473B] mb-1">
                  Visual landmark cue
                </label>
                <input
                  type="text"
                  value={editingPlace.landmarkCue}
                  onChange={(e) =>
                    setEditingPlace({ ...editingPlace, landmarkCue: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#DBD0BF] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54473B] mb-1">
                  Personal notes
                </label>
                <textarea
                  rows={3}
                  value={editingPlace.notes}
                  onChange={(e) =>
                    setEditingPlace({ ...editingPlace, notes: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#DBD0BF] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54473B] mb-1">
                  Safety / orientation reminder
                </label>
                <input
                  type="text"
                  value={editingPlace.safetyNotes || ''}
                  onChange={(e) =>
                    setEditingPlace({ ...editingPlace, safetyNotes: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#DBD0BF] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54473B] mb-1">
                  Familiar people here (comma-separated)
                </label>
                <input
                  type="text"
                  value={editPeopleInput}
                  onChange={(e) => setEditPeopleInput(e.target.value)}
                  placeholder="e.g., Maya, Dr. Patel"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#DBD0BF] rounded-xl"
                />
              </div>

              <label className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#A85432] bg-[#FAF6EE] hover:bg-[#EDE4D6] border border-[#DBD0BF] rounded-xl cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>
                  {editingPlace.imageUrl ? 'Replace photograph' : 'Attach photograph'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlace(null)}
                  className="px-4 py-2 text-sm font-semibold text-[#54473B] bg-[#F2EBE0] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#A85432] hover:bg-[#8E4427] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Place Confirmation Dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="place-delete-title"
        >
          <div
            className="fixed inset-0 bg-[#1C1512]/60 backdrop-blur-[2px]"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-10 w-full max-w-md bg-[#FFFDF9] text-[#261E19] rounded-2xl border border-[#DFD3C0] shadow-2xl p-6 space-y-4">
            <h2 id="place-delete-title" className={`${EDITORIAL_SERIF} text-lg font-bold`}>
              Remove saved place?
            </h2>
            <p className="text-sm text-[#54473B] leading-relaxed">
              Are you sure you want to remove &ldquo;{deleteTarget.name}&rdquo; from your saved
              places?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-semibold text-[#54473B] bg-[#F2EBE0] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDelete(deleteTarget.id)}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#B83232] hover:bg-[#992626] rounded-xl cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Removing...' : 'Remove Place'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
