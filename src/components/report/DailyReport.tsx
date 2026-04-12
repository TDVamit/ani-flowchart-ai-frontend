import type { DailyReport as DailyReportType } from '../../types';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { AlertTriangle, Download } from 'lucide-react';
import Button from '../ui/Button';
import { format } from 'date-fns';

interface DailyReportProps {
  report: DailyReportType;
}

function detectHypothesisStance(text: string): 'supports' | 'complicates' | 'weakens' {
  const lower = text.toLowerCase();
  if (lower.includes('weaken') || lower.includes('contradict') || lower.includes('against')) return 'weakens';
  if (lower.includes('compli') || lower.includes('nuanc') || lower.includes('uncertain')) return 'complicates';
  return 'supports';
}

function exportAsMarkdown(report: DailyReportType) {
  const lines = [
    `# Daily Report — ${report.report_date}`,
    `**Week ${report.week_number}, Day ${report.day_number}** | Model: ${report.llm_provider}/${report.llm_model}`,
    '',
    `## Executive Summary`,
    report.executive_summary,
    '',
    `## Key Findings Today`,
    ...report.key_findings_today.map((f) => `- ${f}`),
    '',
    `## Patterns Emerging`,
    report.patterns_emerging,
    '',
    `## Hypothesis Update`,
    report.hypothesis_update,
    '',
    `## Stakeholder Notes`,
    report.stakeholder_notes,
    '',
    `## Risks & Flags`,
    ...report.risks_and_flags.map((r) => `- ⚠️ ${r}`),
    '',
    `## Progress Summary`,
    report.progress_summary,
    '',
    `## Tomorrow's Plan`,
    report.tomorrow_plan,
    '',
    `## Tomorrow's Priorities`,
    ...report.tomorrow_priorities.map((p, i) => `${i + 1}. ${p}`),
    '',
    `---`,
    `*Generated: ${format(new Date(report.generated_at), 'PPpp')} | Tokens: ${report.prompt_tokens} in / ${report.completion_tokens} out*`,
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report-w${report.week_number}d${report.day_number}-${report.report_date}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DailyReport({ report }: DailyReportProps) {
  const stance = detectHypothesisStance(report.hypothesis_update);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="indigo">W{report.week_number}·D{report.day_number}</Badge>
          <span className="font-mono text-xs text-[#64748b]">{report.report_date}</span>
          <span className="font-mono text-xs text-[#94a3b8]">
            {report.llm_provider}/{report.llm_model}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => exportAsMarkdown(report)}>
          <Download size={12} className="mr-1" />
          Export .md
        </Button>
      </div>

      <Card title="Executive Summary">
        <p className="text-sm text-[#475569] leading-relaxed">{report.executive_summary}</p>
      </Card>

      <Card title="Key Findings Today">
        <ul className="space-y-1">
          {report.key_findings_today.map((f, i) => (
            <li key={i} className="flex gap-2 text-sm text-[#475569]">
              <span className="text-indigo-500 flex-shrink-0 font-mono text-xs mt-0.5">•</span>
              {f}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Patterns Emerging">
        <p className="text-sm text-[#475569] leading-relaxed">{report.patterns_emerging}</p>
      </Card>

      <Card title="Hypothesis Update" className="relative">
        <div className="flex items-start gap-3">
          <Badge variant={stance === 'supports' ? 'green' : stance === 'weakens' ? 'red' : 'amber'}>
            {stance}
          </Badge>
          <p className="text-sm text-[#475569] leading-relaxed">{report.hypothesis_update}</p>
        </div>
      </Card>

      <Card title="Stakeholder Notes">
        <p className="text-sm text-[#475569] leading-relaxed">{report.stakeholder_notes}</p>
      </Card>

      {report.risks_and_flags.length > 0 && (
        <Card title="Risks & Flags">
          <ul className="space-y-1">
            {report.risks_and_flags.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-red-600">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                {r}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Progress Summary">
        <p className="text-sm text-[#475569] leading-relaxed whitespace-pre-wrap">
          {report.progress_summary}
        </p>
      </Card>

      <Card title="Tomorrow's Plan">
        <p className="text-sm text-[#475569] leading-relaxed">{report.tomorrow_plan}</p>
      </Card>

      <Card title="Tomorrow's Priorities">
        <div className="flex flex-wrap gap-2">
          {report.tomorrow_priorities.map((p, i) => (
            <span
              key={i}
              className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded"
            >
              {i + 1}. {p}
            </span>
          ))}
        </div>
      </Card>

      <div className="text-xs text-[#94a3b8] font-mono border-t border-[#e2e8f0] pt-3">
        Generated {format(new Date(report.generated_at), 'PPpp')} ·{' '}
        {report.prompt_tokens.toLocaleString()} prompt tokens ·{' '}
        {report.completion_tokens.toLocaleString()} completion tokens
      </div>
    </div>
  );
}
