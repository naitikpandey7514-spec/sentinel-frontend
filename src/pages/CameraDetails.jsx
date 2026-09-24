import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CircleAlert,
  Clock3,
  Cpu,
  Maximize,
  RefreshCw,
  Signal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import api from "../services/api";

function CameraDetails() {
  const navigate = useNavigate();
  const { cameraId } = useParams();

  const [camera, setCamera] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCamera() {
    setLoading(true);
    setError("");

    try {
      const [cameraResponse, eventsResponse] =
        await Promise.all([
          api.get(`/api/cameras/${cameraId}`),
          api.get(`/api/cameras/${cameraId}/events`),
        ]);

      setCamera(cameraResponse.data);
      setEvents(
        Array.isArray(eventsResponse.data)
          ? eventsResponse.data
          : eventsResponse.data.events || []
      );
    } catch (err) {
      console.error("Camera details error:", err);

      setCamera(null);
      setEvents([]);
      setError(
        "Unable to load this camera from the Sentinel-X backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCamera();
  }, [cameraId]);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen">
          <RefreshCw className="spin" size={28} />
          <p>Loading camera...</p>
        </div>
      </div>
    );
  }

  if (error || !camera) {
    return (
      <div className="page">
        <button
          className="back-button"
          onClick={() => navigate("/cameras")}
        >
          <ArrowLeft size={17} />
          Back to Cameras
        </button>

        <div className="connection-error">
          <CircleAlert size={30} />

          <div>
            <h3>Camera Unavailable</h3>
            <p>
              {error ||
                "The requested camera could not be found."}
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={loadCamera}
          >
            <RefreshCw size={17} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isOnline =
    String(camera.status || "").toLowerCase() === "online";

  const streamUrl =
    camera.hls_url ||
    camera.hls ||
    camera.stream_url ||
    "";

  return (
    <div className="page camera-details-page">
      <div className="page-header">
        <div>
          <button
            className="back-button"
            onClick={() => navigate("/cameras")}
          >
            <ArrowLeft size={17} />
            Camera Registry
          </button>

          <div className="camera-detail-title">
            <div className="camera-large-icon">
              <Camera size={25} />
            </div>

            <div>
              <h2>{camera.name || camera.id}</h2>

              <p>
                {camera.id}
                {camera.location
                  ? ` • ${camera.location}`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <button
          className="refresh-button"
          onClick={loadCamera}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="camera-detail-layout">
        <section className="camera-view-panel">
          <div className="camera-view-header">
            <div>
              <span className="live-label">
                <span className="live-dot"></span>
                LIVE
              </span>

              <strong>
                {camera.name || camera.id}
              </strong>
            </div>

            <button
              className="icon-button"
              title="Fullscreen"
              onClick={() =>
                document
                  .querySelector(".camera-stream")
                  ?.requestFullscreen?.()
              }
            >
              <Maximize size={18} />
            </button>
          </div>

          <div className="camera-stream">
            {isOnline && streamUrl ? (
              <video
                src={streamUrl}
                controls
                autoPlay
                muted
                playsInline
              />
            ) : (
              <div className="stream-placeholder">
                <Camera size={48} />

                <strong>
                  {isOnline
                    ? "Live stream unavailable"
                    : "Camera Offline"}
                </strong>

                <span>
                  {isOnline
                    ? "The backend has not provided a browser-compatible stream."
                    : "This camera is currently offline."}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="camera-health-panel">
          <div className="panel-header">
            <div>
              <h3>Camera Health</h3>
              <p>Current camera information</p>
            </div>

            {isOnline ? (
              <Wifi size={20} />
            ) : (
              <WifiOff size={20} />
            )}
          </div>

          <div className="health-status">
            <span
              className={
                isOnline
                  ? "status-badge online"
                  : "status-badge offline"
              }
            >
              {isOnline ? (
                <Wifi size={14} />
              ) : (
                <WifiOff size={14} />
              )}

              {camera.status || "Unknown"}
            </span>
          </div>

          <div className="health-grid">
            <div className="health-item">
              <Signal size={18} />
              <span>FPS</span>
              <strong>{camera.fps ?? "—"}</strong>
            </div>

            <div className="health-item">
              <Camera size={18} />
              <span>Resolution</span>
              <strong>
                {camera.resolution || "—"}
              </strong>
            </div>

            <div className="health-item">
              <Clock3 size={18} />
              <span>Uptime</span>
              <strong>
                {camera.uptime || "—"}
              </strong>
            </div>

            <div className="health-item">
              <Cpu size={18} />
              <span>Detection</span>
              <strong>
                {camera.detection || "—"}
              </strong>
            </div>
          </div>

          <div className="camera-information">
            <h4>Camera Information</h4>

            <div>
              <span>Camera ID</span>
              <strong>{camera.id}</strong>
            </div>

            <div>
              <span>Location</span>
              <strong>
                {camera.location || "—"}
              </strong>
            </div>

            <div>
              <span>Type</span>
              <strong>
                {camera.type || "CCTV"}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <section className="dashboard-panel camera-events-panel">
        <div className="panel-header">
          <div>
            <h3>Recent Events</h3>
            <p>
              Latest events from {camera.name || camera.id}
            </p>
          </div>

          <Clock3 size={20} />
        </div>

        {events.length === 0 ? (
          <div className="empty-state">
            No recent events available.
          </div>
        ) : (
          <div className="event-list">
            {events.map((event, index) => (
              <div
                className="event-row"
                key={event.id || index}
              >
                <div className="event-indicator"></div>

                <div className="event-info">
                  <strong>
                    {event.type || "Camera Event"}
                  </strong>

                  <span>
                    {event.description ||
                      event.message ||
                      "Event received from camera"}
                  </span>
                </div>

                <div className="event-meta">
                  <span className="severity">
                    {event.severity || "Normal"}
                  </span>

                  <time>
                    {event.time ||
                      event.timestamp ||
                      "—"}
                  </time>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default CameraDetails;