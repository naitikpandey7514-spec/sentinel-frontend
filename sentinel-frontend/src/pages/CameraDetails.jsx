import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Circle, MapPin, Activity } from "lucide-react";
import WebRTCPlayer from "../components/cameras/WebRTCPlayer";

function CameraDetails() {
  const { cameraId } = useParams();

  const cameraName = cameraId
    ? cameraId.replace(/^cam/i, "Camera ")
    : "Camera";

  return (
    <main className="camera-details-page">
      <div className="camera-details-header">
        <div>
          <Link to="/cameras" className="camera-back-button">
            <ArrowLeft size={16} />
            <span>Back to Cameras</span>
          </Link>

          <div className="camera-details-title-row">
            <div className="camera-details-icon">
              <Camera size={22} />
            </div>

            <div>
              <h1>{cameraName}</h1>

              <div className="camera-details-subtitle">
                <span className="camera-details-id">
                  {cameraId}
                </span>

                <span className="camera-details-separator">
                  /
                </span>

                <span className="camera-online-label">
                  <span className="camera-online-dot" />
                  Live Monitoring
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="camera-detail-status">
          <span className="camera-detail-status-dot" />
          ONLINE
        </div>
      </div>

      <section className="camera-details-layout">
        <div className="camera-details-main">
          <div className="camera-details-feed-card">
            <div className="camera-details-feed-header">
              <div>
                <span className="camera-feed-label">
                  LIVE FEED
                </span>
                <span className="camera-feed-source">
                  {cameraId}
                </span>
              </div>

              <div className="camera-feed-live">
                <span />
                LIVE
              </div>
            </div>

            <div className="camera-details-feed">
              <WebRTCPlayer
                cameraId={cameraId}
                active={true}
              />
            </div>
          </div>

          <div className="camera-details-info-grid">
            <div className="camera-info-card">
              <div className="camera-info-icon">
                <Camera size={18} />
              </div>

              <div>
                <span className="camera-info-label">
                  Camera ID
                </span>
                <strong>{cameraId}</strong>
              </div>
            </div>

            <div className="camera-info-card">
              <div className="camera-info-icon">
                <Activity size={18} />
              </div>

              <div>
                <span className="camera-info-label">
                  Stream
                </span>
                <strong>WebRTC / WHEP</strong>
              </div>
            </div>

            <div className="camera-info-card">
              <div className="camera-info-icon">
                <MapPin size={18} />
              </div>

              <div>
                <span className="camera-info-label">
                  Location
                </span>
                <strong>Live CCTV Network</strong>
              </div>
            </div>
          </div>
        </div>

        <aside className="camera-details-sidebar">
          <div className="camera-sidebar-card">
            <div className="camera-sidebar-heading">
              <div>
                <span className="camera-sidebar-eyebrow">
                  CAMERA STATUS
                </span>
                <h2>System Status</h2>
              </div>

              <Circle
                size={13}
                fill="currentColor"
              />
            </div>

            <div className="camera-status-large">
              <span className="camera-status-large-dot" />
              <div>
                <strong>Online</strong>
                <span>Camera stream is available</span>
              </div>
            </div>

            <div className="camera-sidebar-divider" />

            <div className="camera-stat-row">
              <span>Camera</span>
              <strong>{cameraId}</strong>
            </div>

            <div className="camera-stat-row">
              <span>Protocol</span>
              <strong>WebRTC</strong>
            </div>

            <div className="camera-stat-row">
              <span>Transport</span>
              <strong>WHEP</strong>
            </div>
          </div>

          <div className="camera-sidebar-card">
            <div className="camera-sidebar-heading">
              <div>
                <span className="camera-sidebar-eyebrow">
                  ACTIVITY
                </span>
                <h2>Recent Events</h2>
              </div>
            </div>

            <div className="camera-empty-events">
              <Activity size={20} />
              <span>No recent events</span>
              <small>
                Detection activity will appear here.
              </small>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default CameraDetails;