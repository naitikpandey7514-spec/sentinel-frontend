import time

from app.ai.worker import CameraAIWorker


worker = CameraAIWorker(
    camera_id="cam01",
    sample_fps=5,
)

worker.start()

try:
    while True:
        time.sleep(1)

except KeyboardInterrupt:
    print("\nStopping AI worker...")

finally:
    worker.stop()