import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { GeminiConfigError, runMemoryCompanionRag } from './server/rag.ts';
import {
  appendAuditLog,
  findPotentialDuplicates,
  getCaregiverSummaryData,
  getFullRawVaultSnapshot,
  getVaultForClient,
  isValidCaregiverToken,
  recomputeTodayHistory,
  resetVaultToSeed,
  revokeCaregiverToken,
  syncRoutineNotification,
  updateCaregiverPin,
  updateVault,
  verifyCaregiverPin,
} from './server/vault.ts';
import type {
  BelongingRecord,
  ChatMessage,
  MemoryCapsule,
  MemoryRecord,
  PersonRecord,
  PlaceRecord,
  RoutineRecord,
  UserSettings,
  VaultClientData,
} from './src/types/memory.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

function isValidTime24(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function formatTimeDisplay(time24: string): {
  displayTime: string;
  period: 'Morning' | 'Afternoon' | 'Evening';
} {
  const [hh, mm] = time24.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  const displayTime = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
  const period = hh < 12 ? 'Morning' : hh < 17 ? 'Afternoon' : 'Evening';
  return { displayTime, period };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // --- Health ---
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: 'Kindred — Personal Memory Companion',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      timestamp: new Date().toISOString(),
    });
  });

  // --- Vault & Settings ---
  app.get('/api/vault', (_req, res) => {
    try {
      res.json(getVaultForClient());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/settings', (req, res) => {
    try {
      const patch = req.body as Partial<UserSettings>;
      if (!patch || typeof patch !== 'object') {
        res.status(400).json({ error: 'Invalid settings payload.' });
        return;
      }
      if (patch.userName !== undefined && !String(patch.userName).trim()) {
        res.status(400).json({ error: 'User name cannot be empty.' });
        return;
      }
      const updated = updateVault((vault) => {
        vault.settings = {
          ...vault.settings,
          ...patch,
          userName: patch.userName !== undefined ? String(patch.userName).trim() : vault.settings.userName,
        };
        appendAuditLog(
          vault,
          `${vault.settings.userName} (Owner)`,
          'Preferences updated',
          'Personal privacy or accessibility settings were saved.'
        );
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Memories & Duplicate Detection ---
  app.get('/api/memories', (_req, res) => {
    try {
      res.json({ memories: getVaultForClient().memories });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/memories/check-duplicates', (req, res) => {
    try {
      const { title = '', description = '' } = req.body as { title?: string; description?: string };
      const duplicates = findPotentialDuplicates(String(title), String(description));
      res.json({ duplicates });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/memories', (req, res) => {
    try {
      const body = req.body as Partial<MemoryRecord>;
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      if (!title || !description) {
        res.status(400).json({ error: 'Memory title and description are required.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const newRecord: MemoryRecord = {
        id: `mem-${Date.now()}`,
        category: body.category || 'Important events',
        title,
        description,
        createdAt: nowIso,
        updatedAt: nowIso,
        eventDate: body.eventDate || nowIso.split('T')[0],
        source: body.source || 'User-reported',
        confidenceScore: body.confidenceScore ?? 90,
        verificationStatus: body.verificationStatus || 'Verified',
        privacyLevel: body.privacyLevel || 'Family-shared',
        associatedPeople: Array.isArray(body.associatedPeople) ? body.associatedPeople : [],
        associatedLocations: Array.isArray(body.associatedLocations) ? body.associatedLocations : [],
        tags: Array.isArray(body.tags) ? body.tags : [],
        linkedMemoryIds: Array.isArray(body.linkedMemoryIds) ? body.linkedMemoryIds : [],
        imageUrl: body.imageUrl,
        audioDataUrl: body.audioDataUrl,
        evidenceNote: body.evidenceNote || 'Saved directly by user',
      };
      const updated = updateVault((vault) => {
        vault.memories.unshift(newRecord);
        const todayPoint = vault.weeklyHistory[vault.weeklyHistory.length - 1];
        if (todayPoint) todayPoint.memorySaves += 1;
        appendAuditLog(
          vault,
          `${vault.settings.userName} (Owner)`,
          'Memory created',
          `Saved "${newRecord.title}" (${newRecord.category}).`
        );
      });
      res.status(201).json({ memory: newRecord, vault: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/memories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const patch = req.body as Partial<MemoryRecord>;
      let found = false;
      const updated = updateVault((vault) => {
        const idx = vault.memories.findIndex((m) => m.id === id);
        if (idx !== -1) {
          found = true;
          vault.memories[idx] = {
            ...vault.memories[idx],
            ...patch,
            title: patch.title !== undefined ? String(patch.title).trim() || vault.memories[idx].title : vault.memories[idx].title,
            description:
              patch.description !== undefined
                ? String(patch.description).trim() || vault.memories[idx].description
                : vault.memories[idx].description,
            updatedAt: new Date().toISOString(),
          };
          appendAuditLog(
            vault,
            `${vault.settings.userName} (Owner)`,
            'Memory updated',
            `Updated "${vault.memories[idx].title}".`
          );
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Memory not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/memories/:id', (req, res) => {
    try {
      const { id } = req.params;
      let removedTitle = '';
      const updated = updateVault((vault) => {
        const target = vault.memories.find((m) => m.id === id);
        if (target) removedTitle = target.title;
        vault.memories = vault.memories.filter((m) => m.id !== id);
        vault.capsules.forEach((c) => {
          c.memoryIds = c.memoryIds.filter((mid) => mid !== id);
        });
        if (removedTitle) {
          appendAuditLog(
            vault,
            `${vault.settings.userName} (Owner)`,
            'Memory deleted',
            `Removed "${removedTitle}".`
          );
        }
      });
      if (!removedTitle) {
        res.status(404).json({ error: 'Memory not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- People ---
  app.get('/api/people', (_req, res) => {
    try {
      res.json({ people: getVaultForClient().people });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/people', (req, res) => {
    try {
      const body = req.body as Partial<PersonRecord>;
      const name = String(body.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'Person name is required.' });
        return;
      }
      const nowIso = new Date().toISOString();
      const person: PersonRecord = {
        id: `person-${Date.now()}`,
        name,
        relationship: String(body.relationship || 'Family').trim(),
        relationshipGroup: body.relationshipGroup || 'Immediate Family',
        birthday: body.birthday || 'Not specified',
        importantDetails: body.importantDetails || '',
        notes: body.notes || '',
        phone: body.phone,
        avatarUrl: body.avatarUrl,
        lastAssociatedMemory: body.lastAssociatedMemory,
        visitingNext: body.visitingNext,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const updated = updateVault((vault) => {
        vault.people.unshift(person);
        appendAuditLog(
          vault,
          `${vault.settings.userName} (Owner)`,
          'Person added',
          `Added "${person.name}" (${person.relationship}).`
        );
      });
      res.status(201).json({ person, vault: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/people/:id', (req, res) => {
    try {
      const { id } = req.params;
      const patch = req.body as Partial<PersonRecord>;
      let found = false;
      const updated = updateVault((vault) => {
        const idx = vault.people.findIndex((p) => p.id === id);
        if (idx !== -1) {
          found = true;
          vault.people[idx] = {
            ...vault.people[idx],
            ...patch,
            updatedAt: new Date().toISOString(),
          };
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Person not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/people/:id', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        const target = vault.people.find((p) => p.id === req.params.id);
        if (target) {
          found = true;
          vault.people = vault.people.filter((p) => p.id !== req.params.id);
          appendAuditLog(
            vault,
            `${vault.settings.userName} (Owner)`,
            'Person removed',
            `Removed "${target.name}" from directory.`
          );
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Person not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Places ---
  app.get('/api/places', (_req, res) => {
    try {
      res.json({ places: getVaultForClient().places });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/places', (req, res) => {
    try {
      const body = req.body as Partial<PlaceRecord>;
      const name = String(body.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'Place name is required.' });
        return;
      }
      const nowIso = new Date().toISOString();
      const place: PlaceRecord = {
        id: `place-${Date.now()}`,
        name,
        category: body.category || 'Community',
        address: body.address || '',
        landmarkCue: body.landmarkCue || '',
        notes: body.notes || '',
        visitingHours: body.visitingHours,
        safetyNotes: body.safetyNotes,
        associatedPeople: Array.isArray(body.associatedPeople) ? body.associatedPeople : [],
        imageUrl: body.imageUrl,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const updated = updateVault((vault) => {
        vault.places.unshift(place);
      });
      res.status(201).json({ place, vault: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/places/:id', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        const idx = vault.places.findIndex((p) => p.id === req.params.id);
        if (idx !== -1) {
          found = true;
          vault.places[idx] = {
            ...vault.places[idx],
            ...req.body,
            updatedAt: new Date().toISOString(),
          };
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Place not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/places/:id', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        if (vault.places.some((p) => p.id === req.params.id)) {
          found = true;
          vault.places = vault.places.filter((p) => p.id !== req.params.id);
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Place not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Routines & Reminders ---
  app.get('/api/routines', (_req, res) => {
    try {
      res.json({ routines: getVaultForClient().routines });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/routines', (req, res) => {
    try {
      const body = req.body as Partial<RoutineRecord>;
      const title = String(body.title || '').trim();
      const time24 = String(body.time || '10:00').trim();
      if (!title) {
        res.status(400).json({ error: 'Routine title is required.' });
        return;
      }
      if (!isValidTime24(time24)) {
        res.status(400).json({ error: 'Time must be in HH:MM 24-hour format.' });
        return;
      }

      const { displayTime, period } = formatTimeDisplay(time24);
      const routine: RoutineRecord = {
        id: `routine-${Date.now()}`,
        title,
        time: time24,
        displayTime,
        period: body.period || period,
        category: body.category || 'Self-care',
        priority: body.priority || 'normal',
        status: 'pending',
        caregiverAlertOnMiss: Boolean(body.caregiverAlertOnMiss),
        notes: body.notes || '',
        daysOfWeek:
          Array.isArray(body.daysOfWeek) && body.daysOfWeek.length > 0
            ? body.daysOfWeek
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      };

      const updated = updateVault((vault) => {
        vault.routines.push(routine);
        vault.routines.sort((a, b) => a.time.localeCompare(b.time));
        recomputeTodayHistory(vault);
        syncRoutineNotification(vault, routine, 'created');
      });
      res.status(201).json({ routine, vault: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/routines/:id', (req, res) => {
    try {
      const { id } = req.params;
      const patch = req.body as Partial<RoutineRecord>;
      if (patch.time !== undefined && !isValidTime24(String(patch.time))) {
        res.status(400).json({ error: 'Time must be in HH:MM 24-hour format.' });
        return;
      }

      let found = false;
      const updated = updateVault((vault) => {
        const idx = vault.routines.findIndex((r) => r.id === id);
        if (idx !== -1) {
          found = true;
          const prev = vault.routines[idx];
          let displayTime = prev.displayTime;
          let period = prev.period;
          if (patch.time && patch.time !== prev.time) {
            const formatted = formatTimeDisplay(patch.time);
            displayTime = formatted.displayTime;
            period = formatted.period;
          }
          const updatedRoutine: RoutineRecord = {
            ...prev,
            ...patch,
            displayTime: patch.displayTime || displayTime,
            period: patch.period || period,
            completedAt:
              patch.status === 'completed'
                ? new Date().toISOString()
                : patch.status === 'pending'
                ? undefined
                : prev.completedAt,
          };
          vault.routines[idx] = updatedRoutine;
          vault.routines.sort((a, b) => a.time.localeCompare(b.time));
          recomputeTodayHistory(vault);

          if (patch.status === 'completed') {
            syncRoutineNotification(vault, updatedRoutine, 'completed');
          } else if (patch.status === 'snoozed') {
            syncRoutineNotification(vault, updatedRoutine, 'snoozed');
          } else if (patch.status === 'skipped') {
            syncRoutineNotification(vault, updatedRoutine, 'skipped');
          } else if (patch.time && patch.time !== prev.time) {
            syncRoutineNotification(vault, updatedRoutine, 'rescheduled');
          }
        }
      });

      if (!found) {
        res.status(404).json({ error: 'Routine not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/routines/:id', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        const target = vault.routines.find((r) => r.id === req.params.id);
        if (target) {
          found = true;
          vault.routines = vault.routines.filter((r) => r.id !== req.params.id);
          recomputeTodayHistory(vault);
          syncRoutineNotification(vault, target, 'deleted');
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Routine not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Belongings ---
  app.get('/api/belongings', (_req, res) => {
    try {
      res.json({ belongings: getVaultForClient().belongings });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/belongings', (req, res) => {
    try {
      const body = req.body as Partial<BelongingRecord>;
      const name = String(body.name || '').trim();
      const exactLocation = String(body.exactLocation || '').trim();
      if (!name || !exactLocation) {
        res.status(400).json({ error: 'Item name and exact location are required.' });
        return;
      }
      const item: BelongingRecord = {
        id: `item-${Date.now()}`,
        name,
        category: body.category || 'Keepsakes',
        room: String(body.room || 'Living room').trim(),
        exactLocation,
        visualCue: body.visualCue || '',
        notes: body.notes || '',
        lastVerifiedAt: new Date().toISOString(),
        privacyLevel: body.privacyLevel || 'Caregiver-visible',
      };
      const updated = updateVault((vault) => {
        vault.belongings.unshift(item);
      });
      res.status(201).json({ item, vault: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/belongings/:id', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        const idx = vault.belongings.findIndex((b) => b.id === req.params.id);
        if (idx !== -1) {
          found = true;
          vault.belongings[idx] = {
            ...vault.belongings[idx],
            ...req.body,
            lastVerifiedAt: new Date().toISOString(),
          };
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Belonging not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/belongings/:id', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        if (vault.belongings.some((b) => b.id === req.params.id)) {
          found = true;
          vault.belongings = vault.belongings.filter((b) => b.id !== req.params.id);
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Belonging not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Memory Capsules ---
  app.get('/api/capsules', (_req, res) => {
    try {
      res.json({ capsules: getVaultForClient().capsules });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/capsules', (req, res) => {
    try {
      const body = req.body as Partial<MemoryCapsule>;
      const title = String(body.title || '').trim();
      if (!title) {
        res.status(400).json({ error: 'Capsule title is required.' });
        return;
      }
      const capsule: MemoryCapsule = {
        id: `capsule-${Date.now()}`,
        title,
        theme: body.theme || 'Personal Keepsake',
        description: body.description || '',
        unlockDate: body.unlockDate,
        memoryIds: Array.isArray(body.memoryIds) ? body.memoryIds : [],
        coverImageUrl: body.coverImageUrl,
        createdAt: new Date().toISOString(),
      };
      const updated = updateVault((vault) => {
        vault.capsules.unshift(capsule);
      });
      res.status(201).json({ capsule, vault: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.put('/api/capsules/:id', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        const idx = vault.capsules.findIndex((c) => c.id === req.params.id);
        if (idx !== -1) {
          found = true;
          vault.capsules[idx] = { ...vault.capsules[idx], ...req.body };
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Capsule not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/capsules/:id', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        if (vault.capsules.some((c) => c.id === req.params.id)) {
          found = true;
          vault.capsules = vault.capsules.filter((c) => c.id !== req.params.id);
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Capsule not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Notifications ---
  app.get('/api/notifications', (_req, res) => {
    try {
      res.json({ notifications: getVaultForClient().notifications });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/notifications/:id/read', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        const n = vault.notifications.find((item) => item.id === req.params.id);
        if (n) {
          found = true;
          n.read = true;
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Notification not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/notifications/mark-all-read', (_req, res) => {
    try {
      const updated = updateVault((vault) => {
        vault.notifications.forEach((n) => {
          n.read = true;
        });
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/notifications/:id', (req, res) => {
    try {
      let found = false;
      const updated = updateVault((vault) => {
        if (vault.notifications.some((n) => n.id === req.params.id)) {
          found = true;
          vault.notifications = vault.notifications.filter((n) => n.id !== req.params.id);
        }
      });
      if (!found) {
        res.status(404).json({ error: 'Notification not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- AI Memory Companion (RAG + Grounded Gemini) ---
  app.get('/api/conversations', (_req, res) => {
    try {
      res.json({ conversations: getVaultForClient().conversations });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/companion/ask', async (req, res) => {
    try {
      const { question, threadId } = req.body as { question?: string; threadId?: string };
      if (!question || !question.trim()) {
        res.status(400).json({ error: 'Please enter a question.' });
        return;
      }

      const vault = getVaultForClient();
      const targetThread =
        vault.conversations.find((t) => t.id === threadId) || vault.conversations[0];
      const recentHistory = targetThread?.messages ?? [];

      const ragResult = await runMemoryCompanionRag(question.trim(), recentHistory, vault);
      const nowIso = new Date().toISOString();

      const userMsg: ChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: 'user',
        text: question.trim(),
        timestamp: nowIso,
      };

      const assistantMsg: ChatMessage = {
        id: `msg-a-${Date.now() + 1}`,
        role: 'assistant',
        text: ragResult.answer,
        timestamp: new Date().toISOString(),
        citations: ragResult.citations,
        reasoning: ragResult.reasoning,
        missingInformationTopic: ragResult.missingInformationTopic,
        suggestedMemory: ragResult.suggestedMemory,
      };

      let updatedVault = vault;
      if (vault.settings.retainConversations) {
        updatedVault = updateVault((v) => {
          let thread = v.conversations.find((t) => t.id === (threadId || targetThread?.id));
          if (!thread) {
            thread = {
              id: `thread-${Date.now()}`,
              title: question.trim().slice(0, 40),
              createdAt: nowIso,
              updatedAt: nowIso,
              messages: [],
            };
            v.conversations.unshift(thread);
          }
          thread.messages.push(userMsg, assistantMsg);
          if (thread.messages.length > 30) {
            thread.messages = thread.messages.slice(-30);
          }
          thread.updatedAt = nowIso;
        });
      }

      res.json({
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        vault: updatedVault,
      });
    } catch (err) {
      if (err instanceof GeminiConfigError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      const msg = (err as Error).message || 'Unable to reach AI companion service.';
      res.status(502).json({ error: msg });
    }
  });

  app.post('/api/companion/confirm-save', (req, res) => {
    try {
      const { threadId, messageId, title, category, description } = req.body as {
        threadId?: string;
        messageId?: string;
        title?: string;
        category?: MemoryRecord['category'];
        description?: string;
      };
      if (!title?.trim() || !description?.trim()) {
        res.status(400).json({ error: 'Memory title and description are required to save.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const memory: MemoryRecord = {
        id: `mem-${Date.now()}`,
        category: category || 'Important events',
        title: title.trim(),
        description: description.trim(),
        createdAt: nowIso,
        updatedAt: nowIso,
        eventDate: nowIso.split('T')[0],
        source: 'User-reported',
        confidenceScore: 95,
        verificationStatus: 'Verified',
        privacyLevel: 'Family-shared',
        associatedPeople: [],
        associatedLocations: [],
        tags: ['companion-confirmed'],
        linkedMemoryIds: [],
        evidenceNote: 'Explicitly confirmed for saving during AI Companion chat',
      };

      const updated = updateVault((vault) => {
        vault.memories.unshift(memory);
        const todayPoint = vault.weeklyHistory[vault.weeklyHistory.length - 1];
        if (todayPoint) todayPoint.memorySaves += 1;
        const thread = vault.conversations.find((t) => t.id === threadId);
        const msg = thread?.messages.find((m) => m.id === messageId);
        if (msg) {
          msg.savedFromSuggestion = true;
        }
        appendAuditLog(
          vault,
          `${vault.settings.userName} (Owner)`,
          'Companion memory confirmed',
          `Confirmed saving "${memory.title}" from chat.`
        );
      });

      res.status(201).json({ memory, vault: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/conversations/new', (_req, res) => {
    try {
      const nowIso = new Date().toISOString();
      const newThreadId = `thread-${Date.now()}`;
      const updated = updateVault((vault) => {
        vault.conversations.unshift({
          id: newThreadId,
          title: 'New conversation',
          createdAt: nowIso,
          updatedAt: nowIso,
          messages: [],
        });
      });
      res.status(201).json({ threadId: newThreadId, vault: updated });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/conversations/:id', (req, res) => {
    try {
      const updated = updateVault((vault) => {
        vault.conversations = vault.conversations.filter((t) => t.id !== req.params.id);
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/conversations/clear', (_req, res) => {
    try {
      const updated = updateVault((vault) => {
        vault.conversations = [
          {
            id: `thread-${Date.now()}`,
            title: 'Fresh conversation',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [],
          },
        ];
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Caregiver Authorization & Summary ---
  app.post('/api/caregiver/verify-pin', (req, res) => {
    try {
      const { pin = '' } = req.body as { pin?: string };
      if (!String(pin).trim()) {
        res.status(400).json({ error: 'Caregiver PIN is required.' });
        return;
      }
      const result = verifyCaregiverPin(String(pin).trim());
      if (!result.valid) {
        res.status(401).json({ error: 'Incorrect caregiver PIN. Default demo PIN is 2468.' });
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/caregiver/logout', (req, res) => {
    try {
      const token = req.header('x-caregiver-token');
      revokeCaregiverToken(token);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/caregiver/update-pin', (req, res) => {
    try {
      const { currentPin = '', newPin = '' } = req.body as {
        currentPin?: string;
        newPin?: string;
      };
      if (String(newPin).trim().length < 4) {
        res.status(400).json({ error: 'New PIN must be at least 4 digits.' });
        return;
      }
      const ok = updateCaregiverPin(String(currentPin).trim(), String(newPin).trim());
      if (!ok) {
        res.status(401).json({ error: 'Current PIN did not match.' });
        return;
      }
      res.json({ success: true, vault: getVaultForClient() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/caregiver/summary', (req, res) => {
    try {
      const token = req.header('x-caregiver-token');
      const auth = isValidCaregiverToken(token);
      if (!auth.valid) {
        res.status(401).json({ error: 'Caregiver session locked or expired.' });
        return;
      }
      res.json(getCaregiverSummaryData());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/caregiver/note', (req, res) => {
    try {
      const token = req.header('x-caregiver-token');
      const auth = isValidCaregiverToken(token);
      if (!auth.valid) {
        res.status(401).json({ error: 'Caregiver session locked or expired.' });
        return;
      }
      const { title, description, category, verifyMemoryId } = req.body as {
        title?: string;
        description?: string;
        category?: MemoryRecord['category'];
        verifyMemoryId?: string;
      };
      if (!verifyMemoryId && (!title?.trim() || !description?.trim())) {
        res.status(400).json({ error: 'Provide either verifyMemoryId or a caregiver note title and description.' });
        return;
      }

      const nowIso = new Date().toISOString();
      let notFound = false;

      updateVault((vault) => {
        if (verifyMemoryId) {
          const target = vault.memories.find((m) => m.id === verifyMemoryId);
          if (!target) {
            notFound = true;
            return;
          }
          target.verificationStatus = 'Verified';
          target.source = 'Caregiver-reported';
          target.confidenceScore = 95;
          target.updatedAt = nowIso;
          target.evidenceNote = `Confirmed by ${vault.settings.caregiverName}`;
          appendAuditLog(
            vault,
            auth.actor || vault.settings.caregiverName,
            'Verified memory record',
            `Confirmed "${target.title}".`
          );
        } else if (title && description) {
          vault.memories.unshift({
            id: `mem-${Date.now()}`,
            category: category || 'Appointments',
            title: title.trim(),
            description: description.trim(),
            createdAt: nowIso,
            updatedAt: nowIso,
            eventDate: nowIso.split('T')[0],
            source: 'Caregiver-reported',
            confidenceScore: 93,
            verificationStatus: 'Verified',
            privacyLevel: 'Caregiver-visible',
            associatedPeople: [vault.settings.caregiverName],
            associatedLocations: [],
            tags: ['caregiver-note'],
            linkedMemoryIds: [],
            evidenceNote: `Added by ${vault.settings.caregiverName}`,
          });
          appendAuditLog(
            vault,
            auth.actor || vault.settings.caregiverName,
            'Added caregiver note',
            title.trim()
          );
        }
      });

      if (notFound) {
        res.status(404).json({ error: 'Memory record to verify was not found.' });
        return;
      }

      res.json({ summary: getCaregiverSummaryData(), vault: getVaultForClient() });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Backup Export / Import / Reset ---
  app.get('/api/vault/export', (_req, res) => {
    try {
      const snapshot = getFullRawVaultSnapshot();
      res.setHeader('Content-Disposition', 'attachment; filename="kindred-memory-backup.json"');
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/vault/import', (req, res) => {
    try {
      const imported = req.body as Partial<VaultClientData>;
      if (
        !imported ||
        !Array.isArray(imported.memories) ||
        !imported.settings ||
        typeof imported.settings !== 'object'
      ) {
        res.status(400).json({ error: 'Invalid Kindred backup file.' });
        return;
      }
      const updated = updateVault((vault) => {
        vault.settings = { ...vault.settings, ...imported.settings };
        vault.memories = imported.memories || vault.memories;
        vault.people = Array.isArray(imported.people) ? imported.people : vault.people;
        vault.places = Array.isArray(imported.places) ? imported.places : vault.places;
        vault.routines = Array.isArray(imported.routines) ? imported.routines : vault.routines;
        vault.belongings = Array.isArray(imported.belongings) ? imported.belongings : vault.belongings;
        vault.capsules = Array.isArray(imported.capsules) ? imported.capsules : vault.capsules;
        recomputeTodayHistory(vault);
        appendAuditLog(
          vault,
          `${vault.settings.userName} (Owner)`,
          'Vault backup restored',
          `Restored ${vault.memories.length} memories from backup.`
        );
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/vault/reset', (_req, res) => {
    try {
      res.json(resetVaultToSeed());
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Vite / Static Frontend ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kindred memory companion running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
