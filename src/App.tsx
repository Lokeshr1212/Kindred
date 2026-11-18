import React, { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Menu, MessageCircleHeart } from 'lucide-react';
import { AiCompanionView } from './components/AiCompanionView';
import {
  CaregiverView,
  NotificationsView,
  PrivacySecurityView,
  SettingsView,
} from './components/CaregiverNotificationsPrivacySettings';
import { HomeDashboard } from './components/HomeDashboard';
import { LandingView } from './components/LandingView';
import { MemoriesView } from './components/MemoriesView';
import { PeopleView } from './components/PeopleView';
import { BelongingsView, PlacesView } from './components/PlacesBelongingsViews';
import { QuickModals, type QuickModalType } from './components/QuickModals';
import {
  ActivitiesView,
  CapsulesView,
  RoutinesView,
  TimelineView,
} from './components/RoutinesTimelineCapsulesActivities';
import { Sidebar } from './components/Sidebar';
import { SkeletonLoader, ToastBanner } from './components/ui/CommonUI';
import { api } from './lib/api';
import type { NavSection, VaultClientData } from './types/memory';

export default function App() {
  const [vault, setVault] = useState<VaultClientData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>('landing');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickModal, setQuickModal] = useState<QuickModalType>(null);
  const [prefillMemoryTitle, setPrefillMemoryTitle] = useState('');
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3600);
  };

  useEffect(() => {
    api
      .getVault()
      .then((data) => setVault(data))
      .catch((err) => setLoadError((err as Error).message));
  }, []);

  const openSaveMemoryModal = (prefill = '') => {
    setPrefillMemoryTitle(prefill);
    setQuickModal('memory');
  };

  const handleNavigate = (section: NavSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#F8F7FC] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E6E3F1] rounded-2xl p-6 max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold text-[#29283A]">Unable to open Kindred</h1>
          <p className="text-sm text-[#68667D]">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#6D5FD1] rounded-xl cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="min-h-screen bg-[#F8F7FC]">
        <SkeletonLoader />
      </div>
    );
  }

  const unreadCount = vault.notifications.filter((n) => !n.read).length;
  const showSidebar = activeSection !== 'landing';

  return (
    <MotionConfig reducedMotion={vault.settings.reducedMotion ? 'always' : 'user'}>
      <div
        className={`min-h-screen bg-[#F8F7FC] text-[#29283A] flex ${
          vault.settings.textScale === 'comfortable' ? 'text-scale-comfortable' : ''
        }`}
      >
        {showSidebar && (
          <Sidebar
            activeSection={activeSection}
            onSelect={handleNavigate}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
            settings={vault.settings}
            unreadNotifications={unreadCount}
          />
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Mobile Header */}
          {showSidebar && (
            <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E6E3F1] px-4 py-3 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                className="p-2 rounded-xl text-[#29283A] hover:bg-[#F2F0F9] cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="font-display text-base font-bold text-[#29283A]">Kindred</span>
              <button
                type="button"
                onClick={() => handleNavigate('companion')}
                aria-label="Ask AI Companion"
                className="p-2 rounded-xl bg-[#EDEAF9] text-[#5B4DC4] cursor-pointer"
              >
                <MessageCircleHeart className="w-5 h-5" />
              </button>
            </header>
          )}

          {/* Main Content Viewport */}
          <main className="flex-1 p-5 sm:p-8 lg:p-10 max-w-6xl w-full mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeSection === 'landing' && (
                  <LandingView vault={vault} onNavigate={handleNavigate} />
                )}
                {activeSection === 'home' && (
                  <HomeDashboard
                    vault={vault}
                    onVaultUpdate={setVault}
                    onNavigate={setActiveSection}
                    onOpenQuickModal={(m) => {
                      setPrefillMemoryTitle('');
                      setQuickModal(m);
                    }}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'companion' && (
                  <AiCompanionView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onOpenSaveMemory={openSaveMemoryModal}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'memories' && (
                  <MemoriesView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onOpenNewMemory={() => openSaveMemoryModal('')}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'people' && (
                  <PeopleView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onOpenAddPerson={() => setQuickModal('person')}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'places' && (
                  <PlacesView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onOpenAddPlace={() => setQuickModal('place')}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'routines' && (
                  <RoutinesView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onOpenAddRoutine={() => setQuickModal('routine')}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'belongings' && (
                  <BelongingsView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onOpenAddBelonging={() => setQuickModal('belonging')}
                    onAskAiAboutItem={() => setActiveSection('companion')}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'timeline' && (
                  <TimelineView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onOpenNewMemory={() => openSaveMemoryModal('')}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'capsules' && (
                  <CapsulesView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'activities' && (
                  <ActivitiesView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'caregiver' && (
                  <CaregiverView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'notifications' && (
                  <NotificationsView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onNavigate={setActiveSection}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'privacy' && (
                  <PrivacySecurityView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onToast={showToast}
                  />
                )}
                {activeSection === 'settings' && (
                  <SettingsView
                    vault={vault}
                    onVaultUpdate={setVault}
                    onToast={showToast}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Gentle Floating AI Companion Quick Button (when not already in Companion view) */}
        {activeSection !== 'companion' && (
          <motion.button
            type="button"
            onClick={() => setActiveSection('companion')}
            aria-label="Open AI Memory Companion"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="hidden lg:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2 px-4 py-3 rounded-2xl bg-[#6D5FD1] hover:bg-[#5B4DC4] text-white text-sm font-medium shadow-lg cursor-pointer"
          >
            <MessageCircleHeart className="w-4 h-4" />
            <span>Ask Kindred</span>
          </motion.button>
        )}

        <QuickModals
          activeModal={quickModal}
          prefillTitle={prefillMemoryTitle}
          onClose={() => {
            setQuickModal(null);
            setPrefillMemoryTitle('');
          }}
          vault={vault}
          onVaultUpdate={setVault}
          onToast={showToast}
        />

        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </MotionConfig>
  );
}
