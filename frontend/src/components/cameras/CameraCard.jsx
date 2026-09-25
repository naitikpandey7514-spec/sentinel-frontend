import { useEffect, useRef, useState } from "react";
import { Camera, Wifi, WifiOff, LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import CameraStatus from "./CameraStatus";
import api from "../../services/api";

function CameraCard({ camera }) {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const abortRef = useRef(null);

  const [hovered, setHovered] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [previewLive, setPreviewLive] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const cameraId = String(camera.id || "").trim();

  const cameraStatus = String(
  camera.status || "Unknown"
).toLowerCase();

const isOnline =
  cameraStatus === "online" ||
  cameraStatus === "connected" ||
  cameraStatus === "active" ||
  cameraStatus === "healthy" ||
  cameraStatus === "unknown";

console.log("CAMERA CARD DATA:", {
  id: camera.id,
  cameraId,
  status: camera.status,
  isOnline,
  camera,
});

  function stopPreview() {
    abortRef.current?.abort();
    abortRef.current = null;

    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setConnecting(false);
    setPreviewLive(false);
  }

  async function startPreview() {
    if (!hovered || !isOnline || !cameraId) {
      return;
    }

    stopPreview();

    const controller = new AbortController();
    abortRef.current = controller;

    setConnecting(true);
    setPreviewError(false);
    console.log("HOVER PREVIEW START:", cameraId);
    try {
      const peer = new RTCPeerConnection({
        iceServers: [],
      });

      peerRef.current = peer;

      peer.addTransceiver("video", {
        direction: "recvonly",
      });

      peer.ontrack = (event) => {
  console.log("HOVER WHEP TRACK:", cameraId, event);

  if (!videoRef.current) {
    console.log("HOVER VIDEO REF MISSING:", cameraId);
    return;
  }

  const stream =
    event.streams?.[0] ||
    new MediaStream([event.track]);

  videoRef.current.srcObject = stream;

  videoRef.current
    .play()
    .then(() => {
      console.log("HOVER VIDEO PLAYING:", cameraId);
    })
    .catch((error) => {
      console.error(
  "HOVER WHEP ERROR:",
  cameraId,
  error
);
    });

  setConnecting(false);
  setPreviewLive(true);
};

      peer.onconnectionstatechange = () => {
        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "closed" ||
          peer.connectionState === "disconnected"
        ) {
          setPreviewLive(false);

          if (
            peer.connectionState === "failed"
          ) {
            setPreviewError(true);
          }
        }
      };

      const offer = await peer.createOffer();

await peer.setLocalDescription(offer);

/* Wait for ICE gathering to complete */
await new Promise((resolve) => {
  if (peer.iceGatheringState === "complete") {
    resolve();
    return;
  }

  const checkIce = () => {
    if (peer.iceGatheringState === "complete") {
      peer.removeEventListener(
        "icegatheringstatechange",
        checkIce
      );
      resolve();
    }
  };

  peer.addEventListener(
    "icegatheringstatechange",
    checkIce
  );
});

if (controller.signal.aborted) {
  return;
}

const response = await api.post(
        `/api/cctv/whep/${encodeURIComponent(
          cameraId
        )}`,
        offer.sdp,
        {
          signal: controller.signal,
          headers: {
            "Content-Type": "application/sdp",
          },
          transformResponse: [
            (data) => data,
          ],
        }
      );

      if (controller.signal.aborted) {
        return;
      }

      const answerSdp =
        typeof response.data === "string"
          ? response.data
          : response.data?.sdp;

      if (!answerSdp) {
        throw new Error(
          "WHEP server returned no SDP answer."
        );
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (error) {
      if (
        error?.code === "ERR_CANCELED" ||
        controller.signal.aborted
      ) {
        return;
      }

      console.error(
        `Camera preview error (${cameraId}):`,
        error
      );

      setConnecting(false);
      setPreviewLive(false);
      setPreviewError(true);
    }
  }

  useEffect(() => {
    if (hovered) {
      startPreview();
    } else {
      stopPreview();
    }

    return () => {
      stopPreview();
    };
  }, [hovered, cameraId, isOnline]);

  function openDetails() {
    navigate(
      `/cameras/${encodeURIComponent(cameraId)}`
    );
  }

  return (
    <article
      className={`camera-card ${
        hovered ? "camera-card-hovered" : ""
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={openDetails}
    >
      <div className="camera-preview">
        <div className="camera-preview-placeholder">
          <Camera size={34} />
        </div>

        <video
          ref={videoRef}
          className={`camera-hover-video ${
            previewLive ? "visible" : ""
          }`}
          muted
          autoPlay
          playsInline
        />

        <div className="camera-preview-overlay">
          <div className="camera-preview-name">
            <strong>
              {camera.name || cameraId}
            </strong>

            <span>{cameraId}</span>
          </div>

          <CameraStatus
            status={camera.status}
          />
        </div>

        {hovered && connecting && (
          <div className="camera-preview-loading">
            <LoaderCircle
              size={24}
              className="spin"
            />

            <span>Connecting live feed…</span>
          </div>
        )}

        {hovered &&
          !connecting &&
          !previewLive &&
          (previewError || !isOnline) && (
            <div className="camera-preview-offline">
              {isOnline ? (
                <>
                  <WifiOff size={24} />
                  <span>Preview unavailable</span>
                </>
              ) : (
                <>
                  <WifiOff size={24} />
                  <span>Camera offline</span>
                </>
              )}
            </div>
          )}

        {previewLive && (
          <div className="camera-live-indicator">
            <span className="live-pulse" />
            LIVE
          </div>
        )}
      </div>

      <div className="camera-card-body">
        <div className="camera-card-heading">
          <div className="camera-card-icon">
            {isOnline ? (
              <Wifi size={17} />
            ) : (
              <WifiOff size={17} />
            )}
          </div>

          <div>
            <h3>
              {camera.name || cameraId}
            </h3>

            <p>
              {camera.location ||
                "Location unavailable"}
            </p>
          </div>
        </div>

        <div className="camera-card-info">
          <span>
            {camera.type || "CCTV"}
          </span>

          <span>
            {camera.resolution || "—"}
          </span>

          <span>
            {camera.fps ?? "—"} FPS
          </span>
        </div>

        <div className="camera-card-footer">
          <span
            className={
              isOnline
                ? "camera-online"
                : "camera-offline"
            }
          >
            <span className="camera-status-dot" />
            {camera.status || "Unknown"}
          </span>

          <span className="camera-view-hint">
            {hovered
              ? "Opening live preview"
              : "Hover for live preview"}
          </span>
        </div>
      </div>
    </article>
  );
}

export default CameraCard;