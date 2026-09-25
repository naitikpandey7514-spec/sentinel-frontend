import { useEffect, useState } from "react";
import {
  Server,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  Clock3,
  Database,
} from "lucide-react";

import api from "../services/api";

function VMSConnections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadConnections() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/vms/connections");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.connections || [];

      setConnections(data);
    } catch (err) {
      console.error("VMS API error:", err);
      setConnections([]);
      setError(
        "Unable to load VMS connection information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  return (
    <div className="page vms-page">
      <div className="page-header">
        <div>
          <div className="title-row">
            <Server size={24} />
            <h2>VMS Connections</h2>
          </div>

          <p>
            Monitor video management system connections.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadConnections}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="connection-error compact">
          <WifiOff size={22} />

          <div>
            <strong>VMS Backend Unavailable</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen">
          <RefreshCw className="spin" size={28} />
          <p>Loading VMS connections...</p>
        </div>
      ) : connections.length === 0 ? (
        <div className="empty-state large">
          <Server size={36} />

          <h3>No VMS Connections</h3>

          <p>
            Connect the Sentinel-X backend to display
            VMS connection information.
          </p>
        </div>
      ) : (
        <div className="vms-grid">
          {connections.map((connection, index) => {
            const online =
              String(connection.status || "")
                .toLowerCase() === "connected" ||
              String(connection.status || "")
                .toLowerCase() === "online";

            return (
              <article
                className="vms-card"
                key={connection.id || index}
              >
                <div className="vms-card-header">
                  <div className="vms-icon">
                    <Server size={24} />
                  </div>

                  <span
                    className={
                      online
                        ? "status-badge online"
                        : "status-badge offline"
                    }
                  >
                    {online ? (
                      <Wifi size={14} />
                    ) : (
                      <WifiOff size={14} />
                    )}

                    {connection.status ||
                      "Unknown"}
                  </span>
                </div>

                <h3>
                  {connection.name ||
                    connection.server_name ||
                    "VMS Server"}
                </h3>

                <p>
                  {connection.description ||
                    "Video management system connection"}
                </p>

                <div className="vms-details">
                  <div>
                    <Database size={17} />
                    <span>Server</span>
                    <strong>
                      {connection.host || "—"}
                    </strong>
                  </div>

                  <div>
                    <Activity size={17} />
                    <span>Streams</span>
                    <strong>
                      {connection.active_streams ?? "—"}
                    </strong>
                  </div>

                  <div>
                    <Clock3 size={17} />
                    <span>Uptime</span>
                    <strong>
                      {connection.uptime || "—"}
                    </strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default VMSConnections;