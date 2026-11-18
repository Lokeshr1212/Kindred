import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Mic, Square, Upload } from 'lucide-react';
import { api } from '../lib/api';
import {
  MEMORY_CATEGORIES,
  type BelongingRecord,
  type MemoryCategory,
  type MemoryRecord,
  type PersonRecord,
  type PlaceRecord,
  type PrivacyLevel,
  type RoutineRecord,
  type VaultClientData,
} from '../types/memory';
import { Modal } from './ui/CommonUI';

export type QuickModalType =
  | null
  | 'memory'
  | 'voice'
  | 'routine'
  | 'person'
  | 'place'
  | 'belonging';

interface QuickModalsProps {
  activeModal: QuickModalType;
  prefillTitle?: string;
  onClose: () => void;
  vault: VaultClientData;
  onVaultUpdate: (v: VaultClientData) => void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export function QuickModals({
  activeModal,
  prefillTitle = '',
  onClose,
  vault,
  onVaultUpdate,
  onToast,
}: QuickModalsProps) {
  // Memory form
  const [memTitle, setMemTitle] = useState('');
  const [memCategory, setMemCategory] = useState<MemoryCategory>('Important events');
  const [memDesc, setMemDesc] = useState('');
  const [memDate, setMemDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [memPrivacy, setMemPrivacy] = useState<PrivacyLevel>('Family-shared');
  const [memPeople, setMemPeople] = useState<string[]>([]);
  const [memLocation, setMemLocation] = useState('');
  const [memTags, setMemTags] = useState('');
  const [memImageUrl, setMemImageUrl] = useState('');
  const [duplicates, setDuplicates] = useState<MemoryRecord[]>([]);
  const [saving, setSaving] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioDataUrl, setAudioDataUrl] = useState('');
  const [voiceNoteTitle, setVoiceNoteTitle] = useState('');
  const [voiceNoteTranscript, setVoiceNoteTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  // Routine form
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineTime, setRoutineTime] = useState('10:30');
  const [routineCat, setRoutineCat] = useState<RoutineRecord['category']>('Self-care');
  const [routinePriority, setRoutinePriority] = useState<RoutineRecord['priority']>('normal');
  const [routineAlert, setRoutineAlert] = useState(false);
  const [routineNotes, setRoutineNotes] = useState('');

  // Person form
  const [personName, setPersonName] = useState('');
  const [personRel, setPersonRel] = useState('');
  const [personGroup, setPersonGroup] = useState<PersonRecord['relationshipGroup']>('Immediate Family');
  const [personBirthday, setPersonBirthday] = useState('');
  const [personDetails, setPersonDetails] = useState('');
  const [personNotes, setPersonNotes] = useState('');
  const [personAvatar, setPersonAvatar] = useState('');

  // Place form
  const [placeName, setPlaceName] = useState('');
  const [placeCategory, setPlaceCategory] = useState<PlaceRecord['category']>('Community');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeLandmark, setPlaceLandmark] = useState('');
  const [placeNotes, setPlaceNotes] = useState('');

  // Belonging form
  const [itemName, setItemName] = useState('');
  const [itemCat, setItemCat] = useState<BelongingRecord['category']>('Keepsakes');
  const [itemRoom, setItemRoom] = useState('');
  const [itemSpot, setItemSpot] = useState('');
  const [itemCue, setItemCue] = useState('');

  useEffect(() => {
    if (activeModal === 'memory' && prefillTitle) {
      setMemTitle(prefillTitle);
    }
  }, [activeModal, prefillTitle]);

  useEffect(() => {
    if (activeModal !== 'memory') {
      setDuplicates([]);
      return;
    }
    if (memTitle.trim().length < 4 && memDesc.trim().length < 10) {
      setDuplicates([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.checkDuplicates(memTitle, memDesc);
        setDuplicates(res.duplicates);
      } catch {
        // Ignore silent duplicate check error
      }
    }, 350);
    return () => clearTimeout(t);
  }, [memTitle, memDesc, activeModal]);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onLoad: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onLoad(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setAudioDataUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      onToast('Microphone permission is needed to record a voice note.', 'error');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memTitle.trim() || !memDesc.trim()) return;
    setSaving(true);
    try {
      const res = await api.createMemory({
        title: memTitle,
        category: memCategory,
        description: memDesc,
        eventDate: memDate,
        privacyLevel: memPrivacy,
        associatedPeople: memPeople,
        associatedLocations: memLocation ? [memLocation] : [],
        tags: memTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        imageUrl: memImageUrl || undefined,
      });
      onVaultUpdate(res.vault);
      onToast('Memory saved to your personal vault.');
      setMemTitle('');
      setMemDesc('');
      setMemTags('');
      setMemImageUrl('');
      setMemPeople([]);
      setMemLocation('');
      onClose();
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVoiceNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceNoteTitle.trim()) return;
    setSaving(true);
    try {
      const res = await api.createMemory({
        title: voiceNoteTitle,
        category: 'Voice notes',
        description:
          voiceNoteTranscript.trim() ||
          `Recorded voice note (${recordingSeconds}s) saved locally in personal vault.`,
        audioDataUrl: audioDataUrl || undefined,
        privacyLevel: 'Family-shared',
        tags: ['voice-note'],
        evidenceNote: 'Audio recording saved directly by user',
      });
      onVaultUpdate(res.vault);
      onToast('Voice note saved.');
      setVoiceNoteTitle('');
      setVoiceNoteTranscript('');
      setAudioDataUrl('');
      setRecordingSeconds(0);
      onClose();
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineTitle.trim()) return;
    setSaving(true);
    try {
      const res = await api.createRoutine({
        title: routineTitle,
        time: routineTime,
        category: routineCat,
        priority: routinePriority,
        caregiverAlertOnMiss: routineAlert,
        notes: routineNotes,
      });
      onVaultUpdate(res.vault);
      onToast('Reminder added to your daily timeline.');
      setRoutineTitle('');
      setRoutineNotes('');
      onClose();
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) return;
    setSaving(true);
    try {
      const res = await api.createPerson({
        name: personName,
        relationship: personRel || 'Family',
        relationshipGroup: personGroup,
        birthday: personBirthday || 'Not specified',
        importantDetails: personDetails,
        notes: personNotes,
        avatarUrl: personAvatar || undefined,
      });
      onVaultUpdate(res.vault);
      onToast(`${personName} added to People.`);
      setPersonName('');
      setPersonRel('');
      setPersonBirthday('');
      setPersonDetails('');
      setPersonNotes('');
      setPersonAvatar('');
      onClose();
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeName.trim()) return;
    setSaving(true);
    try {
      const res = await api.createPlace({
        name: placeName,
        category: placeCategory,
        address: placeAddress,
        landmarkCue: placeLandmark,
        notes: placeNotes,
      });
      onVaultUpdate(res.vault);
      onToast(`${placeName} saved to Places.`);
      setPlaceName('');
      setPlaceAddress('');
      setPlaceLandmark('');
      setPlaceNotes('');
      onClose();
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBelonging = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemSpot.trim()) return;
    setSaving(true);
    try {
      const res = await api.createBelonging({
        name: itemName,
        category: itemCat,
        room: itemRoom || 'Home',
        exactLocation: itemSpot,
        visualCue: itemCue,
      });
      onVaultUpdate(res.vault);
      onToast(`${itemName} spot saved.`);
      setItemName('');
      setItemRoom('');
      setItemSpot('');
      setItemCue('');
      onClose();
    } catch (err) {
      onToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 text-sm bg-[#F8F7FC] border border-[#E6E3F1] rounded-xl text-[#29283A] placeholder:text-[#858398] focus:outline-none focus:border-[#6D5FD1] focus:bg-white transition-colors';

  return (
    <>
      <Modal
        open={activeModal === 'memory'}
        onClose={onClose}
        title="Save a Memory"
        subtitle="Stored privately in your local-first knowledge vault."
      >
        <form onSubmit={handleSaveMemory} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Title</label>
            <input
              type="text"
              required
              value={memTitle}
              onChange={(e) => setMemTitle(e.target.value)}
              placeholder="e.g., Afternoon tea with Maya"
              className={inputClass}
            />
          </div>

          {duplicates.length > 0 && (
            <div className="p-3 rounded-xl bg-[#FBE6DC]/60 border border-[#E8C5B5] text-xs text-[#6B331D] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Similar memory already exists</p>
                <p className="mt-0.5">
                  Found &ldquo;{duplicates[0].title}&rdquo;. You can still save this if it is a separate event.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Category</label>
              <select
                value={memCategory}
                onChange={(e) => setMemCategory(e.target.value as MemoryCategory)}
                className={inputClass}
              >
                {MEMORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Date</label>
              <input
                type="date"
                value={memDate}
                onChange={(e) => setMemDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Details</label>
            <textarea
              required
              rows={3}
              value={memDesc}
              onChange={(e) => setMemDesc(e.target.value)}
              placeholder="Describe what happened, who was there, or helpful context..."
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Privacy level</label>
              <select
                value={memPrivacy}
                onChange={(e) => setMemPrivacy(e.target.value as PrivacyLevel)}
                className={inputClass}
              >
                <option value="Family-shared">Family-shared</option>
                <option value="Caregiver-visible">Caregiver-visible</option>
                <option value="Private">Private (Owner only)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Location</label>
              <input
                type="text"
                value={memLocation}
                onChange={(e) => setMemLocation(e.target.value)}
                placeholder="e.g., Home Sunroom"
                className={inputClass}
              />
            </div>
          </div>

          {vault.people.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">
                Associated people
              </label>
              <div className="flex flex-wrap gap-2">
                {vault.people.map((p) => {
                  const selected = memPeople.includes(p.name);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setMemPeople((prev) =>
                          selected ? prev.filter((n) => n !== p.name) : [...prev, p.name]
                        )
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#EDEAF9] border-[#6D5FD1] text-[#4E3FB8]'
                          : 'bg-[#F8F7FC] border-[#E6E3F1] text-[#4A485E]'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={memTags}
                onChange={(e) => setMemTags(e.target.value)}
                placeholder="family, afternoon, tea"
                className={inputClass}
              />
            </div>
            <div>
              <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium text-[#4E3FB8] bg-[#EDEAF9] hover:bg-[#E1DCF7] rounded-xl cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>{memImageUrl ? 'Photo attached' : 'Attach photograph'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, setMemImageUrl)}
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#4A485E] bg-[#F2F0F9] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Memory'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'voice'}
        onClose={() => {
          stopVoiceRecording();
          onClose();
        }}
        title="Record a Voice Note"
        subtitle="Capture a quick spoken reminder or story privately."
      >
        <form onSubmit={handleSaveVoiceNote} className="space-y-4">
          <div className="p-5 rounded-2xl bg-[#F8F7FC] border border-[#E6E3F1] flex flex-col items-center text-center">
            <button
              type="button"
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
                isRecording
                  ? 'bg-[#C93B3B] text-white shadow-md'
                  : 'bg-[#6D5FD1] text-white hover:bg-[#5B4DC4]'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <p className="mt-3 text-sm font-medium text-[#29283A]">
              {isRecording
                ? `Recording... ${recordingSeconds}s`
                : audioDataUrl
                ? `Recorded (${recordingSeconds}s) — ready to play`
                : 'Tap microphone to begin recording'}
            </p>
            {audioDataUrl && !isRecording && (
              <audio controls src={audioDataUrl} className="mt-3 w-full max-w-xs" />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Title</label>
            <input
              type="text"
              required
              value={voiceNoteTitle}
              onChange={(e) => setVoiceNoteTitle(e.target.value)}
              placeholder="e.g., Reminder about watering porch herbs"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">
              Written note or transcript (optional)
            </label>
            <textarea
              rows={2}
              value={voiceNoteTranscript}
              onChange={(e) => setVoiceNoteTranscript(e.target.value)}
              placeholder="Add any short notes so AI Companion can search this easily..."
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#4A485E] bg-[#F2F0F9] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Voice Note'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'routine'}
        onClose={onClose}
        title="Add Routine or Reminder"
        subtitle="Add an activity to your gentle daily timeline."
      >
        <form onSubmit={handleSaveRoutine} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Activity title</label>
            <input
              type="text"
              required
              value={routineTitle}
              onChange={(e) => setRoutineTitle(e.target.value)}
              placeholder="e.g., Call Maya for afternoon catch-up"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Time</label>
              <input
                type="time"
                required
                value={routineTime}
                onChange={(e) => setRoutineTime(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Category</label>
              <select
                value={routineCat}
                onChange={(e) => setRoutineCat(e.target.value as RoutineRecord['category'])}
                className={inputClass}
              >
                <option value="Self-care">Self-care</option>
                <option value="Meals">Meals</option>
                <option value="Movement">Movement</option>
                <option value="Health">Health</option>
                <option value="Family">Family</option>
                <option value="Rest">Rest</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Priority</label>
              <select
                value={routinePriority}
                onChange={(e) => setRoutinePriority(e.target.value as RoutineRecord['priority'])}
                className={inputClass}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="low">Gentle</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Helpful notes</label>
            <textarea
              rows={2}
              value={routineNotes}
              onChange={(e) => setRoutineNotes(e.target.value)}
              placeholder="Any helpful reminders or preparation steps..."
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2.5 text-sm text-[#29283A] cursor-pointer">
            <input
              type="checkbox"
              checked={routineAlert}
              onChange={(e) => setRoutineAlert(e.target.checked)}
              className="w-4 h-4 accent-[#6D5FD1]"
            />
            <span>Notify authorized caregiver if this important routine is missed</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#4A485E] bg-[#F2F0F9] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl cursor-pointer"
            >
              {saving ? 'Adding...' : 'Add Reminder'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'person'}
        onClose={onClose}
        title="Add a Person"
        subtitle="Keep meaningful details about family, friends, and care team."
      >
        <form onSubmit={handleSavePerson} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Name</label>
              <input
                type="text"
                required
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="e.g., Priya"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Relationship</label>
              <input
                type="text"
                required
                value={personRel}
                onChange={(e) => setPersonRel(e.target.value)}
                placeholder="e.g., Granddaughter, Neighbor"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Circle</label>
              <select
                value={personGroup}
                onChange={(e) =>
                  setPersonGroup(e.target.value as PersonRecord['relationshipGroup'])
                }
                className={inputClass}
              >
                <option value="Immediate Family">Immediate Family</option>
                <option value="Extended Family">Extended Family</option>
                <option value="Friends">Friends</option>
                <option value="Care & Medical">Care & Medical</option>
                <option value="Community">Community</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Birthday</label>
              <input
                type="text"
                value={personBirthday}
                onChange={(e) => setPersonBirthday(e.target.value)}
                placeholder="e.g., 15 August"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">
              Important details
            </label>
            <input
              type="text"
              value={personDetails}
              onChange={(e) => setPersonDetails(e.target.value)}
              placeholder="Hobbies, favorite topics, how you know them..."
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Personal notes</label>
            <textarea
              rows={2}
              value={personNotes}
              onChange={(e) => setPersonNotes(e.target.value)}
              placeholder="When they usually visit or call..."
              className={inputClass}
            />
          </div>
          <label className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-[#4E3FB8] bg-[#EDEAF9] hover:bg-[#E1DCF7] rounded-xl cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span>{personAvatar ? 'Portrait selected' : 'Upload photograph'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e, setPersonAvatar)}
            />
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#4A485E] bg-[#F2F0F9] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Person'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'place'}
        onClose={onClose}
        title="Save a Familiar Place"
        subtitle="Record landmarks, addresses, and helpful cues."
      >
        <form onSubmit={handleSavePlace} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Place name</label>
              <input
                type="text"
                required
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="e.g., Cedar Corner Bakery"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Category</label>
              <select
                value={placeCategory}
                onChange={(e) => setPlaceCategory(e.target.value as PlaceRecord['category'])}
                className={inputClass}
              >
                <option value="Home">Home</option>
                <option value="Park & Outdoors">Park & Outdoors</option>
                <option value="Medical">Medical</option>
                <option value="Community">Community</option>
                <option value="Travel & Heritage">Travel & Heritage</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Address</label>
            <input
              type="text"
              value={placeAddress}
              onChange={(e) => setPlaceAddress(e.target.value)}
              placeholder="Street address or neighborhood"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">
              Visual landmark cue
            </label>
            <input
              type="text"
              value={placeLandmark}
              onChange={(e) => setPlaceLandmark(e.target.value)}
              placeholder="e.g., Green striped awning across from the post office"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={placeNotes}
              onChange={(e) => setPlaceNotes(e.target.value)}
              placeholder="Why this place is meaningful or helpful tips..."
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#4A485E] bg-[#F2F0F9] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Place'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal === 'belonging'}
        onClose={onClose}
        title="Track a Personal Belonging"
        subtitle="Save the exact spot where an everyday item is kept."
      >
        <form onSubmit={handleSaveBelonging} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Item name</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., Spare reading glasses"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Room</label>
              <input
                type="text"
                required
                value={itemRoom}
                onChange={(e) => setItemRoom(e.target.value)}
                placeholder="e.g., Bedroom, Kitchen"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Category</label>
            <select
              value={itemCat}
              onChange={(e) => setItemCat(e.target.value as BelongingRecord['category'])}
              className={inputClass}
            >
              <option value="Eyewear">Eyewear</option>
              <option value="Keys">Keys</option>
              <option value="Documents & Wallet">Documents & Wallet</option>
              <option value="Health">Health</option>
              <option value="Electronics">Electronics</option>
              <option value="Keepsakes">Keepsakes</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">
              Exact location
            </label>
            <input
              type="text"
              required
              value={itemSpot}
              onChange={(e) => setItemSpot(e.target.value)}
              placeholder="e.g., Top right drawer of bedside table"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4A485E] mb-1.5">Visual cue</label>
            <input
              type="text"
              value={itemCue}
              onChange={(e) => setItemCue(e.target.value)}
              placeholder="e.g., Inside the soft lavender pouch"
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#4A485E] bg-[#F2F0F9] rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-[#6D5FD1] hover:bg-[#5B4DC4] rounded-xl cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Item Spot'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
