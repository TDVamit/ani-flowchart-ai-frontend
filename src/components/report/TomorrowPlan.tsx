import type { DailyReport } from '../../types';
import Card from '../ui/Card';

interface TomorrowPlanProps {
  report: DailyReport;
}

export default function TomorrowPlan({ report }: TomorrowPlanProps) {
  return (
    <Card title="Tomorrow's Plan">
      <p className="text-sm text-gray-300 leading-relaxed mb-3">{report.tomorrow_plan}</p>
      {report.tomorrow_priorities.length > 0 && (
        <div>
          <div className="font-mono text-xs text-gray-500 uppercase tracking-wider mb-2">
            Priorities
          </div>
          <ol className="space-y-1">
            {report.tomorrow_priorities.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-amber-300">
                <span className="font-mono text-xs text-amber-600 w-4 flex-shrink-0">{i + 1}.</span>
                {p}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
