import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, X } from 'lucide-react';
import { filesApi, entriesApi } from '../../api/client';
import type { UploadedDocument } from '../../types';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import toast from 'react-hot-toast';

interface FileUploaderProps {
  projectId: string;
  entryId: string;
  documents: UploadedDocument[];
  onDocumentAdded: (doc: UploadedDocument) => void;
}

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
};

export default function FileUploader({
  projectId,
  entryId,
  documents,
  onDocumentAdded,
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [expandedText, setExpandedText] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        setUploading(true);
        try {
          const res = await filesApi.upload(file, projectId);
          const { file_id, filename, file_type, has_extracted_text } = res.data;
          const doc: UploadedDocument = {
            file_id,
            original_filename: filename,
            file_type,
          };
          await entriesApi.addDocument(entryId, doc);
          onDocumentAdded(doc);
          toast.success(`Uploaded ${filename}`);
          if (has_extracted_text) {
            toast(`PDF text extracted for ${filename}`, { icon: '📄' });
          }
        } catch {
          // error handled by interceptor
        } finally {
          setUploading(false);
        }
      }
    },
    [projectId, entryId, onDocumentAdded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  const getIcon = (type: string) => {
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(type)) return <Image size={14} />;
    return <FileText size={14} />;
  };

  return (
    <div>
      <label className="block font-mono text-xs text-[#f59e0b] uppercase tracking-widest mb-2">
        Documents & Images
      </label>

      <div
        {...getRootProps()}
        className={`border border-dashed p-6 text-center cursor-pointer transition-colors mb-3 ${
          isDragActive ? 'border-amber-500 bg-amber-500/5' : 'border-[#30363d] hover:border-[#484f58]'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <Spinner />
          ) : (
            <Upload size={20} className="text-gray-500" />
          )}
          <span className="text-xs text-gray-500 font-mono">
            {isDragActive ? 'Drop files here' : 'Drag PDFs, images, or text files — or click to browse'}
          </span>
        </div>
      </div>

      {documents.map((doc) => (
        <div key={doc.file_id} className="border border-[#21262d] bg-[#161b22] mb-2">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-gray-400">{getIcon(doc.file_type)}</span>
            <span className="text-sm text-gray-200 flex-1 truncate font-mono text-xs">
              {doc.original_filename}
            </span>
            <span className="text-xs text-gray-600 uppercase font-mono">{doc.file_type}</span>
          </div>
          <div className="px-3 pb-2 border-t border-[#21262d] pt-2">
            <input
              type="text"
              placeholder="Add annotation (why did you upload this?)"
              value={annotations[doc.file_id] || doc.user_annotation || ''}
              onChange={(e) =>
                setAnnotations((a) => ({ ...a, [doc.file_id]: e.target.value }))
              }
              className="w-full text-xs bg-[#0f1117] border border-[#21262d] text-gray-300 px-2 py-1 focus:border-amber-500 placeholder-gray-600"
            />
          </div>
          {doc.extracted_text && (
            <div className="px-3 pb-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setExpandedText(expandedText === doc.file_id ? null : doc.file_id)
                }
              >
                {expandedText === doc.file_id ? 'Hide' : 'View'} extracted text
              </Button>
              {expandedText === doc.file_id && (
                <pre className="mt-2 text-xs text-gray-400 bg-[#0f1117] border border-[#21262d] p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                  {doc.extracted_text}
                </pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
