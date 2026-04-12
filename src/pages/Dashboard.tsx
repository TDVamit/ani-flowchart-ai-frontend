import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { analysisApi, projectsApi, entriesApi, settingsApi } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import type { DailyReport, DailyEntry, ContextStore, LLMProvider } from '../types';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import TopBar from '../components/layout/TopBar';
import { format } from 'date-fns';
import { Play, Plus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeProjectId, projects, selectedProvider, selectedModel, setSelectedModel } =
    useAppStore();
  const activeProject = projects.find((p) => p._id === activeProjectId);

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [todayEntry, setTodayEntry] = useState<DailyEntry | null>(null);
  const [context, setContext] = useState<ContextStore | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [localProvider, setLocalProvider] = useState(selectedProvider);
  const [localModel, setLocalModel] = useState(selectedModel);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!activeProjectId) return;
    Promise.all([
      analysisApi.listReports(activeProjectId),
      entriesApi.listByProject(activeProjectId),
      projectsApi.getContext(activeProjectId),
      settingsApi.getModels(),
    ]).then(([rRes, eRes, cRes, mRes]) => {
      setReports(rRes.data);
      const entry = eRes.data.find((e: DailyEntry) => e.entry_date === today);
      setTodayEntry(entry || null);
      setContext(cRes.data);
      setProviders(mRes.data.providers);
    });
  }, [activeProjectId, today]);

  const handleTriggerAnalysis = async () => {
    if (!todayEntry?._id || !activeProjectId) return;
    setAnalysisRunning(true);
    setSelectedModel(localProvider, localModel);
    try {
      const res = await analysisApi.trigger({
        project_id: activeProjectId,
        entry_id: todayEntry._id,
        llm_provider: localProvider,
        llm_model: localModel,
        extra_prompt: extraPrompt || undefined,
      });
      const jobId = res.data.job_id;
      setShowAnalysisModal(false);
      toast('Analysis running in background...', { icon: '⚙️' });

      pollRef.current = setInterval(async () => {
        const statusRes = await analysisApi.getStatus(jobId);
        const { status, report_id, error } = statusRes.data;
        if (status === 'completed') {
          clearInterval(pollRef.current!);
          setAnalysisRunning(false);
          toast.success('Analysis complete!');
          // Refresh
          const [rRes, cRes] = await Promise.all([
            analysisApi.listReports(activeProjectId),
            projectsApi.getContext(activeProjectId),
          ]);
          setReports(rRes.data);
          setContext(cRes.data);
          setTodayEntry((e) => e ? { ...e, analysis_completed: true } : e);
        } else if (status === 'failed') {
          clearInterval(pollRef.current!);
          setAnalysisRunning(false);
          toast.error(`Analysis failed: ${error}`);
        }
      }, 3000);
    } catch {
      setAnalysisRunning(false);
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (!activeProjectId || !activeProject) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc]">
        <div className="text-center">
          <div className="font-mono text-amber-500 text-sm uppercase tracking-widest mb-3">
            No Active Project
          </div>
          <p className="text-gray-500 text-sm mb-6">
            Create your first engagement to get started.
          </p>
          <Button variant="primary" onClick={() => navigate('/project-brief')}>
            <Plus size={14} className="mr-2" />
            Create Project
          </Button>
        </div>
      </div>
    );
  }

  const brief = activeProject.brief;
  const totalDays = brief.week_count * 5;
  const daysElapsed =
    (activeProject.current_week - 1) * 5 + activeProject.current_day;
  const daysRemaining = totalDays - daysElapsed;
  const canRunAnalysis =
    todayEntry && todayEntry.typed_findings?.trim() && !todayEntry.analysis_completed;

  const modelsForProvider = providers.find((p) => p.id === localProvider)?.models || [];

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-auto">
      <TopBar
        title="Dashboard"
        subtitle={brief.engagement_name}
        actions={
          <Button
            variant="primary"
            disabled={!canRunAnalysis || analysisRunning}
            onClick={() => setShowAnalysisModal(true)}
          >
            {analysisRunning ? (
              <Spinner className="mr-2" />
            ) : (
              <Play size={13} className="mr-2" />
            )}
            Run End-of-Day Analysis
          </Button>
        }
      />

      <div className="p-6 space-y-4 max-w-4xl">
        {/* Project summary */}
        <Card title="Active Engagement">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 font-mono uppercase mb-1">Client</div>
              <div className="text-sm text-[#1e293b]">{brief.client_name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-mono uppercase mb-1">Position</div>
              <div className="text-sm text-[#1e293b] font-mono">
                W{activeProject.current_week} · D{activeProject.current_day}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-mono uppercase mb-1">Days Remaining</div>
              <div className="text-sm font-mono text-indigo-600">{daysRemaining}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-mono uppercase mb-1">FDE</div>
              <div className="text-sm text-[#1e293b]">{brief.fde_name}</div>
            </div>
          </div>
          {brief.core_hypothesis && (
            <div className="mt-3 pt-3 border-t border-[#e2e8f0]">
              <div className="text-xs text-gray-500 font-mono uppercase mb-1">Core Hypothesis</div>
              <p className="text-sm text-[#475569] line-clamp-2">{brief.core_hypothesis}</p>
            </div>
          )}
        </Card>

        {/* Today's entry status */}
        <Card title="Today's Entry">
          {todayEntry ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant={todayEntry.analysis_completed ? 'green' : 'amber'}>
                  {todayEntry.analysis_completed ? 'Analysis Complete' : 'Pending Analysis'}
                </Badge>
                <span className="text-xs text-gray-500 font-mono">
                  {todayEntry.typed_findings?.length || 0} chars · {todayEntry.audio_recordings?.length || 0} recordings · {todayEntry.uploaded_documents?.length || 0} docs
                </span>
              </div>
              <Button size="sm" variant="secondary" onClick={() => navigate('/daily-input')}>
                Edit Entry
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">No entry for today yet.</span>
              <Button size="sm" variant="primary" onClick={() => navigate('/daily-input')}>
                <Plus size={12} className="mr-1" />
                Start Today's Entry
              </Button>
            </div>
          )}
        </Card>

        {/* Context health */}
        {context && (
          <Card title="Context Health">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-indigo-600">
                  {context.total_days_analyzed}
                </div>
                <div className="font-mono text-xs text-gray-500 uppercase mt-1">Days Analyzed</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-red-400">
                  {context.confirmed_gaps?.length || 0}
                </div>
                <div className="font-mono text-xs text-gray-500 uppercase mt-1">Confirmed Gaps</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-xl font-bold text-blue-400">
                  {context.open_questions?.length || 0}
                </div>
                <div className="font-mono text-xs text-gray-500 uppercase mt-1">Open Questions</div>
              </div>
            </div>
            {context.last_updated && (
              <div className="text-xs text-gray-600 font-mono mt-3">
                Last updated: {format(new Date(context.last_updated), 'PPp')}
              </div>
            )}
          </Card>
        )}

        {/* Recent reports */}
        <div>
          <div className="font-mono text-xs text-indigo-600 uppercase tracking-widest mb-2">
            Recent Reports
          </div>
          {reports.length === 0 ? (
            <div className="text-sm text-gray-600 font-mono py-4">No reports yet.</div>
          ) : (
            <div className="space-y-2">
              {reports.slice(0, 5).map((r) => (
                <div key={r._id} className="border border-[#e2e8f0] bg-white">
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                    onClick={() =>
                      setExpandedReport(expandedReport === r._id ? null : r._id)
                    }
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <Badge variant="amber">W{r.week_number}·D{r.day_number}</Badge>
                      <span className="font-mono text-xs text-gray-500">{r.report_date}</span>
                    </div>
                    <p className="text-sm text-[#475569] line-clamp-2">{r.executive_summary}</p>
                    {r.tomorrow_priorities?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.tomorrow_priorities.slice(0, 3).map((p, i) => (
                          <span
                            key={i}
                            className="font-mono text-xs bg-[#f8fafc] text-gray-500 border border-[#e2e8f0] px-2 py-0.5"
                          >
                            {p.slice(0, 40)}{p.length > 40 ? '…' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                  {expandedReport === r._id && (
                    <div className="border-t border-[#e2e8f0] px-4 py-3">
                      <div className="space-y-3 text-sm text-[#475569]">
                        <div>
                          <div className="font-mono text-xs text-gray-500 uppercase mb-1">Patterns</div>
                          <p>{r.patterns_emerging}</p>
                        </div>
                        {r.risks_and_flags?.length > 0 && (
                          <div>
                            <div className="font-mono text-xs text-gray-500 uppercase mb-1">Risks & Flags</div>
                            <ul className="space-y-1">
                              {r.risks_and_flags.map((flag, i) => (
                                <li key={i} className="flex gap-2 text-red-300">
                                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-red-400" />
                                  {flag}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div>
                          <div className="font-mono text-xs text-gray-500 uppercase mb-1">Tomorrow's Plan</div>
                          <p>{r.tomorrow_plan}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Analysis modal */}
      <Modal
        open={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        title="Run End-of-Day Analysis"
      >
        <div className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-gray-400 uppercase mb-1">
              LLM Provider
            </label>
            <select
              value={localProvider}
              onChange={(e) => {
                setLocalProvider(e.target.value);
                const prov = providers.find((p) => p.id === e.target.value);
                if (prov?.models[0]) setLocalModel(prov.models[0].id);
              }}
              className="w-full bg-white border border-[#e2e8f0] text-[#1e293b] text-sm px-3 py-2 font-mono rounded focus:outline-none focus:border-indigo-400"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.is_configured}>
                  {p.name} {!p.is_configured ? '(not configured)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-gray-400 uppercase mb-1">
              Model
            </label>
            <select
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              className="w-full bg-white border border-[#e2e8f0] text-[#1e293b] text-sm px-3 py-2 font-mono rounded focus:outline-none focus:border-indigo-400"
            >
              {modelsForProvider.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs text-gray-400 uppercase mb-1">
              Additional Focus (optional)
            </label>
            <textarea
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder="Anything specific you want the AI to focus on today?"
              className="w-full bg-white border border-[#e2e8f0] text-[#1e293b] text-sm px-3 py-2 min-h-[80px] resize-y placeholder-gray-400 rounded focus:outline-none focus:border-indigo-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAnalysisModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleTriggerAnalysis}>
              <Play size={13} className="mr-1" />
              Run Analysis
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
