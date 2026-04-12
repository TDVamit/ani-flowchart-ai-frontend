import { useEffect, useState } from 'react';
import { settingsApi } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import type { LLMProvider } from '../types';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import TopBar from '../components/layout/TopBar';
import { CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { selectedProvider, selectedModel, setSelectedModel } = useAppStore();
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [whisperConfigured, setWhisperConfigured] = useState(false);
  const [localProvider, setLocalProvider] = useState(selectedProvider);
  const [localModel, setLocalModel] = useState(selectedModel);

  useEffect(() => {
    settingsApi.getModels().then((res) => {
      setProviders(res.data.providers);
      setWhisperConfigured(res.data.whisper_configured);
    });
  }, []);

  const handleSave = () => {
    setSelectedModel(localProvider, localModel);
    toast.success('Default model saved');
  };

  const currentProviderModels =
    providers.find((p) => p.id === localProvider)?.models || [];

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-auto">
      <TopBar title="Settings" />
      <div className="p-6 space-y-4 max-w-2xl">
        <Card title="LLM Provider">
          <div className="space-y-3">
            {providers.map((p) => (
              <div
                key={p.id}
                className={`border p-3 cursor-pointer transition-colors ${
                  localProvider === p.id
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-[#e2e8f0] hover:border-indigo-300'
                }`}
                onClick={() => {
                  setLocalProvider(p.id);
                  if (p.models[0]) setLocalModel(p.models[0].id);
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-[#1e293b]">{p.name}</span>
                  <div className="flex items-center gap-2">
                    {p.is_configured ? (
                      <div className="flex items-center gap-1 text-green-400">
                        <CheckCircle size={13} />
                        <span className="font-mono text-xs">Configured</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-400">
                        <XCircle size={13} />
                        <span className="font-mono text-xs">No API key</span>
                      </div>
                    )}
                  </div>
                </div>
                {localProvider === p.id && p.is_configured && (
                  <div>
                    <label className="block font-mono text-xs text-[#64748b] uppercase mb-1">
                      Model
                    </label>
                    <select
                      value={localModel}
                      onChange={(e) => setLocalModel(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-white border border-[#e2e8f0] text-[#1e293b] text-sm px-2 py-1.5 font-mono rounded focus:outline-none focus:border-indigo-400"
                    >
                      {p.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-[#e2e8f0]">
            <Button variant="primary" size="sm" onClick={handleSave}>
              Set as Default
            </Button>
          </div>
        </Card>

        <Card title="Transcription (Whisper)">
          <div className="flex items-center gap-2 mb-2">
            {whisperConfigured ? (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={13} />
                <span className="font-mono text-sm">OpenAI Whisper configured</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-400">
                <XCircle size={13} />
                <span className="font-mono text-sm">OpenAI API key not set</span>
              </div>
            )}
          </div>
          {!whisperConfigured && (
            <p className="text-xs text-[#64748b]">
              Set <code className="text-indigo-600">OPENAI_API_KEY</code> in{' '}
              <code className="text-indigo-600">backend/.env</code> to enable audio transcription.
              Manual transcript entry works without this.
            </p>
          )}
        </Card>

        <Card title="API Keys">
          <p className="text-sm text-[#64748b] leading-relaxed">
            API keys are configured in <code className="text-indigo-600 font-mono">backend/.env</code>.
            Restart the backend server after making changes.
          </p>
          <div className="mt-3 bg-[#f8fafc] border border-[#e2e8f0] rounded p-3 font-mono text-xs text-[#64748b]">
            <div>ANTHROPIC_API_KEY=your_key_here</div>
            <div>OPENAI_API_KEY=your_key_here</div>
            <div>GOOGLE_API_KEY=your_key_here</div>
          </div>
        </Card>

        <Card title="Current Default">
          <div className="flex items-center gap-3">
            <Badge variant="amber">{selectedProvider}</Badge>
            <span className="font-mono text-sm text-[#475569]">{selectedModel}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
