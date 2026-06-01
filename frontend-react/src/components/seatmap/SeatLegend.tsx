export function SeatLegend() {
  return (
    <div className="seat-legend">
      <div className="legend-item">
        <span className="legend-dot available" /> Available
      </div>
      <div className="legend-item">
        <span className="legend-dot sold" /> Booked / Sold
      </div>
      <div className="legend-item">
        <span className="legend-dot blocked" /> Blocked
      </div>
      <div className="legend-item">
        <span className="legend-dot locked" /> Selected
      </div>
    </div>
  );
}
