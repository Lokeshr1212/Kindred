import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mic,
  MicOff,
  Plus,
  Send,
  Trash2,
  Volume2,
} from 'lucide-react';
import { api, formatFriendlyDate } from '../lib/api';
import type { ChatMessage, VaultClientData } from '../types/memory';
import { ConfirmDialog, MetadataLine } from './ui/CommonUI';

interface AiCompanionViewProps {
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onOpenSaveMemory: (prefillTitle?: string) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

const SUGGESTED_QUESTIONS = [
  'Who is visiting me today?',
  'What should I do next?',
  'Where did I keep my glasses?',
  'What is my next appointment?',
  'Who is this person?',
  'What did I do yesterday?',
  'Tell me about my family.',
  'What are my usual morning activities?',
];

export function AiCompanionView({
  vault,
  onVaultUpdate,
  onOpenSaveMemory,
  onToast,
}: AiCompanionViewProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string>(
    vault.conversations[0]?.id || ''
  );
  const [transientMessages, setTransientMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedExplainId, setExpandedExplainId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeThread =
    vault.conversations.find((t) => t.id === selectedThreadId) || vault.conversations[0];
  const displayMessages = vault.settings.retainConversations
    ? activeThread?.messages || []
    : transientMessages;

  useEffect(() => {
    if (activeThread && activeThread.id !== selectedThreadId) {
      setSelectedThreadId(activeThread.id);
    }
  }, [activeThread, selectedThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length, isLoading]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    setIsLoading(true);

    if (!vault.settings.retainConversations) {
      setTransientMessages((prev) => [
        ...prev,
        {
          id: `u-temp-${Date.now()}`,
          role: 'user',
          text: trimmed,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    try {
      const res = await api.askCompanion(trimmed, activeThread?.id);
      if (vault.settings.retainConversations) {
        onVaultUpdate(res.vault);
      } else {
        setTransientMessages((prev) => [...prev, res.assistantMessage]);
      }
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
      };
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      onToast('Voice dictation is not supported in this browser. Please type your question.', 'error');
      return;
    }
    try {
      const recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      setListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      recognition.onerror = () => {
        setListening(false);
        onToast('Could not capture speech. Please try again.', 'error');
      };
      recognition.onend = () => {
        setListening(false);
      };
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  const handleSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      onToast('Speech playback is not supported in this browser.', 'error');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const handleNewChat = async () => {
    if (!vault.settings.retainConversations) {
      setTransientMessages([]);
      return;
    }
    try {
      const res = await api.newConversation();
      onVaultUpdate(res.vault);
      setSelectedThreadId(res.threadId);
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleDeleteThread = async (id: string) => {
    try {
      const updated = await api.deleteConversation(id);
      onVaultUpdate(updated);
      onToast('Conversation deleted.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleClearAll = async () => {
    if (!vault.settings.retainConversations) {
      setTransientMessages([]);
      return;
    }
    try {
      const updated = await api.clearConversations();
      onVaultUpdate(updated);
      setSelectedThreadId(updated.conversations[0]?.id || '');
      onToast('Conversation history cleared.');
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  const handleConfirmSaveSuggested = async (msg: ChatMessage) => {
    if (!msg.suggestedMemory) return;
    try {
      const res = await api.confirmSaveSuggestedMemory({
        threadId: activeThread?.id,
        messageId: msg.id,
        title: msg.suggestedMemory.title,
        category: msg.suggestedMemory.category,
        description: msg.suggestedMemory.description,
      });
      onVaultUpdate(res.vault);
      onToast(`Saved "${msg.suggestedMemory.title}" to My Memories.`);
    } catch (err) {
      onToast((err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#29283A]">AI Memory Companion</h1>
          <p className="text-sm text-[#68667D] mt-0.5">
            Grounded strictly in your saved memories, people, places, belongings, and routines.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#29283A] bg-white border border-[#E6E3F1] hover:bg-[#F2F0F9] rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New chat</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#68667D] hover:text-[#C93B3B] bg-white border border-[#E6E3F1] rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear conversation</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Conversation History Sidebar */}
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-[#E6E3F1] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#68667D]">Recent chats</h2>
            {!vault.settings.retainConversations && (
              <span className="text-[11px] text-[#68667D]">Temporary mode</span>
            )}
          </div>
          {vault.conversations.length === 0 ? (
            <p className="text-xs text-[#68667D] py-2">No saved conversations.</p>
          ) : (
            <div className="space-y-1.5">
              {vault.conversations.map((thread) => {
                const active = thread.id === activeThread?.id;
                return (
                  <div
                    key={thread.id}
                    className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                      active ? 'bg-[#EDEAF9] text-[#4E3FB8]' : 'hover:bg-[#F8F7FC] text-[#29283A]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedThreadId(thread.id)}
                      className="flex-1 text-left truncate font-medium cursor-pointer"
                    >
                      {thread.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteThread(thread.id)}
                      aria-label={`Delete conversation ${thread.title}`}
                      className="opacity-60 hover:opacity-100 text-[#68667D] hover:text-[#C93B3B] p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-[#E6E3F1]">
            <p className="text-xs font-semibold text-[#68667D] mb-2">Suggested questions</p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuestion(q)}
                  className="text-left text-xs px-3 py-2 rounded-xl bg-[#F8F7FC] hover:bg-[#EDEAF9] text-[#29283A] transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <section className="lg:col-span-9 bg-white rounded-2xl border border-[#E6E3F1] flex flex-col min-h-[600px] max-h-[75vh]">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            {displayMessages.length === 0 && (
              <div className="text-center py-12 max-w-md mx-auto">
                <p className="text-base font-semibold text-[#29283A]">
                  Ask me anything about your day, people, or saved memories
                </p>
                <p className="text-sm text-[#68667D] mt-1">
                  Every answer shows the exact saved record, source, and confidence level.
                </p>
              </div>
            )}

            {displayMessages.map((msg) => {
              const isUser = msg.role === 'user';
              const explainOpen = expandedExplainId === msg.id;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#6D5FD1] text-white'
                        : 'bg-[#F8F7FC] border border-[#E6E3F1] text-[#29283A]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {!isUser && (
                      <div className="mt-2.5 flex items-center gap-3 text-xs text-[#68667D]">
                        <button
                          type="button"
                          onClick={() => handleSpeak(msg.text)}
                          className="inline-flex items-center gap-1 hover:text-[#29283A] cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Listen</span>
                        </button>
                        {(msg.reasoning || (msg.citations && msg.citations.length > 0)) && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedExplainId(explainOpen ? null : msg.id)
                            }
                            className="inline-flex items-center gap-1 text-[#5B4DC4] hover:underline cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Why am I seeing this answer?</span>
                            {explainOpen ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Retrieved Memory Reference Cards */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 max-w-[85%] grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {msg.citations.map((cite) => (
                        <div
                          key={cite.memoryId}
                          className="p-3 rounded-xl bg-white border border-[#E6E3F1] text-xs"
                        >
                          <p className="font-semibold text-[#29283A] truncate">{cite.title}</p>
                          <MetadataLine
                            items={[
                              cite.recordType,
                              cite.source,
                              cite.verificationStatus,
                              `${cite.confidenceScore}% confidence`,
                            ]}
                          />
                          <p className="text-[#4A485E] mt-1.5 line-clamp-2">{cite.snippet}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expandable Explainability Panel */}
                  {!isUser && explainOpen && (
                    <div className="mt-2 max-w-[85%] p-4 rounded-xl bg-[#F2F0F9]/75 border border-[#E6E3F1] text-xs text-[#4A485E] space-y-2">
                      <p className="font-semibold text-[#29283A]">Memory retrieval explanation</p>
                      <p>{msg.reasoning}</p>
                      {msg.citations &&
                        msg.citations.map((c) => (
                          <div key={c.memoryId} className="pt-2 border-t border-[#E6E3F1]">
                            <p className="font-medium text-[#29283A]">{c.title}</p>
                            <MetadataLine
                              items={[
                                `Source: ${c.source}`,
                                `Status: ${c.verificationStatus}`,
                                `Updated: ${formatFriendlyDate(c.timestamp)}`,
                                c.context,
                              ]}
                            />
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Missing info helper */}
                  {!isUser && msg.missingInformationTopic && (
                    <button
                      type="button"
                      onClick={() => onOpenSaveMemory(msg.missingInformationTopic)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#4E3FB8] bg-[#EDEAF9] hover:bg-[#E1DCF7] rounded-xl transition-colors cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      <span>Add &ldquo;{msg.missingInformationTopic}&rdquo; to My Memories</span>
                    </button>
                  )}

                  {/* Confirmation prompt before saving new memory shared in chat */}
                  {!isUser && msg.suggestedMemory && !msg.savedFromSuggestion && (
                    <div className="mt-2.5 max-w-[85%] p-3.5 rounded-xl bg-[#DDF3E8]/55 border border-[#B9E2CC] text-xs text-[#1E4D36] space-y-2">
                      <p className="font-semibold">Save this to your permanent memories?</p>
                      <p>
                        <strong>{msg.suggestedMemory.title}</strong> ({msg.suggestedMemory.category}):{' '}
                        {msg.suggestedMemory.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleConfirmSaveSuggested(msg)}
                        className="px-3 py-1.5 bg-[#1A7F54] hover:bg-[#156945] text-white rounded-lg font-medium cursor-pointer"
                      >
                        Confirm & Save Memory
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}

            {isLoading && (
              <div className="flex items-start">
                <div className="px-4 py-3 rounded-2xl bg-[#F8F7FC] border border-[#E6E3F1] text-xs text-[#68667D]">
                  Searching your memory vault...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="p-4 border-t border-[#E6E3F1] flex items-center gap-2.5"
          >
            <button
              type="button"
              onClick={handleVoiceInput}
              aria-label="Voice input"
              className={`p-3 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                listening
                  ? 'bg-[#C93B3B] text-white border-[#C93B3B]'
                  : 'bg-[#F8F7FC] text-[#4A485E] border-[#E6E3F1] hover:bg-[#EDEAF9]'
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about someone, where an item is kept, or today's schedule..."
              className="flex-1 px-4 py-2.5 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl text-[#29283A] placeholder:text-[#858398] focus:outline-none focus:border-[#6D5FD1] focus:bg-white"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </section>
      </div>

      <ConfirmDialog
        open={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearAll}
        title="Clear conversation history?"
        message="This removes your chat history from this view without deleting any saved memories in your Personal Knowledge Base."
        confirmLabel="Clear chats"
        destructive
      />
    </div>
  );
}
