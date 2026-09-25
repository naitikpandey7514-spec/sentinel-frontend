import { useEffect, useState } from "react";
import {
  Camera,
  CircleAlert,
  Activity,
  Wifi,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import api from "../services/api";

function getArray(data, key) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data[key])) {
    return data[key];
  }

  return [];
}

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const [
        statsResponse,
        alertsResponse,
      ] = await Promise.all([
        api.get("/api/dashboard"),
        api.get("/api/alerts"),
      ]);
      setStats(
        statsResponse.data?.stats ||
          statsResponse.data ||
          null
      );

      const alertData = getArray(
  alertsResponse.data,
  "alerts"
).length
  ? getArray(alertsResponse.data, "alerts")
  : getArray(alertsResponse.data, "value");

const normalizedAlerts = alertData.map((alert) => ({
  ...alert,
  type: alert.alert_type || "Security Alert",
  title: alert.alert_type || "Security Alert",
  severity: alert.priority || "Normal",
  camera_name:
    alert.camera_name || `Camera ${alert.camera_id}`,
  description: `${alert.plate_number || "Unknown vehicle"} — ${alert.alert_type || "Security Alert"}`,
  time: alert.timestamp,
}));

setAlerts(normalizedAlerts);
setEvents(normalizedAlerts);
    } catch (err) {
      console.error("Dashboard API error:", err);

      setStats(null);
      setEvents([]);
      setAlerts([]);

      setError(
        "Backend unavailable. Connect the Sentinel-X backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="loading-screen">
          <RefreshCw className="spin" size={28} />
          <p>Connecting to Sentinel-X...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page dashboard-page">
        <div className="page-header">
          <div>
            <div className="title-row">
              <ShieldCheck size={25} />
              <h2>Command Dashboard</h2>
            </div>

            <p>
              Live CCTV monitoring and security overview
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={loadDashboard}
          >
            <RefreshCw size={17} />
            Retry
          </button>
        </div>

        <div className="connection-error">
          <CircleAlert size={30} />

          <div>
            <h3>Backend Connection Required</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Total Cameras",
      value: stats?.total_cameras ?? 0,
      icon: Camera,
      className: "stat-blue",
    },
    {
      title: "Online Cameras",
      value: stats?.online_cameras ?? 0,
      icon: Wifi,
      className: "stat-green",
    },
    {
      title: "Active Alerts",
      value: stats?.active_alerts ?? 0,
      icon: CircleAlert,
      className: "stat-red",
    },
    {
      title: "Live Events",
      value: stats?.live_events ?? 0,
      icon: Activity,
      className: "stat-purple",
    },
  ];

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <div>
          <div className="title-row">
            <ShieldCheck size={25} />
            <h2>Command Dashboard</h2>
          </div>

          <p>
            Live CCTV monitoring and security overview
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadDashboard}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="dashboard-status">
        <span className="online-dot"></span>
        Sentinel CCTV System Connected
      </div>

      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              className={`dashboard-stat-card ${card.className}`}
              key={card.title}
            >
              <div className="stat-icon">
                <Icon size={23} />
              </div>

              <div>
                <span>{card.title}</span>
                <strong>{card.value}</strong>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-panel events-panel">
          <div className="panel-header">
            <div>
              <h3>Live Event Stream</h3>
              <p>
                Latest events received from CCTV system
              </p>
            </div>

            <Activity size={20} />
          </div>

          {events.length === 0 ? (
            <div className="empty-state">
              No live events available.
            </div>
          ) : (
            <div className="event-list">
              {events.slice(0, 8).map((event, index) => (
                <div
                  className="event-row"
                  key={event.id || index}
                >
                  <div className="event-indicator"></div>

                  <div className="event-info">
                    <strong>
                      {event.type ||
                        event.event_type ||
                        "Camera Event"}
                    </strong>

                    <span>
                      {event.camera_name ||
                        event.camera_id ||
                        "Unknown Camera"}
                    </span>
                  </div>

                  <div className="event-meta">
                    <span className="severity">
                      {event.severity || "Normal"}
                    </span>

                    <time>
                      {event.time ||
                        event.timestamp ||
                        "--:--:--"}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-panel alerts-panel">
          <div className="panel-header">
            <div>
              <h3>Active Alerts</h3>
              <p>
                Current security notifications
              </p>
            </div>

            <CircleAlert size={20} />
          </div>

          {alerts.length === 0 ? (
            <div className="no-alerts">
              <ShieldCheck size={32} />
              <strong>No Active Alerts</strong>
              <span>
                No active alerts received.
              </span>
            </div>
          ) : (
            <div className="alert-list">
              {alerts.slice(0, 6).map((alert, index) => (
                <div
                  className="alert-row"
                  key={alert.id || index}
                >
                  <CircleAlert size={18} />

                  <div>
                    <strong>
                      {alert.title ||
                        alert.type ||
                        "Security Alert"}
                    </strong>

                    <span>
                      {alert.camera_name ||
                        alert.camera_id ||
                        "Unknown Camera"}
                    </span>
                  </div>

                  <small>
                    {alert.severity || "Alert"}
                  </small>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;