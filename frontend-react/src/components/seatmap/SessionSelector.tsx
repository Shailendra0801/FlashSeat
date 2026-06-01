import type { EventSession } from '../../types';

interface SessionSelectorProps {
  sessions: EventSession[];
  currentSessionId: string | null;
  onChange: (sessionId: string) => void;
}

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
            {s.session_name} &mdash; {new Date(s.start_time).toLocaleString()}
          </option>
        ))}
      </select>
    </div>
  );
}
