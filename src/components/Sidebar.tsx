import React from 'react';
import {
  Archive,
  Bell,
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  HeartHandshake,
  Home,
  KeyRound,
  MapPin,
  MessageCircleHeart,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { NavSection, UserSettings } from '../types/memory';
import { SafeImage } from './ui/CommonUI';

interface SidebarProps {
  activeSection: NavSection;
  onSelect: (section: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  settings: UserSettings;
  unreadNotifications: number;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'landing', label: 'Landing Page', icon: Compass },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'companion', label: 'AI Companion', icon: MessageCircleHeart },
  { id: 'memories', label: 'My Memories', icon: BookOpen },
  { id: 'people', label: 'People', icon: Users },
  { id: 'places', label: 'Places', icon: MapPin },
  { id: 'routines', label: 'Daily Routines', icon: CalendarClock },
  { id: 'belongings', label: 'My Belongings', icon: KeyRound },
  { id: 'timeline', label: 'Memory Timeline', icon: Clock },
  { id: 'capsules', label: 'Memory Capsules', icon: Archive },
  { id: 'activities', label: 'Memory Activities', icon: Sparkles },
  { id: 'caregiver', label: 'Caregiver Dashboard', icon: HeartHandshake },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function getTimeGreeting(): string {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning!';
  if (hr < 17) return 'Good afternoon!';
  return 'Good evening!';
}

export function Sidebar({
  activeSection,
  onSelect,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  settings,
  unreadNotifications,
}: SidebarProps) {
  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const renderContent = (isMobile: boolean) => {
    const isNarrow = !isMobile && collapsed;

    return (
      <div className="flex flex-col h-full bg-white border-r border-[#E6E3F1]">
        {/* Brand & Collapse Header */}
        <div
          className={`flex items-center ${
            isNarrow ? 'justify-center px-3' : 'justify-between px-5'
          } py-4 border-b border-[#E6E3F1]`}
        >
          {!isNarrow && (
            <button
              type="button"
              onClick={() => {
                onSelect('home');
                if (isMobile) onCloseMobile();
              }}
              className="text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6D5FD1] rounded-lg"
            >
              <span className="font-display text-lg font-bold tracking-tight text-[#29283A] whitespace-nowrap">
                Kindred
              </span>
            </button>
          )}

          {isMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="p-2 rounded-xl text-[#68667D] hover:bg-[#F2F0F9] hover:text-[#29283A] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-2 rounded-xl text-[#68667D] hover:bg-[#F2F0F9] hover:text-[#29283A] transition-colors cursor-pointer"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Personalized Greeting & Avatar */}
        <div
          className={`border-b border-[#E6E3F1] ${
            isNarrow ? 'px-3 py-4 flex justify-center' : 'px-5 py-4'
          }`}
        >
          <div className={`flex items-center ${isNarrow ? 'justify-center' : 'gap-3'}`}>
            <SafeImage
              src={settings.avatarUrl}
              alt={`${settings.userName} profile portrait`}
              fallbackLabel={settings.userName[0] || 'A'}
              className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-[#E6E3F1]"
            />
            {!isNarrow && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#29283A] truncate">
                  {getTimeGreeting()}
                </p>
                <p className="text-xs text-[#68667D] truncate">{dateString}</p>
              </div>
            )}
          </div>
          {!isNarrow && (
            <p className="mt-2.5 text-xs text-[#68667D] leading-relaxed">
              Welcome back, {settings.userName}. Let&apos;s make today a little easier.
            </p>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                  if (isMobile) onCloseMobile();
                }}
                title={isNarrow ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center ${
                  isNarrow ? 'justify-center px-2' : 'justify-between px-3'
                } py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#6D5FD1] ${
                  active
                    ? 'bg-[#EDEAF9] text-[#4E3FB8]'
                    : 'text-[#4A485E] hover:bg-[#F5F3FC] hover:text-[#29283A]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      active ? 'text-[#6D5FD1]' : 'text-[#68667D]'
                    }`}
                  />
                  {!isNarrow && <span className="truncate">{item.label}</span>}
                </span>
                {!isNarrow && item.id === 'notifications' && unreadNotifications > 0 && (
                  <span className="text-xs font-mono-tabular font-medium text-[#5B4DC4] shrink-0">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ease-out ${
          collapsed ? 'w-[78px]' : 'w-[268px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderContent(false)}</div>
      </aside>

      {/* Mobile Slide-Out Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#29283A]/35 backdrop-blur-[2px]"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full shadow-xl">
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
