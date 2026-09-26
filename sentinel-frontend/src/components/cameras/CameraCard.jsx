import { Link } from "react-router-dom";
import { Camera } from "lucide-react";
import CameraStatus from "./CameraStatus";

function CameraCard({ camera }) {
  return (
    <Link to={`/cameras/${camera.id}`} className="camera-card">
      <div className="camera-card-top">
        <div className="camera-icon">
          <Camera size={22} />
        </div>

        <CameraStatus status={camera.status} />
      </div>

      <h3>{camera.name}</h3>

      <p>{camera.location}</p>

      <div className="camera-card-info">
        <span>{camera.type}</span>
        <span>{camera.resolution}</span>
        <span>{camera.fps} FPS</span>
      </div>
    </Link>
  );
}

export default CameraCard;