import { useEffect, useRef, useState } from "react";
import {
  Camera,
  MapPin,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";

import api from "../services/api";

import "leaflet/dist/leaflet.css";
function hasCoordinates(camera) {
  const latitude = camera?.latitude;
  const longitude = camera?.longitude;

  if (
    latitude === null ||
    latitude === undefined ||
    latitude === "" ||
    longitude === null ||
    longitude === undefined ||
    longitude === ""
  ) {
    return false;
  }

  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude))
  );
}
function CommandMap() {
  const navigate = useNavigate();

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCameras() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/live-cameras");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.cameras || [];

      setCameras(data);

      if (data.length > 0) {
        setSelectedCamera((current) => current || data[0]);
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

    useEffect(() => {
  if (!mapRef.current || mapInstanceRef.current) {
    return;
  }

  const map = L.map(mapRef.current, {
  center: [22.2587, 71.1924],
  zoom: 7,
  minZoom: 5,
  maxZoom: 19,
  zoomControl: true,
});

    L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 0,
    maxZoom: 19,
    maxNativeZoom: 19,
  }
).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    map.invalidateSize(true);
  });
});

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, [loading]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;

    if (!map || !layer) {
      return;
    }

    layer.clearLayers();

    const validCameras = cameras.filter(hasCoordinates);

    validCameras.forEach((camera) => {
      const latitude = Number(camera.latitude);
      const longitude = Number(camera.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const status = String(
        camera.status || "Unknown"
      ).toLowerCase();

      const isOnline =
        status === "online" ||
        status === "connected" ||
        status === "active" ||
        status === "healthy" ||
        status === "unknown";

      const color = isOnline ? "#16a34a" : "#dc2626";

      const icon = L.divIcon({
        className: "sentinel-camera-marker",
        html: `
          <div style="
            width:34px;
            height:34px;
            border-radius:50%;
            background:${color};
            border:3px solid white;
            box-shadow:0 2px 10px rgba(0,0,0,.45);
            display:flex;
            align-items:center;
            justify-content:center;
            color:white;
            font-size:11px;
            font-weight:700;
          ">
            ${camera.id || "CAM"}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker(
        [latitude, longitude],
        { icon }
      );

      marker.bindPopup(`
        <div style="min-width:200px">
          <strong>${camera.name || camera.id}</strong>
          <br />
          <strong>ID:</strong> ${camera.id}
          <br />
          <strong>Status:</strong> ${camera.status || "Unknown"}
          <br />
          <strong>Location:</strong> ${
            camera.location || "Unknown"
          }
        </div>
      `);

      marker.on("click", () => {
        setSelectedCamera(camera);
      });

      marker.addTo(layer);
    });

    if (validCameras.length > 0) {
      const bounds = L.latLngBounds(
        validCameras.map((camera) => [
          Number(camera.latitude),
          Number(camera.longitude),
        ])
      );

      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 14,
      });
    }
  }, [cameras]);

  function selectCamera(camera) {
    setSelectedCamera(camera);

    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const latitude = Number(camera.latitude);
    const longitude = Number(camera.longitude);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      map.flyTo(
        [latitude, longitude],
        16,
        { duration: 0.8 }
      );
    }
  }

  function showAllCameras() {
    const map = mapInstanceRef.current;

    if (!map) {
      return;
    }

    const validCameras = cameras.filter(hasCoordinates);

    if (!validCameras.length) {
      return;
    }

    const bounds = L.latLngBounds(
      validCameras.map((camera) => [
        Number(camera.latitude),
        Number(camera.longitude),
      ])
    );

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 14,
    });
  }

  return (
    <div className="page command-map-page">
      <div className="page-header">
        <div>
          <div className="title-row">
            <MapPin size={24} />
            <h2>Command Map</h2>
          </div>

          <p>
            Monitor the Sentinel-X camera network geographically.
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
          <RefreshCw
            className="spin"
            size={28}
          />
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

              <div className="map-actions">
                <button
                  className="map-action-button"
                  onClick={showAllCameras}
                >
                  <MapPin size={15} />
                  Show All
                </button>

                <div className="map-status">
                  <span className="online-dot" />
                  Live Registry
                </div>
              </div>
            </div>

            <div
              ref={mapRef}
              className="map-area leaflet-map"
            />
          </section>

          <aside className="map-sidebar">
            <div className="map-sidebar-header">
              <div>
                <h3>Camera List</h3>
                <p>{cameras.length} cameras</p>
              </div>
            </div>

            <div className="map-camera-list">
              {cameras.map((camera) => {
                const status = String(
                  camera.status || "Unknown"
                ).toLowerCase();

                const isOnline =
                  status === "online" ||
                  status === "connected" ||
                  status === "active" ||
                  status === "healthy" ||
                  status === "unknown";

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
                      selectCamera(camera)
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
                    />
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

                  <Wifi size={19} />
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

                  <div>
                    <span>Coordinates</span>
                    <strong>
                      {selectedCamera.latitude},{" "}
                      {selectedCamera.longitude}
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