import { useEffect, useState } from "react";
import {
  Camera,
  MapPin,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";

function CommandMap() {
  const navigate = useNavigate();

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCameras() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/cameras");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.cameras || [];

      setCameras(data);

      if (data.length > 0) {
        setSelectedCamera(data[0]);
      }
    } catch (err) {
      console.error("Map camera API error:", err);
      setCameras([]);
      setSelectedCamera(null);
      setError(
        "Unable to load camera locations from the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCameras();
  }, []);

  return (
    <div className="page command-map-page">
      <div className="page-header">
        <div>
          <div className="title-row">
            <MapPin size={24} />
            <h2>Command Map</h2>
          </div>

          <p>
            Monitor camera locations and current camera status.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadCameras}
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
            <strong>Map Data Unavailable</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen">
          <RefreshCw className="spin" size={28} />
          <p>Loading camera locations...</p>
        </div>
      ) : cameras.length === 0 ? (
        <div className="empty-state large">
          <MapPin size={36} />

          <h3>No Camera Locations</h3>

          <p>
            Connect the Sentinel-X backend to display
            real camera locations.
          </p>
        </div>
      ) : (
        <div className="map-layout">
          <section className="map-container">
            <div className="map-header">
              <div>
                <strong>Sentinel CCTV Network</strong>
                <span>
                  {cameras.length} registered cameras
                </span>
              </div>

              <div className="map-status">
                <span className="online-dot"></span>
                Live Registry
              </div>
            </div>

            <div className="map-area">
              <div className="map-grid"></div>

              <div className="map-center-label">
                <MapPin size={24} />
                <strong>Camera Network</strong>
                <span>
                  Geographic map will use real coordinates
                  supplied by the backend.
                </span>
              </div>

              {cameras.map((camera, index) => {
                const isOnline =
                  String(camera.status || "")
                    .toLowerCase() === "online";

                const latitude = Number(
                  camera.latitude
                );

                const longitude = Number(
                  camera.longitude
                );

                /*
                  The marker is displayed only when the
                  backend supplies valid coordinates.
                */
                if (
                  !Number.isFinite(latitude) ||
                  !Number.isFinite(longitude)
                ) {
                  return null;
                }

                const left =
                  ((longitude + 180) / 360) * 100;

                const top =
                  ((90 - latitude) / 180) * 100;

                return (
                  <button
                    key={camera.id || index}
                    className={
                      isOnline
                        ? "map-marker online"
                        : "map-marker offline"
                    }
                    style={{
                      left: `${Math.max(
                        5,
                        Math.min(95, left)
                      )}%`,
                      top: `${Math.max(
                        8,
                        Math.min(92, top)
                      )}%`,
                    }}
                    title={
                      camera.name || camera.id
                    }
                    onClick={() =>
                      setSelectedCamera(camera)
                    }
                  >
                    <Camera size={15} />
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="map-sidebar">
            <div className="map-sidebar-header">
              <div>
                <h3>Camera List</h3>
                <p>
                  {cameras.length} cameras
                </p>
              </div>
            </div>

            <div className="map-camera-list">
              {cameras.map((camera) => {
                const isOnline =
                  String(camera.status || "")
                    .toLowerCase() === "online";

                const selected =
                  selectedCamera?.id === camera.id;

                return (
                  <button
                    key={camera.id}
                    className={
                      selected
                        ? "map-camera-item selected"
                        : "map-camera-item"
                    }
                    onClick={() =>
                      setSelectedCamera(camera)
                    }
                  >
                    <div className="map-camera-icon">
                      <Camera size={17} />
                    </div>

                    <div className="map-camera-info">
                      <strong>
                        {camera.name || camera.id}
                      </strong>

                      <span>
                        {camera.location ||
                          camera.id}
                      </span>
                    </div>

                    <span
                      className={
                        isOnline
                          ? "camera-status-dot online"
                          : "camera-status-dot offline"
                      }
                    ></span>
                  </button>
                );
              })}
            </div>

            {selectedCamera && (
              <div className="selected-camera">
                <div className="selected-camera-title">
                  <div>
                    <span>Selected Camera</span>
                    <h3>
                      {selectedCamera.name ||
                        selectedCamera.id}
                    </h3>
                  </div>

                  {String(
                    selectedCamera.status || ""
                  ).toLowerCase() === "online" ? (
                    <Wifi size={19} />
                  ) : (
                    <WifiOff size={19} />
                  )}
                </div>

                <div className="selected-details">
                  <div>
                    <span>ID</span>
                    <strong>
                      {selectedCamera.id}
                    </strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>
                      {selectedCamera.status ||
                        "Unknown"}
                    </strong>
                  </div>

                  <div>
                    <span>Location</span>
                    <strong>
                      {selectedCamera.location ||
                        "—"}
                    </strong>
                  </div>
                </div>

                <button
                  className="view-camera-button"
                  onClick={() =>
                    navigate(
                      `/cameras/${selectedCamera.id}`
                    )
                  }
                >
                  <Camera size={17} />
                  Open Camera
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default CommandMap;