import json
import os
import re
import sqlite3
import time
import uuid
from pathlib import Path

import cv2
import numpy as np
import pytesseract

from app.services.vehicle_detector import detect_vehicles


TESSERACT_CMD = os.getenv(
    "TESSERACT_CMD",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
)

if os.path.exists(TESSERACT_CMD):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD


_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_STORAGE_ROOT = _BACKEND_ROOT / "storage"
_RECORDING_DB = _STORAGE_ROOT / "segment_analysis.sqlite3"
_EVIDENCE_DIR = _STORAGE_ROOT / "evidence" / "segment_ai"

_SPEED_STATE = {}


def _ensure_storage():
    _STORAGE_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    _EVIDENCE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    with sqlite3.connect(_RECORDING_DB) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS analysis_records (
                id TEXT PRIMARY KEY,
                camera_id TEXT NOT NULL,
                session_id TEXT,
                source TEXT NOT NULL,
                timestamp REAL NOT NULL,
                created_at REAL NOT NULL,
                roi_json TEXT NOT NULL,
                features_json TEXT NOT NULL,
                vehicles_json TEXT NOT NULL
            )
            """
        )

        db.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_analysis_camera_time
            ON analysis_records(camera_id, timestamp)
            """
        )

        db.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_analysis_session
            ON analysis_records(session_id)
            """
        )

        db.commit()


def record_analysis(
    camera_id,
    source,
    timestamp,
    roi,
    features,
    vehicles,
    session_id=None,
    minimum_interval_seconds=1.0,
):
    _ensure_storage()

    now = time.time()

    with sqlite3.connect(_RECORDING_DB) as db:
        if session_id:
            row = db.execute(
                """
                SELECT created_at
                FROM analysis_records
                WHERE session_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (session_id,),
            ).fetchone()

            if (
                row is not None
                and now - float(row[0])
                < minimum_interval_seconds
            ):
                return None

        record_id = str(uuid.uuid4())

        db.execute(
            """
            INSERT INTO analysis_records (
                id,
                camera_id,
                session_id,
                source,
                timestamp,
                created_at,
                roi_json,
                features_json,
                vehicles_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id,
                str(camera_id),
                session_id,
                str(source),
                float(timestamp),
                now,
                json.dumps(roi),
                json.dumps(sorted(features)),
                json.dumps(vehicles),
            ),
        )

        db.commit()

    return record_id


def list_analysis_records(
    camera_id=None,
    session_id=None,
    source=None,
    limit=200,
):
    _ensure_storage()

    query = """
        SELECT
            id,
            camera_id,
            session_id,
            source,
            timestamp,
            created_at,
            roi_json,
            features_json,
            vehicles_json
        FROM analysis_records
        WHERE 1 = 1
    """

    params = []

    if camera_id:
        query += " AND camera_id = ?"
        params.append(str(camera_id))

    if session_id:
        query += " AND session_id = ?"
        params.append(str(session_id))

    if source:
        query += " AND source = ?"
        params.append(str(source))

    query += """
        ORDER BY created_at DESC
        LIMIT ?
    """

    params.append(max(1, min(int(limit), 1000)))

    with sqlite3.connect(_RECORDING_DB) as db:
        rows = db.execute(
            query,
            params,
        ).fetchall()

    result = []

    for row in rows:
        result.append(
            {
                "id": row[0],
                "camera_id": row[1],
                "session_id": row[2],
                "source": row[3],
                "timestamp": row[4],
                "created_at": row[5],
                "roi": json.loads(row[6]),
                "features": json.loads(row[7]),
                "vehicles": json.loads(row[8]),
            }
        )

    return result


def save_evidence(
    camera_id,
    source,
    timestamp,
    roi,
    features,
    vehicles,
    image_bytes,
    session_id=None,
):
    _ensure_storage()

    evidence_id = str(uuid.uuid4())

    filename = (
        f"{camera_id}_"
        f"{int(time.time() * 1000)}_"
        f"{evidence_id[:8]}"
    )

    image_path = _EVIDENCE_DIR / (
        filename + ".jpg"
    )

    metadata_path = _EVIDENCE_DIR / (
        filename + ".json"
    )

    image_path.write_bytes(
        image_bytes
    )

    metadata = {
        "id": evidence_id,
        "camera_id": str(camera_id),
        "session_id": session_id,
        "source": str(source),
        "timestamp": float(timestamp),
        "created_at": time.time(),
        "roi": roi,
        "features": sorted(features),
        "vehicles": vehicles,
        "image_file": str(
            image_path.relative_to(
                _BACKEND_ROOT
            )
        ),
    }

    metadata_path.write_text(
        json.dumps(
            metadata,
            indent=2,
        ),
        encoding="utf-8",
    )

    return metadata


def _clamp_roi(
    frame,
    x,
    y,
    width,
    height,
):
    frame_h, frame_w = frame.shape[:2]

    x = max(
        0,
        min(
            int(x),
            frame_w - 1,
        ),
    )

    y = max(
        0,
        min(
            int(y),
            frame_h - 1,
        ),
    )

    x2 = max(
        x + 1,
        min(
            int(x + width),
            frame_w,
        ),
    )

    y2 = max(
        y + 1,
        min(
            int(y + height),
            frame_h,
        ),
    )

    return x, y, x2, y2


def _dominant_color(crop):
    if crop is None or crop.size == 0:
        return None

    hsv = cv2.cvtColor(
        crop,
        cv2.COLOR_BGR2HSV,
    )

    pixels = hsv.reshape(
        -1,
        3,
    )

    valid = pixels[
        (pixels[:, 2] > 35) &
        (pixels[:, 2] < 245)
    ]

    if len(valid) < 20:
        valid = pixels

    if len(valid) == 0:
        return None

    hue = valid[:, 0]
    sat = valid[:, 1]
    val = valid[:, 2]

    median_sat = float(
        np.median(sat)
    )

    median_val = float(
        np.median(val)
    )

    if median_sat < 35:
        if median_val > 180:
            return "white"

        if median_val < 80:
            return "black"

        return "gray"

    median_hue = float(
        np.median(hue)
    )

    if (
        median_val > 190
        and median_sat < 80
    ):
        return "white"

    if median_val < 70:
        return "black"

    if (
        median_hue < 10
        or median_hue >= 170
    ):
        return "red"

    if median_hue < 25:
        return "orange"

    if median_hue < 35:
        return "yellow"

    if median_hue < 85:
        return "green"

    if median_hue < 105:
        return "cyan"

    if median_hue < 135:
        return "blue"

    if median_hue < 170:
        return "purple"

    return "unknown"



def _enhance_plate_image(image):
    if image is None or image.size == 0:
        return []

    enlarged = cv2.resize(
        image,
        None,
        fx=6,
        fy=6,
        interpolation=cv2.INTER_CUBIC,
    )

    gray = cv2.cvtColor(
        enlarged,
        cv2.COLOR_BGR2GRAY,
    )

    clahe = cv2.createCLAHE(
        clipLimit=3.0,
        tileGridSize=(8, 8),
    )

    contrast = clahe.apply(gray)

    denoised = cv2.bilateralFilter(
        contrast,
        7,
        55,
        55,
    )

    blur = cv2.GaussianBlur(
        denoised,
        (0, 0),
        2.0,
    )

    sharpened = cv2.addWeighted(
        denoised,
        2.0,
        blur,
        -1.0,
        0,
    )

    otsu = cv2.threshold(
        sharpened,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )[1]

    adaptive = cv2.adaptiveThreshold(
        sharpened,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        7,
    )

    blackhat_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (31, 11),
    )

    blackhat = cv2.morphologyEx(
        sharpened,
        cv2.MORPH_BLACKHAT,
        blackhat_kernel,
    )

    blackhat = cv2.normalize(
        blackhat,
        None,
        0,
        255,
        cv2.NORM_MINMAX,
    )

    return [
        enlarged,
        contrast,
        sharpened,
        otsu,
        adaptive,
        blackhat,
    ]



def _clean_plate_text(value):
    value = re.sub(
        r"[^A-Z0-9]",
        "",
        value.upper(),
    )

    if not 5 <= len(value) <= 12:
        return None

    if not any(char.isalpha() for char in value):
        return None

    if not any(char.isdigit() for char in value):
        return None

    return value


def _plate_text_score(
    value,
    ocr_confidence=0.0,
):
    if not value:
        return 0.0

    letters = sum(
        1
        for char in value
        if char.isalpha()
    )

    digits = sum(
        1
        for char in value
        if char.isdigit()
    )

    score = 0.0

    if 8 <= len(value) <= 10:
        score += 0.30
    elif 6 <= len(value) <= 11:
        score += 0.18

    if letters >= 2:
        score += 0.20

    if digits >= 2:
        score += 0.20

    if (
        len(value) >= 4
        and value[0].isalpha()
        and value[1].isalpha()
    ):
        score += 0.12

    if re.match(
        r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{3,4}$",
        value,
    ):
        score += 0.25

    if ocr_confidence > 0:
        score += (
            min(
                max(
                    ocr_confidence,
                    0.0,
                ) / 100.0,
                1.0,
            )
            * 0.25
        )

    return min(
        score,
        1.0,
    )


def _ocr_enhanced_plate_region(
    region,
):
    if (
        region is None
        or region.size == 0
    ):
        return None

    height, width = region.shape[:2]

    if width < 35 or height < 8:
        return None

    variants = _enhance_plate_image(
        region
    )

    configs = (
        "--psm 6",
        "--psm 7",
        "--psm 8",
        "--psm 11",
        "--psm 13",
    )

    candidates = {}

    for image in variants:
        for config in configs:
            try:
                data = pytesseract.image_to_data(
                    image,
                    config=(
                        config
                        + " -c "
                        "tessedit_char_whitelist="
                        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                    ),
                    output_type=(
                        pytesseract.Output.DICT
                    ),
                )
            except Exception:
                continue

            tokens = []

            raw_texts = data.get(
                "text",
                [],
            )

            raw_confidences = data.get(
                "conf",
                [],
            )

            for index, raw_text in enumerate(
                raw_texts
            ):
                cleaned = _clean_plate_text(
                    raw_text
                )

                if not cleaned:
                    continue

                try:
                    confidence = float(
                        raw_confidences[
                            index
                        ]
                    )
                except (
                    ValueError,
                    TypeError,
                    IndexError,
                ):
                    confidence = 0.0

                tokens.append(
                    (
                        cleaned,
                        confidence,
                    )
                )

            if not tokens:
                continue

            joined = _clean_plate_text(
                "".join(
                    value
                    for value, _ in tokens
                )
            )

            if joined:
                average_confidence = (
                    sum(
                        confidence
                        for _, confidence
                        in tokens
                    )
                    / len(tokens)
                )

                score = _plate_text_score(
                    joined,
                    average_confidence,
                )

                current = candidates.get(
                    joined
                )

                candidate = (
                    score,
                    average_confidence,
                    len(tokens),
                )

                if (
                    current is None
                    or candidate > current
                ):
                    candidates[joined] = candidate

            for (
                token,
                confidence,
            ) in tokens:
                score = _plate_text_score(
                    token,
                    confidence,
                )

                current = candidates.get(
                    token
                )

                candidate = (
                    score,
                    confidence,
                    1,
                )

                if (
                    current is None
                    or candidate > current
                ):
                    candidates[token] = candidate

    if not candidates:
        return None

    ranked = sorted(
        candidates.items(),
        key=lambda item: (
            item[1][0],
            item[1][1],
            item[1][2],
            len(item[0]),
        ),
        reverse=True,
    )

    text_value, metrics = ranked[0]

    score = metrics[0]
    ocr_confidence = metrics[1]
    votes = metrics[2]

    if score < 0.38:
        return None

    return {
        "text": text_value,
        "confidence": round(
            score,
            3,
        ),
        "ocr_confidence": round(
            ocr_confidence,
            2,
        ),
        "ocr_votes": votes,
        "source": "enhanced_selected_roi",
    }


def _selected_plate_windows(
    region,
):
    height, width = region.shape[:2]

    windows = [
        (
            "full_roi",
            0,
            0,
            width,
            height,
        )
    ]

    if height >= 24:
        windows.append(
            (
                "lower_80",
                0,
                int(height * 0.20),
                width,
                height,
            )
        )

    if height >= 30:
        windows.append(
            (
                "lower_65",
                0,
                int(height * 0.35),
                width,
                height,
            )
        )

    if width >= 80:
        margin = int(
            width * 0.10
        )

        windows.append(
            (
                "center_80",
                margin,
                0,
                width - margin,
                height,
            )
        )

    return windows


def _ocr_selected_region(
    region,
):
    if (
        region is None
        or region.size == 0
    ):
        return None

    results = []

    for (
        method,
        x1,
        y1,
        x2,
        y2,
    ) in _selected_plate_windows(
        region
    ):
        crop = region[
            y1:y2,
            x1:x2,
        ]

        result = _ocr_enhanced_plate_region(
            crop
        )

        if not result:
            continue

        result["bbox"] = [
            int(x1),
            int(y1),
            int(x2),
            int(y2),
        ]

        result["method"] = method

        results.append(
            result
        )

    if not results:
        return None

    results.sort(
        key=lambda item: (
            item.get(
                "confidence",
                0.0,
            ),
            item.get(
                "ocr_confidence",
                0.0,
            ),
            item.get(
                "ocr_votes",
                0,
            ),
        ),
        reverse=True,
    )

    return results[0]


def _ocr_plate(
    vehicle_crop,
):
    if (
        vehicle_crop is None
        or vehicle_crop.size == 0
    ):
        return None

    result = _ocr_selected_region(
        vehicle_crop
    )

    if not result:
        return None

    result["method"] = (
        "vehicle_crop_selected_windows"
    )

    return result


def _speed_for_detection(
    camera_id,
    track_id,
    bbox,
    timestamp,
    meters_per_pixel=None,
):
    if track_id is None:
        return {
            "speed_kph": None,
            "speed_status":
                "tracking_required",
        }

    center_x = (
        bbox[0] +
        bbox[2]
    ) / 2.0

    center_y = (
        bbox[1] +
        bbox[3]
    ) / 2.0

    camera_state = _SPEED_STATE.setdefault(
        camera_id,
        {},
    )

    previous = camera_state.get(
        track_id
    )

    camera_state[track_id] = {
        "x": center_x,
        "y": center_y,
        "timestamp": timestamp,
    }

    if previous is None:
        return {
            "speed_kph": None,
            "speed_status":
                "warming_up",
        }

    elapsed = (
        timestamp -
        previous["timestamp"]
    )

    if elapsed <= 0:
        return {
            "speed_kph": None,
            "speed_status":
                "invalid_time",
        }

    pixel_distance = float(
        np.hypot(
            center_x -
            previous["x"],
            center_y -
            previous["y"],
        )
    )

    pixels_per_second = (
        pixel_distance /
        elapsed
    )

    if (
        not meters_per_pixel
        or meters_per_pixel <= 0
    ):
        return {
            "speed_kph": None,
            "speed_status":
                "calibration_required",
            "pixel_speed":
                round(
                    pixels_per_second,
                    3,
                ),
        }

    meters_per_second = (
        pixels_per_second *
        meters_per_pixel
    )

    return {
        "speed_kph": round(
            meters_per_second *
            3.6,
            2,
        ),
        "speed_status":
            "estimated",
        "pixel_speed":
            round(
                pixels_per_second,
                3,
            ),
    }


def analyze_region(
    frame,
    camera_id,
    roi,
    features,
    timestamp=None,
    meters_per_pixel=None,
    source="live",
    session_id=None,
    record=True,
):
    if frame is None:
        raise ValueError(
            "Frame is empty"
        )

    timestamp = (
        float(timestamp)
        if timestamp is not None
        else time.time()
    )

    x, y, x2, y2 = _clamp_roi(
        frame,
        roi.get("x", 0),
        roi.get("y", 0),
        roi.get(
            "width",
            frame.shape[1],
        ),
        roi.get(
            "height",
            frame.shape[0],
        ),
    )

    region = frame[
        y:y2,
        x:x2,
    ]

    selected_region_plate = None

    if "plate" in features:
        selected_region_plate = (
            _ocr_selected_region(
                region
            )
        )

    vehicles = detect_vehicles(
        frame,
        camera_id=camera_id,
        tracking=True,
    )

    selected = []

    for vehicle in vehicles:
        vx1, vy1, vx2, vy2 = (
            vehicle["bbox"]
        )

        ix1 = max(x, vx1)
        iy1 = max(y, vy1)
        ix2 = min(x2, vx2)
        iy2 = min(y2, vy2)

        if (
            ix2 <= ix1
            or iy2 <= iy1
        ):
            continue

        vehicle_result = dict(
            vehicle
        )

        crop = frame[
            max(0, vy1):
            min(frame.shape[0], vy2),
            max(0, vx1):
            min(frame.shape[1], vx2),
        ]

        if "color" in features:
            vehicle_result[
                "color"
            ] = _dominant_color(
                crop
            )

        if "plate" in features:
            plate = _ocr_plate(
                crop
            )

            if plate:
                plate[
                    "bbox"
                ] = [
                    int(vx1 + plate["bbox"][0]),
                    int(vy1 + plate["bbox"][1]),
                    int(vx1 + plate["bbox"][2]),
                    int(vy1 + plate["bbox"][3]),
                ]

            vehicle_result[
                "license_plate"
            ] = plate

        if "speed" in features:
            vehicle_result[
                "speed"
            ] = _speed_for_detection(
                camera_id=camera_id,
                track_id=vehicle.get(
                    "track_id"
                ),
                bbox=vehicle[
                    "bbox"
                ],
                timestamp=timestamp,
                meters_per_pixel=meters_per_pixel,
            )

        selected.append(
            vehicle_result
        )

    result = {
        "camera_id": camera_id,
        "source": source,
        "session_id": session_id,
        "roi": {
            "x": x,
            "y": y,
            "width": x2 - x,
            "height": y2 - y,
        },
        "features": sorted(
            features
        ),
        "timestamp": timestamp,
        "region_width": int(
            region.shape[1]
        ),
        "region_height": int(
            region.shape[0]
        ),
        "vehicle_count": len(
            selected
        ),
        "vehicles": selected,
        "region_license_plate":
            selected_region_plate,
        "plate_enhancement":
            "6x upscale + CLAHE + bilateral denoise + sharpening + thresholding",
    }

    if record:
        result["record_id"] = (
            record_analysis(
                camera_id=camera_id,
                source=source,
                timestamp=timestamp,
                roi=result["roi"],
                features=features,
                vehicles=selected,
                session_id=session_id,
            )
        )

    return result
