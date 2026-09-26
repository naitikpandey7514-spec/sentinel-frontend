import { AlertTriangle } from "lucide-react";

function AlertPanel({ alerts = [] }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Active Alerts</h3>
          <p>Important system notifications</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="empty-state">
          No active alerts
        </div>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <div className="alert-item" key={alert.id}>
              <AlertTriangle size={18} />

              <div>
                <strong>{alert.type}</strong>
                <p>{alert.camera}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AlertPanel;