import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Video, AlertCircle } from "lucide-react";

import api from "../services/api";
import WebRTCPlayer from "../components/cameras/WebRTCPlayer";

function Cameras() {
  const [cameras, setCameras] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeCamera, setActiveCamera] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCameras() {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/api/live-cameras");

        if (cancelled) {
          return;
        }

        const data = response.data;

        const cameraList = Array.isArray(data)
          ? data
          : Array.isArray(data?.cameras)
            ? data.cameras
            : [];

        setCameras(cameraList);
      } catch (err) {
        console.error("Failed to load cameras:", err);

        if (!cancelled) {
          setError(
            err?.response?.data?.detail ||
              "Unable to load camera catalogue."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCameras();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCameras = useMemo(() => {
    const query = search.trim().toLowerCase();

    return cameras.filter((camera) => {
      const id = String(camera?.id ?? "").toLowerCase();
      const name = String(camera?.name ?? "").toLowerCase();

      const matchesSearch =
        !query ||
        id.includes(query) ||
        name.includes(query);

      const cameraStatus =
        String(camera?.status ?? "online").toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        cameraStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [cameras, search, statusFilter]);

  return (
    <div className="cameras-page">
      <div className="cameras-header">
        <div>
          <h1>Cameras</h1>
          <p>
            {cameras.length} camera
            {cameras.length === 1 ? "" : "s"} available
          </p>
        </div>

        <div className="cameras-controls">
          <div className="camera-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search cameras..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="cameras-state">
          <Video size={28} />
          <p>Loading camera grid...</p>
        </div>
      )}

      {!loading && error && (
        <div className="cameras-state cameras-error">
          <AlertCircle size={28} />
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && filteredCameras.length === 0 && (
        <div className="cameras-state">
          <Video size={28} />
          <p>No cameras found.</p>
        </div>
      )}

      {!loading && !error && filteredCameras.length > 0 && (
        <div className="camera-grid">
          {filteredCameras.map((camera) => {
            const cameraId = String(camera.id);
            const cameraName =
              camera.name || cameraId;

            const cameraStatus =
              String(camera.status ?? "online").toLowerCase();

            const isOnline =
              cameraStatus !== "offline";

            return (
              <div
  key={cameraId}
  className={`camera-card ${
    activeCamera === cameraId ? "camera-card-active" : ""
  }`}
  onMouseEnter={() => setActiveCamera(cameraId)}
  onMouseLeave={() => setActiveCamera(null)}
>
  <div className="camera-preview">
    <WebRTCPlayer
      cameraId={cameraId}
      active={activeCamera === cameraId}
    />
  </div>

  <div className="camera-card-body">
    <div className="camera-card-heading">
      <div className="camera-name-block">
        <h3>{camera.name || cameraId}</h3>

        <div className="camera-id">
          {cameraId}
        </div>
      </div>

      <div
        className={`camera-status ${
          camera.status === "offline"
            ? "offline"
            : "online"
        }`}
      >
        <span className="status-dot" />
        {camera.status === "offline" ? "Offline" : "Online"}
      </div>
    </div>

    <div className="camera-card-footer">
      <span className="camera-location">
        CCTV Camera
      </span>

      <Link
        to={`/cameras/${encodeURIComponent(cameraId)}`}
        className="camera-details-button"
      >
        Details
      </Link>
    </div>
  </div>
</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Cameras;