import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Cloud,
  Database,
  Plug,
  RefreshCw,
  Server,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";

import api from "../services/api";

function IntegrationHub() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadIntegrations() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/integrations");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.integrations || [];

      setIntegrations(data);
    } catch (err) {
      console.error("Integration API error:", err);
      setIntegrations([]);
      setError(
        "Unable to load integration status from the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIntegrations();
  }, []);

  function getIcon(type) {
    const value = String(type || "").toLowerCase();

    if (value.includes("vms")) return Server;
    if (value.includes("database")) return Database;
    if (value.includes("event")) return Activity;
    if (value.includes("gateway")) return Cloud;
    if (value.includes("api")) return Plug;

    return Plug;
  }

  function isConnected(status) {
  const value = String(status || "").toLowerCase();

  return (
    value === "connected" ||
    value === "online" ||
    value === "active" ||
    value === "healthy" ||
    value === "available"
  );
}

  return (
    <div className="page integration-page">
      <div className="page-header">
        <div>
          <div className="title-row">
            <Plug size={24} />
            <h2>Integration Hub</h2>
          </div>

          <p>
            Monitor services connected to the Sentinel-X
            command center.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadIntegrations}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={loading ? "spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="integration-summary">
        <div className="integration-summary-card">
          <div className="summary-icon">
            <Plug size={21} />
          </div>

          <div>
            <span>Total Integrations</span>
            <strong>{integrations.length}</strong>
          </div>
        </div>

        <div className="integration-summary-card">
          <div className="summary-icon connected">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <span>Connected</span>
            <strong>
              {
                integrations.filter((item) =>
                  isConnected(item.status)
                ).length
              }
            </strong>
          </div>
        </div>

        <div className="integration-summary-card">
          <div className="summary-icon disconnected">
            <ShieldAlert size={21} />
          </div>

          <div>
            <span>Attention Required</span>
            <strong>
              {
                integrations.filter(
                  (item) =>
                    !isConnected(item.status)
                ).length
              }
            </strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="connection-error compact">
          <WifiOff size={22} />

          <div>
            <strong>Integration Backend Unavailable</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen">
          <RefreshCw className="spin" size={28} />
          <p>Loading integrations...</p>
        </div>
      ) : integrations.length === 0 ? (
        <div className="empty-state large">
          <Plug size={36} />

          <h3>No Integrations Available</h3>

          <p>
            Connect the Sentinel-X backend to receive
            integration status.
          </p>
        </div>
      ) : (
        <div className="integration-grid">
          {integrations.map((integration, index) => {
            const Icon = getIcon(integration.type);
            const connected = isConnected(
              integration.status
            );

            return (
              <article
                className="integration-card"
                key={integration.id || index}
              >
                <div className="integration-card-top">
                  <div className="integration-icon">
                    <Icon size={23} />
                  </div>

                  <span
                    className={
                      connected
                        ? "status-badge online"
                        : "status-badge offline"
                    }
                  >
                    {connected ? (
                      <Wifi size={14} />
                    ) : (
                      <WifiOff size={14} />
                    )}

                    {integration.status ||
                      "Unknown"}
                  </span>
                </div>

                <div className="integration-card-content">
                  <span className="integration-type">
                    {integration.type || "Service"}
                  </span>

                  <h3>
                    {integration.name ||
                      "Unnamed Integration"}
                  </h3>

                  <p>
                    {integration.description ||
                      "No description provided."}
                  </p>
                </div>

                <div className="integration-card-footer">
                  <span>
                    {connected
                      ? "Service operational"
                      : "Connection requires attention"}
                  </span>

                  <span
                    className={
                      connected
                        ? "connection-dot connected"
                        : "connection-dot disconnected"
                    }
                  ></span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default IntegrationHub;