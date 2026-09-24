import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  Car,
  CameraOff,
} from "lucide-react";

import api from "../services/api";

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("All");
  const [type, setType] = useState("All");

  async function loadEvents() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/events");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.events || [];

      setEvents(data);
    } catch (err) {
      console.error("Event API error:", err);
      setEvents([]);
      setError(
        "Unable to load events from the Sentinel-X backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const eventTypes = useMemo(() => {
    const types = events
      .map((event) => event.type)
      .filter(Boolean);

    return ["All", ...new Set(types)];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const searchableText = `
        ${event.type || ""}
        ${event.camera_id || ""}
        ${event.camera_name || ""}
        ${event.location || ""}
        ${event.message || ""}
        ${event.description || ""}
      `.toLowerCase();

      const matchesSearch = searchableText.includes(
        search.toLowerCase()
      );

      const matchesSeverity =
        severity === "All" ||
        String(event.severity || "").toLowerCase() ===
          severity.toLowerCase();

      const matchesType =
        type === "All" || event.type === type;

      return (
        matchesSearch &&
        matchesSeverity &&
        matchesType
      );
    });
  }, [events, search, severity, type]);

  function getEventIcon(eventType) {
    const value = String(
      eventType || ""
    ).toLowerCase();

    if (
      value.includes("person") ||
      value.includes("human")
    ) {
      return UserRound;
    }

    if (
      value.includes("vehicle") ||
      value.includes("car")
    ) {
      return Car;
    }

    if (
      value.includes("offline") ||
      value.includes("camera")
    ) {
      return CameraOff;
    }

    if (
      value.includes("alert") ||
      value.includes("intrusion")
    ) {
      return ShieldAlert;
    }

    return Activity;
  }

  function getSeverityClass(value) {
    const severityValue = String(
      value || ""
    ).toLowerCase();

    if (severityValue === "high") {
      return "severity-high";
    }

    if (severityValue === "medium") {
      return "severity-medium";
    }

    if (severityValue === "low") {
      return "severity-low";
    }

    return "severity-normal";
  }

  return (
    <div className="page events-page">
      <div className="page-header">
        <div>
          <div className="title-row">
            <Activity size={24} />
            <h2>Event Stream</h2>
          </div>

          <p>
            Monitor security events received from the
            Sentinel CCTV network.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadEvents}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="event-live-status">
        <span className="live-dot"></span>
        Live Event Monitoring
      </div>

      <div className="event-filters">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search events, cameras or locations..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        <div className="filter-group">
          <Filter size={17} />

          <select
            value={severity}
            onChange={(e) =>
              setSeverity(e.target.value)
            }
          >
            <option value="All">All Severity</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Normal">Normal</option>
          </select>
        </div>

        <div className="filter-group">
          <Activity size={17} />

          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value)
            }
          >
            {eventTypes.map((eventType) => (
              <option
                key={eventType}
                value={eventType}
              >
                {eventType === "All"
                  ? "All Event Types"
                  : eventType}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="connection-error compact">
          <AlertTriangle size={22} />

          <div>
            <strong>Event Backend Unavailable</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen">
          <RefreshCw className="spin" size={28} />
          <p>Loading events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="empty-state large">
          <Activity size={36} />

          <h3>No Events Found</h3>

          <p>
            {error
              ? "Connect the backend to receive real CCTV events."
              : "No events match the current filters."}
          </p>
        </div>
      ) : (
        <section className="event-stream-panel">
          <div className="event-stream-header">
            <div>
              <h3>Security Events</h3>
              <span>
                {filteredEvents.length} event
                {filteredEvents.length !== 1
                  ? "s"
                  : ""}
              </span>
            </div>

            <span className="live-indicator">
              <span className="live-dot"></span>
              LIVE
            </span>
          </div>

          <div className="event-stream-list">
            {filteredEvents.map((event, index) => {
              const Icon = getEventIcon(
                event.type
              );

              return (
                <article
                  className="event-card"
                  key={event.id || index}
                >
                  <div className="event-card-icon">
                    <Icon size={20} />
                  </div>

                  <div className="event-card-main">
                    <div className="event-card-title">
                      <h3>
                        {event.type ||
                          "Camera Event"}
                      </h3>

                      <span
                        className={`severity-badge ${getSeverityClass(
                          event.severity
                        )}`}
                      >
                        {event.severity ||
                          "Normal"}
                      </span>
                    </div>

                    <p>
                      {event.description ||
                        event.message ||
                        "Event received from CCTV system."}
                    </p>

                    <div className="event-card-details">
                      <span>
                        Camera:{" "}
                        <strong>
                          {event.camera_name ||
                            event.camera_id ||
                            "—"}
                        </strong>
                      </span>

                      <span>
                        Location:{" "}
                        <strong>
                          {event.location || "—"}
                        </strong>
                      </span>

                      <span>
                        Time:{" "}
                        <strong>
                          {event.time ||
                            event.timestamp ||
                            "—"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="event-card-status">
                    <CheckCircle2 size={18} />
                    <span>Received</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default Events;