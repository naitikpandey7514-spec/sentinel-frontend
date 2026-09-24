import { Server } from "lucide-react";
import ConnectionStatus from "./ConnectionStatus";

function IntegrationCard({ integration }) {
  return (
    <div className="integration-card">
      <div className="integration-icon">
        <Server size={22} />
      </div>

      <div className="integration-content">
        <div className="integration-title">
          <h3>{integration.name}</h3>
          <ConnectionStatus status={integration.status} />
        </div>

        <span className="integration-type">
          {integration.type}
        </span>

        <p>{integration.description}</p>
      </div>
    </div>
  );
}

export default IntegrationCard;