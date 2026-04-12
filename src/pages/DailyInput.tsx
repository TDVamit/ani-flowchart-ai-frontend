import { useEffect, useState, useCallback, useRef } from 'react';
import { entriesApi, projectsApi } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import type { DailyEntry, AudioRecording, UploadedDocument, ContextStore } from '../types';
import DailyNotesInput from '../components/entry/DailyNotesInput';
import AudioUploader from '../components/entry/AudioUploader';
import FileUploader from '../components/entry/FileUploader';
import TopBar from '../components/layout/TopBar';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { format } from 'date-fns';

type SaveState = 'idle' | 'saving' | 'saved';

export default function DailyInput() {
  const { activeProjectId, projects } = useAppStore();
  const activeProject = projects.find((p) => p._id === activeProjectId);

  const [entry, setEntry] = useState<DailyEntry | null>(null);
  const [context, setContext] = useState<ContextStore | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryRef = useRef<DailyEntry | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date();

  useEffect(() => {
    if (!activeProjectId) return;
    Promise.all([
      entriesApi.listByProject(activeProjectId),
      projectsApi.getContext(activeProjectId),
    ]).then(async ([eRes, cRes]) => {
      setContext(cRes.data);
      let todayEntry = eRes.data.find((e: DailyEntry) => e.entry_date === today);
      if (!todayEntry) {
        // Create today's entry
        const project = projects.find((p) => p._id === activeProjectId);
        const newEntry: Omit<DailyEntry, '_id'> = {
          project_id: activeProjectId,
          entry_date: today,
          week_number: project?.current_week || 1,
          day_number: project?.current_day || 1,
          typed_findings: '',
          user_annotations: '',
          previous_plan_review: '',
          audio_recordings: [],
          uploaded_documents: [],
          analysis_triggered: false,
          analysis_completed: false,
        };
        const res = await entriesApi.create(newEntry);
        todayEntry = { ...newEntry, _id: res.data.id };
      }
      setEntry(todayEntry);
      entryRef.current = todayEntry;
    });
  }, [activeProjectId, today, projects]);

  const scheduleSave = useCallback(
    (updatedEntry: DailyEntry) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveState('saving');
      saveTimerRef.current = setTimeout(async () => {
        if (!updatedEntry._id) return;
        await entriesApi.update(updatedEntry._id, {
          typed_findings: updatedEntry.typed_findings,
          user_annotations: updatedEntry.user_annotations,
          previous_plan_review: updatedEntry.previous_plan_review,
        });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      }, 30000);
    },
    []
  );

  const updateField = (field: keyof DailyEntry, value: string) => {
    if (!entry) return;
    const updated = { ...entry, [field]: value };
    setEntry(updated);
    entryRef.current = updated;
    scheduleSave(updated);
  };

  const handleSaveNow = async () => {
    if (!entry?._id) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState('saving');
    await entriesApi.update(entry._id, {
      typed_findings: entry.typed_findings,
      user_annotations: entry.user_annotations,
      previous_plan_review: entry.previous_plan_review,
    });
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 2000);
  };

  const handleRecordingAdded = (rec: AudioRecording) => {
    if (!entry) return;
    const updated = {
      ...entry,
      audio_recordings: [...entry.audio_recordings, rec],
    };
    setEntry(updated);
  };

  const handleTranscriptUpdated = (
    index: number,
    transcript: string,
    source: 'whisper' | 'manual'
  ) => {
    if (!entry) return;
    const recordings = [...entry.audio_recordings];
    recordings[index] = { ...recordings[index], transcript, transcript_source: source };
    setEntry({ ...entry, audio_recordings: recordings });
  };

  const handleDocumentAdded = (doc: UploadedDocument) => {
    if (!entry) return;
    setEntry({
      ...entry,
      uploaded_documents: [...entry.uploaded_documents, doc],
    });
  };

  if (!activeProjectId || !activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc]">
        <span className="text-[#64748b] font-mono text-sm">No active project selected.</span>
      </div>
    );
  }

  const saveIndicator =
    saveState === 'saving' ? (
      <Badge variant="amber">Saving...</Badge>
    ) : saveState === 'saved' ? (
      <Badge variant="green">Saved</Badge>
    ) : null;

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-auto">
      <TopBar
        title="Daily Input"
        subtitle={format(todayDate, 'EEEE, MMMM d')}
        actions={
          <div className="flex items-center gap-3">
            {saveIndicator}
            <button
              onClick={handleSaveNow}
              className="font-mono text-xs text-[#64748b] hover:text-indigo-600 transition-colors"
            >
              Save now
            </button>
          </div>
        }
      />

      {!entry ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[#94a3b8] font-mono text-sm">Loading entry...</span>
        </div>
      ) : (
        <div className="p-6 space-y-6 max-w-3xl">
          {/* Section 1: Today's Context */}
          {context?.last_plan && (
            <Card title="Yesterday's Plan">
              <ul className="space-y-1">
                {context.last_plan.split('\n').filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#475569]">
                    <span className="text-indigo-500 flex-shrink-0">→</span>
                    {line.replace(/^[-•*]\s*/, '')}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <DailyNotesInput
            label="How did today's plan actually go?"
            value={entry.previous_plan_review}
            onChange={(v) => updateField('previous_plan_review', v)}
            placeholder="Compare what was planned vs. what actually happened..."
            minHeight={100}
          />

          {/* Section 2: Typed Findings */}
          <DailyNotesInput
            label="What did you observe, learn, or discover today?"
            value={entry.typed_findings}
            onChange={(v) => updateField('typed_findings', v)}
            placeholder="Describe meetings, observations, documents reviewed, people spoken with, processes observed..."
            minHeight={250}
          />

          {/* Section 3: Annotations */}
          <DailyNotesInput
            label="Hunches, priorities, what feels important but you can't prove yet"
            value={entry.user_annotations}
            onChange={(v) => updateField('user_annotations', v)}
            placeholder="Your gut instincts, things that feel significant, patterns you're starting to sense..."
            minHeight={120}
          />

          {/* Section 4: Audio */}
          <AudioUploader
            entryId={entry._id!}
            projectId={activeProjectId}
            recordings={entry.audio_recordings}
            onRecordingAdded={handleRecordingAdded}
            onTranscriptUpdated={handleTranscriptUpdated}
          />

          {/* Section 5: Documents */}
          <FileUploader
            projectId={activeProjectId}
            entryId={entry._id!}
            documents={entry.uploaded_documents}
            onDocumentAdded={handleDocumentAdded}
          />
        </div>
      )}
    </div>
  );
}
