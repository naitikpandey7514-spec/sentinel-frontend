
from ultralytics import YOLO

# Loads pretrained COCO weights on first use.
# Keep this model instance alive between frames.
_model = None

VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}


def get_model():
    global _model

    if _model is None:
        _model = YOLO("yolo11n.pt")

    return _model


def detect_vehicles(frame):
    """
    Input: OpenCV BGR frame
    Output: list of vehicle detections with bounding boxes
    """
    model = get_model()

    results = model.predict(
        source=frame,
        classes=list(VEHICLE_CLASSES.keys()),
        conf=0.35,
        verbose=False,
    )

    detections = []

    for result in results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            x1, y1, x2, y2 = [
                int(value) for value in box.xyxy[0].tolist()
            ]

            detections.append({
                "vehicle_type": VEHICLE_CLASSES[class_id],
                "confidence": round(confidence, 4),
                "bbox": [x1, y1, x2, y2],
            })

    return detections