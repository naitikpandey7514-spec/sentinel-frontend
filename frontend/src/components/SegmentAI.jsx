import api from "../services/api";
import {
  CircleStop,
  Crosshair,
  Gauge,
  Palette,
  Play,
  ScanText,
  SquareDashedMousePointer,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ANALYSIS_INTERVAL_MS = 350;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatSpeed(speed) {
  if (
    speed === null ||
    speed === undefined ||
    !Number.isFinite(Number(speed))
  ) {
    return null;
  }

  return `${Number(speed).toFixed(1)} km/h`;
}

function SegmentAI({
  videoRef,
  playbackVideoRef,
  reviewMode,
  cameraId,
}) {
  const [open, setOpen] = useState(false);

  const [selecting, setSelecting] =
    useState(false);

  const [roi, setRoi] =
    useState(null);

  const [draftRect, setDraftRect] =
    useState(null);

  const [colorEnabled, setColorEnabled] =
    useState(true);

  const [plateEnabled, setPlateEnabled] =
    useState(false);

  const [speedEnabled, setSpeedEnabled] =
    useState(false);

  const [metersPerPixel, setMetersPerPixel] =
    useState("");

  const [durationSeconds, setDurationSeconds] =
    useState(10);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [analysisStartedAt, setAnalysisStartedAt] =
    useState(null);

  const [results, setResults] =
    useState([]);

  const [frameSize, setFrameSize] =
    useState({
      width: 1920,
      height: 1080,
    });

  const [videoRect, setVideoRect] =
    useState(null);

  const [error, setError] =
    useState("");

  const [savedEvidenceId, setSavedEvidenceId] =
    useState(null);

  const sessionIdRef =
    useRef(
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`
    );

  const lastFrameBlobRef =
    useRef(null);

  const lastResultMetaRef =
    useRef(null);

  const stageRef =
    useRef(null);

  const canvasRef =
    useRef(null);

  const timerRef =
    useRef(null);

  const busyRef =
    useRef(false);

  const selectingRef =
    useRef(false);

  const dragStartRef =
    useRef(null);

  const activeVideo =
    reviewMode
      ? playbackVideoRef.current
      : videoRef.current;

  const featureList = useMemo(
    () => {
      const features = [];

      if (colorEnabled) {
        features.push("color");
      }

      if (plateEnabled) {
        features.push("plate");
      }

      if (speedEnabled) {
        features.push("speed");
      }

      return features;
    },
    [
      colorEnabled,
      plateEnabled,
      speedEnabled,
    ]
  );

  const updateVideoGeometry = () => {
    const stage =
      stageRef.current;

    const video =
      reviewMode
        ? playbackVideoRef.current
        : videoRef.current;

    if (!stage || !video) {
      return;
    }

    const rect =
      video.getBoundingClientRect();

    const stageRect =
      stage.getBoundingClientRect();

    setVideoRect({
      left: rect.left - stageRect.left,
      top: rect.top - stageRect.top,
      width: rect.width,
      height: rect.height,
    });

    if (
      video.videoWidth &&
      video.videoHeight
    ) {
      setFrameSize({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    }
  };

  useEffect(() => {
    updateVideoGeometry();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(
            updateVideoGeometry
          )
        : null;

    if (
      resizeObserver &&
      stageRef.current
    ) {
      resizeObserver.observe(
        stageRef.current
      );
    }

    window.addEventListener(
      "resize",
      updateVideoGeometry
    );

    const intervalId =
      window.setInterval(
        updateVideoGeometry,
        500
      );

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      window.removeEventListener(
        "resize",
        updateVideoGeometry
      );

      window.clearInterval(
        intervalId
      );
    };
  }, [
    reviewMode,
    open,
  ]);

  useEffect(() => {
    selectingRef.current =
      selecting;
  }, [selecting]);

  const getVideoPoint = (
    clientX,
    clientY
  ) => {
    if (!videoRect) {
      return null;
    }

    const px =
      clientX -
      videoRect.left;

    const py =
      clientY -
      videoRect.top;

    const x =
      clamp(
        px,
        0,
        videoRect.width
      ) /
      Math.max(
        videoRect.width,
        1
      );

    const y =
      clamp(
        py,
        0,
        videoRect.height
      ) /
      Math.max(
        videoRect.height,
        1
      );

    return {
      x:
        x *
        frameSize.width,

      y:
        y *
        frameSize.height,
    };
  };

  const beginSelection =
    (event) => {
      if (!selecting) {
        return;
      }

      const point =
        getVideoPoint(
          event.clientX,
          event.clientY
        );

      if (!point) {
        return;
      }

      event.preventDefault();

      dragStartRef.current =
        point;

      setDraftRect({
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
      });
    };

  const updateSelection =
    (event) => {
      if (
        !selecting ||
        !dragStartRef.current
      ) {
        return;
      }

      const point =
        getVideoPoint(
          event.clientX,
          event.clientY
        );

      if (!point) {
        return;
      }

      const start =
        dragStartRef.current;

      const x =
        Math.min(
          start.x,
          point.x
        );

      const y =
        Math.min(
          start.y,
          point.y
        );

      const width =
        Math.abs(
          point.x - start.x
        );

      const height =
        Math.abs(
          point.y - start.y
        );

      setDraftRect({
        x,
        y,
        width,
        height,
      });
    };

  const finishSelection =
    () => {
      if (
        !selecting ||
        !dragStartRef.current ||
        !draftRect
      ) {
        return;
      }

      const minimumSize = 12;

      if (
        draftRect.width >=
          minimumSize &&
        draftRect.height >=
          minimumSize
      ) {
        setRoi({
          x: Math.round(
            draftRect.x
          ),
          y: Math.round(
            draftRect.y
          ),
          width: Math.round(
            draftRect.width
          ),
          height: Math.round(
            draftRect.height
          ),
        });
      }

      dragStartRef.current =
        null;

      setDraftRect(null);
      setSelecting(false);
    };

  const clearSelection =
    () => {
      setRoi(null);
      setDraftRect(null);
      setSelecting(false);
      setResults([]);
    };

  const captureFrame =
    async (video) => {
      if (
        !video ||
        video.readyState <
          HTMLMediaElement.HAVE_CURRENT_DATA ||
        !video.videoWidth ||
        !video.videoHeight
      ) {
        return null;
      }

      const canvas =
        canvasRef.current ||
        document.createElement(
          "canvas"
        );

      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;

      const context =
        canvas.getContext("2d");

      if (!context) {
        return null;
      }

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      return await new Promise(
        (resolve) => {
          canvas.toBlob(
            (blob) => resolve(blob),
            "image/jpeg",
            0.7
          );
        }
      );
    };

  const analyzeCurrentFrame =
    async (allowPaused = false) => {
      if (
        busyRef.current ||
        (!analyzing && !allowPaused)
      ) {
        return;
      }

      const video =
        reviewMode
          ? playbackVideoRef.current
          : videoRef.current;

      if (!video) {
        return;
      }

      if (
        reviewMode &&
        video.paused &&
        !allowPaused
      ) {
        return;
      }

      if (
        !roi ||
        featureList.length === 0
      ) {
        return;
      }

      busyRef.current = true;

      try {
        const blob =
          await captureFrame(
            video
          );

        if (!blob) {
          return;
        }

        const timestamp =
          reviewMode
            ? Number(
                video.currentTime || 0
              )
            : performance.now() /
              1000;

        const source =
          reviewMode
            ? "recorded"
            : "live";

        const params = {
          x: Math.round(
            roi.x
          ),
          y: Math.round(
            roi.y
          ),
          width: Math.round(
            roi.width
          ),
          height: Math.round(
            roi.height
          ),
          features:
            featureList.join(
              ","
            ),
          timestamp,
          source,
          session_id:
            sessionIdRef.current,
        };

        const calibration =
          Number(
            metersPerPixel
          );

        if (
          speedEnabled &&
          Number.isFinite(
            calibration
          ) &&
          calibration > 0
        ) {
          params.meters_per_pixel =
            calibration;
        }

        const response =
          await api.post(
            `/api/cctv/analyze-region/${cameraId}`,
            blob,
            {
              params,
              headers: {
                "Content-Type":
                  "image/jpeg",
              },
            }
          );

        lastFrameBlobRef.current =
          blob;

        lastResultMetaRef.current = {
          source,
          session_id:
            sessionIdRef.current,
          timestamp,
          roi,
          features:
            featureList,
          vehicles:
            Array.isArray(
              response.data?.vehicles
            )
              ? response.data.vehicles
              : [],
        };

        setSavedEvidenceId(null);

        setFrameSize({
          width:
            Number(
              response.data
                ?.frame_width
            ) ||
            frameSize.width,

          height:
            Number(
              response.data
                ?.frame_height
            ) ||
            frameSize.height,
        });

        setResults(
          Array.isArray(
            response.data
              ?.vehicles
          )
            ? response.data
                .vehicles
            : []
        );
      } catch (requestError) {
        console.error(
          "Segment AI error:",
          requestError
        );

        setError(
          "Segment analysis request failed."
        );
      } finally {
        busyRef.current = false;
      }
    };

  const saveEvidence =
    async () => {
      const blob =
        lastFrameBlobRef.current;

      const metadata =
        lastResultMetaRef.current;

      if (!blob || !metadata) {
        setError(
          "Analyze a frame before saving evidence."
        );
        return;
      }

      try {
        setError("");

        const bitmap =
          await createImageBitmap(
            blob
          );

        const canvas =
          document.createElement(
            "canvas"
          );

        canvas.width =
          bitmap.width;

        canvas.height =
          bitmap.height;

        const context =
          canvas.getContext("2d");

        if (!context) {
          bitmap.close?.();
          throw new Error(
            "Evidence canvas unavailable"
          );
        }

        context.drawImage(
          bitmap,
          0,
          0
        );

        bitmap.close?.();

        const roiData =
          metadata.roi;

        if (roiData) {
          context.save();

          context.strokeStyle =
            "#22c55e";
          context.lineWidth = 5;
          context.setLineDash([
            12,
            8,
          ]);

          context.strokeRect(
            roiData.x,
            roiData.y,
            roiData.width,
            roiData.height
          );

          context.restore();
        }

        const vehicles =
          Array.isArray(
            metadata.vehicles
          )
            ? metadata.vehicles
            : [];

        vehicles.forEach(
          (item) => {
            const bbox =
              Array.isArray(
                item.bbox
              )
                ? item.bbox
                : null;

            if (!bbox) {
              return;
            }

            context.save();

            context.strokeStyle =
              "#22c55e";
            context.lineWidth = 4;

            context.strokeRect(
              bbox[0],
              bbox[1],
              bbox[2] -
                bbox[0],
              bbox[3] -
                bbox[1]
            );

            const labels =
              [
                item.vehicle_type,
                item.color,
                item
                  .license_plate
                  ?.text,
                formatSpeed(
                  item.speed
                    ?.speed_kph
                ),
              ].filter(Boolean);

            if (
              item.speed
                ?.speed_status ===
              "calibration_required"
            ) {
              labels.push(
                "speed calibration needed"
              );
            }

            const label =
              labels.join(
                "  "
              );

            if (label) {
              context.font =
                "bold 22px Arial";

              const padding = 8;
              const metrics =
                context.measureText(
                  label
                );

              const labelWidth =
                metrics.width +
                padding * 2;

              const labelHeight =
                34;

              const labelX =
                bbox[0];

              const labelY =
                Math.max(
                  labelHeight,
                  bbox[1]
                );

              context.fillStyle =
                "rgba(22,101,52,0.92)";

              context.fillRect(
                labelX,
                labelY -
                  labelHeight,
                labelWidth,
                labelHeight
              );

              context.fillStyle =
                "#ffffff";

              context.fillText(
                label,
                labelX +
                  padding,
                labelY -
                  9
              );
            }

            context.restore();
          }
        );

        const sourceLabel =
          metadata.source ===
          "recorded"
            ? "RECORDED"
            : "LIVE";

        context.save();

        context.fillStyle =
          "rgba(15,23,42,0.88)";

        context.fillRect(
          18,
          18,
          210,
          42
        );

        context.fillStyle =
          "#ffffff";

        context.font =
          "bold 20px Arial";

        context.fillText(
          `SENTINEL-X  ${sourceLabel}`,
          30,
          46
        );

        context.restore();

        const annotatedBlob =
          await new Promise(
            (resolve) => {
              canvas.toBlob(
                resolve,
                "image/jpeg",
                0.9
              );
            }
          );

        if (!annotatedBlob) {
          throw new Error(
            "Could not encode evidence image"
          );
        }

        const response =
          await api.post(
            `/api/cctv/save-segment-evidence/${cameraId}`,
            annotatedBlob,
            {
              headers: {
                "Content-Type":
                  "image/jpeg",
                "x-segment-metadata":
                  JSON.stringify(
                    metadata
                  ),
              },
            }
          );

        setSavedEvidenceId(
          response.data?.id ||
            null
        );
      } catch (requestError) {
        console.error(
          "Segment evidence save error:",
          requestError
        );

        setError(
          "Could not save the evidence image."
        );
      }
    };

  const stopAnalysis =
    () => {
      if (timerRef.current) {
        window.clearInterval(
          timerRef.current
        );

        timerRef.current = null;
      }

      setAnalyzing(false);
      setAnalysisStartedAt(
        null
      );
    };

  useEffect(() => {
    if (!analyzing) {
      return undefined;
    }

    setError("");

    analyzeCurrentFrame();

    timerRef.current =
      window.setInterval(
        analyzeCurrentFrame,
        ANALYSIS_INTERVAL_MS
      );

    return () => {
      if (timerRef.current) {
        window.clearInterval(
          timerRef.current
        );

        timerRef.current = null;
      }
    };
  }, [
    analyzing,
    roi,
    featureList,
    cameraId,
    reviewMode,
    metersPerPixel,
  ]);

  useEffect(() => {
    if (
      !analyzing ||
      !analysisStartedAt
    ) {
      return undefined;
    }

    const stopTimer =
      window.setInterval(
        () => {
          if (
            reviewMode &&
            !playbackVideoRef.current
          ) {
            return;
          }

          const elapsed =
            reviewMode
              ? Number(
                  playbackVideoRef
                    .current
                    ?.currentTime || 0
                ) -
                Number(
                  analysisStartedAt
                )
              : performance.now() /
                  1000 -
                analysisStartedAt;

          if (
            elapsed >=
            Number(durationSeconds)
          ) {
            stopAnalysis();
          }
        },
        250
      );

    return () => {
      window.clearInterval(
        stopTimer
      );
    };
  }, [
    analyzing,
    analysisStartedAt,
    durationSeconds,
    reviewMode,
  ]);

  useEffect(() => {
    if (reviewMode) {
      setResults([]);
      stopAnalysis();
    }
  }, [reviewMode]);

  const startAnalysis =
    () => {
      setError("");

      if (!roi) {
        setError(
          "Select a region on the video first."
        );
        return;
      }

      if (
        featureList.length ===
        0
      ) {
        setError(
          "Enable at least one AI feature."
        );
        return;
      }

      const video =
        reviewMode
          ? playbackVideoRef.current
          : videoRef.current;

      if (!video) {
        setError(
          "No active video is available."
        );
        return;
      }

      if (
        reviewMode &&
        video.paused
      ) {
        setError(
          "Press Play before analyzing recorded footage."
        );
        return;
      }

      stopAnalysis();

      setResults([]);
      setSavedEvidenceId(null);
      lastFrameBlobRef.current = null;
      lastResultMetaRef.current = null;

      const startTime =
        reviewMode
          ? Number(
              video.currentTime || 0
            )
          : performance.now() /
            1000;

      setAnalysisStartedAt(
        startTime
      );

      setAnalyzing(true);
    };

  const remove =
    () => {
      stopAnalysis();
      setResults([]);
      setRoi(null);
      setOpen(false);
      setSelecting(false);
      setDraftRect(null);
    };

  const regionStyle =
    (region) => {
      if (
        !region ||
        !videoRect
      ) {
        return {
          display: "none",
        };
      }

      return {
        position: "absolute",
        left:
          videoRect.left +
          (region.x /
            Math.max(
              frameSize.width,
              1
            )) *
            videoRect.width,

        top:
          videoRect.top +
          (region.y /
            Math.max(
              frameSize.height,
              1
            )) *
            videoRect.height,

        width:
          (region.width /
            Math.max(
              frameSize.width,
              1
            )) *
            videoRect.width,

        height:
          (region.height /
            Math.max(
              frameSize.height,
              1
            )) *
            videoRect.height,

        pointerEvents:
          "none",
      };
    };

  const boxStyle =
    (bbox) => {
      if (
        !bbox ||
        !videoRect
      ) {
        return {
          display: "none",
        };
      }

      return {
        position: "absolute",
        left:
          videoRect.left +
          (bbox[0] /
            Math.max(
              frameSize.width,
              1
            )) *
            videoRect.width,

        top:
          videoRect.top +
          (bbox[1] /
            Math.max(
              frameSize.height,
              1
            )) *
            videoRect.height,

        width:
          ((bbox[2] -
            bbox[0]) /
            Math.max(
              frameSize.width,
              1
            )) *
            videoRect.width,

        height:
          ((bbox[3] -
            bbox[1]) /
            Math.max(
              frameSize.height,
              1
            )) *
            videoRect.height,

        pointerEvents:
          "none",
      };
    };

  return (
    <div
      ref={stageRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            window.setTimeout(
              updateVideoGeometry,
              0
            );
          }}
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding:
              "9px 12px",
            borderRadius: 9,
            border:
              "1px solid rgba(255,255,255,0.28)",
            background:
              "rgba(15,23,42,0.88)",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          <Crosshair
            size={15}
          />
          Segment AI
        </button>
      )}

      {open && (
        <div
          style={{
            position:
              "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-end",
            gap: 12,
            pointerEvents:
              "none",
          }}
        >
          <div
            style={{
              width:
                "min(460px, calc(100% - 20px))",
              padding: 13,
              border:
                "1px solid #d8e0ea",
              borderRadius: 12,
              background:
                "rgba(255,255,255,0.97)",
              boxShadow:
                "0 10px 24px rgba(15,23,42,0.18)",
              color: "#172033",
              pointerEvents:
                "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: 10,
                marginBottom:
                  10,
              }}
            >
              <div>
                <strong
                  style={{
                    fontSize: 13,
                  }}
                >
                  Segment AI
                </strong>

                <div
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  {reviewMode
                    ? "Recorded footage"
                    : "Live feed"}
                </div>
              </div>

              <button
                type="button"
                onClick={remove}
                title="Close Segment AI"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border:
                    "1px solid #d8e0ea",
                  background:
                    "#ffffff",
                  color: "#475569",
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  cursor:
                    "pointer",
                }}
              >
                <X
                  size={16}
                />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap:
                  "wrap",
                gap: 7,
                marginBottom:
                  10,
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setSelecting(
                    (value) =>
                      !value
                  )
                }
                style={{
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  gap: 6,
                  padding:
                    "8px 10px",
                  borderRadius: 8,
                  border:
                    selecting
                      ? "1px solid #0f766e"
                      : "1px solid #d8e0ea",
                  background:
                    selecting
                      ? "#ecfeff"
                      : "#ffffff",
                  color:
                    selecting
                      ? "#115e59"
                      : "#334155",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor:
                    "pointer",
                }}
              >
                <SquareDashedMousePointer
                  size={14}
                />
                {selecting
                  ? "Drag region"
                  : roi
                    ? "Change region"
                    : "Select region"}
              </button>

              {roi && (
                <button
                  type="button"
                  onClick={
                    clearSelection
                  }
                  style={{
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    gap: 6,
                    padding:
                      "8px 10px",
                    borderRadius: 8,
                    border:
                      "1px solid #d8e0ea",
                    background:
                      "#ffffff",
                    color:
                      "#475569",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor:
                      "pointer",
                  }}
                >
                  <Trash2
                    size={14}
                  />
                  Clear region
                </button>
              )}

              {reviewMode &&
                playbackVideoRef
                  .current
                  ?.paused &&
                !analyzing && (
                  <button
                    type="button"
                    onClick={() =>
                      analyzeCurrentFrame(
                        true
                      )
                    }
                    disabled={
                      !roi ||
                      featureList.length ===
                        0
                    }
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: 6,
                      padding:
                        "8px 10px",
                      borderRadius: 8,
                      border:
                        "1px solid #d8e0ea",
                      background:
                        "#ffffff",
                      color:
                        "#334155",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor:
                        "pointer",
                    }}
                  >
                    <ScanText
                      size={14}
                    />
                    Analyze frame
                  </button>
                )}

              {(results.length > 0 ||
                lastFrameBlobRef.current) && (
                <button
                  type="button"
                  onClick={
                    saveEvidence
                  }
                  style={{
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    gap: 6,
                    padding:
                      "8px 10px",
                    borderRadius: 8,
                    border:
                      "1px solid #d8e0ea",
                    background:
                      savedEvidenceId
                        ? "#f0fdf4"
                        : "#ffffff",
                    color:
                      savedEvidenceId
                        ? "#166534"
                        : "#334155",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor:
                      "pointer",
                  }}
                >
                  <Trash2
                    size={14}
                  />
                  {savedEvidenceId
                    ? "Evidence saved"
                    : "Save evidence"}
                </button>
              )}

              {analyzing ? (
                <button
                  type="button"
                  onClick={
                    stopAnalysis
                  }
                  style={{
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    gap: 6,
                    padding:
                      "8px 10px",
                    borderRadius: 8,
                    border:
                      "1px solid #fecaca",
                    background:
                      "#fef2f2",
                    color:
                      "#991b1b",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor:
                      "pointer",
                  }}
                >
                  <CircleStop
                    size={14}
                  />
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    startAnalysis
                  }
                  style={{
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    gap: 6,
                    padding:
                      "8px 10px",
                    borderRadius: 8,
                    border:
                      "1px solid #0f766e",
                    background:
                      "#0f766e",
                    color:
                      "#ffffff",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor:
                      "pointer",
                  }}
                >
                  <Play
                    size={14}
                  />
                  Analyze
                </button>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: 7,
              }}
            >
              <label
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 6,
                  minHeight: 34,
                  padding:
                    "0 8px",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: 8,
                  background:
                    colorEnabled
                      ? "#f8fafc"
                      : "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor:
                    "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    colorEnabled
                  }
                  onChange={(event) =>
                    setColorEnabled(
                      event.target
                        .checked
                    )
                  }
                />
                <Palette
                  size={14}
                />
                Color
              </label>

              <label
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 6,
                  minHeight: 34,
                  padding:
                    "0 8px",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: 8,
                  background:
                    plateEnabled
                      ? "#f8fafc"
                      : "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor:
                    "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    plateEnabled
                  }
                  onChange={(event) =>
                    setPlateEnabled(
                      event.target
                        .checked
                    )
                  }
                />
                <ScanText
                  size={14}
                />
                Plate
              </label>

              <label
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 6,
                  minHeight: 34,
                  padding:
                    "0 8px",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: 8,
                  background:
                    speedEnabled
                      ? "#f8fafc"
                      : "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor:
                    "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    speedEnabled
                  }
                  onChange={(event) =>
                    setSpeedEnabled(
                      event.target
                        .checked
                    )
                  }
                />
                <Gauge
                  size={14}
                />
                Speed
              </label>
            </div>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  speedEnabled
                    ? "1fr 1fr"
                    : "1fr",
                gap: 8,
                marginTop: 8,
              }}
            >
              <label
                style={{
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  gap: 4,
                  fontSize: 10,
                  color:
                    "#64748b",
                  fontWeight: 700,
                }}
              >
                Analysis duration

                <select
                  value={
                    durationSeconds
                  }
                  onChange={(event) =>
                    setDurationSeconds(
                      Number(
                        event.target
                          .value
                      )
                    )
                  }
                  style={{
                    minHeight: 34,
                    border:
                      "1px solid #d8e0ea",
                    borderRadius: 8,
                    background:
                      "#ffffff",
                    color:
                      "#172033",
                    padding:
                      "0 8px",
                    fontSize: 12,
                  }}
                >
                  <option value={5}>
                    5 seconds
                  </option>
                  <option value={10}>
                    10 seconds
                  </option>
                  <option value={20}>
                    20 seconds
                  </option>
                  <option value={30}>
                    30 seconds
                  </option>
                </select>
              </label>

              {speedEnabled && (
                <label
                  style={{
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    gap: 4,
                    fontSize: 10,
                    color:
                      "#64748b",
                    fontWeight: 700,
                  }}
                >
                  Meters per pixel

                  <input
                    value={
                      metersPerPixel
                    }
                    onChange={(event) =>
                      setMetersPerPixel(
                        event.target
                          .value
                      )
                    }
                    placeholder="Required for km/h"
                    inputMode="decimal"
                    style={{
                      minHeight: 34,
                      border:
                        "1px solid #d8e0ea",
                      borderRadius: 8,
                      background:
                        "#ffffff",
                      color:
                        "#172033",
                      padding:
                        "0 8px",
                      fontSize: 12,
                    }}
                  />
                </label>
              )}
            </div>

            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                gap: 7,
                marginTop: 9,
                fontSize: 10,
                color:
                  "#64748b",
              }}
            >
              <Crosshair
                size={13}
              />

              {roi
                ? `ROI ${Math.round(
                    roi.x
                  )}, ${Math.round(
                    roi.y
                  )}  ${Math.round(
                    roi.width
                  )} x ${Math.round(
                    roi.height
                  )}`
                : "Draw a region on the video."}
            </div>

            {speedEnabled && (
              <div
                style={{
                  marginTop: 7,
                  fontSize: 10,
                  color:
                    "#64748b",
                }}
              >
                Speed remains uncalibrated until
                meters-per-pixel is supplied.
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 8,
                  border:
                    "1px solid #fecaca",
                  background:
                    "#fef2f2",
                  color:
                    "#991b1b",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}

            {results.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {results.map(
                  (item, index) => (
                    <div
                      key={`${item.track_id}-${index}`}
                      style={{
                        padding:
                          "7px 8px",
                        borderRadius: 8,
                        border:
                          "1px solid #e2e8f0",
                        background:
                          "#f8fafc",
                        fontSize: 10,
                      }}
                    >
                      <strong>
                        {item.vehicle_type ||
                          "object"}
                      </strong>

                      {item.color && (
                        <span>
                          {" "}
                          {item.color}
                        </span>
                      )}

                      {item
                        .license_plate
                        ?.text && (
                        <span>
                          {" "}
                          {item
                            .license_plate
                            .text}
                        </span>
                      )}

                      {formatSpeed(
                        item.speed
                          ?.speed_kph
                      ) && (
                        <span>
                          {" "}
                          {formatSpeed(
                            item.speed
                              .speed_kph
                          )}
                        </span>
                      )}

                      {item.speed
                        ?.speed_status ===
                        "calibration_required" && (
                        <span>
                          {" "}
                          calibration needed
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {open && (
        <>
          <div
            style={{
              ...regionStyle(roi),
              border:
                "2px solid #22c55e",
              background:
                "rgba(34,197,94,0.08)",
            }}
          />

          {draftRect && (
            <div
              style={{
                ...regionStyle(
                  draftRect
                ),
                border:
                  "2px dashed #0f766e",
                background:
                  "rgba(15,118,110,0.10)",
              }}
            />
          )}

          {results.map(
            (item, index) => (
              <div
                key={`box-${item.track_id}-${index}`}
                style={{
                  ...boxStyle(
                    item.bbox
                  ),
                  border:
                    "2px solid #22c55e",
                }}
              >
                <span
                  style={{
                    position:
                      "absolute",
                    left: -2,
                    top: -22,
                    padding:
                      "2px 5px",
                    borderRadius:
                      4,
                    background:
                      "#166534",
                    color:
                      "#ffffff",
                    fontSize: 9,
                    lineHeight:
                      "16px",
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  {[
                    item.vehicle_type,
                    item.color,
                    item
                      .license_plate
                      ?.text,
                    formatSpeed(
                      item.speed
                        ?.speed_kph
                    ),
                  ]
                    .filter(Boolean)
                    .join("  ")}
                </span>
              </div>
            )
          )}
        </>
      )}

      {open &&
        selecting && (
          <div
            style={{
              position:
                "absolute",
              inset: 0,
              pointerEvents:
                "auto",
              cursor:
                "crosshair",
            }}
            onPointerDown={
              beginSelection
            }
            onPointerMove={
              updateSelection
            }
            onPointerUp={
              finishSelection
            }
            onPointerCancel={
              finishSelection
            }
          />
        )}

      <canvas
        ref={canvasRef}
        style={{
          display: "none",
        }}
      />
    </div>
  );
}

export default SegmentAI;
