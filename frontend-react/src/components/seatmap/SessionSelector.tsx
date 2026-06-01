import type { EventSession } from '../../types';

interface SessionSelectorProps {
  sessions: EventSession[];
  currentSessionId: string | null;
  onChange: (sessionId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  sold_out: 'Sold Out',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const STATUS_CLASSES: Record<string, string> = {
  draft: 'status-draft',
  published: 'status-published',
  sold_out: 'status-sold_out',
  cancelled: 'status-cancelled',
  completed: 'status-completed',
};

export function SessionSelector({ sessions, currentSessionId, onChange }: SessionSelectorProps) {
  return (
    <div className="session-selector">
      <label htmlFor="sessionSelect">
        <strong>Select Show / Session:</strong>
      </label>
      <select
        id="sessionSelect"
        value={currentSessionId || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {sessions.map((s) => (
          <option key={s.session_id} value={s.session_id}>
            {s.session_name} — {new Date(s.start_time).toLocaleString()}
            {s.status !== 'published' ? ` [${STATUS_LABELS[s.status] || s.status}]` : ''}
          </option>
        ))}
      </select>
      {currentSessionId && (
        <div className="session-status-row">
          {sessions.filter((s) => s.session_id === currentSessionId).map((s) => (
            <span key={s.session_id} className={`status-badge ${STATUS_CLASSES[s.status] || ''}`}>
              {STATUS_LABELS[s.status] || s.status}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
