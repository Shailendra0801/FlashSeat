import { useEffect, useRef } from 'react';
import './WaitingRoom.css';

interface WaitingRoomProps {
  position: number | null;
  estimatedWait: number | null;
  onLeave: () => void;
}

export function WaitingRoom({ position, estimatedWait, onLeave }: WaitingRoomProps) {
  const positionRef = useRef<HTMLHeadingElement>(null);

  // Animate position number change
  useEffect(() => {
    if (positionRef.current) {
      positionRef.current.classList.remove('queue-bump');
      // Force reflow
      void positionRef.current.offsetWidth;
      positionRef.current.classList.add('queue-bump');
    }
  }, [position]);

  const formatWait = (seconds: number): string => {
    if (seconds < 60) return `~${seconds} seconds`;
    const mins = Math.ceil(seconds / 60);
    return `~${mins} minute${mins !== 1 ? 's' : ''}`;
  };

  return (
    <div className="waiting-room" role="dialog" aria-label="Waiting room">
      <div className="waiting-content">
        <div className="waiting-icon">&#9203;</div>
        <h2>You're in the Waiting Room</h2>
        <p className="waiting-subtitle">
          Hang tight! We'll let you in as soon as a spot opens up.
        </p>

        <div className="queue-position" aria-live="polite" aria-atomic="true">
          <h1 ref={positionRef}>{position ?? '?'}</h1>
          <p>Your Position</p>
        </div>

        {estimatedWait !== null && (
          <p className="estimated-wait">
            Estimated wait: {formatWait(estimatedWait)}
          </p>
        )}

        <div className="waiting-dots">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>

        <p className="waiting-tip">
          Keep this tab open. You'll be redirected automatically when it's your turn.
        </p>

        <button className="btn-leave-queue" onClick={onLeave}>
          Leave Queue &amp; Go Back
        </button>
      </div>
    </div>
  );
}
