import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

export interface AccordionMediaItem {
  id: string | number;
  title: string;
  subtitle?: string;
  imageUrl: string;
}

export interface LandingAccordionItemProps {
  items?: AccordionMediaItem[];
  heading?: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  secondaryCtaLabel?: string;
  onSecondaryCtaClick?: () => void;
  onItemSelect?: (item: AccordionMediaItem) => void;
  compact?: boolean;
}

const DEFAULT_ACCORDION_ITEMS: AccordionMediaItem[] = [
  {
    id: 'companion',
    title: 'AI Memory Companion',
    subtitle: 'Grounded answers from your personal vault',
    imageUrl: '/src/assets/images/accordion_sunroom_tea_1794988072404.jpg',
  },
  {
    id: 'places',
    title: 'Familiar Places',
    subtitle: 'Willow Botanical Park & visual cues',
    imageUrl: '/src/assets/images/place_botanical_park_1794977877475.jpg',
  },
  {
    id: 'memories',
    title: 'Family Memories',
    subtitle: 'Mysore Palace evening & photo albums',
    imageUrl: '/src/assets/images/memory_mysore_palace_1794977878338.jpg',
  },
  {
    id: 'people',
    title: 'People & Visits',
    subtitle: 'Sunday family dinners & reminders',
    imageUrl: '/src/assets/images/accordion_family_dinner_1794988071380.jpg',
  },
  {
    id: 'capsules',
    title: 'Memory Capsules',
    subtitle: 'Quiet keepsakes saved locally',
    imageUrl: '/src/assets/images/accordion_reading_corner_1794988073851.jpg',
  },
];

interface AccordionItemProps {
  item: AccordionMediaItem;
  isActive: boolean;
  heightClass: string;
  expandedWidthClass: string;
  onActivate: () => void;
  onSelect?: () => void;
}

function AccordionItem({
  item,
  isActive,
  heightClass,
  expandedWidthClass,
  onActivate,
  onSelect,
}: AccordionItemProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={() => {
        onActivate();
        if (isActive && onSelect) {
          onSelect();
        }
      }}
      aria-pressed={isActive}
      className={`
        relative ${heightClass} rounded-2xl overflow-hidden cursor-pointer shrink-0 text-left
        transition-all duration-700 ease-in-out border border-[#E6E3F1]
        focus-visible:outline-2 focus-visible:outline-[#6D5FD1]
        ${isActive ? expandedWidthClass : 'w-[56px] sm:w-[60px]'}
      `}
    >
      {imgError ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#EDEAF9] via-[#F4F2FB] to-[#DDF3E8]/70 text-[#68667D] p-3"
          role="img"
          aria-label={item.title}
        >
          <ImageOff className="w-5 h-5 opacity-60" />
        </div>
      ) : (
        <img
          src={item.imageUrl}
          alt={item.title}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isActive
            ? 'bg-gradient-to-t from-[#1D1B2A]/80 via-[#1D1B2A]/25 to-transparent'
            : 'bg-black/45'
        }`}
        aria-hidden="true"
      />

      {isActive ? (
        <div className="absolute bottom-6 left-5 right-5 text-white transition-all duration-300">
          <p className="font-display text-lg font-semibold leading-snug truncate">
            {item.title}
          </p>
          {item.subtitle && (
            <p className="text-xs text-white/85 mt-0.5 truncate">{item.subtitle}</p>
          )}
        </div>
      ) : (
        <span className="absolute bottom-24 left-1/2 -translate-x-1/2 rotate-90 origin-center text-white text-base font-semibold whitespace-nowrap">
          {item.title}
        </span>
      )}
    </button>
  );
}

export function LandingAccordionItem({
  items = DEFAULT_ACCORDION_ITEMS,
  heading = 'Keep What Matters Close Every Day',
  description = 'Your private personal memory companion—organizing trusted people, familiar places, household items, and daily routines with a grounded AI assistant.',
  ctaLabel = 'Open Dashboard',
  onCtaClick,
  secondaryCtaLabel,
  onSecondaryCtaClick,
  onItemSelect,
  compact = false,
}: LandingAccordionItemProps) {
  const [activeIndex, setActiveIndex] = useState(
    Math.min(4, Math.max(0, items.length - 1))
  );

  const heightClass = compact ? 'h-[320px] sm:h-[360px]' : 'h-[420px] sm:h-[450px]';
  const expandedWidthClass = compact
    ? 'w-[260px] sm:w-[320px]'
    : 'w-[280px] sm:w-[360px]';

  return (
    <section className="bg-white rounded-2xl border border-[#E6E3F1] px-6 py-10 sm:px-10 sm:py-14">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
        {/* Left Side: Text Content */}
        <div className="w-full lg:w-5/12 text-center lg:text-left">
          <h1
            className={`font-display font-bold text-[#29283A] leading-tight tracking-tight [text-wrap:balance] ${
              compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl'
            }`}
          >
            {heading}
          </h1>
          <p className="mt-5 text-base sm:text-lg text-[#4A485E] max-w-xl mx-auto lg:mx-0 leading-relaxed">
            {description}
          </p>
          {(onCtaClick || onSecondaryCtaClick) && (
            <div className="mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              {onCtaClick && (
                <button
                  type="button"
                  onClick={onCtaClick}
                  className="inline-flex items-center justify-center bg-[#29283A] hover:bg-[#1D1B2A] text-white font-semibold px-6 py-3 rounded-xl transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {ctaLabel}
                </button>
              )}
              {secondaryCtaLabel && onSecondaryCtaClick && (
                <button
                  type="button"
                  onClick={onSecondaryCtaClick}
                  className="inline-flex items-center justify-center bg-[#EDEAF9] hover:bg-[#E1DCF7] text-[#4E3FB8] font-semibold px-5 py-3 rounded-xl transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {secondaryCtaLabel}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Interactive Image Accordion */}
        <div className="w-full lg:w-7/12">
          <div className="flex flex-row items-center justify-start lg:justify-end gap-3 overflow-x-auto py-2">
            {items.map((item, index) => (
              <AccordionItem
                key={item.id}
                item={item}
                isActive={index === activeIndex}
                heightClass={heightClass}
                expandedWidthClass={expandedWidthClass}
                onActivate={() => setActiveIndex(index)}
                onSelect={onItemSelect ? () => onItemSelect(item) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingAccordionItem;
