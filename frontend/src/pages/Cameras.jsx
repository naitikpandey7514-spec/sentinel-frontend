import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Camera,
  WifiOff,
} from "lucide-react";

import api from "../services/api";
import { normalizeCameras } from "../data/mockData";
import CameraCard from "../components/cameras/CameraCard";

function Cameras() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  async function loadCameras() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        "/api/live-cameras"
      );

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.cameras || [];

      setCameras(normalizeCameras(data));
    } catch (err) {
      console.error("Camera API error:", err);

      setCameras([]);
      setError(
        "Unable to connect to the CCTV backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCameras();
  }, []);

  const filteredCameras = useMemo(() => {
    return cameras.filter((camera) => {
      const text = `
        ${camera.id || ""}
        ${camera.name || ""}
        ${camera.location || ""}
        ${camera.type || ""}
      `.toLowerCase();

      const matchesSearch = text.includes(
        search.toLowerCase()
      );

      const cameraStatus = String(
        camera.status || "Unknown"
      ).toLowerCase();

      const matchesStatus =
        status === "All" ||
        cameraStatus === status.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [cameras, search, status]);

  return (
    <div className="page cameras-page">
      <div className="page-header">
        <div>
          <div className="title-row">
            <Camera size={24} />

            <h2>Camera Registry</h2>
          </div>

          <p>
            Monitor the Sentinel CCTV camera network.
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

      <div className="camera-toolbar">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search camera, ID or location..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div className="filter-buttons">
          {["All", "Online", "Offline"].map(
            (item) => (
              <button
                key={item}
                className={
                  status === item
                    ? "filter-button active"
                    : "filter-button"
                }
                onClick={() => setStatus(item)}
              >
                {item}
              </button>
            )
          )}
        </div>
      </div>

      {error && (
        <div className="connection-error compact">
          <WifiOff size={22} />

          <div>
            <strong>
              Camera Backend Unavailable
            </strong>

            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen">
          <RefreshCw
            className="spin"
            size={28}
          />

          <p>Loading CCTV cameras...</p>
        </div>
      ) : filteredCameras.length === 0 ? (
        <div className="empty-state large">
          <Camera size={35} />

          <h3>No Cameras Found</h3>

          <p>
            {error
              ? "Connect the Sentinel-X backend to load the real camera registry."
              : "No cameras match your search or filter."}
          </p>
        </div>
      ) : (
        <div className="camera-grid">
          {filteredCameras.map((camera) => (
            <CameraCard
              key={camera.id}
              camera={camera}
            />
          ))}
        </div>
      )}

      {!loading && cameras.length > 0 && (
        <div className="camera-footer">
          <span>
            Showing {filteredCameras.length} of{" "}
            {cameras.length} cameras
          </span>

          <span>
            <span className="online-dot" />
            Live registry
          </span>
        </div>
      )}
    </div>
  );
}

export default Cameras;