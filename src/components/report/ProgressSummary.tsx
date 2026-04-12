import type { ContextStore } from '../../types';
import Card from '../ui/Card';
import { format } from 'date-fns';

interface ProgressSummaryProps {
  context: ContextStore;
}

export default function ProgressSummary({ context }: ProgressSummaryProps) {
  return (
    <Card title="Context Health">
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-amber-400">
            {context.total_days_analyzed}
          </div>
          <div className="font-mono text-xs text-gray-500 uppercase mt-1">Days Analyzed</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-red-400">
            {context.confirmed_gaps?.length || 0}
          </div>
          <div className="font-mono text-xs text-gray-500 uppercase mt-1">Confirmed Gaps</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-blue-400">
            {context.open_questions?.length || 0}
          </div>
          <div className="font-mono text-xs text-gray-500 uppercase mt-1">Open Questions</div>
        </div>
      </div>
      {context.last_updated && (
        <div className="text-xs text-gray-600 font-mono">
          Last updated: {format(new Date(context.last_updated), 'PPp')}
        </div>
      )}
    </Card>
  );
}
