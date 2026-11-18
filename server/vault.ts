import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  BelongingRecord,
  CaregiverAuditEntry,
  ConversationThread,
  DailyEngagementPoint,
  MemoryCapsule,
  MemoryRecord,
  NotificationItem,
  PersonRecord,
  PlaceRecord,
  RoutineRecord,
  UserSettings,
  VaultClientData,
} from '../src/types/memory.ts';

export interface VaultStorageData extends VaultClientData {
  caregiverPinHash: string;
  caregiverPinSalt: string;
}

interface EncryptedEnvelope {
  encrypted: true;
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  payload: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const VAULT_FILE = path.join(DATA_DIR, 'kindred-vault.json');
const KEY_FILE = path.join(DATA_DIR, '.vault.key');

const revokedTokens = new Set<string>();
let tokenEpoch = 1;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function getOrCreateMasterKey(): Buffer {
  ensureDataDir();
  if (fs.existsSync(KEY_FILE)) {
    const hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
    const buf = Buffer.from(hex, 'hex');
    if (buf.length === 32) return buf;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 });
  return key;
}

function hashPin(pin: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  return { hash: derived, salt };
}

function signCaregiverToken(actor: string, expiresAt: number): string {
  const key = getOrCreateMasterKey();
  const payload = Buffer.from(
    JSON.stringify({
      actor,
      expiresAt,
      epoch: tokenEpoch,
      nonce: crypto.randomBytes(8).toString('hex'),
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function formatIsoDateOffset(daysOffset: number, yearsOffset = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearsOffset);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

function createInitialSeedData(): VaultStorageData {
  const now = new Date();
  const todayIso = now.toISOString();
  const yesterdayIso = new Date(now.getTime() - 86400000).toISOString();
  const lastYearDate = formatIsoDateOffset(0, -1);
  const twoDaysAgoDate = formatIsoDateOffset(-2);
  const yesterdayDate = formatIsoDateOffset(-1);
  const todayDate = formatIsoDateOffset(0);
  const { hash, salt } = hashPin('2468');

  const settings: UserSettings = {
    userName: 'Alex',
    avatarUrl: '/src/assets/images/avatar_user_alex_1794977875085.jpg',
    greetingStyle: 'warm',
    caregiverName: 'Rahul',
    caregiverRelation: 'Son',
    textScale: 'standard',
    reducedMotion: false,
    retainConversations: true,
    encryptVaultAtRest: true,
    sharePrivateWithCaregiver: false,
    reminderLeadMinutes: 15,
    weatherEnabled: false,
    weatherCity: '',
  };

  const people: PersonRecord[] = [
    {
      id: 'person-rahul',
      name: 'Rahul',
      relationship: 'Son',
      relationshipGroup: 'Immediate Family',
      birthday: '12 June',
      importantDetails: 'Enjoys cricket, brings cardamom chai on visits, works as an architect downtown.',
      notes: 'Visits every Tuesday and Friday evening around 5:00 PM. Always parks near the oak tree.',
      phone: '(555) 234-8910',
      avatarUrl: '/src/assets/images/avatar_person_rahul_1794977876547.jpg',
      lastAssociatedMemory: 'Family dinner & Mysore trip album',
      visitingNext: `Today at 5:00 PM`,
      createdAt: yesterdayIso,
      updatedAt: todayIso,
    },
    {
      id: 'person-maya',
      name: 'Maya',
      relationship: 'Daughter',
      relationshipGroup: 'Immediate Family',
      birthday: '24 September',
      importantDetails: 'Loves botanical watercolor sketching, chamomile tea, and Sunday morning phone calls.',
      notes: 'Lives twenty minutes away near Willow Creek. Helps organize photo albums each month.',
      phone: '(555) 892-4412',
      avatarUrl: '/src/assets/images/avatar_person_maya_1794977877365.jpg',
      lastAssociatedMemory: 'Botanical Park afternoon walk',
      visitingNext: 'Sunday at 10:30 AM',
      createdAt: yesterdayIso,
      updatedAt: todayIso,
    },
    {
      id: 'person-elena',
      name: 'Dr. Elena Vance',
      relationship: 'Primary Physician',
      relationshipGroup: 'Care & Medical',
      birthday: '14 March',
      importantDetails: 'Oak Street Family Clinic, Suite 204. Warm, patient, speaks slowly and writes clear notes.',
      notes: 'Bring the blue medication notebook to appointments.',
      phone: '(555) 401-2200',
      lastAssociatedMemory: 'Autumn wellness checkup',
      visitingNext: 'Today at 11:00 AM',
      createdAt: yesterdayIso,
      updatedAt: todayIso,
    },
  ];

  const places: PlaceRecord[] = [
    {
      id: 'place-botanical-park',
      name: 'Willow Botanical Park',
      category: 'Park & Outdoors',
      address: '418 Meadowbrook Lane',
      landmarkCue: 'Enter through the stone arch gate; the quiet wooden bench sits right beside the purple lavender bed.',
      notes: 'Favorite morning walk path. Flat gravel trail with plenty of shade and benches every 150 meters.',
      visitingHours: '6:30 AM – 7:30 PM daily',
      safetyNotes: 'Carry water bottle and phone in front coat pocket. Main exit faces Meadowbrook Bus Stop.',
      associatedPeople: ['Maya', 'Alex'],
      imageUrl: '/src/assets/images/place_botanical_park_1794977877475.jpg',
      createdAt: yesterdayIso,
      updatedAt: todayIso,
    },
    {
      id: 'place-oak-clinic',
      name: 'Oak Street Family Clinic',
      category: 'Medical',
      address: '112 Oak Street, Suite 204',
      landmarkCue: 'Brick building across from the green bakery awning. Elevator is directly to the left of the lobby desk.',
      notes: 'Dr. Elena Vance office. Receptionist Sara always checks you in warmly.',
      visitingHours: '8:00 AM – 5:00 PM (Mon–Fri)',
      safetyNotes: 'Rahul usually drives here, or ask for front-door drop-off.',
      associatedPeople: ['Dr. Elena Vance', 'Rahul'],
      createdAt: yesterdayIso,
      updatedAt: todayIso,
    },
    {
      id: 'place-home-sunroom',
      name: 'Home Sunroom & Garden Porch',
      category: 'Home',
      address: '74 Cedar Crescent',
      landmarkCue: 'South-facing glass doors overlooking the lemon tree and bird feeder.',
      notes: 'Best spot for reading the morning paper and having afternoon tea with Rahul.',
      associatedPeople: ['Rahul', 'Maya'],
      createdAt: yesterdayIso,
      updatedAt: todayIso,
    },
  ];

  const belongings: BelongingRecord[] = [
    {
      id: 'item-glasses',
      name: 'Blue-rimmed reading glasses',
      category: 'Eyewear',
      room: 'Entry Hallway',
      exactLocation: 'Top drawer of the walnut hallway console table, inside the soft felt case',
      visualCue: 'Navy leather glasses case beside the brass ceramic dish',
      notes: 'Spare pair is kept on the bedroom nightstand next to the lamp.',
      lastVerifiedAt: todayIso,
      privacyLevel: 'Caregiver-visible',
    },
    {
      id: 'item-keys',
      name: 'House & porch keys',
      category: 'Keys',
      room: 'Front Entryway',
      exactLocation: 'Hanging on the second brass hook beside the front door',
      visualCue: 'Has a woven mint-green ribbon keychain that Maya made',
      notes: 'Always return to the brass hook when coming inside.',
      lastVerifiedAt: todayIso,
      privacyLevel: 'Caregiver-visible',
    },
    {
      id: 'item-wallet',
      name: 'Brown leather wallet & ID card',
      category: 'Documents & Wallet',
      room: 'Bedroom',
      exactLocation: 'Middle tray on the wooden dresser beside the framed family photo',
      visualCue: 'Stitched brown leather fold with emergency contact card inside',
      notes: 'Contains clinic card and Rahul emergency phone number.',
      lastVerifiedAt: yesterdayIso,
      privacyLevel: 'Private',
    },
    {
      id: 'item-pillbox',
      name: 'Weekly morning & evening pill organizer',
      category: 'Health',
      room: 'Kitchen',
      exactLocation: 'Left counter next to the electric kettle and green tea tin',
      visualCue: 'Clear seven-day organizer with large morning/evening labels',
      notes: 'Refilled every Sunday evening with Rahul.',
      lastVerifiedAt: todayIso,
      privacyLevel: 'Caregiver-visible',
    },
  ];

  const routines: RoutineRecord[] = [
    {
      id: 'routine-wakeup',
      title: 'Wake up & morning hydration',
      time: '07:00',
      displayTime: '7:00 AM',
      period: 'Morning',
      category: 'Self-care',
      priority: 'normal',
      status: 'completed',
      caregiverAlertOnMiss: false,
      notes: 'Drink a glass of warm water and open the sunroom curtains.',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      completedAt: `${todayDate}T07:10:00.000Z`,
    },
    {
      id: 'routine-breakfast',
      title: 'Breakfast & morning vitamins',
      time: '08:00',
      displayTime: '8:00 AM',
      period: 'Morning',
      category: 'Meals',
      priority: 'high',
      status: 'completed',
      caregiverAlertOnMiss: true,
      notes: 'Oatmeal with berries and morning pills from the kitchen organizer.',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      completedAt: `${todayDate}T08:15:00.000Z`,
    },
    {
      id: 'routine-walk',
      title: 'Morning walk at Willow Botanical Park',
      time: '09:00',
      displayTime: '9:00 AM',
      period: 'Morning',
      category: 'Movement',
      priority: 'normal',
      status: 'pending',
      caregiverAlertOnMiss: false,
      notes: '20-minute gentle stroll along the lavender bed path.',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    {
      id: 'routine-doctor',
      title: 'Doctor appointment with Dr. Elena Vance',
      time: '11:00',
      displayTime: '11:00 AM',
      period: 'Morning',
      category: 'Health',
      priority: 'high',
      status: 'pending',
      caregiverAlertOnMiss: true,
      notes: 'Oak Street Family Clinic, Suite 204. Bring the blue notebook.',
      daysOfWeek: ['Tue'],
    },
    {
      id: 'routine-lunch',
      title: 'Lunch & quiet reading in sunroom',
      time: '13:00',
      displayTime: '1:00 PM',
      period: 'Afternoon',
      category: 'Meals',
      priority: 'normal',
      status: 'pending',
      caregiverAlertOnMiss: false,
      notes: 'Soup and toasted sourdough, followed by 20 minutes of light reading.',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    {
      id: 'routine-family',
      title: 'Family time — Rahul visiting for tea',
      time: '17:00',
      displayTime: '5:00 PM',
      period: 'Afternoon',
      category: 'Family',
      priority: 'high',
      status: 'pending',
      caregiverAlertOnMiss: false,
      notes: 'Rahul is bringing cardamom chai and cricket highlights to watch together.',
      daysOfWeek: ['Tue', 'Fri'],
    },
    {
      id: 'routine-evening',
      title: 'Evening routine & glasses on hallway table',
      time: '21:00',
      displayTime: '9:00 PM',
      period: 'Evening',
      category: 'Rest',
      priority: 'high',
      status: 'pending',
      caregiverAlertOnMiss: true,
      notes: 'Place reading glasses in walnut drawer, check front door lock, herbal tea.',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
  ];

  const memories: MemoryRecord[] = [
    {
      id: 'mem-mysore-palace',
      category: 'Family memories',
      title: 'Evening visit to Mysore Palace with family',
      description:
        'On this day last year, you visited Mysore Palace with Rahul and Maya just as the golden palace lamps lit up at dusk. Everyone walked along the stone courtyard together, stopped for warm filter coffee nearby, and took portraits under the illuminated arches.',
      createdAt: `${lastYearDate}T19:30:00.000Z`,
      updatedAt: todayIso,
      eventDate: lastYearDate,
      source: 'Confirmed',
      confidenceScore: 98,
      verificationStatus: 'Verified',
      privacyLevel: 'Family-shared',
      associatedPeople: ['Rahul', 'Maya'],
      associatedLocations: ['Mysore Palace'],
      tags: ['travel', 'family', 'anniversary', 'photographs'],
      linkedMemoryIds: ['mem-family-dinner'],
      imageUrl: '/src/assets/images/memory_mysore_palace_1794977878338.jpg',
      evidenceNote: 'Verified family photograph from travel album & confirmed by Rahul',
    },
    {
      id: 'mem-rahul-visit',
      category: 'Appointments',
      title: 'Rahul visiting today at 5:00 PM for tea',
      description:
        'Rahul confirmed he is visiting you today at 5:00 PM. He plans to bring fresh cardamom chai and sit in the sunroom to talk about the weekend cricket match.',
      createdAt: yesterdayIso,
      updatedAt: todayIso,
      eventDate: todayDate,
      source: 'Caregiver-reported',
      confidenceScore: 96,
      verificationStatus: 'Verified',
      privacyLevel: 'Caregiver-visible',
      associatedPeople: ['Rahul'],
      associatedLocations: ['Home Sunroom & Garden Porch'],
      tags: ['visitor', 'today', 'family'],
      linkedMemoryIds: ['mem-family-dinner'],
      evidenceNote: 'Added by Rahul via family check-in note',
    },
    {
      id: 'mem-doctor-appt',
      category: 'Appointments',
      title: 'Checkup with Dr. Elena Vance at 11:00 AM',
      description:
        'Routine wellness checkup today at 11:00 AM at Oak Street Family Clinic, Suite 204. Remember to bring the blue notebook and your glasses from the walnut console drawer.',
      createdAt: yesterdayIso,
      updatedAt: todayIso,
      eventDate: todayDate,
      source: 'Confirmed',
      confidenceScore: 99,
      verificationStatus: 'Verified',
      privacyLevel: 'Caregiver-visible',
      associatedPeople: ['Dr. Elena Vance', 'Rahul'],
      associatedLocations: ['Oak Street Family Clinic'],
      tags: ['appointment', 'today', 'health'],
      linkedMemoryIds: ['mem-morning-routine'],
      evidenceNote: 'Clinic appointment card verified',
    },
    {
      id: 'mem-yesterday-walk',
      category: 'Activities',
      title: 'Yesterday afternoon garden walk & watercolor chat',
      description:
        'Yesterday afternoon you walked along the Willow Botanical Park gravel path, rested on the wooden bench by the blooming lavender, and called Maya to hear about her new botanical sketch.',
      createdAt: yesterdayIso,
      updatedAt: yesterdayIso,
      eventDate: yesterdayDate,
      source: 'User-reported',
      confidenceScore: 92,
      verificationStatus: 'Verified',
      privacyLevel: 'Family-shared',
      associatedPeople: ['Maya'],
      associatedLocations: ['Willow Botanical Park'],
      tags: ['yesterday', 'walk', 'park', 'outdoors'],
      linkedMemoryIds: ['mem-mysore-palace'],
      imageUrl: '/src/assets/images/place_botanical_park_1794977877475.jpg',
      evidenceNote: 'Saved journal note & park photograph',
    },
    {
      id: 'mem-family-dinner',
      category: 'People',
      title: 'Sunday family dinner with Rahul and Maya',
      description:
        'Last Sunday Rahul cooked vegetable biryani and Maya brought lemon tart. You all looked through old travel photos in the sunroom and laughed about Rahul learning to bowl spin cricket in the backyard.',
      createdAt: `${twoDaysAgoDate}T20:00:00.000Z`,
      updatedAt: `${twoDaysAgoDate}T20:00:00.000Z`,
      eventDate: twoDaysAgoDate,
      source: 'Confirmed',
      confidenceScore: 95,
      verificationStatus: 'Verified',
      privacyLevel: 'Family-shared',
      associatedPeople: ['Rahul', 'Maya'],
      associatedLocations: ['Home Sunroom & Garden Porch'],
      tags: ['family', 'dinner', 'cricket'],
      linkedMemoryIds: ['mem-mysore-palace', 'mem-rahul-visit'],
      evidenceNote: 'Confirmed by Alex and Maya',
    },
    {
      id: 'mem-morning-routine',
      category: 'Daily routines',
      title: 'Usual peaceful morning routine',
      description:
        'On most mornings, you wake around 7:00 AM, drink warm water in the sunroom, eat oatmeal with berries at 8:00 AM with your morning vitamins, and take a gentle walk at 9:00 AM.',
      createdAt: yesterdayIso,
      updatedAt: todayIso,
      source: 'Confirmed',
      confidenceScore: 97,
      verificationStatus: 'Verified',
      privacyLevel: 'Caregiver-visible',
      associatedPeople: ['Alex'],
      associatedLocations: ['Home Sunroom & Garden Porch', 'Willow Botanical Park'],
      tags: ['morning', 'routine', 'habits'],
      linkedMemoryIds: [],
      evidenceNote: 'Consistent daily schedule pattern',
    },
    {
      id: 'mem-tea-preference',
      category: 'Preferences',
      title: 'Tea & music preferences',
      description:
        'You prefer mildly sweet cardamom chai in the afternoon and soothing chamomile tea after 8:00 PM. You enjoy soft classical guitar and acoustic piano in the mornings.',
      createdAt: yesterdayIso,
      updatedAt: todayIso,
      source: 'User-reported',
      confidenceScore: 90,
      verificationStatus: 'Verified',
      privacyLevel: 'Family-shared',
      associatedPeople: ['Alex'],
      associatedLocations: ['Home Sunroom & Garden Porch'],
      tags: ['preferences', 'tea', 'music'],
      linkedMemoryIds: [],
      evidenceNote: 'Personal preference card',
    },
    {
      id: 'mem-spare-umbrella',
      category: 'Personal belongings',
      title: 'Green plaid umbrella location (needs check)',
      description:
        'You mentioned leaving the green plaid folding umbrella either in the coat closet or in the trunk of Rahul’s car after last week’s rain.',
      createdAt: `${twoDaysAgoDate}T15:00:00.000Z`,
      updatedAt: `${twoDaysAgoDate}T15:00:00.000Z`,
      source: 'Inferred',
      confidenceScore: 58,
      verificationStatus: 'Needs review',
      privacyLevel: 'Caregiver-visible',
      associatedPeople: ['Rahul'],
      associatedLocations: ['Front Entryway'],
      tags: ['belongings', 'umbrella'],
      linkedMemoryIds: [],
      evidenceNote: 'Needs quick confirmation from Rahul',
    },
    {
      id: 'mem-private-journal',
      category: 'Important events',
      title: 'Private reflection on retirement garden project',
      description:
        'Personal private note about planning a small herb corner by the south porch with mint, basil, and rosemary for spring.',
      createdAt: `${twoDaysAgoDate}T09:00:00.000Z`,
      updatedAt: `${twoDaysAgoDate}T09:00:00.000Z`,
      eventDate: twoDaysAgoDate,
      source: 'User-reported',
      confidenceScore: 94,
      verificationStatus: 'Verified',
      privacyLevel: 'Private',
      associatedPeople: ['Alex'],
      associatedLocations: ['Home Sunroom & Garden Porch'],
      tags: ['garden', 'reflection', 'private'],
      linkedMemoryIds: [],
      evidenceNote: 'Private personal journal entry',
    },
  ];

  const capsules: MemoryCapsule[] = [
    {
      id: 'capsule-travels',
      title: 'Family Travels & Golden Evenings',
      theme: 'Heritage & Trips',
      description: 'Warm evenings, illuminated courtyards, and family road trips saved with photos.',
      unlockDate: lastYearDate,
      memoryIds: ['mem-mysore-palace', 'mem-family-dinner'],
      coverImageUrl: '/src/assets/images/memory_mysore_palace_1794977878338.jpg',
      createdAt: yesterdayIso,
    },
    {
      id: 'capsule-morning-walks',
      title: 'Botanical Walks & Quiet Mornings',
      theme: 'Nature & Calm',
      description: 'Gentle morning routines, blooming lavender paths, and conversations with Maya.',
      memoryIds: ['mem-yesterday-walk', 'mem-morning-routine', 'mem-tea-preference'],
      coverImageUrl: '/src/assets/images/place_botanical_park_1794977877475.jpg',
      createdAt: yesterdayIso,
    },
  ];

  const conversations: ConversationThread[] = [
    {
      id: 'thread-welcome',
      title: 'Morning check-in',
      createdAt: todayIso,
      updatedAt: todayIso,
      messages: [
        {
          id: 'msg-welcome-1',
          role: 'assistant',
          text: 'Good morning, Alex. Everything you ask here stays anchored to your saved memories, people, places, and daily schedule. Feel free to ask who is visiting today, where an item is kept, or what comes next.',
          timestamp: todayIso,
        },
      ],
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif-1',
      title: 'Morning walk at Willow Botanical Park',
      message: 'Scheduled for 9:00 AM — gentle 20-minute stroll along the lavender path.',
      time: '8:45 AM',
      category: 'Routine',
      priority: 'normal',
      read: false,
      actionTarget: 'routines',
      relatedRoutineId: 'routine-walk',
    },
    {
      id: 'notif-2',
      title: 'Appointment with Dr. Elena Vance',
      message: 'Today at 11:00 AM at Oak Street Family Clinic, Suite 204. Remember your blue notebook.',
      time: '9:30 AM',
      category: 'Appointment',
      priority: 'high',
      read: false,
      actionTarget: 'routines',
      relatedRoutineId: 'routine-doctor',
    },
    {
      id: 'notif-3',
      title: 'Rahul is visiting at 5:00 PM',
      message: 'Rahul confirmed he will bring cardamom chai for family tea time.',
      time: 'Yesterday',
      category: 'Memory',
      priority: 'normal',
      read: false,
      actionTarget: 'people',
    },
  ];

  const weeklyHistory: DailyEngagementPoint[] = [
    { day: 'Wed', dateLabel: formatIsoDateOffset(-6), completed: 6, missed: 1, upcoming: 0, memorySaves: 1 },
    { day: 'Thu', dateLabel: formatIsoDateOffset(-5), completed: 7, missed: 0, upcoming: 0, memorySaves: 2 },
    { day: 'Fri', dateLabel: formatIsoDateOffset(-4), completed: 6, missed: 1, upcoming: 0, memorySaves: 1 },
    { day: 'Sat', dateLabel: formatIsoDateOffset(-3), completed: 7, missed: 0, upcoming: 0, memorySaves: 3 },
    { day: 'Sun', dateLabel: formatIsoDateOffset(-2), completed: 6, missed: 1, upcoming: 0, memorySaves: 2 },
    { day: 'Mon', dateLabel: formatIsoDateOffset(-1), completed: 7, missed: 0, upcoming: 0, memorySaves: 2 },
    { day: 'Today', dateLabel: todayDate, completed: 2, missed: 0, upcoming: 5, memorySaves: 1 },
  ];

  const monthlyHistory: DailyEngagementPoint[] = [
    { day: 'Wk 1', dateLabel: 'Week 1', completed: 41, missed: 4, upcoming: 0, memorySaves: 8 },
    { day: 'Wk 2', dateLabel: 'Week 2', completed: 44, missed: 3, upcoming: 0, memorySaves: 11 },
    { day: 'Wk 3', dateLabel: 'Week 3', completed: 45, missed: 2, upcoming: 0, memorySaves: 10 },
    { day: 'Wk 4', dateLabel: 'Current', completed: 34, missed: 3, upcoming: 5, memorySaves: 12 },
  ];

  const auditLog: CaregiverAuditEntry[] = [
    {
      id: 'audit-1',
      actor: 'Alex (Owner)',
      action: 'Vault encryption initialized',
      detail: 'Local AES-256-GCM vault protection active for personal records.',
      timestamp: yesterdayIso,
    },
    {
      id: 'audit-2',
      actor: 'Rahul (Authorized Caregiver)',
      action: 'Added visit confirmation',
      detail: 'Confirmed Tuesday 5:00 PM visit note (Caregiver-reported).',
      timestamp: yesterdayIso,
    },
  ];

  return {
    settings,
    memories,
    people,
    places,
    routines,
    belongings,
    capsules,
    conversations,
    notifications,
    weeklyHistory,
    monthlyHistory,
    auditLog,
    caregiverPinHash: hash,
    caregiverPinSalt: salt,
  };
}

function readRawVault(): VaultStorageData {
  ensureDataDir();
  if (!fs.existsSync(VAULT_FILE)) {
    const seed = createInitialSeedData();
    writeRawVault(seed);
    return seed;
  }

  const rawText = fs.readFileSync(VAULT_FILE, 'utf8');
  const parsed = JSON.parse(rawText) as VaultStorageData | EncryptedEnvelope;

  if ('encrypted' in parsed && parsed.encrypted === true) {
    const key = getOrCreateMasterKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(parsed.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.payload, 'hex')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(decrypted) as VaultStorageData;
  }

  return parsed as VaultStorageData;
}

function writeRawVault(data: VaultStorageData): void {
  ensureDataDir();
  if (data.settings.encryptVaultAtRest) {
    const key = getOrCreateMasterKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const jsonBytes = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
    const encrypted = Buffer.concat([cipher.update(jsonBytes), cipher.final()]);
    const tag = cipher.getAuthTag();

    const envelope: EncryptedEnvelope = {
      encrypted: true,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      payload: encrypted.toString('hex'),
    };
    fs.writeFileSync(VAULT_FILE, JSON.stringify(envelope, null, 2), { mode: 0o600 });
  } else {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  }
}

export function appendAuditLog(
  vault: VaultStorageData,
  actor: string,
  action: string,
  detail: string
): void {
  vault.auditLog.unshift({
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    actor,
    action,
    detail,
    timestamp: new Date().toISOString(),
  });
  vault.auditLog = vault.auditLog.slice(0, 50);
}

export function recomputeTodayHistory(vault: VaultStorageData): void {
  const completed = vault.routines.filter((r) => r.status === 'completed').length;
  const missed = vault.routines.filter((r) => r.status === 'skipped').length;
  const upcoming = vault.routines.filter(
    (r) => r.status === 'pending' || r.status === 'snoozed'
  ).length;

  const todayPt = vault.weeklyHistory[vault.weeklyHistory.length - 1];
  if (todayPt) {
    todayPt.completed = completed;
    todayPt.missed = missed;
    todayPt.upcoming = upcoming;
  }

  const currentMonthPt = vault.monthlyHistory[vault.monthlyHistory.length - 1];
  if (currentMonthPt) {
    currentMonthPt.upcoming = upcoming;
  }
}

export function syncRoutineNotification(
  vault: VaultStorageData,
  routine: RoutineRecord,
  event: 'created' | 'snoozed' | 'completed' | 'rescheduled' | 'skipped' | 'deleted'
): void {
  const existingIdx = vault.notifications.findIndex(
    (n) => n.relatedRoutineId === routine.id
  );

  if (event === 'deleted') {
    if (existingIdx !== -1) {
      vault.notifications.splice(existingIdx, 1);
    }
    return;
  }

  if (event === 'completed' || event === 'skipped') {
    if (existingIdx !== -1) {
      vault.notifications[existingIdx].read = true;
    }
    return;
  }

  const notifItem: NotificationItem = {
    id: existingIdx !== -1 ? vault.notifications[existingIdx].id : `notif-${Date.now()}`,
    title:
      event === 'snoozed'
        ? `Snoozed: ${routine.title}`
        : routine.title,
    message:
      event === 'snoozed'
        ? `Gentle reminder moved to ${routine.displayTime}. ${routine.notes || ''}`.trim()
        : `Scheduled for ${routine.displayTime}. ${routine.notes || ''}`.trim(),
    time: routine.displayTime,
    category: routine.category === 'Health' ? 'Appointment' : 'Routine',
    priority: routine.priority === 'high' ? 'high' : 'normal',
    read: false,
    actionTarget: 'routines',
    relatedRoutineId: routine.id,
  };

  if (existingIdx !== -1) {
    vault.notifications[existingIdx] = notifItem;
  } else {
    vault.notifications.unshift(notifItem);
    vault.notifications = vault.notifications.slice(0, 30);
  }
}

export function getVaultForClient(): VaultClientData {
  const full = readRawVault();
  const { caregiverPinHash: _h, caregiverPinSalt: _s, ...clientSafe } = full;
  return clientSafe;
}

export function updateVault(updater: (vault: VaultStorageData) => void): VaultClientData {
  const full = readRawVault();
  updater(full);
  writeRawVault(full);
  const { caregiverPinHash: _h, caregiverPinSalt: _s, ...clientSafe } = full;
  return clientSafe;
}

export function verifyCaregiverPin(pin: string): { valid: boolean; token?: string; expiresAt?: number } {
  const full = readRawVault();
  const { hash } = hashPin(pin, full.caregiverPinSalt);
  const valid = crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(full.caregiverPinHash, 'hex')
  );
  if (!valid) {
    appendAuditLog(
      full,
      'Unknown visitor',
      'Failed caregiver PIN attempt',
      'Rejected invalid caregiver unlock attempt.'
    );
    writeRawVault(full);
    return { valid: false };
  }
  const actor = `${full.settings.caregiverName} (${full.settings.caregiverRelation})`;
  const expiresAt = Date.now() + 1000 * 60 * 60 * 4; // 4 hours
  const token = signCaregiverToken(actor, expiresAt);
  appendAuditLog(
    full,
    `${full.settings.caregiverName} (Authorized Caregiver)`,
    'Caregiver session unlocked',
    'Authorized PIN verified for caregiver dashboard viewing.'
  );
  writeRawVault(full);
  return { valid: true, token, expiresAt };
}

export function isValidCaregiverToken(token: string | undefined): { valid: boolean; actor?: string } {
  if (!token || revokedTokens.has(token)) return { valid: false };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  const [payloadB64, sigB64] = parts;
  try {
    const key = getOrCreateMasterKey();
    const expectedSig = crypto.createHmac('sha256', key).update(payloadB64).digest('base64url');
    const a = Buffer.from(sigB64);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false };
    }
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      actor: string;
      expiresAt: number;
      epoch: number;
    };
    if (parsed.epoch !== tokenEpoch || Date.now() > parsed.expiresAt) {
      return { valid: false };
    }
    return { valid: true, actor: parsed.actor };
  } catch {
    return { valid: false };
  }
}

export function revokeCaregiverToken(token: string | undefined): void {
  if (token) {
    revokedTokens.add(token);
  }
}

export function updateCaregiverPin(currentPin: string, newPin: string): boolean {
  const full = readRawVault();
  const check = hashPin(currentPin, full.caregiverPinSalt);
  const valid = crypto.timingSafeEqual(
    Buffer.from(check.hash, 'hex'),
    Buffer.from(full.caregiverPinHash, 'hex')
  );
  if (!valid) return false;
  const next = hashPin(newPin);
  full.caregiverPinHash = next.hash;
  full.caregiverPinSalt = next.salt;
  tokenEpoch += 1; // Invalidate older tokens when PIN rotates
  appendAuditLog(
    full,
    `${full.settings.userName} (Owner)`,
    'Caregiver PIN rotated',
    'Caregiver authorization PIN was updated and prior sessions invalidated.'
  );
  writeRawVault(full);
  return true;
}

export function getCaregiverSummaryData() {
  const full = readRawVault();
  const allowPrivate = full.settings.sharePrivateWithCaregiver;

  const visibleMemories = full.memories.filter(
    (m) => allowPrivate || m.privacyLevel !== 'Private'
  );
  const visibleBelongings = full.belongings.filter(
    (b) => allowPrivate || b.privacyLevel !== 'Private'
  );

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const missedOrOverdueRoutines = full.routines.filter((r) => {
    if (r.status === 'skipped') return true;
    if (r.status === 'pending' && r.caregiverAlertOnMiss) {
      const [hh, mm] = r.time.split(':').map(Number);
      const rMins = hh * 60 + mm;
      return nowMinutes - rMins > 45;
    }
    return false;
  });

  const needsReviewMemories = visibleMemories.filter(
    (m) => m.verificationStatus === 'Needs review' || m.verificationStatus === 'Unverified'
  );

  return {
    userName: full.settings.userName,
    caregiverName: full.settings.caregiverName,
    totalMemoriesShared: visibleMemories.length,
    privateHiddenCount: full.memories.length - visibleMemories.length,
    routines: full.routines,
    missedOrOverdueRoutines,
    needsReviewMemories,
    visibleMemories,
    visibleBelongings,
    people: full.people,
    auditLog: full.auditLog.slice(0, 20),
    weeklyHistory: full.weeklyHistory,
  };
}

export function findPotentialDuplicates(title: string, description: string): MemoryRecord[] {
  const full = readRawVault();
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const queryTokens = new Set([...norm(title), ...norm(description)]);
  if (queryTokens.size === 0) return [];

  return full.memories.filter((m) => {
    const memTokens = new Set([...norm(m.title), ...norm(m.description)]);
    let overlap = 0;
    for (const t of queryTokens) {
      if (memTokens.has(t)) overlap++;
    }
    const jaccard = overlap / Math.max(1, Math.min(queryTokens.size, memTokens.size));
    return jaccard >= 0.48;
  });
}

export function getFullRawVaultSnapshot(): VaultClientData {
  return updateVault((vault) => {
    appendAuditLog(
      vault,
      `${vault.settings.userName} (Owner)`,
      'Vault backup exported',
      'Full local backup JSON downloaded.'
    );
  });
}

export function resetVaultToSeed(): VaultClientData {
  const seed = createInitialSeedData();
  appendAuditLog(
    seed,
    `${seed.settings.userName} (Owner)`,
    'Vault reset to defaults',
    'Restored vault to initial sample records.'
  );
  writeRawVault(seed);
  const { caregiverPinHash: _h, caregiverPinSalt: _s, ...clientSafe } = seed;
  return clientSafe;
}
