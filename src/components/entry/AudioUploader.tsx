import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Mic, Upload } from 'lucide-react';
import { filesApi, entriesApi } from '../../api/client';
import type { AudioRecording } from '../../types';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import TranscriptEditor from './TranscriptEditor';
import toast from 'react-hot-toast';

interface AudioUploaderProps {
  entryId: string;
  projectId: string;
  recordings: AudioRecording[];
  onRecordingAdded: (rec: AudioRecording) => void;
  onTranscriptUpdated: (index: number, transcript: string, source: 'whisper' | 'manual') => void;
}

const ACCEPTED = {
  'audio/mpeg': ['.mp3'],
  'audio/mp4': ['.mp4', '.m4a'],
  'audio/wav': ['.wav'],
  'audio/webm': ['.webm'],
  'audio/ogg': ['.ogg'],
};

export default function AudioUploader({
  entryId,
  projectId,
  recordings,
  onRecordingAdded,
  onTranscriptUpdated,
}: AudioUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [showDropzone, setShowDropzone] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        setUploading(true);
        try {
          const res = await filesApi.upload(file, projectId);
          const { file_id, filename } = res.data;
          const recording: AudioRecording = {
            file_id,
            original_filename: filename,
          };
          await entriesApi.addRecording(entryId, recording);
          onRecordingAdded(recording);
          toast.success(`Audio uploaded: ${filename}`);
          setShowDropzone(false);
        } catch {
          // handled by interceptor
        } finally {
          setUploading(false);
        }
      }
    },
    [projectId, entryId, onRecordingAdded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: false,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="font-mono text-xs text-[#f59e0b] uppercase tracking-widest">
          Audio Recordings
        </label>
        <Button size="sm" variant="secondary" onClick={() => setShowDropzone(!showDropzone)}>
          <Mic size={12} className="mr-1" />
          Add Recording
        </Button>
      </div>

      {showDropzone && (
        <div
          {...getRootProps()}
          className={`border border-dashed p-4 text-center cursor-pointer transition-colors mb-3 ${
            isDragActive ? 'border-amber-500 bg-amber-500/5' : 'border-[#30363d] hover:border-[#484f58]'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <Spinner />
            ) : (
              <Upload size={16} className="text-gray-500" />
            )}
            <span className="text-xs text-gray-500 font-mono">
              {isDragActive ? 'Drop audio file' : 'Drop mp3, m4a, wav, webm — or click to browse'}
            </span>
          </div>
        </div>
      )}

      {recordings.map((rec, index) => (
        <TranscriptEditor
          key={rec.file_id}
          recording={rec}
          index={index}
          entryId={entryId}
          onTranscriptUpdated={onTranscriptUpdated}
        />
      ))}
    </div>
  );
}
