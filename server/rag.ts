import { GoogleGenAI, Type } from '@google/genai';
import type {
  ChatMessage,
  CitationItem,
  MemoryCategory,
  MemorySource,
  SuggestedMemoryDraft,
  VaultClientData,
  VerificationStatus,
} from '../src/types/memory.ts';

interface RetrievalChunk {
  id: string;
  recordType: 'Memory' | 'Person' | 'Place' | 'Routine' | 'Belonging';
  title: string;
  content: string;
  source: MemorySource;
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  timestamp: string;
  context: string;
  keywords: string[];
}

export interface CompanionRagResult {
  answer: string;
  citations: CitationItem[];
  reasoning: string;
  missingInformationTopic?: string;
  suggestedMemory?: SuggestedMemoryDraft;
}

export class GeminiConfigError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.statusCode = statusCode;
  }
}

const embeddingCache = new Map<string, { signature: string; vector: number[] }>();

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiConfigError(
      'GEMINI_API_KEY is not configured in server environment secrets.',
      503
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function buildKnowledgeChunks(vault: VaultClientData): RetrievalChunk[] {
  const chunks: RetrievalChunk[] = [];

  for (const m of vault.memories) {
    chunks.push({
      id: m.id,
      recordType: 'Memory',
      title: m.title,
      content: `${m.title}. Category: ${m.category}. Details: ${m.description}. ${
        m.eventDate ? `Event date: ${m.eventDate}. ` : ''
      }${m.associatedPeople.length ? `People: ${m.associatedPeople.join(', ')}. ` : ''}${
        m.associatedLocations.length ? `Locations: ${m.associatedLocations.join(', ')}. ` : ''
      }${m.evidenceNote ? `Evidence: ${m.evidenceNote}.` : ''}`,
      source: m.source,
      verificationStatus: m.verificationStatus,
      confidenceScore: m.confidenceScore,
      timestamp: m.updatedAt || m.createdAt,
      context: `${m.category} · ${m.privacyLevel}${m.eventDate ? ` · Event ${m.eventDate}` : ''}`,
      keywords: [...m.tags, ...m.associatedPeople, ...m.associatedLocations, m.category],
    });
  }

  for (const p of vault.people) {
    chunks.push({
      id: p.id,
      recordType: 'Person',
      title: `${p.name} (${p.relationship})`,
      content: `Person: ${p.name}, Relationship: ${p.relationship} (${p.relationshipGroup}). Birthday: ${
        p.birthday
      }. Important details: ${p.importantDetails}. Notes: ${p.notes}. ${
        p.visitingNext ? `Next visit: ${p.visitingNext}. ` : ''
      }${p.lastAssociatedMemory ? `Last associated memory: ${p.lastAssociatedMemory}.` : ''}`,
      source: 'Confirmed',
      verificationStatus: 'Verified',
      confidenceScore: 96,
      timestamp: p.updatedAt,
      context: `People directory · ${p.relationship}`,
      keywords: [p.name, p.relationship, 'family', 'visiting', 'birthday'],
    });
  }

  for (const pl of vault.places) {
    chunks.push({
      id: pl.id,
      recordType: 'Place',
      title: pl.name,
      content: `Place: ${pl.name} (${pl.category}). Address: ${pl.address}. Landmark cue: ${
        pl.landmarkCue
      }. Notes: ${pl.notes}. ${pl.visitingHours ? `Hours: ${pl.visitingHours}. ` : ''}${
        pl.safetyNotes ? `Safety notes: ${pl.safetyNotes}.` : ''
      }`,
      source: 'Confirmed',
      verificationStatus: 'Verified',
      confidenceScore: 95,
      timestamp: pl.updatedAt,
      context: `Familiar place · ${pl.address}`,
      keywords: [pl.name, pl.category, ...pl.associatedPeople, 'place', 'where'],
    });
  }

  for (const b of vault.belongings) {
    chunks.push({
      id: b.id,
      recordType: 'Belonging',
      title: b.name,
      content: `Personal belonging: ${b.name} (${b.category}). Room: ${b.room}. Exact spot: ${
        b.exactLocation
      }. Visual cue: ${b.visualCue}. Notes: ${b.notes}.`,
      source: 'User-reported',
      verificationStatus: 'Verified',
      confidenceScore: 94,
      timestamp: b.lastVerifiedAt,
      context: `Belongings · ${b.room}`,
      keywords: [b.name, b.room, b.category, 'where', 'kept', 'find'],
    });
  }

  for (const r of vault.routines) {
    chunks.push({
      id: r.id,
      recordType: 'Routine',
      title: `${r.displayTime} — ${r.title}`,
      content: `Daily routine at ${r.displayTime} (${r.period}): ${r.title}. Category: ${r.category}. Current status today: ${r.status}. Priority: ${r.priority}. Notes: ${r.notes}.`,
      source: 'Confirmed',
      verificationStatus: 'Verified',
      confidenceScore: 97,
      timestamp: r.completedAt || new Date().toISOString(),
      context: `Daily routine · ${r.period} · Status: ${r.status}`,
      keywords: [r.title, r.period, r.category, r.displayTime, 'routine', 'next', 'today', 'appointment'],
    });
  }

  return chunks;
}

function lexicalScore(query: string, chunk: RetrievalChunk): number {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (tokens.length === 0) return 0;

  const haystack = `${chunk.title} ${chunk.content} ${chunk.keywords.join(' ')}`.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      hits += chunk.title.toLowerCase().includes(token) ? 2.2 : 1;
    }
  }

  const qLower = query.toLowerCase();
  if (qLower.includes('next') && chunk.recordType === 'Routine' && chunk.content.includes('status today: pending')) {
    hits += 2.5;
  }
  if ((qLower.includes('visit') || qLower.includes('today')) && haystack.includes('today')) {
    hits += 2.0;
  }
  if ((qLower.includes('where') || qLower.includes('keep') || qLower.includes('kept')) && chunk.recordType === 'Belonging') {
    hits += 2.0;
  }
  if ((qLower.includes('family') || qLower.includes('who')) && chunk.recordType === 'Person') {
    hits += 1.6;
  }
  if (qLower.includes('morning') && haystack.includes('morning')) {
    hits += 1.8;
  }
  if (qLower.includes('yesterday') && haystack.includes('yesterday')) {
    hits += 2.2;
  }

  return hits / (tokens.length + 3);
}

async function computeSemanticScores(
  ai: GoogleGenAI,
  query: string,
  chunks: RetrievalChunk[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (chunks.length === 0) return scores;
  try {
    const queryEmbedRes = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: [query],
    });
    const queryVec = queryEmbedRes.embeddings?.[0]?.values;
    if (!queryVec || queryVec.length === 0) return scores;

    const missingChunks = chunks.filter((c) => {
      const cached = embeddingCache.get(c.id);
      return !cached || cached.signature !== `${c.timestamp}:${c.content.length}`;
    });

    if (missingChunks.length > 0) {
      const batchRes = await ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: missingChunks.map((c) => `${c.title}\n${c.content}`),
      });
      missingChunks.forEach((c, idx) => {
        const vec = batchRes.embeddings?.[idx]?.values;
        if (vec && vec.length > 0) {
          embeddingCache.set(c.id, {
            signature: `${c.timestamp}:${c.content.length}`,
            vector: vec,
          });
        }
      });
    }

    for (const c of chunks) {
      const cached = embeddingCache.get(c.id);
      if (cached) {
        scores.set(c.id, cosineSimilarity(queryVec, cached.vector));
      }
    }
  } catch {
    // Graceful degradation to lexical retrieval if embedding endpoint is unavailable
  }
  return scores;
}

export async function runMemoryCompanionRag(
  question: string,
  recentHistory: ChatMessage[],
  vault: VaultClientData
): Promise<CompanionRagResult> {
  const ai = getAiClient();
  const chunks = buildKnowledgeChunks(vault);
  const semanticScores = await computeSemanticScores(ai, question, chunks);

  const ranked = chunks
    .map((chunk) => {
      const lex = lexicalScore(question, chunk);
      const sem = semanticScores.get(chunk.id) ?? 0;
      const combined = sem * 0.65 + lex * 0.55;
      return { chunk, score: combined, lex, sem };
    })
    .sort((a, b) => b.score - a.score);

  // Privacy-preserving RAG: retrieve ONLY relevant chunks (never send the entire personal database)
  const topChunks = ranked
    .filter((r) => r.lex > 0.08 || r.sem > 0.45 || r.score > 0.16)
    .slice(0, 7);

  const nowFormatted = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const retrievedContextText =
    topChunks.length > 0
      ? topChunks
          .map(
            (r, idx) =>
              `[Record ${idx + 1}]
ID: ${r.chunk.id}
Type: ${r.chunk.recordType}
Title: ${r.chunk.title}
Source: ${r.chunk.source}
Verification: ${r.chunk.verificationStatus}
Confidence: ${r.chunk.confidenceScore}%
Updated: ${r.chunk.timestamp}
Context: ${r.chunk.context}
Content: ${r.chunk.content}`
          )
          .join('\n\n')
      : 'NO MATCHING PERSONAL RECORDS FOUND.';

  const conversationSnippet = recentHistory
    .slice(-4)
    .map((m) => `${m.role === 'user' ? vault.settings.userName : 'Kindred'}: ${m.text}`)
    .join('\n');

  const systemInstruction = `You are Kindred, a calm, warm, trustworthy personal AI memory companion helping ${vault.settings.userName}.
Current local date and time: ${nowFormatted}.

STRICT GROUNDING & HONESTY RULES:
1. Answer ONLY using the Retrieved Personal Records provided below and the brief recent conversation context.
2. NEVER invent, guess, or fabricate personal facts, people, appointments, locations, or dates that are not explicitly present in the Retrieved Personal Records.
3. Distinguish clearly between Confirmed, User-reported, Caregiver-reported, Inferred, and Outdated records. Never present an "Inferred" or "Needs review" record as a verified fact—gently mention that it needs confirmation.
4. If the retrieved records do NOT contain the answer to the user's question, respond naturally and warmly with: "I don't have that information saved yet. Would you like to add it?" and populate missingInformationTopic. Do NOT cite unrelated records if none match.
5. If the user is sharing a NEW personal fact, preference, item location, or event (rather than asking a question), acknowledge it warmly and propose a suggestedMemory draft so the user can confirm saving it.
6. Only include citedIds for records that you actually relied upon in your answer.`;

  const prompt = `Recent conversation:
${conversationSnippet || '(New conversation)'}

User message: "${question}"

Retrieved Personal Records:
${retrievedContextText}`;

  let responseText = '{}';
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: 'Warm, clear, reassuring response grounded strictly in the retrieved records.',
              },
              citedIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Exact IDs of the retrieved records actually used to answer.',
              },
              reasoning: {
                type: Type.STRING,
                description: 'Brief plain-language explanation of why these memories matched and how confidence/verification was applied.',
              },
              missingInformationTopic: {
                type: Type.STRING,
                description: 'Short topic title if the requested information is not saved yet, otherwise empty string.',
              },
              hasSuggestedMemory: {
                type: Type.BOOLEAN,
                description: 'True only if the user explicitly stated a new personal fact/location/event worth asking to save.',
              },
              suggestedTitle: { type: Type.STRING },
              suggestedCategory: { type: Type.STRING },
              suggestedDescription: { type: Type.STRING },
            },
            required: ['answer', 'citedIds', 'reasoning', 'hasSuggestedMemory'],
          },
        },
      });
      responseText = (response.text ?? '{}').trim();
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  let parsed: {
    answer?: string;
    citedIds?: string[];
    reasoning?: string;
    missingInformationTopic?: string;
    hasSuggestedMemory?: boolean;
    suggestedTitle?: string;
    suggestedCategory?: string;
    suggestedDescription?: string;
  } = {};

  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = {
      answer: responseText || "I don't have that information saved yet. Would you like to add it?",
      citedIds: [],
      reasoning: 'Processed response from Kindred memory companion.',
      hasSuggestedMemory: false,
    };
  }

  const citedSet = new Set(parsed.citedIds ?? []);
  const citations: CitationItem[] = topChunks
    .filter((r) => citedSet.has(r.chunk.id))
    .map((r) => ({
      memoryId: r.chunk.id,
      recordType: r.chunk.recordType,
      title: r.chunk.title,
      snippet: r.chunk.content.slice(0, 180) + (r.chunk.content.length > 180 ? '...' : ''),
      source: r.chunk.source,
      verificationStatus: r.chunk.verificationStatus,
      confidenceScore: r.chunk.confidenceScore,
      timestamp: r.chunk.timestamp,
      context: r.chunk.context,
    }));

  const validCategories: MemoryCategory[] = [
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

  let suggestedMemory: SuggestedMemoryDraft | undefined;
  if (parsed.hasSuggestedMemory && parsed.suggestedTitle && parsed.suggestedDescription) {
    const matchedCat = validCategories.find(
      (c) => c.toLowerCase() === (parsed.suggestedCategory ?? '').toLowerCase()
    );
    suggestedMemory = {
      title: parsed.suggestedTitle,
      category: matchedCat ?? 'Important events',
      description: parsed.suggestedDescription,
    };
  }

  return {
    answer:
      parsed.answer?.trim() ||
      "I don't have that information saved yet. Would you like to add it?",
    citations,
    reasoning:
      parsed.reasoning?.trim() ||
      (citations.length > 0
        ? `Matched ${citations.length} saved record(s) from your personal vault.`
        : 'Searched your personal vault and found no saved record matching this question.'),
    missingInformationTopic: parsed.missingInformationTopic?.trim() || undefined,
    suggestedMemory,
  };
}
