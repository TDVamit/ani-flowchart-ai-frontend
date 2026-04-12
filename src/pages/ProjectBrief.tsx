import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi, filesApi } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import type { ProjectBrief, KeyContact, ContextStore } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import BriefFieldUploader from '../components/ui/BriefFieldUploader';
import { Plus, Trash2, Save, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyBrief: ProjectBrief = {
  engagement_name:        '',
  client_name:            '',
  fde_name:               '',
  engagement_goal:        '',
  deliverable_description:'',
  week_count:             4,
  key_contacts:           [],
  org_structure:          '',
  core_hypothesis:        '',
  custom_context:         '',
};

// ── Tiny field helpers ────────────────────────────────────────────────────────

const inputCls = `w-full bg-white border border-[#e2e8f0] text-[#1e293b] text-sm px-3 py-2
  focus:outline-none focus:border-indigo-400 placeholder-gray-400 rounded transition-colors`

const textareaCls = `w-full bg-white border border-[#e2e8f0] text-[#1e293b] text-sm px-3 py-2 resize-y
  focus:outline-none focus:border-indigo-400 placeholder-gray-400 rounded transition-colors`

function SectionCard({ title, children, collapsible = false }: {
  title: string
  children: React.ReactNode
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3 text-left"
        onClick={() => collapsible && setOpen((v) => !v)}
        style={{ cursor: collapsible ? 'pointer' : 'default' }}
      >
        <span className="font-mono text-xs font-bold text-indigo-600 uppercase tracking-widest">{title}</span>
        {collapsible && (open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />)}
      </button>
      {open && <div className="px-5 pb-5 pt-1 space-y-4">{children}</div>}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block font-mono text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
      {children}
    </label>
  )
}

export default function ProjectBriefPage() {
  const navigate     = useNavigate();
  const { activeProjectId, setActiveProject, setProjects } = useAppStore();
  const [brief,    setBrief]    = useState<ProjectBrief>(emptyBrief);
  const [context,  setContext]  = useState<ContextStore | null>(null);
  const [briefFiles, setBriefFiles] = useState<Record<string, any[]>>({});
  const [isNew,    setIsNew]    = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (!activeProjectId) { setIsNew(true); return; }
    projectsApi.get(activeProjectId).then((res) => setBrief(res.data.brief));
    projectsApi.getContext(activeProjectId).then((res) => setContext(res.data));
    filesApi.getBriefFiles(activeProjectId).then((res) => setBriefFiles(res.data || {}));
  }, [activeProjectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const res = await projectsApi.create({ brief, current_week: 1, current_day: 1 });
        const newId = res.data.id;
        const listRes = await projectsApi.list();
        setProjects(listRes.data);
        setActiveProject(newId);
        toast.success('Project created!');
        navigate('/daily-input');
      } else {
        await projectsApi.updateBrief(activeProjectId!, brief);
        toast.success('Brief saved');
      }
    } finally { setSaving(false); }
  };

  const addContact = () =>
    setBrief((b) => ({ ...b, key_contacts: [...b.key_contacts, { name: '', role: '', department: '', notes: '' }] }));

  const updateContact = (i: number, f: keyof KeyContact, v: string) => {
    const contacts = [...brief.key_contacts];
    contacts[i] = { ...contacts[i], [f]: v };
    setBrief((b) => ({ ...b, key_contacts: contacts }));
  };

  const removeContact = (i: number) =>
    setBrief((b) => ({ ...b, key_contacts: b.key_contacts.filter((_, idx) => idx !== i) }));

  const appendToField = (field: keyof ProjectBrief) => (text: string) =>
    setBrief((b) => ({ ...b, [field]: ((b[field] as string) || '') + (b[field] ? '\n\n' : '') + text }));

  const handleResetContext = async () => {
    if (!activeProjectId) return;
    await projectsApi.resetContext(activeProjectId);
    setContext(null);
    setShowResetConfirm(false);
    toast.success('Context store reset');
  };

  // Refreshes brief file list after upload
  const refreshBriefFiles = () => {
    if (activeProjectId) {
      filesApi.getBriefFiles(activeProjectId).then((res) => setBriefFiles(res.data || {}));
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#e2e8f0] px-6 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="font-mono text-sm font-bold text-[#1e293b] tracking-wide">
            {isNew ? 'New Project' : 'Project Brief'}
          </h1>
          {!isNew && activeProjectId && (
            <p className="font-mono text-xs text-gray-400 mt-0.5">{brief.client_name || '—'}</p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-semibold rounded transition-colors disabled:opacity-60"
        >
          <Save size={13} />
          {saving ? 'Saving…' : isNew ? 'Create Project' : 'Save Changes'}
        </button>
      </div>

      <div className="p-6 space-y-5 max-w-3xl">
        {isNew && (
          <div className="border border-indigo-200 bg-indigo-50 rounded-lg px-4 py-3">
            <p className="text-indigo-700 font-mono text-xs leading-relaxed">
              Fill out the project brief to get started. This information is included in every AI analysis session.
            </p>
          </div>
        )}

        {/* Engagement Details */}
        <SectionCard title="Engagement Details">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Engagement Name</FieldLabel>
              <input className={inputCls} placeholder="e.g. Q2 Ops Audit — Acme" value={brief.engagement_name}
                onChange={(e) => setBrief((b) => ({ ...b, engagement_name: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Client Name</FieldLabel>
              <input className={inputCls} placeholder="e.g. Acme Corporation" value={brief.client_name}
                onChange={(e) => setBrief((b) => ({ ...b, client_name: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>FDE Name</FieldLabel>
              <input className={inputCls} placeholder="Your name" value={brief.fde_name}
                onChange={(e) => setBrief((b) => ({ ...b, fde_name: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Engagement Length (weeks)</FieldLabel>
              <input type="number" className={inputCls} value={brief.week_count}
                onChange={(e) => setBrief((b) => ({ ...b, week_count: parseInt(e.target.value) || 4 }))} />
            </div>
          </div>
        </SectionCard>

        {/* Engagement Scope */}
        <SectionCard title="Engagement Scope">
          <div>
            <div className="flex items-center justify-between mb-1">
              <FieldLabel>Engagement Goal</FieldLabel>
              {!isNew && activeProjectId && (
                <BriefFieldUploader
                  projectId={activeProjectId}
                  fieldKey="engagement_goal"
                  initialFiles={briefFiles['engagement_goal'] || []}
                  onTextExtracted={appendToField('engagement_goal')}
                />
              )}
            </div>
            <textarea className={textareaCls} rows={3}
              placeholder="1–3 sentences: what is this engagement trying to deliver?"
              value={brief.engagement_goal}
              onChange={(e) => setBrief((b) => ({ ...b, engagement_goal: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <FieldLabel>Deliverable Description</FieldLabel>
              {!isNew && activeProjectId && (
                <BriefFieldUploader
                  projectId={activeProjectId}
                  fieldKey="deliverable_description"
                  initialFiles={briefFiles['deliverable_description'] || []}
                  onTextExtracted={appendToField('deliverable_description')}
                />
              )}
            </div>
            <textarea className={textareaCls} rows={3}
              placeholder="What is the final output? (report, recommendations deck, process map…)"
              value={brief.deliverable_description}
              onChange={(e) => setBrief((b) => ({ ...b, deliverable_description: e.target.value }))} />
          </div>
        </SectionCard>

        {/* Organizational Context */}
        <SectionCard title="Organizational Context">
          <div>
            <div className="flex items-center justify-between mb-1">
              <FieldLabel>Organizational Structure</FieldLabel>
              {!isNew && activeProjectId && (
                <BriefFieldUploader
                  projectId={activeProjectId}
                  fieldKey="org_structure"
                  initialFiles={briefFiles['org_structure'] || []}
                  onTextExtracted={appendToField('org_structure')}
                />
              )}
            </div>
            <textarea className={textareaCls} rows={5}
              placeholder="Describe the org: entities, teams, reporting lines, key departments…"
              value={brief.org_structure}
              onChange={(e) => setBrief((b) => ({ ...b, org_structure: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <FieldLabel>Core Hypothesis Being Tested</FieldLabel>
              {!isNew && activeProjectId && (
                <BriefFieldUploader
                  projectId={activeProjectId}
                  fieldKey="core_hypothesis"
                  initialFiles={briefFiles['core_hypothesis'] || []}
                  onTextExtracted={appendToField('core_hypothesis')}
                />
              )}
            </div>
            <textarea className={textareaCls} rows={3}
              placeholder="The central theory this audit is testing or validating…"
              value={brief.core_hypothesis}
              onChange={(e) => setBrief((b) => ({ ...b, core_hypothesis: e.target.value }))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <FieldLabel>Custom Context</FieldLabel>
              {!isNew && activeProjectId && (
                <BriefFieldUploader
                  projectId={activeProjectId}
                  fieldKey="custom_context"
                  initialFiles={briefFiles['custom_context'] || []}
                  onTextExtracted={appendToField('custom_context')}
                />
              )}
            </div>
            <textarea className={textareaCls} rows={4}
              placeholder="Anything else the AI should always know about this engagement…"
              value={brief.custom_context}
              onChange={(e) => setBrief((b) => ({ ...b, custom_context: e.target.value }))} />
          </div>
        </SectionCard>

        {/* Key Contacts */}
        <SectionCard title="Key Contacts" collapsible>
          <div className="space-y-3">
            {brief.key_contacts.map((c, i) => (
              <div key={i} className="border border-[#e2e8f0] rounded-lg p-3 bg-[#f8fafc] relative">
                <button onClick={() => removeContact(i)}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input placeholder="Name" value={c.name} onChange={(e) => updateContact(i, 'name', e.target.value)}
                    className={inputCls + ' text-sm'} />
                  <input placeholder="Role / Title" value={c.role} onChange={(e) => updateContact(i, 'role', e.target.value)}
                    className={inputCls + ' text-sm'} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Department" value={c.department} onChange={(e) => updateContact(i, 'department', e.target.value)}
                    className={inputCls + ' text-sm'} />
                  <input placeholder="Notes" value={c.notes} onChange={(e) => updateContact(i, 'notes', e.target.value)}
                    className={inputCls + ' text-sm'} />
                </div>
              </div>
            ))}
          </div>
          <button onClick={addContact}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded text-xs font-mono text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
            <Plus size={12} /> Add Contact
          </button>
        </SectionCard>

        {/* Context Store (existing projects) */}
        {!isNew && context && (
          <SectionCard title="Context Store" collapsible>
            <div className="grid grid-cols-3 gap-4 mb-3">
              {[
                { value: context.total_days_analyzed,          label: 'Days',      color: '#6366f1' },
                { value: context.confirmed_gaps?.length || 0,  label: 'Gaps',      color: '#ef4444' },
                { value: context.open_questions?.length || 0,  label: 'Questions', color: '#0ea5e9' },
              ].map(({ value, label, color }) => (
                <div key={label} className="text-center bg-[#f8fafc] rounded-lg py-3 border border-[#e2e8f0]">
                  <div className="font-mono text-2xl font-bold" style={{ color }}>{value}</div>
                  <div className="font-mono text-xs text-gray-400 uppercase mt-1">{label}</div>
                </div>
              ))}
            </div>
            {context.cumulative_summary && (
              <div className="mb-3">
                <p className="font-mono text-xs text-gray-400 uppercase mb-1">
                  Summary ({context.cumulative_summary.split(' ').length} words)
                </p>
                <p className="text-sm text-gray-600 leading-relaxed bg-[#f8fafc] border border-[#e2e8f0] rounded p-3">
                  {context.cumulative_summary}
                </p>
              </div>
            )}
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded text-xs font-mono text-red-600 hover:bg-red-100 transition-colors"
            >
              <RotateCcw size={11} /> Reset Context Store
            </button>
          </SectionCard>
        )}
      </div>

      <Modal open={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Reset Context Store">
        <p className="text-sm text-gray-500 mb-4">
          This will delete the cumulative summary and all rolling context. The AI starts fresh on the next analysis. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleResetContext}>Reset Context</Button>
        </div>
      </Modal>
    </div>
  );
}
