import React, { useState } from 'react';
import { ArrowRight, ChevronDown, Lock, ShieldCheck } from 'lucide-react';
import type { NavSection, VaultClientData } from '../types/memory';
import {
  LandingAccordionItem,
  type AccordionMediaItem,
} from './ui/interactive-image-accordion';

interface LandingViewProps {
  vault: VaultClientData;
  onNavigate: (section: NavSection) => void;
}

const CAPABILITIES: {
  num: string;
  title: string;
  detail: string;
  target: NavSection;
  cta: string;
}[] = [
  {
    num: '01.',
    title: 'Citation-Backed AI Companion',
    detail:
      'Retrieves only relevant saved records before answering—citing sources clearly and never inventing personal details when data is missing.',
    target: 'companion',
    cta: 'Open AI Companion',
  },
  {
    num: '02.',
    title: 'People, Places & Belongings',
    detail:
      'Keep family profiles, familiar orientation cues, and exact spots for everyday items like reading glasses and keys easy to find.',
    target: 'belongings',
    cta: 'Browse Belongings',
  },
  {
    num: '03.',
    title: 'Gentle Daily Routines',
    detail:
      'Check off daily anchors, snooze or reschedule reminders smoothly, and keep completion metrics synchronized automatically.',
    target: 'routines',
    cta: 'Open Routines',
  },
  {
    num: '04.',
    title: 'PIN-Protected Caregiver View',
    detail:
      'Authorized family check-in for overdue alerts and notes while entries marked Private remain hidden by default.',
    target: 'caregiver',
    cta: 'Caregiver Dashboard',
  },
];

const FAQS = [
  {
    q: 'Does Kindred send my entire personal database to Gemini?',
    a: 'No. For every question, the server scores your local records and passes only up to seven relevant excerpts. Your API key and local encryption key stay strictly on the server.',
  },
  {
    q: 'What happens if I ask about something not saved yet?',
    a: 'Kindred never guesses or invents personal facts. When no matching record exists, it replies honestly and lets you save that new memory in one click.',
  },
  {
    q: 'How are Private journal entries kept hidden from caregivers?',
    a: 'Any memory or belonging marked Private is excluded from the Caregiver Dashboard unless explicitly shared under Privacy & Security (demo Caregiver PIN: 2468).',
  },
  {
    q: 'Can I export or restore my saved memories?',
    a: 'Yes. Open Privacy & Security anytime to download a JSON backup of your vault, restore from an export, or reset to sample records.',
  },
];

export function LandingView({ vault, onNavigate }: LandingViewProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const completedToday = vault.routines.filter((r) => r.status === 'completed').length;
  const privateHidden = vault.memories.filter((m) => m.privacyLevel === 'Private').length;

  const heroAccordionItems: AccordionMediaItem[] = [
    {
      id: 'companion',
      title: 'AI Memory Companion',
      subtitle: 'Grounded answers from your vault',
      imageUrl: '/src/assets/images/accordion_sunroom_tea_1794988072404.jpg',
    },
    {
      id: 'places',
      title: 'Familiar Places',
      subtitle: 'Willow Botanical Park & landmarks',
      imageUrl: '/src/assets/images/place_botanical_park_1794977877475.jpg',
    },
    {
      id: 'memories',
      title: 'Family Memories',
      subtitle: 'Mysore Palace evening & keepsakes',
      imageUrl: '/src/assets/images/memory_mysore_palace_1794977878338.jpg',
    },
    {
      id: 'people',
      title: 'Trusted People',
      subtitle: 'Rahul, Maya & upcoming visits',
      imageUrl: '/src/assets/images/accordion_family_dinner_1794988071380.jpg',
    },
    {
      id: 'capsules',
      title: 'Memory Capsules',
      subtitle: 'Curated collections preserved locally',
      imageUrl: '/src/assets/images/accordion_reading_corner_1794988073851.jpg',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Main Interactive Image Accordion Hero Landing Section */}
      <LandingAccordionItem
        items={heroAccordionItems}
        heading={`Keep What Matters Close Every Day, ${vault.settings.userName}`}
        description="Your private personal memory companion—organizing trusted people, familiar places, household items, and daily routines with a grounded AI assistant."
        ctaLabel="Open Daily Dashboard"
        onCtaClick={() => onNavigate('home')}
        secondaryCtaLabel="Ask AI Companion"
        onSecondaryCtaClick={() => onNavigate('companion')}
        onItemSelect={(item) => onNavigate(item.id as NavSection)}
      />

      {/* Live Vault Overview Strip */}
      <section className="bg-white rounded-2xl border border-[#E6E3F1] p-6 grid grid-cols-2 sm:grid-cols-4 gap-5">
        <div>
          <p className="text-xs text-[#68667D]">Saved memories</p>
          <p className="text-2xl font-bold font-mono-tabular text-[#29283A] mt-1">
            {vault.memories.length}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#68667D]">Trusted people</p>
          <p className="text-2xl font-bold font-mono-tabular text-[#29283A] mt-1">
            {vault.people.length}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#68667D]">Today&apos;s routines</p>
          <p className="text-2xl font-bold font-mono-tabular text-[#29283A] mt-1">
            {completedToday}/{vault.routines.length} done
          </p>
        </div>
        <div>
          <p className="text-xs text-[#68667D]">Caregiver boundary</p>
          <p className="text-2xl font-bold font-mono-tabular text-[#29283A] mt-1">
            {privateHidden} Private shielded
          </p>
        </div>
      </section>

      {/* Core Modules Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#5B4DC4]">
              Personal Memory Vault · Connected Modules
            </p>
            <h2 className="font-display text-2xl font-bold text-[#29283A] mt-1">
              Everything organized in one calm workspace
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('memories')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5B4DC4] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Browse all memories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CAPABILITIES.map((cap) => (
            <article
              key={cap.num}
              className="bg-white rounded-2xl border border-[#E6E3F1] p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <span className="font-mono-tabular text-xs font-semibold text-[#5B4DC4]">
                  {cap.num}
                </span>
                <h3 className="text-base font-semibold text-[#29283A]">{cap.title}</h3>
                <p className="text-sm text-[#4A485E] leading-relaxed">{cap.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(cap.target)}
                className="self-start px-3.5 py-2 text-xs font-medium text-[#4E3FB8] bg-[#EDEAF9] hover:bg-[#E1DCF7] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {cap.cta}
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Privacy & Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-white rounded-2xl border border-[#E6E3F1] p-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-[#DDF3E8] text-[#1E4D36] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[#29283A]">
              Local-First Privacy by Default
            </h2>
            <p className="text-sm text-[#4A485E] leading-relaxed">
              Your personal records stay encrypted on disk using AES-256-GCM. Confirmed,
              User-reported, Caregiver-reported, and Inferred notes are always clearly
              distinguished so nothing uncertain is presented as verified fact.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('privacy')}
              className="px-4 py-2 text-xs font-medium text-[#29283A] bg-[#F2F0F9] hover:bg-[#E6E3F1] rounded-xl transition-colors cursor-pointer"
            >
              Privacy &amp; Backups
            </button>
            <button
              type="button"
              onClick={() => onNavigate('caregiver')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#4E3FB8] bg-[#EDEAF9] hover:bg-[#E1DCF7] rounded-xl transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Caregiver PIN (2468)</span>
            </button>
          </div>
        </section>

        <section className="lg:col-span-7 bg-white rounded-2xl border border-[#E6E3F1] divide-y divide-[#F0EEF7]">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-[#FAF9FE] transition-colors cursor-pointer first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <span className="text-sm font-semibold text-[#29283A]">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#68667D] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-[#4A485E] leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
