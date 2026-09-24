from dotenv import load_dotenv
import cv2
from pathlib import Path
from fastapi import HTTPException, Query
import uuid
import os
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from app.services.vehicle_detector import detect_vehicles
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
import json
from pathlib import Path
from sqlalchemy import (
    create_engine, String, Integer, Float, Boolean,
    DateTime, ForeignKey, select, func
)
from sqlalchemy.orm import (
    DeclarativeBase, Mapped, mapped_column,
    relationship, Session, sessionmaker
)

load_dotenv()

# -------------------------
# DATABASE
# -------------------------

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://sentinel_user:sentinel_dev_password@localhost:5432/sentinel"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def now_utc():
    return datetime.now(timezone.utc)


# -------------------------
# DATABASE MODELS
# -------------------------

class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(primary_key=True)
    camera_code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    department: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(200))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="ONLINE")

    detections: Mapped[list["Detection"]] = relationship(
        back_populates="camera"
    )


class Watchlist(Base):
    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(primary_key=True)
    plate_number: Mapped[str] = mapped_column(
        String(20), unique=True, index=True
    )
    category: Mapped[str] = mapped_column(String(50))
    priority: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(String(250), default="")


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[int] = mapped_column(primary_key=True)
    camera_id: Mapped[int] = mapped_column(ForeignKey("cameras.id"))
    plate_number: Mapped[str] = mapped_column(String(20), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )

    camera: Mapped["Camera"] = relationship(back_populates="detections")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    detection_id: Mapped[int] = mapped_column(ForeignKey("detections.id"))
    camera_id: Mapped[int] = mapped_column(ForeignKey("cameras.id"))
    plate_number: Mapped[str] = mapped_column(String(20), index=True)
    alert_type: Mapped[str] = mapped_column(String(50))
    priority: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="NEW")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc
    )


# -------------------------
# API SCHEMAS
# -------------------------

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CameraOut(ORMModel):
    id: int
    camera_code: str
    name: str
    department: str
    location: str
    latitude: float
    longitude: float
    status: str


class DetectionIn(BaseModel):
    camera_id: int
    plate_number: str = Field(min_length=3, max_length=20)
    confidence: float = Field(ge=0, le=1)


class WatchlistIn(BaseModel):
    plate_number: str = Field(min_length=3, max_length=20)
    category: str
    priority: str
    description: str = ""


class AlertStatusIn(BaseModel):
    status: str


# -------------------------
# STARTUP + DEMO DATA
# -------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(Camera)) == 0:
            demo_cameras = [
                Camera(
                    camera_code="CAM-001",
                    name="SG Highway North",
                    department="Police",
                    location="Ahmedabad",
                    latitude=23.0395,
                    longitude=72.5100,
                    status="ONLINE",
                ),
                Camera(
                    camera_code="CAM-002",
                    name="Satellite Junction",
                    department="Municipal",
                    location="Ahmedabad",
                    latitude=23.0258,
                    longitude=72.5300,
                    status="ONLINE",
                ),
                Camera(
                    camera_code="CAM-003",
                    name="Gandhinagar Road",
                    department="Police",
                    location="Gandhinagar",
                    latitude=23.2156,
                    longitude=72.6369,
                    status="ONLINE",
                ),
            ]
            db.add_all(demo_cameras)

        if db.scalar(select(func.count()).select_from(Watchlist)) == 0:
            db.add(
                Watchlist(
                    plate_number="GJ01AB1234",
                    category="STOLEN",
                    priority="HIGH",
                    description="Demo watchlist record — fictional",
                )
            )

        db.commit()

    yield


app = FastAPI(
    title="SENTINEL-X API",
    description="Unified CCTV intelligence hackathon prototype",
    version="1.0.0",
    lifespan=lifespan,
)

# Sentinel Camera Grid catalogue
CATALOGUE_PATH = Path(__file__).resolve().parent.parent / "cameras.json"


def load_camera_catalogue():
    if not CATALOGUE_PATH.exists():
        raise FileNotFoundError(
            f"Camera catalogue not found: {CATALOGUE_PATH}"
        )

    with open(CATALOGUE_PATH, "r", encoding="utf-8") as file:
        cameras = json.load(file)

    if not isinstance(cameras, list):
        raise ValueError("Camera catalogue must be a JSON list")

    return cameras


@app.get("/api/live-cameras")
def get_live_cameras():
    cameras = load_camera_catalogue()

    return {
        "count": len(cameras),
        "cameras": cameras
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------
# HEALTH + DASHBOARD
# -------------------------

@app.get("/")
def root():
    return {"message": "SENTINEL-X API is running"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sentinel-backend"}


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    total_cameras = db.scalar(select(func.count()).select_from(Camera)) or 0
    online = db.scalar(
        select(func.count()).select_from(Camera).where(Camera.status == "ONLINE")
    ) or 0
    total_detections = db.scalar(
        select(func.count()).select_from(Detection)
    ) or 0
    active_alerts = db.scalar(
        select(func.count()).select_from(Alert).where(Alert.status == "NEW")
    ) or 0

    return {
        "total_cameras": total_cameras,
        "online_cameras": online,
        "offline_cameras": total_cameras - online,
        "total_detections": total_detections,
        "active_alerts": active_alerts,
    }


# -------------------------
# CAMERAS
# -------------------------

@app.get("/api/cameras", response_model=list[CameraOut])
def get_cameras(db: Session = Depends(get_db)):
    return db.scalars(select(Camera).order_by(Camera.id)).all()


@app.get("/api/cameras/{camera_id}", response_model=CameraOut)
def get_camera(camera_id: int, db: Session = Depends(get_db)):
    camera = db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(404, "Camera not found")
    return camera


# -------------------------
# WATCHLIST
# -------------------------

@app.get("/api/watchlist")
def get_watchlist(db: Session = Depends(get_db)):
    return db.scalars(select(Watchlist).order_by(Watchlist.id.desc())).all()


@app.post("/api/watchlist")
def add_watchlist_item(
    payload: WatchlistIn,
    db: Session = Depends(get_db),
):
    plate = payload.plate_number.strip().upper()

    existing = db.scalar(
        select(Watchlist).where(Watchlist.plate_number == plate)
    )
    if existing:
        raise HTTPException(409, "Plate already exists in watchlist")

    item = Watchlist(
        plate_number=plate,
        category=payload.category.upper(),
        priority=payload.priority.upper(),
        description=payload.description,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# -------------------------
# DETECTION + ALERT ENGINE
# -------------------------

@app.post("/api/detections")
def create_detection(
    payload: DetectionIn,
    db: Session = Depends(get_db),
):
    camera = db.get(Camera, payload.camera_id)
    if not camera:
        raise HTTPException(404, "Camera not found")

    plate = payload.plate_number.strip().upper()

    detection = Detection(
        camera_id=camera.id,
        plate_number=plate,
        confidence=payload.confidence,
    )
    db.add(detection)
    db.flush()

    watch_item = db.scalar(
        select(Watchlist).where(Watchlist.plate_number == plate)
    )

    alert = None
    if watch_item:
        alert = Alert(
            detection_id=detection.id,
            camera_id=camera.id,
            plate_number=plate,
            alert_type=watch_item.category,
            priority=watch_item.priority,
            status="NEW",
        )
        db.add(alert)

    db.commit()
    db.refresh(detection)

    return {
        "message": "Detection saved",
        "detection_id": detection.id,
        "plate_number": plate,
        "camera": camera.camera_code,
        "watchlist_match": watch_item is not None,
        "alert_id": alert.id if alert else None,
    }


# -------------------------
# VEHICLE SEARCH + ROUTE
# -------------------------

@app.get("/api/vehicles/{plate_number}")
def vehicle_search(
    plate_number: str,
    db: Session = Depends(get_db),
):
    plate = plate_number.strip().upper()

    detections = db.scalars(
        select(Detection)
        .where(Detection.plate_number == plate)
        .order_by(Detection.timestamp.asc())
    ).all()

    if not detections:
        raise HTTPException(404, "No detections found for this plate")

    route = []
    for d in detections:
        route.append({
            "detection_id": d.id,
            "camera_id": d.camera.id,
            "camera_code": d.camera.camera_code,
            "camera_name": d.camera.name,
            "location": d.camera.location,
            "latitude": d.camera.latitude,
            "longitude": d.camera.longitude,
            "timestamp": d.timestamp,
            "confidence": d.confidence,
        })

    watch_item = db.scalar(
        select(Watchlist).where(Watchlist.plate_number == plate)
    )

    return {
        "plate_number": plate,
        "watchlist_match": watch_item is not None,
        "watchlist_category": watch_item.category if watch_item else None,
        "total_detections": len(route),
        "first_seen": route[0]["timestamp"],
        "last_seen": route[-1]["timestamp"],
        "route": route,
    }


# -------------------------
import uuid
from pathlib import Path

from fastapi import UploadFile, File, HTTPException

VIDEO_DIR = Path("storage/videos")
VIDEO_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500 MB


@app.post("/api/videos/upload")
async def upload_video(file: UploadFile = File(...)):
    original_name = Path(file.filename or "").name
    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported video format"
        )

    video_id = str(uuid.uuid4())
    saved_path = VIDEO_DIR / f"{video_id}{extension}"
    total_size = 0

    try:
        with saved_path.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_VIDEO_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Video exceeds 500 MB limit"
                    )

                output.write(chunk)

    except Exception:
        saved_path.unlink(missing_ok=True)
        raise

    finally:
        await file.close()

    return {
        "video_id": video_id,
        "filename": original_name,
        "size_bytes": total_size,
        "status": "uploaded",
        "message": "Video uploaded; processing not started"
    }

# -------------------------
# -------------------------
# ALERTS
# -------------------------


@app.get("/api/alerts")
def get_alerts(db: Session = Depends(get_db)):
    alerts = db.scalars(
        select(Alert).order_by(Alert.timestamp.desc())
    ).all()

    return [
        {
            "id": a.id,
            "plate_number": a.plate_number,
            "camera_id": a.camera_id,
            "alert_type": a.alert_type,
            "priority": a.priority,
            "status": a.status,
            "timestamp": a.timestamp,
        }
        for a in alerts
    ]


@app.patch("/api/alerts/{alert_id}")
def update_alert(
    alert_id: int,
    payload: AlertStatusIn,
    db: Session = Depends(get_db),
):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")

    allowed = {"NEW", "ACKNOWLEDGED", "RESOLVED"}
    status = payload.status.upper()

    if status not in allowed:
        raise HTTPException(400, "Invalid alert status")

    alert.status = status
    db.commit()

    return {"message": "Alert updated", "status": alert.status}


@app.post("/api/videos/{video_id}/process")
def process_video(
    video_id: str,
    sample_every_seconds: float = Query(default=1.0, gt=0, le=10)
    
):
    # Find the uploaded file by its server-generated ID
    matches = list(VIDEO_DIR.glob(f"{video_id}.*"))

    if not matches:
        raise HTTPException(
            status_code=404,
            detail="Video not found"
        )

    video_path = matches[0]

    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        raise HTTPException(
            status_code=400,
            detail="Could not open video file"
        )

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if not fps or fps <= 0 or total_frames <= 0:
            raise HTTPException(
                status_code=400,
                detail="Invalid video metadata"
            )

        duration_seconds = total_frames / fps
        frame_step = max(1, int(fps * sample_every_seconds))

        sampled_frames = []
        frame_index = 0

        while frame_index < total_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            success, frame = cap.read()

            if not success:
                break

            timestamp = frame_index / fps

            
            vehicles = detect_vehicles(frame)

            sampled_frames.append({
                "frame_index": frame_index,
                "timestamp_seconds": round(timestamp, 3),
                "width": int(frame.shape[1]),
                "height": int(frame.shape[0]),
                "vehicle_count": len(vehicles),
                "vehicles": vehicles,
            })
            frame_index += frame_step

        return {
            "video_id": video_id,
            "status": "processed",
            "fps": round(fps, 3),
            "total_frames": total_frames,
            "duration_seconds": round(duration_seconds, 2),
            "sample_interval_seconds": sample_every_seconds,
            "sampled_frame_count": len(sampled_frames),
            "frames": sampled_frames,
            "total_vehicles_detected": sum(
                item["vehicle_count"] for item in sampled_frames
            ),
        }

    finally:
        cap.release()