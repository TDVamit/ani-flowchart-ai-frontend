import { useState } from 'react';
import { transcriptionApi, entriesApi } from '../../api/client';
import type { AudioRecording } from '../../types';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Badge from '../ui/Badge';
import { Mic2, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';

interface TranscriptEditorProps {
  recording: AudioRecording;
  index: number;
  entryId: string;
  onTranscriptUpdated: (index: number, transcript: string, source: 'whisper' | 'manual') => void;
}

export default function TranscriptEditor({
  recording,
  index,
  entryId,
  onTranscriptUpdated,
}: TranscriptEditorProps) {
  const [tab, setTab] = useState<'whisper' | 'manual'>('whisper');
  const [transcribing, setTranscribing] = useState(false);
  const [manualText, setManualText] = useState(
    recording.transcript_source === 'manual' ? (recording.transcript || '') : ''
  );
  const [interviewee, setInterviewee] = useState(recording.interviewee_name || '');
  const [role, setRole] = useState(recording.interviewee_role || '');

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const res = await transcriptionApi.transcribeFromR2(recording.file_id);
      const { transcript } = res.data;
      await entriesApi.updateTranscript(entryId, {
        recording_index: index,
        transcript,
        source: 'whisper',
      });
      onTranscriptUpdated(index, transcript, 'whisper');
      toast.success('Transcription complete');
    } catch {
      // handled by interceptor
    } finally {
      setTranscribing(false);
    }
  };

  const handleSaveManual = async () => {
    await entriesApi.updateTranscript(entryId, {
      recording_index: index,
      transcript: manualText,
      source: 'manual',
    });
    onTranscriptUpdated(index, manualText, 'manual');
    toast.success('Transcript saved');
  };

  const whisperTranscript =
    recording.transcript_source === 'whisper' ? recording.transcript : null;

  return (
    <div className="border border-[#21262d] bg-[#161b22] mb-3">
      <div className="px-3 py-2 border-b border-[#21262d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic2 size={13} className="text-amber-500" />
          <span className="font-mono text-xs text-gray-300">{recording.original_filename}</span>
          {recording.duration_seconds && (
            <Badge variant="gray">{Math.round(recording.duration_seconds)}s</Badge>
          )}
          {recording.transcript_source && (
            <Badge variant={recording.transcript_source === 'whisper' ? 'blue' : 'green'}>
              {recording.transcript_source}
            </Badge>
          )}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-[#21262d] grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Interviewee name"
          value={interviewee}
          onChange={(e) => setInterviewee(e.target.value)}
          className="text-xs bg-[#0f1117] border border-[#21262d] text-gray-300 px-2 py-1 focus:border-amber-500 placeholder-gray-600"
        />
        <input
          type="text"
          placeholder="Role / title"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="text-xs bg-[#0f1117] border border-[#21262d] text-gray-300 px-2 py-1 focus:border-amber-500 placeholder-gray-600"
        />
      </div>

      <div className="flex border-b border-[#21262d]">
        {(['whisper', 'manual'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
              tab === t
                ? 'text-amber-400 border-b-2 border-amber-500 -mb-px bg-amber-500/5'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'whisper' ? <Mic2 size={11} /> : <Edit3 size={11} />}
            {t === 'whisper' ? 'Whisper AI' : 'Manual Entry'}
          </button>
        ))}
      </div>

      <div className="p-3">
        {tab === 'whisper' ? (
          whisperTranscript ? (
            <p className="text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
              {whisperTranscript}
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <Button size="sm" variant="primary" onClick={handleTranscribe} disabled={transcribing}>
                {transcribing ? <Spinner className="mr-2" /> : null}
                {transcribing ? 'Transcribing...' : 'Transcribe Now'}
              </Button>
              <span className="text-xs text-gray-600 font-mono">Uses OpenAI Whisper API</span>
            </div>
          )
        ) : (
          <div>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Type or paste the transcript here..."
              className="w-full bg-[#0f1117] border border-[#21262d] text-gray-300 text-xs p-2 resize-y focus:border-amber-500 placeholder-gray-600 min-h-[120px]"
            />
            <div className="mt-2">
              <Button size="sm" variant="secondary" onClick={handleSaveManual}>
                Save Transcript
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
