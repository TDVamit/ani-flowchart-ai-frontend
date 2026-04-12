export interface Project {
  _id: string;
  brief: ProjectBrief;
  created_at: string;
  current_week: number;
  current_day: number;
  is_active: boolean;
}

export interface ProjectBrief {
  engagement_name: string;
  client_name: string;
  fde_name: string;
  engagement_goal: string;
  deliverable_description: string;
  week_count: number;
  key_contacts: KeyContact[];
  org_structure: string;
  core_hypothesis: string;
  custom_context: string;
}

export interface KeyContact {
  name: string;
  role: string;
  department: string;
  notes: string;
}

export interface AudioRecording {
  file_id: string;
  original_filename: string;
  duration_seconds?: number;
  transcript?: string;
  transcript_source?: 'whisper' | 'manual';
  interviewee_name?: string;
  interviewee_role?: string;
  notes?: string;
}

export interface UploadedDocument {
  file_id: string;
  original_filename: string;
  file_type: string;
  extracted_text?: string;
  user_annotation?: string;
}

export interface DailyEntry {
  _id?: string;
  project_id: string;
  entry_date: string;
  week_number: number;
  day_number: number;
  typed_findings: string;
  user_annotations: string;
  previous_plan_review: string;
  audio_recordings: AudioRecording[];
  uploaded_documents: UploadedDocument[];
  analysis_triggered: boolean;
  analysis_completed: boolean;
}

export interface DailyReport {
  _id: string;
  project_id: string;
  entry_id: string;
  report_date: string;
  week_number: number;
  day_number: number;
  llm_provider: string;
  llm_model: string;
  executive_summary: string;
  key_findings_today: string[];
  patterns_emerging: string;
  hypothesis_update: string;
  stakeholder_notes: string;
  risks_and_flags: string[];
  progress_summary: string;
  tomorrow_plan: string;
  tomorrow_priorities: string[];
  generated_at: string;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface ContextStore {
  project_id: string;
  cumulative_summary: string;
  key_findings: string[];
  confirmed_gaps: string[];
  open_questions: string[];
  stakeholder_insights: Record<string, string>;
  last_plan: string;
  total_days_analyzed: number;
  last_updated?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  is_configured: boolean;
  models: { id: string; name: string }[];
}
