import api from "../services/api";
import SegmentAI from "./SegmentAI";
import {
  Circle,
  Eye,
  EyeOff,
  HardDrive,
  Pause,
  Play,
  Radio,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DB_NAME = "sentinel_x_local_recordings_v1";
const STORE_NAME = "segments";
const SEGMENT_MS = 10000;
const MAX_SEGMENTS = 180;

function openRecordingDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(
          STORE_NAME,
          { keyPath: "id" }
        );

        store.createIndex(
          "cameraId",
          "cameraId",
          { unique: false }
        );

        store.createIndex(
          "startAt",
          "startAt",
          { unique: false }
        );
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function getCameraSegments(cameraId) {
  const db = await openRecordingDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly"
    );

    const store = transaction.objectStore(
      STORE_NAME
    );

    const request = store.getAll();

    request.onsuccess = () => {
      const rows = request.result
        .filter(
          (item) =>
            item.cameraId === cameraId
        )
        .sort(
          (a, b) =>
            a.startAt - b.startAt
        );

      resolve(rows);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function saveSegment(segment) {
  const db = await openRecordingDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    transaction.objectStore(
      STORE_NAME
    ).put(segment);

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

async function deleteCameraSegments(cameraId) {
  const db = await openRecordingDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const store = transaction.objectStore(
      STORE_NAME
    );

    const request = store.getAll();

    request.onsuccess = () => {
      request.result
        .filter(
          (item) =>
            item.cameraId === cameraId
        )
        .forEach((item) => {
          store.delete(item.id);
        });
    };

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

async function pruneSegments(cameraId) {
  const segments =
    await getCameraSegments(cameraId);

  if (segments.length <= MAX_SEGMENTS) {
    return segments;
  }

  const removeCount =
    segments.length - MAX_SEGMENTS;

  const db = await openRecordingDb();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite"
    );

    const store = transaction.objectStore(
      STORE_NAME
    );

    segments
      .slice(0, removeCount)
      .forEach((item) => {
        store.delete(item.id);
      });

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };
  });

  return segments.slice(removeCount);
}

function formatDuration(seconds) {
  const value = Math.max(
    0,
    Math.floor(Number(seconds) || 0)
  );

  const hours = Math.floor(
    value / 3600
  );

  const minutes = Math.floor(
    (value % 3600) / 60
  );

  const secs = value % 60;

  if (hours > 0) {
    return `${hours}:${String(
      minutes
    ).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(
    secs
  ).padStart(2, "0")}`;
}

function formatClock(timestamp) {
  if (!timestamp) {
    return "--:--:--";
  }

  return new Date(
    timestamp
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getRecorderMimeType() {
  if (
    typeof MediaRecorder ===
      "undefined"
  ) {
    return "";
  }

  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  return (
    candidates.find((type) =>
      MediaRecorder.isTypeSupported
        ? MediaRecorder.isTypeSupported(
            type
          )
        : false
    ) || ""
  );
}

function LocalRecordingPanel({
  videoRef,
  cameraId,
}) {
  const [
    segments,
    setSegments,
  ] = useState([]);

  const [
    recording,
    setRecording,
  ] = useState(false);

  const [
    reviewMode,
    setReviewMode,
  ] = useState(false);

  const [
    playbackIndex,
    setPlaybackIndex,
  ] = useState(-1);

  const [
    timelinePosition,
    setTimelinePosition,
  ] = useState(0);

  const [
    isPaused,
    setIsPaused,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    panelVisible,
    setPanelVisible,
  ] = useState(true);

  const [
    timelineVisible,
    setTimelineVisible,
  ] = useState(true);

  const recorderRef =
    useRef(null);

  const streamRef =
    useRef(null);

  const timerRef =
    useRef(null);

  const pendingPlaybackRef =
    useRef(null);

  const playbackVideoRef =
    useRef(null);

  const playbackCanvasRef =
    useRef(null);

  const playbackAnalysisCanvasRef =
    useRef(null);

  const objectUrlRef =
    useRef(null);

  const recordingRef =
    useRef(false);

  const playbackOffsetRef =
    useRef(0);

  const [
    storageBytes,
    setStorageBytes,
  ] = useState(0);

  const [
    playbackDetections,
    setPlaybackDetections,
  ] = useState([]);

  const [
    playbackDetectionFrame,
    setPlaybackDetectionFrame,
  ] = useState({
    width: 1920,
    height: 1080,
  });

  const refreshSegments =
    async () => {
      try {
        const rows =
          await getCameraSegments(
            cameraId
          );

        setSegments(rows);

        setStorageBytes(
          rows.reduce(
            (total, item) =>
              total +
              Number(item.size || 0),
            0
          )
        );
      } catch (err) {
        console.error(
          "Local recording load error:",
          err
        );

        setError(
          "Local recording storage is unavailable."
        );
      }
    };

  useEffect(() => {
    refreshSegments();

    return () => {
      if (timerRef.current) {
        window.clearTimeout(
          timerRef.current
        );
      }

      if (
        recorderRef.current &&
        recorderRef.current.state !==
          "inactive"
      ) {
        try {
          recorderRef.current.stop();
        } catch {
          // Ignore recorder cleanup errors.
        }
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      if (objectUrlRef.current) {
        URL.revokeObjectURL(
          objectUrlRef.current
        );
      }
    };
  }, [cameraId]);

  const totalDuration =
    useMemo(() => {
      if (segments.length === 0) {
        return 0;
      }

      const start =
        segments[0].startAt;

      const end =
        segments[segments.length - 1]
          .endAt;

      return Math.max(
        0,
        (end - start) / 1000
      );
    }, [segments]);

  const startSegment =
    () => {
      const stream =
        streamRef.current;

      if (!stream) {
        setRecording(false);
        recordingRef.current =
          false;
        return;
      }

      const mimeType =
        getRecorderMimeType();

      let recorder;

      try {
        recorder = mimeType
          ? new MediaRecorder(
              stream,
              {
                mimeType,
                videoBitsPerSecond:
                  1200000,
              }
            )
          : new MediaRecorder(
              stream
            );
      } catch (err) {
        console.error(
          "MediaRecorder creation error:",
          err
        );

        setError(
          "This browser cannot record the live feed locally."
        );

        setRecording(false);
        recordingRef.current =
          false;
        return;
      }

      const chunks = [];
      const startedAt =
        Date.now();

      recorder.ondataavailable = (
        event
      ) => {
        if (
          event.data &&
          event.data.size > 0
        ) {
          chunks.push(
            event.data
          );
        }
      };

      recorder.onerror = (
        event
      ) => {
        console.error(
          "Local recording error:",
          event
        );

        setError(
          "Local recording stopped because the browser reported an error."
        );
      };

      recorder.onstop = async () => {
        const endedAt =
          Date.now();

        if (timerRef.current) {
          window.clearTimeout(
            timerRef.current
          );
          timerRef.current =
            null;
        }

        if (chunks.length > 0) {
          try {
            const blob =
              new Blob(
                chunks,
                {
                  type:
                    recorder.mimeType ||
                    mimeType ||
                    "video/webm",
                }
              );

            await saveSegment({
              id: `${cameraId}-${startedAt}`,
              cameraId,
              startAt: startedAt,
              endAt: endedAt,
              size: blob.size,
              mimeType:
                blob.type ||
                "video/webm",
              blob,
            });

            const latest =
              await pruneSegments(
                cameraId
              );

            setSegments(
              latest
            );

            setStorageBytes(
              latest.reduce(
                (total, item) =>
                  total +
                  Number(
                    item.size || 0
                  ),
                0
              )
            );
          } catch (err) {
            console.error(
              "Local recording save error:",
              err
            );

            setError(
              "The recorded segment could not be stored locally."
            );
          }
        }

        if (
          recordingRef.current
        ) {
          window.setTimeout(
            startSegment,
            0
          );
        }
      };

      recorderRef.current =
        recorder;

      recorder.start(1000);

      timerRef.current =
        window.setTimeout(
          () => {
            if (
              recorder.state ===
              "recording"
            ) {
              recorder.stop();
            }
          },
          SEGMENT_MS
        );

      setError("");
    };

  const startRecording =
    () => {
      const liveVideo =
        videoRef.current;

      if (
        !liveVideo ||
        typeof liveVideo.captureStream !==
          "function"
      ) {
        setError(
          "This browser does not support local capture of the live feed."
        );
        return;
      }

      if (
        liveVideo.readyState <
        HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        setError(
          "Wait for the live feed to start before enabling recording."
        );
        return;
      }

      try {
        const stream =
          liveVideo.captureStream();

        if (
          !stream ||
          stream.getVideoTracks()
            .length === 0
        ) {
          setError(
            "No live video track is available for local recording."
          );
          return;
        }

        streamRef.current =
          stream;

        recordingRef.current =
          true;

        setRecording(true);
        setError(
          ""
        );

        startSegment();
      } catch (err) {
        console.error(
          "Live stream capture error:",
          err
        );

        setError(
          "The live stream could not be captured for local recording."
        );
      }
    };

  const stopRecording =
    () => {
      recordingRef.current =
        false;

      setRecording(false);

      if (timerRef.current) {
        window.clearTimeout(
          timerRef.current
        );

        timerRef.current =
          null;
      }

      const recorder =
        recorderRef.current;

      if (
        recorder &&
        recorder.state !==
          "inactive"
      ) {
        try {
          recorder.stop();
        } catch {
          // Ignore recorder stop errors.
        }
      } else {
        if (streamRef.current) {
          streamRef.current
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          streamRef.current =
            null;
        }
      }

      setError("");
    };

  const toggleRecording =
    () => {
      if (recording) {
        stopRecording();
      } else {
        startRecording();
      }
    };

  const loadPlayback = (
    index,
    offset = 0,
    autoplay = true
  ) => {
    const segment = segments[index];

    if (!segment) {
      return;
    }

    pendingPlaybackRef.current = {
      index,
      offset,
      autoplay,
    };

    setPlaybackIndex(index);
    setReviewMode(true);
    setIsPaused(!autoplay);
  };

  useEffect(() => {
    if (
      !reviewMode ||
      playbackIndex < 0
    ) {
      return;
    }

    const video =
      playbackVideoRef.current;

    const segment =
      segments[playbackIndex];

    const pending =
      pendingPlaybackRef.current;

    if (!video || !segment) {
      return;
    }

    if (
      pending &&
      pending.index !== playbackIndex
    ) {
      return;
    }

    pendingPlaybackRef.current = null;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(
        objectUrlRef.current
      );
    }

    const url =
      URL.createObjectURL(
        segment.blob
      );

    objectUrlRef.current = url;

    video.src = url;
    video.load();

    const offset =
      pending?.offset ?? 0;

    const autoplay =
      pending?.autoplay ?? true;

    const seek = () => {
      const duration =
        Number(video.duration);

      if (
        Number.isFinite(duration) &&
        duration > 0
      ) {
        video.currentTime =
          Math.min(
            Math.max(
              0,
              offset
            ),
            Math.max(
              0,
              duration - 0.05
            )
          );
      }

      if (autoplay) {
        video
          .play()
          .then(() => {
            setIsPaused(false);
          })
          .catch(() => {
            setIsPaused(true);
          });
      } else {
        setIsPaused(true);
      }
    };

    video.addEventListener(
      "loadedmetadata",
      seek,
      { once: true }
    );

    return () => {
      video.removeEventListener(
        "loadedmetadata",
        seek
      );
    };
  }, [reviewMode, playbackIndex]);

  const playbackAnalysisEffect = useEffect(() => {
    if (!reviewMode) {
      setPlaybackDetections([]);
      return undefined;
    }

    const video =
      playbackVideoRef.current;

    if (!video) {
      return undefined;
    }

    const analysisCanvas =
      playbackAnalysisCanvasRef.current ||
      document.createElement("canvas");

    let stopped = false;
    let busy = false;
    let timeoutId = null;

    const schedule = () => {
      if (stopped) {
        return;
      }

      timeoutId = window.setTimeout(
        analyzeCurrentFrame,
        350
      );
    };

    async function analyzeCurrentFrame() {
      if (stopped || busy) {
        return;
      }

      if (
        video.paused ||
        video.ended ||
        video.readyState <
          HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        schedule();
        return;
      }

      busy = true;

      try {
        const sourceWidth =
          video.videoWidth;

        const sourceHeight =
          video.videoHeight;

        const maxWidth = 960;

        const scale = Math.min(
          1,
          maxWidth / sourceWidth
        );

        const width = Math.max(
          1,
          Math.round(
            sourceWidth * scale
          )
        );

        const height = Math.max(
          1,
          Math.round(
            sourceHeight * scale
          )
        );

        analysisCanvas.width = width;
        analysisCanvas.height =
          height;

        const ctx =
          analysisCanvas.getContext(
            "2d"
          );

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

        const blob =
          await new Promise(
            (resolve) => {
              analysisCanvas.toBlob(
                resolve,
                "image/jpeg",
                0.65
              );
            }
          );

        if (!blob || stopped) {
          return;
        }

        const response =
          await api.post(
            `/api/cctv/analyze-frame/${encodeURIComponent(
              cameraId
            )}`,
            blob,
            {
              headers: {
                "Content-Type":
                  "image/jpeg",
              },
              timeout: 5000,
            }
          );

        if (stopped) {
          return;
        }

        setPlaybackDetections(
          response.data.vehicles ||
            []
        );

        setPlaybackDetectionFrame({
          width:
            Number(
              response.data
                .frame_width
            ) || width,
          height:
            Number(
              response.data
                .frame_height
            ) || height,
        });
      } catch (err) {
        if (!stopped) {
          console.error(
            "Playback AI error:",
            err
          );
        }
      } finally {
        busy = false;
        schedule();
      }
    }

    analyzeCurrentFrame();

    return () => {
      stopped = true;

      if (timeoutId) {
        window.clearTimeout(
          timeoutId
        );
      }
    };
  }, [reviewMode, playbackIndex, cameraId]);

  useEffect(() => {
    if (!reviewMode) {
      return undefined;
    }

    const video =
      playbackVideoRef.current;

    const canvas =
      playbackCanvasRef.current;

    if (!video || !canvas) {
      return undefined;
    }

    let animationFrame = 0;

    const draw = () => {
      const rect =
        video.getBoundingClientRect();

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        animationFrame =
          window.requestAnimationFrame(
            draw
          );

        return;
      }

      const width =
        Math.max(
          1,
          Math.round(rect.width)
        );

      const height =
        Math.max(
          1,
          Math.round(rect.height)
        );

      if (
        canvas.width !== width ||
        canvas.height !== height
      ) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        return;
      }

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      const scaleX =
        width /
        Math.max(
          1,
          playbackDetectionFrame.width
        );

      const scaleY =
        height /
        Math.max(
          1,
          playbackDetectionFrame.height
        );

      playbackDetections.forEach(
        (detection) => {
          const bbox =
            Array.isArray(
              detection.bbox
            )
              ? detection.bbox
              : null;

          if (
            !bbox ||
            bbox.length < 4
          ) {
            return;
          }

          const x1 =
            Number(bbox[0]) * scaleX;

          const y1 =
            Number(bbox[1]) * scaleY;

          const x2 =
            Number(bbox[2]) * scaleX;

          const y2 =
            Number(bbox[3]) * scaleY;

          if (
            !Number.isFinite(
              x1
            ) ||
            !Number.isFinite(
              y1
            ) ||
            !Number.isFinite(
              x2
            ) ||
            !Number.isFinite(
              y2
            )
          ) {
            return;
          }

          const label =
            String(
              detection.vehicle_type ||
                "object"
            ).toUpperCase();

          const confidence =
            Number(
              detection.confidence
            );

          ctx.strokeStyle =
            "#22c55e";

          ctx.lineWidth = 2;

          ctx.strokeRect(
            x1,
            y1,
            Math.max(
              2,
              x2 - x1
            ),
            Math.max(
              2,
              y2 - y1
            )
          );

          const text =
            Number.isFinite(
              confidence
            )
              ? `${label} ${(
                  confidence * 100
                ).toFixed(0)}%`
              : label;

          ctx.font =
            "600 12px sans-serif";

          const textWidth =
            ctx.measureText(
              text
            ).width + 10;

          const textY =
            Math.max(
              16,
              y1
            );

          ctx.fillStyle =
            "rgba(0, 0, 0, 0.72)";

          ctx.fillRect(
            x1,
            textY - 16,
            textWidth,
            18
          );

          ctx.fillStyle =
            "#ffffff";

          ctx.fillText(
            text,
            x1 + 5,
            textY - 3
          );
        }
      );

      animationFrame =
        window.requestAnimationFrame(
          draw
        );
    };

    animationFrame =
      window.requestAnimationFrame(
        draw
      );

    return () => {
      window.cancelAnimationFrame(
        animationFrame
      );
    };
  }, [
    reviewMode,
    playbackDetections,
    playbackDetectionFrame,
  ]);
  const handleTimeline =
    (event) => {
      if (
        segments.length === 0
      ) {
        return;
      }

      const position =
        Number(
          event.target.value
        );

      setTimelinePosition(
        position
      );

      const start =
        segments[0].startAt;

      const target =
        start +
        position * 1000;

      let index =
        segments.findIndex(
          (segment) =>
            target >=
              segment.startAt &&
            target <=
              segment.endAt
        );

      if (index < 0) {
        index =
          segments.findIndex(
            (segment) =>
              segment.startAt >
              target
          );

        if (index < 0) {
          index =
            segments.length - 1;
        } else if (
          index > 0
        ) {
          index -= 1;
        }
      }

      const segment =
        segments[index];

      const offset =
        Math.max(
          0,
          (target -
            segment.startAt) /
            1000
        );

      playbackOffsetRef.current =
        offset;

      loadPlayback(
        index,
        offset,
        true
      );
    };

  const togglePlayback =
    () => {
      const video =
        playbackVideoRef.current;

      if (!video) {
        return;
      }

      if (video.paused) {
        video
          .play()
          .then(() => {
            setIsPaused(
              false
            );
          })
          .catch(() => {
            setIsPaused(
              true
            );
          });
      } else {
        video.pause();
        setIsPaused(true);
      }
    };

  const goLive =
    () => {
      const video =
        playbackVideoRef.current;

      if (video) {
        video.pause();
        video.removeAttribute(
          "src"
        );
        video.load();
      }

      if (
        objectUrlRef.current
      ) {
        URL.revokeObjectURL(
          objectUrlRef.current
        );

        objectUrlRef.current =
          null;
      }

      pendingPlaybackRef.current = null;
      setReviewMode(false);
      setPlaybackIndex(-1);
      setPlaybackDetections([]);
      setIsPaused(false);
      setTimelinePosition(
        totalDuration
      );
    };

  const handlePlaybackTime =
    () => {
      const video =
        playbackVideoRef.current;

      if (
        !video ||
        playbackIndex < 0 ||
        !segments[playbackIndex]
      ) {
        return;
      }

      const segment =
        segments[playbackIndex];

      const absoluteMs =
        segment.startAt +
        video.currentTime *
          1000;

      const start =
        segments[0].startAt;

      const position =
        Math.max(
          0,
          Math.min(
            totalDuration,
            (absoluteMs -
              start) /
              1000
          )
        );

      setTimelinePosition(
        position
      );
    };

  const handlePlaybackEnded =
    () => {
      if (
        playbackIndex <
        segments.length - 1
      ) {
        loadPlayback(
          playbackIndex + 1,
          0,
          true
        );

        return;
      }

      goLive();
    };

  const clearLocalHistory =
    async () => {
      const confirmed =
        window.confirm(
          "Delete locally stored footage for this camera?"
        );

      if (!confirmed) {
        return;
      }

      try {
        await deleteCameraSegments(
          cameraId
        );

        goLive();

        setSegments([]);
        setStorageBytes(0);
        setTimelinePosition(0);
        setError("");
      } catch (err) {
        console.error(
          "Local recording delete error:",
          err
        );

        setError(
          "Local footage could not be deleted."
        );
      }
    };

  const storageLabel =
    storageBytes > 1024 * 1024
      ? `${(
          storageBytes /
          (1024 * 1024)
        ).toFixed(1)} MB`
      : `${Math.round(
          storageBytes / 1024
        )} KB`;

  return (
    <div
      className={`local-recording-layer ${
        reviewMode
          ? "is-reviewing"
          : ""
      }`}
    >
      {reviewMode && (
        <>
          <video
            ref={playbackVideoRef}
            className="local-review-video"
            muted
            playsInline
            onTimeUpdate={
              handlePlaybackTime
            }
            onEnded={
              handlePlaybackEnded
            }
            onPlay={() =>
              setIsPaused(false)
            }
            onPause={() =>
              setIsPaused(true)
            }
          />

          <canvas
            ref={playbackCanvasRef}
            className="local-playback-detection-overlay"
            aria-hidden="true"
          />

          <div className="local-playback-ai-status">
            AI
            <strong>
              {playbackDetections.length}
            </strong>
          </div>
        </>
      )}

      {!panelVisible && (
        <button
          type="button"
          className="local-recording-hidden-button"
          onClick={() =>
            setPanelVisible(true)
          }
        >
          <Eye size={15} />
          Show Local Footage
        </button>
      )}

      {panelVisible && (
      <div className="local-recording-toolbar">
        <div className="local-recording-topline">
          <div className="local-recording-title">
            <HardDrive size={15} />
            Local Footage
          </div>

          <button
            type="button"
            className="local-recording-button"
            onClick={() =>
              setPanelVisible(false)
            }
            title="Hide Local Footage"
          >
            <EyeOff size={15} />
            Hide Local Footage
          </button>

          <div className="local-recording-state">
            {recording ? (
              <>
                <span className="local-recording-live-dot">
                  <Circle size={9} />
                </span>
                Recording
              </>
            ) : (
              "Ready"
            )}

            <span>
              {segments.length} segments
            </span>

            <span>
              {storageLabel}
            </span>
          </div>
        </div>

        <div className="local-recording-controls">
          <button
            type="button"
            className={`local-recording-switch ${
              recording
                ? "active"
                : ""
            }`}
            onClick={
              toggleRecording
            }
            aria-pressed={
              recording
            }
          >
            <span className="local-recording-switch-knob"></span>
            {recording
              ? "Stop recording"
              : "Record locally"}
          </button>

          <button
            type="button"
            className="local-recording-button"
            onClick={
              reviewMode
                ? togglePlayback
                : () => {
                    if (
                      segments.length >
                      0
                    ) {
                      loadPlayback(
                        segments.length -
                          1,
                        0,
                        true
                      );
                    }
                  }
            }
            disabled={
              segments.length ===
              0
            }
          >
            {reviewMode ? (
              isPaused ? (
                <Play size={15} />
              ) : (
                <Pause size={15} />
              )
            ) : (
              <Play size={15} />
            )}

            {reviewMode
              ? isPaused
                ? "Play"
                : "Pause"
              : "Review"}
          </button>

          {reviewMode && (
            <button
              type="button"
              className="local-recording-button primary"
              onClick={
                goLive
              }
            >
              <Radio size={15} />
              Go Live
            </button>
          )}

          <button
            type="button"
            className="local-recording-button danger"
            onClick={
              clearLocalHistory
            }
            disabled={
              segments.length ===
              0
            }
          >
            <Trash2 size={15} />
            Clear local
          </button>
        </div>

        {timelineVisible && (
          <div className="local-recording-timeline">
          <div className="local-recording-timeline-labels">
            <span>
              {segments.length > 0
                ? formatClock(
                    segments[0]
                      .startAt
                  )
                : "No footage"}
            </span>

            <strong>
              {reviewMode
                ? formatDuration(
                    timelinePosition
                  )
                : "LIVE"}
            </strong>

            <span>
              {segments.length > 0
                ? formatClock(
                    segments[
                      segments.length -
                        1
                    ].endAt
                  )
                : "--:--:--"}
            </span>
          </div>

          <div className="local-recording-track">
            <div className="local-recording-segments">
              {segments.map((segment) => {
                if (
                  segments.length === 0 ||
                  totalDuration <= 0
                ) {
                  return null;
                }

                const start =
                  (segment.startAt -
                    segments[0].startAt) /
                  1000;

                const duration =
                  (segment.endAt -
                    segment.startAt) /
                  1000;

                const left =
                  Math.max(
                    0,
                    Math.min(
                      100,
                      (start /
                        totalDuration) *
                        100
                    )
                  );

                const width =
                  Math.max(
                    0.3,
                    Math.min(
                      100 - left,
                      (duration /
                        totalDuration) *
                        100
                    )
                  );

                return (
                  <div
                    key={segment.id}
                    className="local-recording-segment"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                    }}
                    title={`${formatClock(
                      segment.startAt
                    )} - ${formatClock(
                      segment.endAt
                    )}`}
                  />
                );
              })}
            </div>

            <input
              type="range"
              min="0"
              max={
                Math.max(
                  totalDuration,
                  0.1
                )
              }
              step="0.1"
              value={Math.min(
                timelinePosition,
                Math.max(
                  totalDuration,
                  0.1
                )
              )}
              onChange={
                handleTimeline
              }
              disabled={
                segments.length ===
                0
              }
              aria-label="Local footage timeline"
            />
          </div>
          </div>
        )}

        {error && (
          <div className="local-recording-error">
            {error}
          </div>
        )}
      </div>
      )}
      <SegmentAI
        videoRef={videoRef}
        playbackVideoRef={playbackVideoRef}
        reviewMode={reviewMode}
        cameraId={cameraId}
      />
    </div>
  );
}

export default LocalRecordingPanel;

