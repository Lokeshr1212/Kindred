import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlarmClock,
  Archive,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  HeartHandshake,
  KeyRound,
  MapPin,
  MessageCircleHeart,
  Mic,
  Plus,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Users,
} from 'lucide-react';
import { api, formatFriendlyDate } from '../lib/api';
import type {
  MemoryRecord,
  NavSection,
  RoutineRecord,
  VaultClientData,
} from '../types/memory';
import type { QuickModalType } from './QuickModals';
import {
  AnimatedCounter,
  MetadataLine,
  Modal,
  SafeImage,
  SegmentedTabs,
} from './ui/CommonUI';

interface HomeDashboardProps {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onNavigate: (section: NavSection) => void;
  onOpenQuickModal: (modal: QuickModalType) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

interface CompanionPreviewPrompt {
  id: string;
  question: string;
  answer: string;
  citationLabel: string;
  citationDetail: string;
  targetSection: NavSection;
}

export function HomeDashboard({
  vault,
  onVaultUpdate,
  onNavigate,
  onOpenQuickModal,
  onToast,
}: HomeDashboardProps) {
  const [chartPeriod, setChartPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);
  const [activePromptIdx, setActivePromptIdx] = useState(0);

  // Routine interactive modals
  const [detailRoutine, setDetailRoutine] = useState<RoutineRecord | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<RoutineRecord | null>(null);
  const [newTime, setNewTime] = useState('10:00');
  const [skipTarget, setSkipTarget] = useState<RoutineRecord | null>(null);
  const [skipReason, setSkipReason] = useState('');

  const reduceMotion = vault.settings.reducedMotion;

  const now = new Date();
  const hr = now.getHours();
  const timeGreeting =
    hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const formattedDay = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Live routine metrics
  const completedCount = vault.routines.filter((r) => r.status === 'completed').length;
  const pendingRoutines = vault.routines.filter(
    (r) => r.status === 'pending' || r.status === 'snoozed'
  );
  const completionPct =
    vault.routines.length > 0
      ? Math.round((completedCount / vault.routines.length) * 100)
      : 0;

  // Recent memories sorted by most recently updated / created
  const recentMemories = useMemo<MemoryRecord[]>(() => {
    return [...vault.memories]
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || a.eventDate || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || b.eventDate || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [vault.memories]);

  // Grounded interactive preview snippets built strictly from real vault entries
  const companionPrompts = useMemo<CompanionPreviewPrompt[]>(() => {
    const prompts: CompanionPreviewPrompt[] = [];

    const firstMemory = recentMemories[0];
    if (firstMemory) {
      prompts.push({
        id: `mem-${firstMemory.id}`,
        question: `Tell me about "${firstMemory.title}"`,
        answer: firstMemory.description,
        citationLabel: `${firstMemory.category} · ${firstMemory.verificationStatus}`,
        citationDetail: `${firstMemory.source}${
          firstMemory.eventDate ? ` · ${formatFriendlyDate(firstMemory.eventDate)}` : ''
        }`,
        targetSection: 'memories',
      });
    }

    const firstPerson = vault.people[0];
    if (firstPerson) {
      prompts.push({
        id: `person-${firstPerson.id}`,
        question: `Who is ${firstPerson.name}?`,
        answer: `${firstPerson.name} is your ${firstPerson.relationship.toLowerCase()}. ${
          firstPerson.importantDetails || firstPerson.notes
        }`,
        citationLabel: `People · ${firstPerson.relationshipGroup}`,
        citationDetail: firstPerson.visitingNext
          ? `Next visit: ${firstPerson.visitingNext}`
          : `Saved contact profile`,
        targetSection: 'people',
      });
    }

    const firstBelonging = vault.belongings[0];
    if (firstBelonging) {
      prompts.push({
        id: `item-${firstBelonging.id}`,
        question: `Where did I keep my ${firstBelonging.name.toLowerCase()}?`,
        answer: `Stored in ${firstBelonging.room} — ${firstBelonging.exactLocation}.${
          firstBelonging.visualCue ? ` Visual cue: ${firstBelonging.visualCue}.` : ''
        }`,
        citationLabel: `Belongings · ${firstBelonging.category}`,
        citationDetail: `Verified ${formatFriendlyDate(firstBelonging.lastVerifiedAt)}`,
        targetSection: 'belongings',
      });
    }

    const firstPlace = vault.places[0];
    if (firstPlace) {
      prompts.push({
        id: `place-${firstPlace.id}`,
        question: `What should I know about ${firstPlace.name}?`,
        answer: `${firstPlace.landmarkCue || firstPlace.notes} Located at ${firstPlace.address}.`,
        citationLabel: `Places · ${firstPlace.category}`,
        citationDetail: firstPlace.visitingHours || 'Saved familiar place',
        targetSection: 'places',
      });
    }

    if (prompts.length === 0) {
      prompts.push({
        id: 'empty-preview',
        question: 'How does my AI Companion help?',
        answer:
          'Once you save memories, people, places, or belongings, your AI Companion answers everyday questions directly from your personal vault with clear source citations.',
        citationLabel: 'Personal Memory Vault',
        citationDetail: 'Grounded private retrieval',
        targetSection: 'companion',
      });
    }

    return prompts;
  }, [recentMemories, vault.people, vault.belongings, vault.places]);

  const safePromptIdx = Math.min(activePromptIdx, companionPrompts.length - 1);
  const currentPreview = companionPrompts[safePromptIdx];

  const chartData =
    chartPeriod === 'weekly' ? vault.weeklyHistory : vault.monthlyHistory;
  const maxChartTotal = Math.max(
    1,
    ...chartData.map((d) => d.completed + d.missed + d.upcoming)
  );

  const handleCompleteRoutine = async (routine: RoutineRecord) => {
    const nextStatus = routine.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await api.updateRoutine(routine.id, { status: nextStatus });
      onVaultUpdate(updated);
      onToast(
        nextStatus === 'completed'
          ? `Marked "${routine.title}" complete.`
          : `Moved "${routine.title}" back to pending.`
      );
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleSnoozeRoutine = async (routine: RoutineRecord) => {
    const [h, m] = routine.time.split(':').map(Number);
    const totalMins = h * 60 + m + 30;
    const nextH = Math.floor(totalMins / 60) % 24;
    const nextM = totalMins % 60;
    const nextTimeStr = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
    try {
      const updated = await api.updateRoutine(routine.id, {
        status: 'snoozed',
        time: nextTimeStr,
        snoozedUntil: nextTimeStr,
      });
      onVaultUpdate(updated);
      onToast(`Snoozed "${routine.title}" by 30 minutes.`);
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    try {
      const updated = await api.updateRoutine(rescheduleTarget.id, {
        time: newTime,
        status: 'pending',
      });
      onVaultUpdate(updated);
      onToast(`Rescheduled "${rescheduleTarget.title}".`);
      setRescheduleTarget(null);
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleConfirmSkip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skipTarget) return;
    try {
      const updated = await api.updateRoutine(skipTarget.id, {
        status: 'skipped',
        skipReason: skipReason.trim() || 'Skipped by user',
      });
      onVaultUpdate(updated);
      onToast(`Skipped "${skipTarget.title}".`);
      setSkipTarget(null);
      setSkipReason('');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const memoryOverviewMetrics: {
    label: string;
    value: number;
    helper: string;
    target: NavSection;
    icon: React.ComponentType<{ className?: string }>;
    accentBg: string;
    accentText: string;
  }[] = [
    {
      label: 'Total saved memories',
      value: vault.memories.length,
      helper: 'Open memory library',
      target: 'memories',
      icon: BookOpen,
      accentBg: 'bg-[#EEF2FF]',
      accentText: 'text-[#4338CA]',
    },
    {
      label: 'Important people',
      value: vault.people.length,
      helper: 'Family & trusted contacts',
      target: 'people',
      icon: Users,
      accentBg: 'bg-[#ECFDF5]',
      accentText: 'text-[#0F766E]',
    },
    {
      label: 'Saved places',
      value: vault.places.length,
      helper: 'Home & familiar spots',
      target: 'places',
      icon: MapPin,
      accentBg: 'bg-[#F0F9FF]',
      accentText: 'text-[#0369A1]',
    },
    {
      label: 'Daily routines',
      value: vault.routines.length,
      helper: `${completedCount} of ${vault.routines.length} completed`,
      target: 'routines',
      icon: Calendar,
      accentBg: 'bg-[#F5F3FF]',
      accentText: 'text-[#5B4DC4]',
    },
    {
      label: 'Memory capsules',
      value: vault.capsules.length,
      helper: 'Curated life collections',
      target: 'capsules',
      icon: Archive,
      accentBg: 'bg-[#FEF3C7]/70',
      accentText: 'text-[#92400E]',
    },
  ];

  const quickActions = [
    {
      label: 'Ask AI Companion',
      hint: 'Recall memories with sources',
      icon: MessageCircleHeart,
      primary: true,
      action: () => onNavigate('companion'),
    },
    {
      label: 'Add a Memory',
      hint: 'Save a story or photo',
      icon: Plus,
      primary: false,
      action: () => onOpenQuickModal('memory'),
    },
    {
      label: 'View People',
      hint: `${vault.people.length} trusted profiles`,
      icon: Users,
      primary: false,
      action: () => onNavigate('people'),
    },
    {
      label: 'View Places',
      hint: `${vault.places.length} saved locations`,
      icon: MapPin,
      primary: false,
      action: () => onNavigate('places'),
    },
    {
      label: 'Check Daily Routines',
      hint: `${pendingRoutines.length} pending today`,
      icon: Clock,
      primary: false,
      action: () => onNavigate('routines'),
    },
    {
      label: 'Record Voice Note',
      hint: 'Speak a quick reminder',
      icon: Mic,
      primary: false,
      action: () => onOpenQuickModal('voice'),
    },
  ];

  return (
    <div className="space-y-8 pb-6">
      {/* A & B: Atmospheric Daylight Welcome Hero + Featured AI Memory Companion Card */}
      <section
        aria-label="Welcome and AI Memory Companion"
        className="relative overflow-hidden rounded-[28px] border border-[#DCE3EE] bg-gradient-to-br from-[#F4F7FC] via-[#FFFFFF] to-[#E9F5EF] p-6 sm:p-8 lg:p-10 shadow-[0_12px_40px_-24px_rgba(24,28,46,0.16)]"
      >
        {/* Subtle painted horizon & botanical sky wash */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-br from-[#C7D2FE]/35 via-[#D1FAE5]/30 to-transparent blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-16 w-80 h-80 rounded-full bg-gradient-to-tr from-[#A7F3D0]/30 via-[#E0E7FF]/30 to-transparent blur-2xl"
        />

        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">
          {/* A. Welcome Column */}
          <div className="xl:col-span-6 space-y-5">
            <div className="flex items-center gap-3.5">
              <SafeImage
                src={vault.settings.avatarUrl}
                alt={`${vault.settings.userName} portrait`}
                fallbackLabel={vault.settings.userName[0]}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-white shadow-sm shrink-0"
              />
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-medium text-[#0F766E]">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" aria-hidden="true" />
                  <span>{formattedDay}</span>
                </p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Personal Memory Assistant · Encrypted Private Vault
                </p>
              </div>
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#181C2E] tracking-tight leading-[1.15] text-balance">
                {timeGreeting}, {vault.settings.userName}.
              </h1>
              <p className="text-base text-[#475569] mt-3 leading-relaxed max-w-xl">
                {vault.settings.greetingStyle === 'warm'
                  ? 'Welcome back to Kindred. Your saved stories, trusted people, familiar places, and daily rhythm are gathered peacefully here whenever you need a gentle reminder.'
                  : 'Welcome to Kindred — your calm daily space for memories, people, places, and routines.'}
              </p>
              {vault.settings.weatherEnabled && vault.settings.weatherCity && (
                <p className="text-xs text-[#64748B] mt-2.5 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>Saved home area: {vault.settings.weatherCity}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('companion')}
                className="inline-flex items-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-[#181C2E] hover:bg-[#2C3352] rounded-xl transition-colors cursor-pointer shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5]"
              >
                <MessageCircleHeart className="w-4 h-4 text-[#A7F3D0]" />
                <span>Open AI Companion</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onOpenQuickModal('memory')}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#181C2E] bg-white/90 hover:bg-white border border-[#D7DFEC] rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#4F46E5]" />
                <span>Save a Memory</span>
              </button>
            </div>
          </div>

          {/* B. AI Memory Companion Featured Card */}
          <div className="xl:col-span-6">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.35 }}
              className="bg-white/95 backdrop-blur-sm rounded-3xl border border-[#DCE3EE] shadow-[0_20px_50px_-28px_rgba(24,28,46,0.22)] p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#0F766E] text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#181C2E]">
                      AI Memory Companion
                    </h2>
                    <p className="text-xs text-[#64748B]">
                      Recalls your saved memories, people, places & belongings with citations
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F766E] bg-[#ECFDF5] border border-[#BBF7D0] px-2.5 py-1 rounded-lg shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Vault-grounded</span>
                </span>
              </div>

              {/* Prompt selector row from real vault data */}
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sample memory questions">
                {companionPrompts.map((prompt, idx) => {
                  const active = idx === safePromptIdx;
                  return (
                    <button
                      key={prompt.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActivePromptIdx(idx)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer text-left ${
                        active
                          ? 'bg-[#EEF2FF] border-[#C7D2FE] text-[#3730A3]'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {prompt.question}
                    </button>
                  );
                })}
              </div>

              {/* Grounded Assistant Preview Bubble */}
              <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                  <span className="font-medium text-[#181C2E]">Kindred Assistant Preview</span>
                  <button
                    type="button"
                    onClick={() => onNavigate(currentPreview.targetSection)}
                    className="text-[#4F46E5] hover:underline font-medium cursor-pointer"
                  >
                    {currentPreview.citationLabel}
                  </button>
                </div>

                <p className="text-sm text-[#1E293B] leading-relaxed">
                  {currentPreview.answer}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0]">
                  <span className="text-xs text-[#64748B]">
                    Source: {currentPreview.citationDetail}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('companion')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4F46E5] hover:text-[#3730A3] cursor-pointer"
                  >
                    <span>Start a conversation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* G. Quick Actions Bar */}
      <section aria-label="Quick actions">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#181C2E] uppercase tracking-wider">
            Quick Actions
          </h2>
          <span className="text-xs text-[#64748B]">One-tap access across your vault</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={`group flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer min-h-[64px] focus-visible:outline-2 focus-visible:outline-[#4F46E5] ${
                  item.primary
                    ? 'bg-[#EEF2FF]/75 border-[#C7D2FE] hover:bg-[#E0E7FF]'
                    : 'bg-white border-[#E2E8F0] hover:border-[#A5B4FC] hover:bg-[#F8FAFC]'
                }`}
              >
                <span
                  className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                    item.primary
                      ? 'bg-[#4F46E5] text-white'
                      : 'bg-[#F1F5F9] text-[#4F46E5] group-hover:bg-[#EEF2FF]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#181C2E] leading-tight truncate">
                    {item.label}
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5 truncate">{item.hint}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* C. Memory Overview Metrics */}
      <section aria-label="Memory overview">
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="text-xl font-bold text-[#181C2E] tracking-tight">Memory Overview</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Live summary of everything saved inside your private vault
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {memoryOverviewMetrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <motion.button
                key={metric.label}
                type="button"
                onClick={() => onNavigate(metric.target)}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : idx * 0.04 }}
                className="bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#94A3B8] hover:shadow-sm p-4 sm:p-5 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[124px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#475569]">{metric.label}</span>
                  <span className={`p-2 rounded-xl ${metric.accentBg} ${metric.accentText} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-3xl font-bold text-[#181C2E] tabular-nums">
                    <AnimatedCounter value={metric.value} />
                  </p>
                  <p className="text-xs text-[#64748B] mt-1 flex items-center justify-between gap-1">
                    <span className="truncate">{metric.helper}</span>
                    <ArrowRight className="w-3 h-3 shrink-0 opacity-60" />
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* D. Today's Routine & Reminders */}
      <section aria-label="Today's routine" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E2E8F0] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#181C2E]">Today&apos;s Routine</h2>
              <MetadataLine
                items={[
                  `${vault.routines.length} scheduled`,
                  `${completedCount} completed`,
                  `${pendingRoutines.length} pending`,
                ]}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenQuickModal('routine')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#181C2E] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('routines')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#4F46E5] bg-[#EEF2FF] hover:bg-[#E0E7FF] rounded-xl cursor-pointer"
              >
                <span>Open Daily Routines</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-[#64748B] mb-1.5">
              <span>Daily progress</span>
              <span className="font-mono-tabular font-semibold text-[#181C2E]">
                {completionPct}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#4F46E5] to-[#10B981] rounded-full"
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${completionPct}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          {vault.routines.length === 0 ? (
            <div className="rounded-2xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] p-8 text-center">
              <p className="text-sm font-medium text-[#181C2E]">
                No routines scheduled yet for today.
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                Add a gentle reminder for meals, movement, medication, or family calls.
              </p>
              <button
                type="button"
                onClick={() => onOpenQuickModal('routine')}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add your first routine</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {vault.routines.map((r) => {
                const isDone = r.status === 'completed';
                const isSkipped = r.status === 'skipped';
                return (
                  <div
                    key={r.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleCompleteRoutine(r)}
                        aria-label={
                          isDone ? `Mark ${r.title} pending` : `Mark ${r.title} complete`
                        }
                        className={`mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          isDone
                            ? 'bg-[#0F766E] border-[#0F766E] text-white'
                            : isSkipped
                            ? 'bg-[#F1F5F9] border-[#CBD5E1] text-[#64748B]'
                            : 'bg-white border-[#CBD5E1] hover:border-[#4F46E5]'
                        }`}
                      >
                        {isDone && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono-tabular text-xs font-semibold text-[#4F46E5]">
                            {r.displayTime}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDetailRoutine(r)}
                            className={`text-sm font-medium text-left hover:text-[#4F46E5] transition-colors cursor-pointer ${
                              isDone
                                ? 'line-through text-[#94A3B8]'
                                : isSkipped
                                ? 'text-[#94A3B8]'
                                : 'text-[#181C2E]'
                            }`}
                          >
                            {r.title}
                          </button>
                        </div>
                        <MetadataLine
                          items={[
                            r.period,
                            r.category,
                            r.status === 'snoozed' ? 'Snoozed' : undefined,
                            r.status === 'skipped'
                              ? `Skipped${r.skipReason ? `: ${r.skipReason}` : ''}`
                              : undefined,
                            r.priority === 'high' ? 'Important' : undefined,
                          ]}
                        />
                      </div>
                    </div>

                    {!isDone && (
                      <div className="flex items-center gap-1.5 pl-9 sm:pl-0 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSnoozeRoutine(r)}
                          title="Snooze 30 minutes"
                          className="px-2.5 py-1.5 text-xs font-medium text-[#475569] bg-[#F8FAFC] hover:bg-[#EEF2FF] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <AlarmClock className="w-3.5 h-3.5" />
                          <span>Snooze</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRescheduleTarget(r);
                            setNewTime(r.time);
                          }}
                          title="Reschedule"
                          className="px-2.5 py-1.5 text-xs font-medium text-[#475569] bg-[#F8FAFC] hover:bg-[#EEF2FF] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Move</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSkipTarget(r)}
                          title="Skip with optional reason"
                          className="px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:text-[#181C2E] bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <SkipForward className="w-3.5 h-3.5" />
                          <span>Skip</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Next Up Reminders + Weekly/Monthly Routine Rhythm */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#181C2E]">Up Next Today</h3>
                <p className="text-xs text-[#64748B]">
                  {pendingRoutines.length} pending item{pendingRoutines.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('notifications')}
                className="text-xs font-medium text-[#4F46E5] hover:underline cursor-pointer"
              >
                Notifications
              </button>
            </div>

            {pendingRoutines.length === 0 ? (
              <div className="rounded-2xl bg-[#ECFDF5]/60 border border-[#BBF7D0] p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0F766E] shrink-0" />
                <p className="text-sm text-[#181C2E]">
                  All scheduled activities for today have been completed or reviewed.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingRoutines.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#181C2E] truncate">{r.title}</p>
                      <MetadataLine
                        items={[
                          r.displayTime,
                          r.category,
                          r.status === 'snoozed' ? 'Snoozed' : 'Pending',
                        ]}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCompleteRoutine(r)}
                      className="px-3 py-1.5 text-xs font-semibold text-[#0F766E] bg-white border border-[#CBD5E1] hover:bg-[#ECFDF5] rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      Done
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compact Rhythm Chart */}
          <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#181C2E]">Routine Rhythm</h3>
                <p className="text-xs text-[#64748B]">Personal organization consistency</p>
              </div>
              <SegmentedTabs
                options={[
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
                value={chartPeriod}
                onChange={setChartPeriod}
              />
            </div>

            <div className="relative h-40 flex items-end justify-between gap-2 sm:gap-3 pt-6 pb-2 border-b border-[#E2E8F0]">
              {chartData.map((pt, idx) => {
                const completedH = Math.round((pt.completed / maxChartTotal) * 105);
                const upcomingH = Math.round((pt.upcoming / maxChartTotal) * 105);
                const missedH = Math.round((pt.missed / maxChartTotal) * 105);
                const isHovered = hoveredBarIdx === idx;
                return (
                  <div
                    key={pt.day}
                    onMouseEnter={() => setHoveredBarIdx(idx)}
                    onMouseLeave={() => setHoveredBarIdx(null)}
                    className="relative flex-1 flex flex-col items-center"
                  >
                    {isHovered && (
                      <div className="absolute -top-8 z-10 bg-[#181C2E] text-white text-[11px] px-2.5 py-1 rounded-lg shadow-md whitespace-nowrap tabular-nums">
                        {pt.completed} done · {pt.upcoming} up · {pt.missed} missed
                      </div>
                    )}
                    <div className="w-full max-w-[32px] flex flex-col-reverse gap-0.5 items-stretch">
                      {pt.completed > 0 && (
                        <div
                          style={{ height: `${Math.max(6, completedH)}px` }}
                          className="w-full bg-[#4F46E5] rounded-t-md rounded-b-sm"
                        />
                      )}
                      {pt.upcoming > 0 && (
                        <div
                          style={{ height: `${Math.max(5, upcomingH)}px` }}
                          className="w-full bg-[#93C5FD] rounded-md"
                        />
                      )}
                      {pt.missed > 0 && (
                        <div
                          style={{ height: `${Math.max(5, missedH)}px` }}
                          className="w-full bg-[#FCA5A5] rounded-md"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              {chartData.map((pt) => (
                <div key={pt.day} className="flex-1 text-center">
                  <p className="text-[11px] font-medium text-[#181C2E]">{pt.day}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* E. Recent Memories */}
      <section aria-label="Recent memories" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#181C2E] tracking-tight">Recent Memories</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Your latest stories, photographs, and life notes saved in Kindred
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('memories')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#4F46E5] bg-[#EEF2FF] hover:bg-[#E0E7FF] rounded-xl cursor-pointer"
          >
            <span>Open My Memories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentMemories.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-[#CBD5E1] p-8 text-center">
            <p className="text-sm font-medium text-[#181C2E]">
              Your memory library is ready for your first story.
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              Save a meaningful photograph, family moment, or everyday reminder.
            </p>
            <button
              type="button"
              onClick={() => onOpenQuickModal('memory')}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add a Memory</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {recentMemories.map((m) => (
              <article
                key={m.id}
                className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden flex flex-col justify-between hover:border-[#A5B4FC] transition-colors"
              >
                <div>
                  {m.imageUrl ? (
                    <div className="h-44 w-full overflow-hidden bg-[#F1F5F9]">
                      <SafeImage
                        src={m.imageUrl}
                        alt={m.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-24 w-full bg-gradient-to-br from-[#EEF2FF] via-[#F8FAFC] to-[#ECFDF5] px-4 flex items-center justify-between border-b border-[#E2E8F0]">
                      <span className="text-xs font-semibold text-[#4F46E5]">{m.category}</span>
                      <BookOpen className="w-4 h-4 text-[#94A3B8]" />
                    </div>
                  )}

                  <div className="p-4 space-y-2">
                    <MetadataLine
                      items={[
                        m.eventDate
                          ? formatFriendlyDate(m.eventDate)
                          : formatFriendlyDate(m.updatedAt || m.createdAt),
                        m.category,
                      ]}
                    />
                    <h3 className="text-base font-semibold text-[#181C2E] leading-snug">
                      {m.title}
                    </h3>
                    <p className="text-sm text-[#475569] leading-relaxed line-clamp-3">
                      {m.description}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-[#F1F5F9] flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#64748B]">
                    {m.verificationStatus}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('memories')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:underline cursor-pointer"
                  >
                    <span>Read</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* F. Important People & Places */}
      <section aria-label="Important people and places" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Important People */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#ECFDF5] text-[#0F766E]">
                <HeartHandshake className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#181C2E]">Important People</h2>
                <p className="text-xs text-[#64748B]">
                  {vault.people.length} saved relationship{vault.people.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenQuickModal('person')}
                className="px-3 py-1.5 text-xs font-medium text-[#181C2E] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl cursor-pointer"
              >
                + Add
              </button>
              <button
                type="button"
                onClick={() => onNavigate('people')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0F766E] bg-[#ECFDF5] hover:bg-[#D1FAE5] rounded-xl cursor-pointer"
              >
                <span>View People</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {vault.people.length === 0 ? (
            <div className="rounded-2xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] p-6 text-center">
              <p className="text-sm text-[#475569]">No people profiles added yet.</p>
              <button
                type="button"
                onClick={() => onOpenQuickModal('person')}
                className="mt-3 text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
              >
                Add someone special
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vault.people.slice(0, 4).map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => onNavigate('people')}
                  className="p-3.5 rounded-2xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-left flex items-start gap-3 transition-colors cursor-pointer"
                >
                  <SafeImage
                    src={person.avatarUrl}
                    alt={person.name}
                    fallbackLabel={person.name[0]}
                    className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#181C2E] truncate">
                      {person.name}
                    </p>
                    <p className="text-xs font-medium text-[#0F766E] truncate">
                      {person.relationship}
                    </p>
                    <p className="text-xs text-[#64748B] mt-1 line-clamp-1">
                      {person.visitingNext
                        ? `Next visit: ${person.visitingNext}`
                        : person.importantDetails || person.relationshipGroup}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Saved Places */}
        <div className="bg-white rounded-3xl border border-[#E2E8F0] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#F0F9FF] text-[#0369A1]">
                <MapPin className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#181C2E]">Familiar Places</h2>
                <p className="text-xs text-[#64748B]">
                  {vault.places.length} saved location{vault.places.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenQuickModal('place')}
                className="px-3 py-1.5 text-xs font-medium text-[#181C2E] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl cursor-pointer"
              >
                + Add
              </button>
              <button
                type="button"
                onClick={() => onNavigate('places')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0369A1] bg-[#F0F9FF] hover:bg-[#E0F2FE] rounded-xl cursor-pointer"
              >
                <span>View Places</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {vault.places.length === 0 ? (
            <div className="rounded-2xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] p-6 text-center">
              <p className="text-sm text-[#475569]">No saved places added yet.</p>
              <button
                type="button"
                onClick={() => onOpenQuickModal('place')}
                className="mt-3 text-xs font-semibold text-[#0369A1] hover:underline cursor-pointer"
              >
                Save a familiar place
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vault.places.slice(0, 4).map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => onNavigate('places')}
                  className="p-3.5 rounded-2xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-left flex items-start gap-3 transition-colors cursor-pointer"
                >
                  <SafeImage
                    src={place.imageUrl}
                    alt={place.name}
                    fallbackLabel={place.name[0]}
                    className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#181C2E] truncate">
                      {place.name}
                    </p>
                    <p className="text-xs font-medium text-[#0369A1] truncate">
                      {place.category}
                    </p>
                    <p className="text-xs text-[#64748B] mt-1 line-clamp-1">
                      {place.landmarkCue || place.address}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Belongings Quiet Shortcut Banner if items exist */}
      {vault.belongings.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#E2E8F0] px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
              <KeyRound className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#181C2E]">
                Looking for an everyday item?
              </p>
              <p className="text-xs text-[#64748B]">
                {vault.belongings.length} personal belonging
                {vault.belongings.length === 1 ? '' : 's'} tracked by room & visual cue.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('belongings')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#181C2E] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl cursor-pointer"
          >
            <span>Open My Belongings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </section>
      )}

      {/* Routine Details Modal */}
      <Modal
        open={Boolean(detailRoutine)}
        onClose={() => setDetailRoutine(null)}
        title={detailRoutine?.title || 'Activity Details'}
        subtitle={
          detailRoutine
            ? `${detailRoutine.displayTime} · ${detailRoutine.period} · ${detailRoutine.category}`
            : ''
        }
      >
        {detailRoutine && (
          <div className="space-y-4">
            <p className="text-sm text-[#475569] leading-relaxed">
              {detailRoutine.notes || 'No extra notes saved for this routine.'}
            </p>
            <MetadataLine
              items={[
                `Status: ${detailRoutine.status}`,
                `Priority: ${detailRoutine.priority}`,
                detailRoutine.caregiverAlertOnMiss
                  ? 'Caregiver gentle check-in enabled'
                  : 'Personal routine only',
              ]}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleCompleteRoutine(detailRoutine);
                  setDetailRoutine(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-[#4F46E5] hover:bg-[#4338CA] rounded-xl cursor-pointer"
              >
                {detailRoutine.status === 'completed' ? 'Mark Pending' : 'Mark Complete'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title="Reschedule Activity"
        subtitle={rescheduleTarget?.title}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleConfirmReschedule} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              Choose new time
            </label>
            <input
              type="time"
              required
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRescheduleTarget(null)}
              className="px-4 py-2 text-sm font-medium text-[#475569] bg-[#F1F5F9] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#4F46E5] rounded-xl cursor-pointer"
            >
              Save Time
            </button>
          </div>
        </form>
      </Modal>

      {/* Skip Modal */}
      <Modal
        open={Boolean(skipTarget)}
        onClose={() => setSkipTarget(null)}
        title="Skip Activity"
        subtitle={skipTarget?.title}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmSkip} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              Optional reason
            </label>
            <input
              type="text"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="e.g., Resting this afternoon, moved to tomorrow"
              className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSkipTarget(null)}
              className="px-4 py-2 text-sm font-medium text-[#475569] bg-[#F1F5F9] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#4F46E5] rounded-xl cursor-pointer"
            >
              Skip Activity
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
