"""Read-only Amphetamine status for T4 Mobile, served through private HTTPS."""

import argparse
import json
import math
import pathlib
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


STATUS_PATH = "/v1/amphetamine"
CACHE_SECONDS = 600
PROBE_TIMEOUT_SECONDS = 4
MAX_SECONDS = 2**31 - 1
SESSION_STATES = {
    "0": "unlimited",
    "-1": "trigger",
    "-2": "conditional",
    "-3": "inactive",
    "closed": "closed",
}


def read_session(probe):
    try:
        result = subprocess.run(
            [str(probe)], capture_output=True, text=True, timeout=PROBE_TIMEOUT_SECONDS,
            check=True,
        ).stdout.strip()
        if result in SESSION_STATES:
            return SESSION_STATES[result], None
        if result.isascii() and result.isdecimal() and len(result) <= 10:
            seconds = int(result)
            if 0 < seconds <= MAX_SECONDS:
                return "timed", seconds
    except (OSError, subprocess.SubprocessError, UnicodeError):
        pass
    return "unavailable", None


def elapsed_time():
    # Darwin's CLOCK_MONOTONIC_RAW includes system sleep.
    return time.clock_gettime(time.CLOCK_MONOTONIC_RAW)


class SessionCache:
    def __init__(self, environment_id, read, clock=elapsed_time):
        self.environment_id = environment_id
        self.read = read
        self.clock = clock
        self.lock = threading.Lock()
        self.sample = None

    def get(self):
        with self.lock:
            now = self.clock()
            if self.sample is None or now - self.sample[0] >= CACHE_SECONDS:
                status, seconds = self.read()
                self.sample = self.clock(), status, seconds

            measured_at, status, seconds = self.sample
            response = {"version": 1, "environmentId": self.environment_id, "status": status}
            if seconds is not None:
                response["remainingSeconds"] = max(0, seconds - math.floor(self.clock() - measured_at))
            return response


class StatusHandler(BaseHTTPRequestHandler):
    def setup(self):
        self.request.settimeout(3)
        super().setup()

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        if self.path != STATUS_PATH:
            self.send_error(404)
            return

        payload = json.dumps(self.server.session_cache.get()).encode("ascii")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'none'")
        self.end_headers()
        self.wfile.write(payload)


class StatusServer(ThreadingHTTPServer):
    request_queue_size = 8

    def __init__(self, port, cache):
        super().__init__(("127.0.0.1", port), StatusHandler)
        self.session_cache = cache
        self.workers = threading.BoundedSemaphore(8)

    def process_request(self, request, client_address):
        if not self.workers.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.workers.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.workers.release()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--environment-id", required=True)
    parser.add_argument("--probe", required=True, type=pathlib.Path)
    parser.add_argument("--port", type=int, default=18773)
    args = parser.parse_args()
    probe = args.probe.resolve()
    cache = SessionCache(args.environment_id, lambda: read_session(probe))
    with StatusServer(args.port, cache) as server:
        server.serve_forever(poll_interval=30)


if __name__ == "__main__":
    main()
