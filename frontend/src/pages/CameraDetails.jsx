import { useEffect, useRef, useState } from "react";
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

  const videoRef = useRef(null);

  const detectionCanvasRef = useRef(null);

  const analysisCanvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [detectionFrame, setDetectionFrame] = useState({
  width: 1920,
  height: 1080,
});

  const [camera, setCamera] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCamera() {
    setLoading(true);
    setError("");

    try {
      const [cameraResponse, alertsResponse] = await Promise.all([
        api.get("/api/live-cameras"),
        api.get("/api/alerts"),
      ]);

      const cameras = Array.isArray(cameraResponse.data)
        ? cameraResponse.data
        : cameraResponse.data.cameras || [];

      const selectedCamera = cameras.find(
        (item) =>
          String(item.id).toLowerCase() ===
          String(cameraId).toLowerCase()
      );

      if (!selectedCamera) {
        throw new Error("Camera not found");
      }

      setCamera(selectedCamera);

      const alerts = Array.isArray(alertsResponse.data)
        ? alertsResponse.data
        : alertsResponse.data.value ||
          alertsResponse.data.alerts ||
          [];

      const cameraAlerts = alerts
        .filter(
          (alert) =>
            String(alert.camera_id) ===
            String(selectedCamera.id)
        )
        .map((alert) => ({
          ...alert,
          type: alert.alert_type || "Security Alert",
          severity: String(
            alert.priority || "Normal"
          ).toLowerCase(),
          description: `${
            alert.plate_number || "Unknown vehicle"
          } — ${
            alert.alert_type || "Security Alert"
          } (${alert.status || "Unknown status"})`,
          time: alert.timestamp,
        }));

      setEvents(cameraAlerts);
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

  /*
   * WebRTC / WHEP live camera connection
   *
   * Browser
   *    ↓
   * POST SDP offer
   *    ↓
   * Sentinel-X backend
   *    ↓
   * WHEP
   *    ↓
   * CCTV gateway
   */
  useEffect(() => {
    if (!cameraId) {
      return;
    }

    let peerConnection = null;
    let stopped = false;

    async function startWhep() {
      try {
        console.log(
          `Starting WHEP connection for ${cameraId}`
        );

        peerConnection = new RTCPeerConnection();

        peerConnection.addTransceiver("video", {
          direction: "recvonly",
        });

        peerConnection.ontrack = (event) => {
  console.log("WHEP TRACK RECEIVED:", event);

  if (event.track) {
    console.log(
      "WHEP TRACK:",
      event.track.kind,
      event.track.readyState
    );
  }

  if (videoRef.current) {
    const stream =
      event.streams?.[0] ||
      new MediaStream([event.track]);

    videoRef.current.srcObject = stream;

    videoRef.current
      .play()
      .then(() => {
        console.log("WHEP VIDEO PLAYING");
      })
      .catch((err) => {
        console.error(
          "WHEP VIDEO PLAY ERROR:",
          err
        );
      });
  }
};

        peerConnection.onconnectionstatechange = () => {
          console.log(
            `WHEP connection state for ${cameraId}:`,
            peerConnection?.connectionState
          );
        };

        peerConnection.oniceconnectionstatechange =
          () => {
            console.log(
              `WHEP ICE state for ${cameraId}:`,
              peerConnection?.iceConnectionState
            );
          };

        const offer =
          await peerConnection.createOffer();

        await peerConnection.setLocalDescription(
          offer
        );

        /*
         * Wait until ICE gathering is complete.
         *
         * This makes sure the SDP sent to the backend
         * contains the ICE candidates needed by the
         * WHEP server.
         */
        await new Promise((resolve) => {
          if (
            peerConnection.iceGatheringState ===
            "complete"
          ) {
            resolve();
            return;
          }

          const checkIce = () => {
            if (
              peerConnection.iceGatheringState ===
              "complete"
            ) {
              peerConnection.removeEventListener(
                "icegatheringstatechange",
                checkIce
              );

              resolve();
            }
          };

          peerConnection.addEventListener(
            "icegatheringstatechange",
            checkIce
          );
        });

        if (stopped) {
          return;
        }

        const baseUrl =
          api.defaults.baseURL || "";

        const whepUrl =
          `${baseUrl}/api/cctv/whep/` +
          encodeURIComponent(cameraId);

        console.log(
          `Sending WHEP offer to ${whepUrl}`
        );

        const response = await fetch(whepUrl, {
  method: "POST",
  credentials: "include",
  headers: {
            "Content-Type": "application/sdp",
            Accept: "application/sdp",
          },
          body:
            peerConnection.localDescription.sdp,
        });

        if (!response.ok) {
          const message =
            await response.text();

          throw new Error(
            `WHEP signaling failed: ${response.status} ${message}`
          );
        }

        const answerSdp =
          await response.text();

        if (stopped) {
          return;
        }

        await peerConnection.setRemoteDescription(
          {
            type: "answer",
            sdp: answerSdp,
          }
        );

        console.log(
          `WHEP connection established for ${cameraId}`
        );
      } catch (err) {
        console.error(
          `WHEP connection error for ${cameraId}:`,
          err
        );
      }
    }

    startWhep();

    return () => {
      stopped = true;

      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraId]);

  useEffect(() => {
  if (!cameraId || !videoRef.current) {
    return;
  }

  let stopped = false;
  let busy = false;
  let timeoutId = null;

  const video = videoRef.current;
  const canvas =
    analysisCanvasRef.current ||
    document.createElement("canvas");

  async function analyzeCurrentFrame() {
    if (stopped || busy) {
      return;
    }

    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      timeoutId = window.setTimeout(
        analyzeCurrentFrame,
        250
      );
      return;
    }

    busy = true;

    try {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;

      const maxWidth = 960;
      const scale = Math.min(
        1,
        maxWidth / sourceWidth
      );

      const width = Math.max(
        1,
        Math.round(sourceWidth * scale)
      );

      const height = Math.max(
        1,
        Math.round(sourceHeight * scale)
      );

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      ctx.drawImage(
        video,
        0,
        0,
        width,
        height
      );

      const blob = await new Promise(
        (resolve) => {
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.65
          );
        }
      );

      if (!blob || stopped) {
        return;
      }

      const response = await api.post(
        `/api/cctv/analyze-frame/${encodeURIComponent(
          cameraId
        )}`,
        blob,
        {
          headers: {
            "Content-Type": "image/jpeg",
          },
          timeout: 5000,
        }
      );

      if (stopped) {
        return;
      }

      setDetections(
        response.data.vehicles || []
      );

      setDetectionFrame({
        width:
          Number(
            response.data.frame_width
          ) || width,
        height:
          Number(
            response.data.frame_height
          ) || height,
      });
    } catch (err) {
      if (!stopped) {
        console.error(
          `WHEP frame AI error for ${cameraId}:`,
          err
        );
      }
    } finally {
      busy = false;

      if (!stopped) {
        timeoutId = window.setTimeout(
          analyzeCurrentFrame,
          250
        );
      }
    }
  }

  analyzeCurrentFrame();

  return () => {
    stopped = true;

    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  };
}, [cameraId, camera]);
useEffect(() => {
  const canvas = detectionCanvasRef.current;
  const video = videoRef.current;

  if (!canvas || !video) {
    return;
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  let animationFrameId = null;

  const resizeCanvas = () => {
    const rect = video.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;

    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);

    if (
      canvas.width !== width ||
      canvas.height !== height
    ) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  const drawDetections = () => {
    const rect = video.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      animationFrameId = requestAnimationFrame(drawDetections);
      return;
    }

    resizeCanvas();

    const dpr = window.devicePixelRatio || 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(
      0,
      0,
      rect.width,
      rect.height
    );

    const scaleX =
      rect.width / detectionFrame.width;

    const scaleY =
      rect.height / detectionFrame.height;

    detections.forEach((detection) => {
      const [x1, y1, x2, y2] =
        detection.bbox || [];

      if (
        !Number.isFinite(x1) ||
        !Number.isFinite(y1) ||
        !Number.isFinite(x2) ||
        !Number.isFinite(y2)
      ) {
        return;
      }

      const left = x1 * scaleX;
      const top = y1 * scaleY;
      const width = (x2 - x1) * scaleX;
      const height = (y2 - y1) * scaleY;

      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        left,
        top,
        width,
        height
      );

      const confidence =
        Math.round(
          Number(detection.confidence || 0) * 100
        );

      const trackLabel =
        detection.track_id != null
          ? ` #${detection.track_id}`
          : "";

      const label =
        `${detection.vehicle_type || "vehicle"} ` +
        `${confidence}%${trackLabel}`;

      ctx.font = "600 12px Arial";

      const textWidth =
        ctx.measureText(label).width;

      const labelHeight = 20;
      const labelTop =
        Math.max(0, top - labelHeight);

      ctx.fillStyle =
        "rgba(34, 197, 94, 0.92)";

      ctx.fillRect(
        left,
        labelTop,
        textWidth + 10,
        labelHeight
      );

      ctx.fillStyle = "#ffffff";

      ctx.fillText(
        label,
        left + 5,
        Math.max(14, labelTop + 14)
      );
    });

    animationFrameId =
      requestAnimationFrame(drawDetections);
  };

  const resizeObserver =
    new ResizeObserver(() => {
      resizeCanvas();
    });

  resizeObserver.observe(video);

  resizeCanvas();
  animationFrameId =
    requestAnimationFrame(drawDetections);

  return () => {
    resizeObserver.disconnect();

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  };
}, [detections, detectionFrame]);
  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen">
          <RefreshCw
            className="spin"
            size={28}
          />

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
    String(camera.status || "").toLowerCase() ===
    "online";

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
              <h2>
                {camera.name || camera.id}
              </h2>

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

          <div
  className="camera-stream"
  style={{ position: "relative" }}
>
  <video
  ref={videoRef}
  autoPlay
  muted
  playsInline
  className="camera-live-feed"
  style={{
    position: "relative",
    zIndex: 1,
    display: "block",
  }}
/>

<canvas
  ref={detectionCanvasRef}
  className="camera-detection-overlay"
  style={{
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    zIndex: 20,
    pointerEvents: "none",
    display: "block",
  }}
/>
</div>
        </section>

        <section className="camera-health-panel">
          <div className="panel-header">
            <div>
              <h3>Camera Health</h3>

              <p>
                Current camera information
              </p>
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

              <strong>
                {camera.fps ?? "—"}
              </strong>
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

              <strong>
                {camera.id}
              </strong>
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
              Latest events from{" "}
              {camera.name || camera.id}
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
                key={
                  event.id || index
                }
              >
                <div className="event-indicator"></div>

                <div className="event-info">
                  <strong>
                    {event.type ||
                      "Camera Event"}
                  </strong>

                  <span>
                    {event.description ||
                      event.message ||
                      "Event received from camera"}
                  </span>
                </div>

                <div className="event-meta">
                  <span className="severity">
                    {event.severity ||
                      "Normal"}
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