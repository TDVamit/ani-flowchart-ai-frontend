import { useEffect, useState } from 'react';
import { analysisApi } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import type { DailyReport } from '../types';
import DailyReportComponent from '../components/report/DailyReport';
import TopBar from '../components/layout/TopBar';
import Badge from '../components/ui/Badge';

export default function Reports() {
  const { activeProjectId } = useAppStore();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;
    analysisApi.listReports(activeProjectId).then((res) => {
      setReports(res.data);
      if (res.data.length > 0) setExpanded(res.data[0]._id);
    });
  }, [activeProjectId]);

  if (!activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#f8fafc]">
        <span className="text-gray-500 font-mono text-sm">No active project selected.</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-auto">
      <TopBar title="Reports" subtitle={`${reports.length} reports`} />
      <div className="p-6 max-w-4xl space-y-3">
        {reports.length === 0 && (
          <div className="text-[#94a3b8] font-mono text-sm py-8 text-center">
            No reports generated yet. Run an end-of-day analysis from the Dashboard.
          </div>
        )}
        {reports.map((r) => (
          <div key={r._id} className="border border-[#e2e8f0]">
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-[#f8fafc] transition-colors bg-white"
              onClick={() => setExpanded(expanded === r._id ? null : r._id)}
            >
              <div className="flex items-center gap-3">
                <Badge variant="amber">W{r.week_number}·D{r.day_number}</Badge>
                <span className="font-mono text-xs text-[#64748b]">{r.report_date}</span>
                <span className="font-mono text-xs text-[#94a3b8]">
                  {r.llm_provider}/{r.llm_model}
                </span>
              </div>
              <span className="font-mono text-xs text-[#94a3b8]">
                {expanded === r._id ? '▲' : '▼'}
              </span>
            </button>
            {expanded === r._id && (
              <div className="px-4 py-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
                <DailyReportComponent report={r} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
