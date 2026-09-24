import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Camera,
  Wifi,
  WifiOff,
  Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";

function Cameras() {
  const navigate = useNavigate();

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");

  async function loadCameras() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/cameras");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data.cameras || [];

      setCameras(data);
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

      const matchesSearch =
        text.includes(search.toLowerCase());

      const cameraStatus =
        String(camera.status || "Unknown").toLowerCase();

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
            Manage and monitor connected Sentinel CCTV cameras.
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
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          {["All", "Online", "Offline"].map((item) => (
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
          ))}
        </div>
      </div>

      {error && (
        <div className="connection-error compact">
          <WifiOff size={22} />

          <div>
            <strong>Camera Backend Unavailable</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen">
          <RefreshCw className="spin" size={28} />
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
        <div className="camera-table-wrapper">
          <table className="camera-table">
            <thead>
              <tr>
                <th>Camera</th>
                <th>Location</th>
                <th>Type</th>
                <th>Status</th>
                <th>Resolution</th>
                <th>FPS</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredCameras.map((camera) => {
                const isOnline =
                  String(camera.status).toLowerCase() ===
                  "online";

                return (
                  <tr key={camera.id}>
                    <td>
                      <div className="camera-name">
                        <div className="camera-icon">
                          <Camera size={18} />
                        </div>

                        <div>
                          <strong>
                            {camera.name || camera.id}
                          </strong>

                          <span>
                            {camera.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      {camera.location || "—"}
                    </td>

                    <td>
                      {camera.type || "CCTV"}
                    </td>

                    <td>
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
                    </td>

                    <td>
                      {camera.resolution || "—"}
                    </td>

                    <td>
                      {camera.fps ?? "—"}
                    </td>

                    <td>
                      <button
                        className="view-button"
                        onClick={() =>
                          navigate(
                            `/cameras/${camera.id}`
                          )
                        }
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && cameras.length > 0 && (
        <div className="camera-footer">
          <span>
            Showing {filteredCameras.length} of{" "}
            {cameras.length} cameras
          </span>

          <span>
            <span className="online-dot"></span>
            Live registry
          </span>
        </div>
      )}
    </div>
  );
}

export default Cameras;