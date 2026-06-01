import './WaitingRoom.css';

interface WaitingRoomProps {
  position: number | null;
  estimatedWait: number | null;
  onLeave: () => void;
}

export function WaitingRoom({ position, estimatedWait, onLeave }: WaitingRoomProps) {
  return (
    <div className="waiting-room">
      <div className="waiting-content">
        <h2>You are in the Waiting Room</h2>
        <p className="waiting-subtitle">Please wait while we find a spot for you...</p>

        <div className="queue-position">
          <h1>{position ?? '?'}</h1>
          <p>Your Position</p>
        </div>

        {estimatedWait !== null && (
          <p className="estimated-wait">Estimated wait: ~{estimatedWait} seconds</p>
        )}

        <div className="waiting-loader" />

        <button className="btn-leave-queue" onClick={onLeave}>
          Leave Queue
        </button>
      </div>
    </div>
  );
}
