/**
 * Public summary page — no auth required.
 * Shows all daily inputs + current engagement progress.
 * Does NOT show next-day plans or priorities.
 */

import { useEffect, useState } from 'react';
import { summaryApi } from '../api/client';
import { format } from 'date-fns';
import { Mic2, FileText, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import Spinner from '../components/ui/Spinner';

interface SummaryProject {
  _id: string;
  brief: {
    engagement_name: string;
    client_name: string;
    fde_name: string;
    engagement_goal: string;
    deliverable_description: string;
    week_count: number;
    org_structure: string;
    core_hypothesis: string;
    key_contacts: { name: string; role: string; department: string; notes?: string }[];
  };
  current_week: number;
  current_day: number;
}

interface SummaryContext {
  cumulative_summary: string;
  key_findings: string[];
  confirmed_gaps: string[];
  open_questions: string[];
  stakeholder_insights: Record<string, string>;
  total_days_analyzed: number;
  last_updated?: string;
}

interface SummaryEntry {
  _id: string;
  entry_date: string;
  week_number: number;
  day_number: number;
  typed_findings: string;
  user_annotations: string;
  previous_plan_review: string;
  audio_recordings: {
    original_filename: string;
    interviewee_name?: string;
    interviewee_role?: string;
    transcript?: string;
    transcript_source?: string;
    notes?: string;
    duration_seconds?: number;
  }[];
  uploaded_documents: {
    original_filename: string;
    file_type: string;
    extracted_text?: string;
    user_annotation?: string;
  }[];
  analysis_completed: boolean;
}

interface SummaryReport {
  _id: string;
  report_date: string;
  week_number: number;
  day_number: number;
  llm_model: string;
  executive_summary: string;
  key_findings_today: string[];
  patterns_emerging: string;
  hypothesis_update: string;
  stakeholder_notes: string;
  risks_and_flags: string[];
  progress_summary: string;
}

interface ProjectOption {
  _id: string;
  engagement_name: string;
  client_name: string;
}

export default function Summary() {
  const [projectList, setProjectList] = useState<ProjectOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [project, setProject] = useState<SummaryProject | null>(null);
  const [context, setContext] = useState<SummaryContext | null>(null);
  const [entries, setEntries] = useState<SummaryEntry[]>([]);
  const [reports, setReports] = useState<SummaryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    summaryApi.listProjects().then((res) => {
      setProjectList(res.data);
      if (res.data.length > 0) setSelectedId(res.data[0]._id);
      else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    summaryApi.getProject(selectedId).then((res) => {
      setProject(res.data.project);
      setContext(res.data.context);
      setEntries(res.data.entries);
      setReports(res.data.reports);
      // Expand the most recent entry by default
      if (res.data.entries.length > 0) {
        const last = res.data.entries[res.data.entries.length - 1];
        setExpandedEntries(new Set([last._id]));
      }
      setLoading(false);
    });
  }, [selectedId]);

  const toggleEntry = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Map entry _id → report (for showing AI analysis inline)
  const reportByDate = Object.fromEntries(reports.map((r) => [r.report_date, r]));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center">
          <div className="font-mono text-amber-500 text-sm uppercase tracking-widest mb-2">
            No Projects Found
          </div>
          <p className="text-gray-600 text-sm font-mono">
            Create a project in the dashboard first.
          </p>
        </div>
      </div>
    );
  }

  const brief = project.brief;
  const totalDays = brief.week_count * 5;
  const daysElapsed = (project.current_week - 1) * 5 + project.current_day;

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-200">
      {/* Top bar */}
      <div className="border-b border-[#21262d] bg-[#161b22] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 flex-shrink-0" />
            <span className="font-mono text-xs font-bold text-white tracking-widest uppercase">
              Field Intel
            </span>
            <span className="text-gray-600 font-mono text-xs">/ Summary</span>
          </div>
          {projectList.length > 1 && (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-[#0f1117] border border-[#21262d] text-gray-300 text-xs font-mono px-2 py-1 focus:border-amber-500"
            >
              {projectList.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.engagement_name} — {p.client_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* ── Engagement header ── */}
        <div>
          <div className="font-mono text-xs text-amber-500 uppercase tracking-widest mb-1">
            {brief.client_name}
          </div>
          <h1 className="font-mono text-xl font-bold text-white mb-1">
            {brief.engagement_name}
          </h1>
          <div className="flex items-center gap-4 text-xs text-gray-500 font-mono flex-wrap">
            <span>FDE: {brief.fde_name}</span>
            <span>Week {project.current_week} of {brief.week_count} · Day {project.current_day}</span>
            <span>{daysElapsed}/{totalDays} days</span>
            {context && <span>{context.total_days_analyzed} days analyzed</span>}
          </div>
        </div>

        {/* ── Engagement goal + hypothesis ── */}
        <Section title="Engagement Goal">
          <p className="text-sm text-gray-300 leading-relaxed">{brief.engagement_goal}</p>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            <span className="text-gray-600">Deliverable: </span>
            {brief.deliverable_description}
          </p>
        </Section>

        {brief.core_hypothesis && (
          <Section title="Core Hypothesis">
            <p className="text-sm text-gray-300 leading-relaxed">{brief.core_hypothesis}</p>
          </Section>
        )}

        {/* ── Current progress (context store) ── */}
        {context && context.total_days_analyzed > 0 && (
          <Section title="Current Progress">
            {context.cumulative_summary && (
              <div className="mb-4">
                <FieldLabel>Cumulative Summary</FieldLabel>
                <p className="text-sm text-gray-300 leading-relaxed">{context.cumulative_summary}</p>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <FieldLabel>Key Findings ({context.key_findings?.length || 0})</FieldLabel>
                <BulletList items={context.key_findings} color="amber" />
              </div>
              <div>
                <FieldLabel>Confirmed Gaps ({context.confirmed_gaps?.length || 0})</FieldLabel>
                <BulletList items={context.confirmed_gaps} color="red" />
              </div>
              <div>
                <FieldLabel>Open Questions ({context.open_questions?.length || 0})</FieldLabel>
                <BulletList items={context.open_questions} color="blue" />
              </div>
            </div>

            {context.stakeholder_insights && Object.keys(context.stakeholder_insights).length > 0 && (
              <div>
                <FieldLabel>Stakeholder Insights</FieldLabel>
                <div className="space-y-2">
                  {Object.entries(context.stakeholder_insights).map(([name, insight]) => (
                    <div key={name} className="flex gap-3 text-sm">
                      <span className="text-amber-400 font-mono flex-shrink-0 w-32 truncate">{name}</span>
                      <span className="text-gray-400">{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {context.last_updated && (
              <p className="text-xs text-gray-600 font-mono mt-3">
                Context last updated: {format(new Date(context.last_updated), 'PPp')}
              </p>
            )}
          </Section>
        )}

        {/* ── Key contacts ── */}
        {brief.key_contacts?.length > 0 && (
          <Section title="Key Contacts">
            <div className="grid md:grid-cols-2 gap-3">
              {brief.key_contacts.map((c, i) => (
                <div key={i} className="border border-[#21262d] bg-[#161b22] px-3 py-2">
                  <div className="font-mono text-sm text-white">{c.name}</div>
                  <div className="text-xs text-amber-500">{c.role}</div>
                  <div className="text-xs text-gray-500">{c.department}</div>
                  {c.notes && <div className="text-xs text-gray-500 mt-1 italic">{c.notes}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Daily Entries ── */}
        <div>
          <SectionTitle title={`Daily Entries (${entries.length})`} />

          {entries.length === 0 && (
            <p className="text-sm text-gray-600 font-mono">No entries yet.</p>
          )}

          {[...entries].reverse().map((entry) => {
            const report = reportByDate[entry.entry_date];
            const isExpanded = expandedEntries.has(entry._id);

            return (
              <div key={entry._id} className="border border-[#21262d] mb-3">
                {/* Entry header */}
                <button
                  className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors bg-[#161b22]"
                  onClick={() => toggleEntry(entry._id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5">
                      W{entry.week_number}·D{entry.day_number}
                    </span>
                    <span className="font-mono text-sm text-white">
                      {entry.entry_date
                        ? format(new Date(entry.entry_date + 'T00:00:00'), 'EEEE, MMMM d')
                        : entry.entry_date}
                    </span>
                    <span className="text-xs text-gray-600 font-mono">
                      {entry.audio_recordings?.length > 0 && `${entry.audio_recordings.length} rec · `}
                      {entry.uploaded_documents?.length > 0 && `${entry.uploaded_documents.length} docs · `}
                      {entry.analysis_completed ? '✓ analyzed' : 'not analyzed'}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-gray-500" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 py-4 space-y-5 bg-[#0f1117] border-t border-[#21262d]">

                    {/* Plan review */}
                    {entry.previous_plan_review && (
                      <div>
                        <FieldLabel>Plan Review</FieldLabel>
                        <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                          {entry.previous_plan_review}
                        </p>
                      </div>
                    )}

                    {/* Typed findings */}
                    {entry.typed_findings && (
                      <div>
                        <FieldLabel>Field Findings</FieldLabel>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                          {entry.typed_findings}
                        </p>
                      </div>
                    )}

                    {/* Annotations */}
                    {entry.user_annotations && (
                      <div>
                        <FieldLabel>Annotations & Hunches</FieldLabel>
                        <p className="text-sm text-gray-400 italic leading-relaxed whitespace-pre-wrap">
                          {entry.user_annotations}
                        </p>
                      </div>
                    )}

                    {/* Audio transcripts */}
                    {entry.audio_recordings?.length > 0 && (
                      <div>
                        <FieldLabel>Recordings & Transcripts</FieldLabel>
                        <div className="space-y-3">
                          {entry.audio_recordings.map((rec, i) => (
                            <div key={i} className="border border-[#21262d] bg-[#161b22] p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Mic2 size={12} className="text-amber-500" />
                                <span className="font-mono text-xs text-gray-300">
                                  {rec.interviewee_name
                                    ? `${rec.interviewee_name}${rec.interviewee_role ? ` — ${rec.interviewee_role}` : ''}`
                                    : rec.original_filename}
                                </span>
                                {rec.duration_seconds && (
                                  <span className="text-xs text-gray-600 font-mono">
                                    {Math.round(rec.duration_seconds)}s
                                  </span>
                                )}
                                {rec.transcript_source && (
                                  <span className="text-xs text-gray-600 font-mono">
                                    [{rec.transcript_source}]
                                  </span>
                                )}
                              </div>
                              {rec.notes && (
                                <p className="text-xs text-gray-500 italic mb-2">{rec.notes}</p>
                              )}
                              {rec.transcript ? (
                                <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                                  {rec.transcript}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-600 italic">No transcript available</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documents */}
                    {entry.uploaded_documents?.length > 0 && (
                      <div>
                        <FieldLabel>Documents</FieldLabel>
                        <div className="space-y-2">
                          {entry.uploaded_documents.map((doc, i) => (
                            <div key={i} className="border border-[#21262d] bg-[#161b22] p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <FileText size={12} className="text-gray-400" />
                                <span className="font-mono text-xs text-gray-300">
                                  {doc.original_filename}
                                </span>
                                <span className="text-xs text-gray-600 uppercase font-mono">
                                  {doc.file_type}
                                </span>
                              </div>
                              {doc.user_annotation && (
                                <p className="text-xs text-gray-500 italic">{doc.user_annotation}</p>
                              )}
                              {doc.extracted_text && (
                                <details className="mt-2">
                                  <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 font-mono">
                                    View extracted text
                                  </summary>
                                  <pre className="mt-2 text-xs text-gray-500 bg-[#0f1117] border border-[#21262d] p-2 overflow-auto max-h-48 whitespace-pre-wrap">
                                    {doc.extracted_text.slice(0, 3000)}
                                    {doc.extracted_text.length > 3000 ? '\n...[truncated]' : ''}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Analysis for this day (no next-day data) */}
                    {report && (
                      <div className="border-t border-[#21262d] pt-4 space-y-4">
                        <div className="font-mono text-xs text-amber-500 uppercase tracking-wider">
                          AI Analysis · {report.llm_model}
                        </div>

                        {report.executive_summary && (
                          <div>
                            <FieldLabel>Executive Summary</FieldLabel>
                            <p className="text-sm text-gray-300 leading-relaxed">
                              {report.executive_summary}
                            </p>
                          </div>
                        )}

                        {report.key_findings_today?.length > 0 && (
                          <div>
                            <FieldLabel>Key Findings</FieldLabel>
                            <BulletList items={report.key_findings_today} color="amber" />
                          </div>
                        )}

                        {report.patterns_emerging && (
                          <div>
                            <FieldLabel>Patterns Emerging</FieldLabel>
                            <p className="text-sm text-gray-300 leading-relaxed">
                              {report.patterns_emerging}
                            </p>
                          </div>
                        )}

                        {report.hypothesis_update && (
                          <div>
                            <FieldLabel>Hypothesis Update</FieldLabel>
                            <p className="text-sm text-gray-400 leading-relaxed">
                              {report.hypothesis_update}
                            </p>
                          </div>
                        )}

                        {report.stakeholder_notes && (
                          <div>
                            <FieldLabel>Stakeholder Notes</FieldLabel>
                            <p className="text-sm text-gray-400 leading-relaxed">
                              {report.stakeholder_notes}
                            </p>
                          </div>
                        )}

                        {report.risks_and_flags?.length > 0 && (
                          <div>
                            <FieldLabel>Risks & Flags</FieldLabel>
                            <ul className="space-y-1">
                              {report.risks_and_flags.map((r, i) => (
                                <li key={i} className="flex gap-2 text-sm text-red-300">
                                  <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {report.progress_summary && (
                          <div>
                            <FieldLabel>Progress Summary</FieldLabel>
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                              {report.progress_summary}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#21262d] pt-4 pb-8 text-xs text-gray-600 font-mono">
          Field Intel — Audit Intelligence Dashboard
        </div>
      </div>
    </div>
  );
}

// ── Small layout helpers ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#161b22] border border-[#21262d] p-5">
      <SectionTitle title={title} />
      {children}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="font-mono text-xs text-[#f59e0b] uppercase tracking-widest mb-3">{title}</div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-1">{children}</div>
  );
}

function BulletList({
  items,
  color,
}: {
  items: string[];
  color: 'amber' | 'red' | 'blue';
}) {
  const dot =
    color === 'amber'
      ? 'text-amber-500'
      : color === 'red'
      ? 'text-red-400'
      : 'text-blue-400';

  if (!items?.length) return <p className="text-xs text-gray-600 font-mono">None.</p>;

  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-gray-300">
          <span className={`${dot} flex-shrink-0 font-mono text-xs mt-0.5`}>•</span>
          {item}
        </li>
      ))}
    </ul>
  );
}
