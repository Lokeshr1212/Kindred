export type NavSection =
  | 'landing'
  | 'home'
  | 'companion'
  | 'memories'
  | 'people'
  | 'places'
  | 'routines'
  | 'belongings'
  | 'timeline'
  | 'capsules'
  | 'activities'
  | 'caregiver'
  | 'notifications'
  | 'privacy'
  | 'settings';

export type MemoryCategory =
  | 'People'
  | 'Relationships'
  | 'Places'
  | 'Activities'
  | 'Appointments'
  | 'Personal belongings'
  | 'Important events'
  | 'Preferences'
  | 'Voice notes'
  | 'Photographs'
  | 'Family memories'
  | 'Daily routines';

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  'People',
  'Relationships',
  'Places',
  'Activities',
  'Appointments',
  'Personal belongings',
  'Important events',
  'Preferences',
  'Voice notes',
  'Photographs',
  'Family memories',
  'Daily routines',
];

export type MemorySource =
  | 'Confirmed'
  | 'User-reported'
  | 'Caregiver-reported'
  | 'Inferred'
  | 'Outdated';

export type VerificationStatus =
  | 'Verified'
  | 'Unverified'
  | 'Needs review'
  | 'Outdated';

export type PrivacyLevel = 'Private' | 'Family-shared' | 'Caregiver-visible';

export interface MemoryRecord {
  id: string;
  category: MemoryCategory;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  eventDate?: string;
  source: MemorySource;
  confidenceScore: number; // 0 to 100
  verificationStatus: VerificationStatus;
  privacyLevel: PrivacyLevel;
  associatedPeople: string[];
  associatedLocations: string[];
  tags: string[];
  linkedMemoryIds: string[];
  imageUrl?: string;
  audioDataUrl?: string;
  evidenceNote?: string;
}

export interface PersonRecord {
  id: string;
  name: string;
  relationship: string;
  relationshipGroup: 'Immediate Family' | 'Extended Family' | 'Friends' | 'Care & Medical' | 'Community';
  birthday: string;
  importantDetails: string;
  notes: string;
  phone?: string;
  avatarUrl?: string;
  lastAssociatedMemory?: string;
  visitingNext?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceRecord {
  id: string;
  name: string;
  category: 'Home' | 'Park & Outdoors' | 'Medical' | 'Community' | 'Travel & Heritage';
  address: string;
  landmarkCue: string;
  notes: string;
  visitingHours?: string;
  safetyNotes?: string;
  associatedPeople: string[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type RoutineStatus = 'pending' | 'completed' | 'snoozed' | 'skipped';

export interface RoutineRecord {
  id: string;
  title: string;
  time: string; // e.g. "07:00"
  displayTime: string; // e.g. "7:00 AM"
  period: 'Morning' | 'Afternoon' | 'Evening';
  category: 'Self-care' | 'Meals' | 'Movement' | 'Health' | 'Family' | 'Rest';
  priority: 'high' | 'normal' | 'low';
  status: RoutineStatus;
  skipReason?: string;
  snoozedUntil?: string;
  caregiverAlertOnMiss: boolean;
  notes: string;
  daysOfWeek: string[];
  completedAt?: string;
}

export interface BelongingRecord {
  id: string;
  name: string;
  category: 'Eyewear' | 'Keys' | 'Documents & Wallet' | 'Health' | 'Electronics' | 'Keepsakes';
  room: string;
  exactLocation: string;
  visualCue: string;
  notes: string;
  lastVerifiedAt: string;
  privacyLevel: PrivacyLevel;
}

export interface MemoryCapsule {
  id: string;
  title: string;
  theme: string;
  description: string;
  unlockDate?: string;
  memoryIds: string[];
  coverImageUrl?: string;
  createdAt: string;
}

export interface CitationItem {
  memoryId: string;
  recordType: 'Memory' | 'Person' | 'Place' | 'Routine' | 'Belonging';
  title: string;
  snippet: string;
  source: MemorySource;
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  timestamp: string;
  context: string;
}

export interface SuggestedMemoryDraft {
  title: string;
  category: MemoryCategory;
  description: string;
  associatedPeople?: string[];
  associatedLocations?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: CitationItem[];
  reasoning?: string;
  missingInformationTopic?: string;
  suggestedMemory?: SuggestedMemoryDraft;
  savedFromSuggestion?: boolean;
}

export interface ConversationThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  category: 'Routine' | 'Appointment' | 'Memory' | 'Caregiver' | 'System';
  priority: 'high' | 'normal';
  read: boolean;
  actionTarget?: NavSection;
  relatedRoutineId?: string;
}

export interface DailyEngagementPoint {
  day: string;
  dateLabel: string;
  completed: number;
  missed: number;
  upcoming: number;
  memorySaves: number;
}

export interface CaregiverAuditEntry {
  id: string;
  actor: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface UserSettings {
  userName: string;
  avatarUrl: string;
  greetingStyle: 'warm' | 'concise';
  caregiverName: string;
  caregiverRelation: string;
  textScale: 'standard' | 'comfortable';
  reducedMotion: boolean;
  retainConversations: boolean;
  encryptVaultAtRest: boolean;
  sharePrivateWithCaregiver: boolean;
  reminderLeadMinutes: number;
  weatherEnabled: boolean;
  weatherCity: string;
}

export interface VaultClientData {
  settings: UserSettings;
  memories: MemoryRecord[];
  people: PersonRecord[];
  places: PlaceRecord[];
  routines: RoutineRecord[];
  belongings: BelongingRecord[];
  capsules: MemoryCapsule[];
  conversations: ConversationThread[];
  notifications: NotificationItem[];
  weeklyHistory: DailyEngagementPoint[];
  monthlyHistory: DailyEngagementPoint[];
  auditLog: CaregiverAuditEntry[];
}
