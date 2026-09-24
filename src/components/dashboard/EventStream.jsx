function EventStream({ events = [] }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Recent Events</h3>
          <p>Latest CCTV activity</p>
        </div>
      </div>

      <div className="event-list">
        {events.map((event) => (
          <div className="event-item" key={event.id}>
            <div className="event-main">
              <strong>{event.type}</strong>
              <span>
                {event.camera} · {event.location}
              </span>
            </div>

            <div className="event-right">
              <span className={`severity ${event.severity.toLowerCase()}`}>
                {event.severity}
              </span>
              <small>{event.time}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EventStream;