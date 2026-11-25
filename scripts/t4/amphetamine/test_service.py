import concurrent.futures
import http.client
import json
import pathlib
import subprocess
import threading
import unittest
from unittest.mock import patch

from service import CACHE_SECONDS, STATUS_PATH, SessionCache, StatusServer, read_session


class AmphetamineStatusTests(unittest.TestCase):
    def test_probe_decodes_amphetamine_values(self):
        examples = [
            ("123", ("timed", 123)),
            ("0", ("unlimited", None)),
            ("-1", ("trigger", None)),
            ("-2", ("conditional", None)),
            ("-3", ("inactive", None)),
            ("closed", ("closed", None)),
            ("-4", ("unavailable", None)),
            ("9999999999", ("unavailable", None)),
            ("NaN", ("unavailable", None)),
        ]
        for output, expected in examples:
            with self.subTest(output=output), patch("service.subprocess.run") as run:
                run.return_value.stdout = output
                self.assertEqual(read_session(pathlib.Path("/probe")), expected)

    def test_probe_timeout_returns_unavailable(self):
        timeout = subprocess.TimeoutExpired(["/probe"], 4)
        with patch("service.subprocess.run", side_effect=timeout):
            self.assertEqual(read_session(pathlib.Path("/probe")), ("unavailable", None))

    def test_cache_expires_without_inferring_an_inactive_session(self):
        clock = [0]
        samples = iter([("timed", 25), ("inactive", None)])
        cache = SessionCache("mac", lambda: next(samples), lambda: clock[0])
        self.assertEqual(cache.get()["remainingSeconds"], 25)
        clock[0] = 20
        self.assertEqual(cache.get()["remainingSeconds"], 5)
        clock[0] = CACHE_SECONDS - 1
        self.assertEqual(cache.get()["status"], "timed")
        self.assertEqual(cache.get()["remainingSeconds"], 0)
        clock[0] = CACHE_SECONDS
        self.assertEqual(cache.get()["status"], "inactive")

    def test_http_routes_share_a_single_probe(self):
        calls = []

        def read():
            calls.append(1)
            return "trigger", None

        with StatusServer(0, SessionCache("mac", read)) as server:
            port = server.server_port
            self.assertEqual(server.server_address[0], "127.0.0.1")
            worker = threading.Thread(target=server.serve_forever)
            worker.start()

            def request(method, path):
                connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
                try:
                    connection.request(method, path)
                    response = connection.getresponse()
                    return response.status, response.getheader("Cache-Control"), response.read()
                finally:
                    connection.close()

            try:
                self.assertEqual(request("GET", "/")[0], 404)
                self.assertEqual(request("POST", STATUS_PATH)[0], 501)
                self.assertEqual(calls, [])
                with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                    replies = list(pool.map(lambda _: request("GET", STATUS_PATH), range(4)))
                self.assertEqual(calls, [1])
                for code, cache_control, payload in replies:
                    self.assertEqual(code, 200)
                    self.assertEqual(cache_control, "no-store")
                    self.assertEqual(json.loads(payload), {
                        "version": 1, "environmentId": "mac", "status": "trigger",
                    })
            finally:
                server.shutdown()
                worker.join()


if __name__ == "__main__":
    unittest.main()
