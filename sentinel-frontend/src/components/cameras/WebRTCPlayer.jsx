import { useEffect, useRef, useState } from "react";
import api from "../../services/api";

function WebRTCPlayer({ cameraId, active }) {
  const videoRef = useRef(null);
  const peerRef = useRef(null);

  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!active) {
      setStatus("idle");
      setErrorMessage("");

      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      return;
    }

    let cancelled = false;

    async function startStream() {
      let pc = null;

      try {
        setStatus("connecting");
        setErrorMessage("");

        pc = new RTCPeerConnection();
        peerRef.current = pc;

        pc.addTransceiver("video", {
          direction: "recvonly",
        });

        pc.addTransceiver("audio", {
          direction: "recvonly",
        });

        pc.ontrack = (event) => {
          if (cancelled || !videoRef.current) return;

          const stream = event.streams?.[0];

          if (stream) {
            videoRef.current.srcObject = stream;
            setStatus("live");
          }
        };

        pc.onconnectionstatechange = () => {
          if (cancelled) return;

          if (
            pc.connectionState === "failed" ||
            pc.connectionState === "disconnected"
          ) {
            setStatus("error");
            setErrorMessage("Connection lost");
          }

          if (pc.connectionState === "connected") {
            setStatus("live");
          }
        };

        const offer = await pc.createOffer();

        if (cancelled) {
          pc.close();
          return;
        }

        await pc.setLocalDescription(offer);

        const response = await fetch(
          `${api.defaults.baseURL}/api/cctv/whep/${encodeURIComponent(
            cameraId
          )}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/sdp",
              Accept: "application/sdp",
            },
            body: pc.localDescription.sdp,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();

          throw new Error(
            `WHEP ${response.status}: ${errorText || "Request failed"}`
          );
        }

        const answer = await response.text();

        if (cancelled) {
          pc.close();
          return;
        }

        await pc.setRemoteDescription({
          type: "answer",
          sdp: answer,
        });
      } catch (error) {
        console.error(`WebRTC error for ${cameraId}:`, error);

        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Live preview unavailable");
        }

        if (pc) {
          pc.close();
        }

        if (peerRef.current === pc) {
          peerRef.current = null;
        }
      }
    }

    startStream();

    return () => {
      cancelled = true;

      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [cameraId, active]);

  return (
    <div className="camera-live-feed">
      <video
        ref={videoRef}
        className="webrtc-player"
        autoPlay
        muted
        playsInline
      />

      {!active && (
        <div className="stream-overlay stream-overlay-idle">
          <div className="stream-overlay-icon">▶</div>
          <span>Hover to preview</span>
        </div>
      )}

      {active && status === "connecting" && (
        <div className="stream-overlay">
          <div className="stream-spinner" />
          <span>Connecting to camera...</span>
        </div>
      )}

      {active && status === "error" && (
        <div className="stream-overlay stream-overlay-error">
          <div className="stream-error-icon">!</div>
          <span>{errorMessage || "Live preview unavailable"}</span>
        </div>
      )}

      {status === "live" && (
        <div className="stream-status-badge">
          <span className="live-dot" />
          LIVE
        </div>
      )}
    </div>
  );
}

export default WebRTCPlayer;