/**
 * BriefFieldUploader
 * Compact inline file/audio uploader for ProjectBrief fields.
 * Supports docs (PDF, DOCX, TXT) and audio (MP3, M4A, WAV) with transcription.
 */
import { useRef, useState } from 'react'
import { Paperclip, Mic, Trash2, ChevronDown, ChevronUp, Loader2, FileText, Volume2 } from 'lucide-react'
import { filesApi, transcriptionApi } from '../../api/client'
import toast from 'react-hot-toast'

interface BriefFile {
  file_id:           string
  original_filename: string
  file_type:         string
  extracted_text?:   string
  user_annotation?:  string
  uploaded_at:       string
}

interface Props {
  projectId:    string
  fieldKey:     string
  /** Called when a doc/audio is uploaded so parent can append extracted/transcribed text */
  onTextExtracted?: (text: string) => void
  initialFiles?: BriefFile[]
}

const DOC_TYPES   = ['pdf', 'txt', 'docx', 'csv']
const AUDIO_TYPES = ['mp3', 'm4a', 'wav', 'webm', 'ogg', 'mp4']

function isAudio(type: string) { return AUDIO_TYPES.includes(type.toLowerCase()) }
function isDoc(type: string)   { return DOC_TYPES.includes(type.toLowerCase()) }

export default function BriefFieldUploader({ projectId, fieldKey, onTextExtracted, initialFiles = [] }: Props) {
  const [files,       setFiles]       = useState<BriefFile[]>(initialFiles)
  const [uploading,   setUploading]   = useState(false)
  const [expanded,    setExpanded]    = useState(false)
  const [transcribing, setTranscribing] = useState<string | null>(null)
  const [showText,    setShowText]    = useState<string | null>(null)
  const docRef   = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const res = await filesApi.upload(file, projectId, undefined, fieldKey)
      const { file_id, filename, file_type, has_extracted_text } = res.data
      const newFile: BriefFile = {
        file_id,
        original_filename: filename,
        file_type,
        uploaded_at: new Date().toISOString(),
      }
      setFiles((f) => [...f, newFile])
      setExpanded(true)
      toast.success(`Uploaded ${filename}`)

      if (has_extracted_text && onTextExtracted) {
        // Fetch extracted text and offer to append
        const urlRes = await filesApi.getDownloadUrl(file_id)
        toast(`Text extracted — use "Append" to add it to the field`, { icon: '📄', duration: 4000 })
        // Re-fetch file list to get extracted_text
        const filesRes = await filesApi.getBriefFiles(projectId)
        const fieldFiles: BriefFile[] = filesRes.data[fieldKey] ?? []
        setFiles(fieldFiles)
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleTranscribe(file: BriefFile) {
    setTranscribing(file.file_id)
    try {
      const res = await transcriptionApi.transcribeFromR2(file.file_id)
      const text = res.data?.transcript || res.data?.text || ''
      if (text && onTextExtracted) {
        onTextExtracted(text)
        toast.success('Transcribed — appended to field')
      } else {
        toast('No transcript returned', { icon: '⚠️' })
      }
    } catch {
      // handled by interceptor
    } finally {
      setTranscribing(null)
    }
  }

  async function handleDelete(file: BriefFile) {
    try {
      await filesApi.delete(file.file_id)
      setFiles((f) => f.filter((x) => x.file_id !== file.file_id))
      toast.success('Removed')
    } catch {
      // handled
    }
  }

  async function handleAppendExtracted(file: BriefFile) {
    if (!file.extracted_text) {
      // Try refetching
      const filesRes = await filesApi.getBriefFiles(projectId)
      const fieldFiles: BriefFile[] = filesRes.data[fieldKey] ?? []
      const updated = fieldFiles.find((f) => f.file_id === file.file_id)
      if (updated?.extracted_text && onTextExtracted) {
        onTextExtracted(updated.extracted_text)
        toast.success('Text appended to field')
        setFiles(fieldFiles)
      }
    } else if (onTextExtracted) {
      onTextExtracted(file.extracted_text)
      toast.success('Text appended to field')
    }
  }

  const count = files.length

  return (
    <div style={{ marginTop: 4 }}>
      {/* Trigger row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Doc upload button */}
        <button
          type="button"
          title="Attach document (PDF, DOCX, TXT)"
          disabled={uploading}
          onClick={() => docRef.current?.click()}
          style={{
            display:     'flex', alignItems: 'center', gap: 4,
            padding:     '3px 8px',
            background:  '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 4, cursor: 'pointer',
            fontSize:    10, color: '#64748b',
            fontFamily:  'IBM Plex Mono, monospace',
            transition:  'all .12s',
          }}
          onMouseEnter={(e) => { (e.currentTarget).style.borderColor = '#6366f1'; (e.currentTarget).style.color = '#6366f1' }}
          onMouseLeave={(e) => { (e.currentTarget).style.borderColor = '#e2e8f0'; (e.currentTarget).style.color = '#64748b' }}
        >
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
          Doc
        </button>

        {/* Audio upload button */}
        <button
          type="button"
          title="Attach audio (MP3, M4A, WAV) — will auto-transcribe"
          disabled={uploading}
          onClick={() => audioRef.current?.click()}
          style={{
            display:     'flex', alignItems: 'center', gap: 4,
            padding:     '3px 8px',
            background:  '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 4, cursor: 'pointer',
            fontSize:    10, color: '#64748b',
            fontFamily:  'IBM Plex Mono, monospace',
            transition:  'all .12s',
          }}
          onMouseEnter={(e) => { (e.currentTarget).style.borderColor = '#6366f1'; (e.currentTarget).style.color = '#6366f1' }}
          onMouseLeave={(e) => { (e.currentTarget).style.borderColor = '#e2e8f0'; (e.currentTarget).style.color = '#64748b' }}
        >
          <Mic size={11} />
          Audio
        </button>

        {/* File count badge + expand toggle */}
        {count > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              display:     'flex', alignItems: 'center', gap: 3,
              padding:     '2px 7px',
              background:  '#eef2ff', border: '1px solid #c7d2fe',
              borderRadius: 10, cursor: 'pointer',
              fontSize:    10, color: '#6366f1',
              fontFamily:  'IBM Plex Mono, monospace',
            }}
          >
            {count} file{count !== 1 ? 's' : ''}
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={docRef}
        type="file"
        hidden
        accept=".pdf,.txt,.docx,.csv"
        onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = '' }}
      />
      <input
        ref={audioRef}
        type="file"
        hidden
        accept=".mp3,.m4a,.wav,.webm,.ogg,.mp4"
        onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = '' }}
      />

      {/* File list */}
      {expanded && count > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map((file) => (
            <div key={file.file_id} style={{
              background:   '#f8fafc',
              border:       '1px solid #e2e8f0',
              borderRadius:  4,
              padding:      '6px 8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isAudio(file.file_type)
                  ? <Volume2 size={12} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                  : <FileText size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
                }
                <span style={{
                  flex: 1, fontSize: 11, color: '#1e293b',
                  fontFamily: 'IBM Plex Mono, monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {file.original_filename}
                </span>
                <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' }}>
                  {file.file_type}
                </span>

                {/* Audio: transcribe button */}
                {isAudio(file.file_type) && onTextExtracted && (
                  <button
                    type="button"
                    onClick={() => handleTranscribe(file)}
                    disabled={transcribing === file.file_id}
                    title="Transcribe and append to field"
                    style={{
                      padding:     '2px 6px',
                      background:  '#f5f3ff', border: '1px solid #ddd6fe',
                      borderRadius: 3, cursor: 'pointer',
                      fontSize:    9, color: '#7c3aed',
                      fontFamily:  'IBM Plex Mono, monospace',
                      display:     'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    {transcribing === file.file_id
                      ? <Loader2 size={9} className="animate-spin" />
                      : <Mic size={9} />}
                    Transcribe
                  </button>
                )}

                {/* Doc: append extracted text */}
                {isDoc(file.file_type) && onTextExtracted && (
                  <button
                    type="button"
                    onClick={() => handleAppendExtracted(file)}
                    title="Append extracted text to field"
                    style={{
                      padding:     '2px 6px',
                      background:  '#eef2ff', border: '1px solid #c7d2fe',
                      borderRadius: 3, cursor: 'pointer',
                      fontSize:    9, color: '#4338ca',
                      fontFamily:  'IBM Plex Mono, monospace',
                      display:     'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    ↓ Append
                  </button>
                )}

                {/* View extracted text toggle */}
                {file.extracted_text && (
                  <button
                    type="button"
                    onClick={() => setShowText(showText === file.file_id ? null : file.file_id)}
                    style={{
                      padding:     '2px 5px',
                      background:  'transparent', border: '1px solid #e2e8f0',
                      borderRadius: 3, cursor: 'pointer',
                      fontSize:    9, color: '#64748b',
                    }}
                  >
                    {showText === file.file_id ? 'Hide' : 'Text'}
                  </button>
                )}

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(file)}
                  title="Remove attachment"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8' }}
                >
                  <Trash2 size={11} />
                </button>
              </div>

              {/* Extracted text preview */}
              {showText === file.file_id && file.extracted_text && (
                <pre style={{
                  marginTop:   6,
                  padding:    '6px 8px',
                  background: '#f1f5f9',
                  border:     '1px solid #e2e8f0',
                  borderRadius: 3,
                  fontSize:   10,
                  color:      '#475569',
                  fontFamily: 'IBM Plex Mono, monospace',
                  maxHeight:  120,
                  overflowY:  'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak:  'break-word',
                }}>
                  {file.extracted_text}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
