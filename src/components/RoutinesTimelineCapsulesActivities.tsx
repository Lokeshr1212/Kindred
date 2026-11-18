import React, { useState } from 'react';
import {
  Archive,
  Plus,
} from 'lucide-react';
import { api, formatFriendlyDate } from '../lib/api';
import type { MemoryCapsule, VaultClientData } from '../types/memory';
import { DailyRoutineBook } from './DailyRoutineBook';
import { MemoryActivitiesDiary } from './MemoryActivitiesDiary';
import { MemoryTimelineAlbum } from './MemoryTimelineAlbum';
import {
  MetadataLine,
  Modal,
  SafeImage,
} from './ui/CommonUI';
import {
  LandingAccordionItem,
  type AccordionMediaItem,
} from './ui/interactive-image-accordion';

export function RoutinesView({
  vault,
  onVaultUpdate,
  onOpenAddRoutine,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenAddRoutine: () => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  return (
    <DailyRoutineBook
      vault={vault}
      onVaultUpdate={onVaultUpdate}
      onOpenAddRoutine={onOpenAddRoutine}
      onToast={onToast}
    />
  );
}

export function TimelineView({
  vault,
  onVaultUpdate,
  onOpenNewMemory,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate?: (v: VaultClientData) => void;
  onOpenNewMemory?: () => void;
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}) {
  return (
    <MemoryTimelineAlbum
      vault={vault}
      onVaultUpdate={onVaultUpdate}
      onOpenNewMemory={onOpenNewMemory}
      onToast={onToast}
    />
  );
}

export function CapsulesView({
  vault,
  onVaultUpdate,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [selectedCapsule, setSelectedCapsule] = useState<MemoryCapsule | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMemIds, setSelectedMemIds] = useState<string[]>([]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const res = await api.createCapsule({
        title,
        theme: theme || 'Personal Keepsake',
        description,
        memoryIds: selectedMemIds,
      });
      onVaultUpdate(res.vault);
      onToast(`Created "${title}" capsule.`);
      setTitle('');
      setTheme('');
      setDescription('');
      setSelectedMemIds([]);
      setCreateOpen(false);
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const reelItems: AccordionMediaItem[] = [
    {
      id: 'capsule-morning-walks',
      title: 'Botanical Walks',
      subtitle: 'Lavender path & morning routine notes',
      imageUrl: '/src/assets/images/place_botanical_park_1794977877475.jpg',
    },
    {
      id: 'capsule-travels',
      title: 'Mysore Palace Evening',
      subtitle: 'Family Travels & Golden Evenings capsule',
      imageUrl: '/src/assets/images/memory_mysore_palace_1794977878338.jpg',
    },
    {
      id: 'sunroom-tea',
      title: 'Morning Tea & Notes',
      subtitle: 'Sunroom memory journal & reading glasses',
      imageUrl: '/src/assets/images/accordion_sunroom_tea_1794988072404.jpg',
    },
    {
      id: 'family-dinner',
      title: 'Sunday Family Dinner',
      subtitle: 'Shared meals with Rahul & Maya',
      imageUrl: '/src/assets/images/accordion_family_dinner_1794988071380.jpg',
    },
    {
      id: 'reading-corner',
      title: 'Quiet Reading Corner',
      subtitle: 'Afternoon albums by the garden window',
      imageUrl: '/src/assets/images/accordion_reading_corner_1794988073851.jpg',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#29283A]">Memory Capsules</h1>
          <p className="text-sm text-[#68667D] mt-0.5">
            Curated keepsake collections of family trips, traditions, and meaningful stories.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New capsule</span>
        </button>
      </div>

      <LandingAccordionItem
        items={reelItems}
        compact
        heading="Keepsake highlights"
        description="Hover or tap any panel to bring cherished moments forward, or create a new capsule to preserve family memories together."
        ctaLabel="Create capsule"
        onCtaClick={() => setCreateOpen(true)}
        onItemSelect={(item) => {
          const matched = vault.capsules.find((c) => c.id === item.id) || vault.capsules[0];
          if (matched) setSelectedCapsule(matched);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {vault.capsules.map((cap) => {
          const memories = vault.memories.filter((m) => cap.memoryIds.includes(m.id));
          return (
            <article
              key={cap.id}
              className="bg-white rounded-2xl border border-[#E6E3F1] overflow-hidden flex flex-col"
            >
              {cap.coverImageUrl ? (
                <div className="h-44 w-full overflow-hidden border-b border-[#E6E3F1]">
                  <SafeImage
                    src={cap.coverImageUrl}
                    alt={cap.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-28 w-full bg-gradient-to-br from-[#EDEAF9] to-[#DDF3E8] flex items-center justify-center border-b border-[#E6E3F1]">
                  <Archive className="w-7 h-7 text-[#5B4DC4]" />
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <MetadataLine
                    items={[
                      cap.theme,
                      `${memories.length} memories`,
                      cap.unlockDate ? formatFriendlyDate(cap.unlockDate) : undefined,
                    ]}
                  />
                  <h3 className="text-lg font-semibold text-[#29283A] mt-1">{cap.title}</h3>
                  <p className="text-sm text-[#4A485E] mt-1.5 leading-relaxed">
                    {cap.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCapsule(cap)}
                  className="self-start px-4 py-2 text-xs font-medium text-[#4E3FB8] bg-[#EDEAF9] hover:bg-[#E1DCF7] rounded-xl cursor-pointer"
                >
                  Open capsule
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={Boolean(selectedCapsule)}
        onClose={() => setSelectedCapsule(null)}
        title={selectedCapsule?.title || 'Memory Capsule'}
        subtitle={selectedCapsule?.theme}
        maxWidth="max-w-2xl"
      >
        {selectedCapsule && (
          <div className="space-y-4">
            <p className="text-sm text-[#4A485E]">{selectedCapsule.description}</p>
            <div className="space-y-3 pt-2">
              {vault.memories
                .filter((m) => selectedCapsule.memoryIds.includes(m.id))
                .map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl bg-[#F8F7FC] border border-[#ECEAF5] space-y-1.5"
                  >
                    <MetadataLine
                      items={[m.category, formatFriendlyDate(m.eventDate || m.createdAt)]}
                    />
                    <h4 className="text-sm font-semibold text-[#29283A]">{m.title}</h4>
                    <p className="text-xs text-[#4A485E] leading-relaxed">{m.description}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Memory Capsule"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1">Capsule title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sunday Family Traditions"
              className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1">Theme</label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g., Family & Recipes"
              className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">
              Include memories
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2.5 bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl">
              {vault.memories.map((m) => {
                const checked = selectedMemIds.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedMemIds((prev) =>
                          checked ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                        )
                      }
                      className="accent-[#6D5FD1]"
                    />
                    <span className="truncate">{m.title}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-sm font-medium text-[#4A485E] bg-[#F2F0F9] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#6D5FD1] rounded-xl cursor-pointer"
            >
              Create Capsule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function ActivitiesView({
  vault,
  onVaultUpdate,
  onToast,
}: {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  return (
    <MemoryActivitiesDiary
      vault={vault}
      onVaultUpdate={onVaultUpdate}
      onToast={onToast}
    />
  );
}
