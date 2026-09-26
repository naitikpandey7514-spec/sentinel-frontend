import os

import torch
from ultralytics import YOLO
import numpy as np


_model = None
_tracker_models = {}

DETECTION_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}


def get_device():
    configured = os.getenv(
        "YOLO_DEVICE",
        "auto"
    ).strip().lower()

    if configured == "auto":
        return (
            "cuda:0"
            if torch.cuda.is_available()
            else "cpu"
        )

    return configured


def get_model():
    global _model

    if _model is None:
        device = get_device()

        model_name = os.getenv(
            "YOLO_MODEL",
            "yolo11s.pt"
            if device.startswith("cuda")
            else "yolo11n.pt"
        )

        _model = YOLO(model_name)

        _model.to(device)

        # Warm up once so the first live inference
        # does not absorb model initialization latency.
        imgsz = int(
    os.getenv(
        "YOLO_IMGSZ",
        "960" if device.startswith("cuda") else "640"
    )
)

        quantize = 16 if device.startswith("cuda") else 32
        
        warmup_frame = np.zeros(
            (imgsz, imgsz, 3),
            dtype=np.uint8,
        )
        
        _model.predict(
            source=warmup_frame,
            imgsz=imgsz,
            classes=list(DETECTION_CLASSES.keys()),
            conf=0.40,
            device=device,
            quantize=quantize,
            verbose=False,
        )

        print(
            "YOLO device:",
            device
        )

        print(
            "YOLO model:",
            model_name
        )

    return _model

def detect_vehicles(
    frame,
    camera_id=None,
    tracking=False,
):
    """
    Detect vehicles in a frame.

    When tracking=True, a dedicated YOLO tracker model is
    maintained for each camera so track IDs do not leak
    between different camera streams.
    """

    global _model

    if tracking and camera_id:
        tracker_model = _tracker_models.get(camera_id)

        if tracker_model is None:
            device = get_device()

            model_name = os.getenv(
                "YOLO_MODEL",
                "yolo11s.pt"
                if device.startswith("cuda")
                else "yolo11n.pt"
            )

            tracker_model = YOLO(model_name)
            tracker_model.to(device)

            _tracker_models[camera_id] = tracker_model

            print(
                f"YOLO tracker initialized: "
                f"{camera_id} | {device} | {model_name}"
            )

        model = tracker_model

    else:
        model = get_model()

    device = get_device()

    imgsz = int(
        os.getenv(
            "YOLO_IMGSZ",
            "960"
            if device.startswith("cuda")
            else "640"
        )
    )

    vehicle_conf = float(os.getenv("YOLO_CONF", "0.40"))
    person_conf = float(
        os.getenv("YOLO_PERSON_CONF", "0.25")
    )

    kwargs = {
        "source": frame,
        "classes": list(DETECTION_CLASSES.keys()),
        # Use the lower threshold for initial inference.
        # We apply per-class thresholds after YOLO returns results.
        "conf": min(vehicle_conf, person_conf),
        "imgsz": imgsz,
        "device": device,
        "quantize": (
            16 if device.startswith("cuda")
            else 32
        ),
        "verbose": False,
    }

    if tracking and camera_id:
        results = model.track(
            **kwargs,
            persist=True,
            tracker="bytetrack.yaml",
        )
    else:
        results = model.predict(
            **kwargs,
        )

    detections = []

    for result in results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())

            # People can be smaller/further away in CCTV,
            # so allow a lower confidence threshold for them.
            minimum_confidence = (
                person_conf
                if class_id == 0
                else vehicle_conf
            )

            if confidence < minimum_confidence:
                continue
            
            x1, y1, x2, y2 = [
                int(value)
                for value in box.xyxy[0].tolist()
            ]

            track_id = None

            if tracking and box.id is not None:
                track_id = int(
                    box.id[0].item()
                )

            detections.append({
                "vehicle_type":
                    DETECTION_CLASSES[class_id],

                "confidence":
                    round(confidence, 4),

                "bbox": [
                    x1,
                    y1,
                    x2,
                    y2,
                ],

                "track_id": track_id,
            })

    return detections