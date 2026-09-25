import os
import time
import threading
from urllib.parse import quote

import cv2
from dotenv import load_dotenv


load_dotenv()


class CameraAIWorker:

    def __init__(
        self,
        camera_id: str,
        sample_fps: float = 5.0,
    ):
        self.camera_id = camera_id
        self.sample_fps = sample_fps

        self.running = False
        self.thread: threading.Thread | None = None

        self.frames_received = 0
        self.last_frame_time: float | None = None

    def start(self):
        if self.running:
            print(f"[AI] Worker already running: {self.camera_id}")
            return

        self.running = True

        self.thread = threading.Thread(
            target=self.run,
            daemon=True,
            name=f"AI-{self.camera_id}",
        )

        self.thread.start()

        print(f"[AI] Worker started: {self.camera_id}")

    def stop(self):
        self.running = False

        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)

        print(f"[AI] Worker stopped: {self.camera_id}")

    def build_rtsp_url(self) -> str:
        email = os.getenv("CCTV_EMAIL")
        password = os.getenv("CCTV_PASSWORD")

        if not email or not password:
            raise RuntimeError(
                "CCTV_EMAIL and CCTV_PASSWORD must be configured"
            )

        encoded_email = quote(email, safe="")
        encoded_password = quote(password, safe="")

        return (
            f"rtsp://{encoded_email}:{encoded_password}"
            f"@103.250.160.189:554/stream/{self.camera_id}"
        )

    def run(self):
        print(f"[AI] Connecting to {self.camera_id}...")

        while self.running:

            capture = None

            try:
                rtsp_url = self.build_rtsp_url()

                capture = cv2.VideoCapture(
                    rtsp_url,
                    cv2.CAP_FFMPEG,
                )

                if not capture.isOpened():
                    print(
                        f"[AI] Failed to open stream: "
                        f"{self.camera_id}"
                    )

                    time.sleep(5)
                    continue

                print(
                    f"[AI] Connected to stream: "
                    f"{self.camera_id}"
                )

                self.process_stream(capture)

            except Exception as exc:
                print(
                    f"[AI] Worker error "
                    f"{self.camera_id}: {exc}"
                )

            finally:
                if capture is not None:
                    capture.release()

                if self.running:
                    print(
                        f"[AI] Reconnecting to "
                        f"{self.camera_id} in 5 seconds..."
                    )

                    time.sleep(5)

    def process_stream(self, capture):
        frame_interval = 1.0 / self.sample_fps
        next_sample_time = time.monotonic()

        while self.running:

            success, frame = capture.read()

            if not success:
                print(
                    f"[AI] Frame read failed: "
                    f"{self.camera_id}"
                )
                break

            now = time.monotonic()

            if now < next_sample_time:
                continue

            next_sample_time = now + frame_interval

            self.frames_received += 1
            self.last_frame_time = time.time()

            height, width = frame.shape[:2]

            print(
                f"[AI] {self.camera_id} | "
                f"frame={self.frames_received} | "
                f"resolution={width}x{height}"
            )