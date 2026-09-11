"""API client tests against a mocked serve: a real local HTTP server with
canned answers, so the client's URL shapes, error mapping and JSON parsing
are exercised without the engine or the chain."""

import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

CANNED = {
    "/health": {"ok": True, "service": "gemhog-serve", "uptimeSec": 1},
    "/top": {"rows": [], "note": "no hunt yet"},
    "/alerts": {"alerts": [{"at": "2026-09-11T12:00:00Z", "grade": "VS1", "score": 74, "symbol": "NOVA", "token": "0xab"}]},
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        path = self.path.split("?")[0]
        if path.startswith("/check/"):
            body, status = ({"error": "not a pons token"}, 404)
        elif path in CANNED:
            body, status = (CANNED[path], 200)
        else:
            body, status = ({"error": "unknown"}, 404)
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):  # silence
        pass


@pytest.fixture(scope="module", autouse=True)
def mock_serve():
    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    os.environ["GEMHOG_SERVE_URL"] = f"http://127.0.0.1:{server.server_port}"
    # api reads the env at import time, so import after pointing it at the mock
    global api
    import api  # noqa: PLC0415
    import importlib

    importlib.reload(api)
    yield
    server.shutdown()


@pytest.mark.asyncio
async def test_health_roundtrip():
    assert (await api.health())["ok"] is True


@pytest.mark.asyncio
async def test_top_returns_empty_rows():
    assert (await api.top())["rows"] == []


@pytest.mark.asyncio
async def test_alerts_unwraps_the_list():
    alerts = await api.alerts("2026-09-11T00:00:00Z")
    assert alerts[0]["grade"] == "VS1"


@pytest.mark.asyncio
async def test_serve_errors_become_serve_error():
    with pytest.raises(api.ServeError, match="not a pons token"):
        await api.check("0x" + "00" * 20)
