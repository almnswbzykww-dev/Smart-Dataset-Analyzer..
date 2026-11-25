from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import threading
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from python_core.online_firebase_rest import FirebaseRestClient
from python_core.shared_engine import (
    CHART_TYPES_AR,
    aggregate_series,
    build_print_voucher_html,
    compute_column_stats,
    generate_voucher_number,
    json_response_bytes,
    load_csv_dataset,
)

EDITION_NAME = "Dataset Analyzer Online"
DEFAULT_PORT = 8766
MAX_JSON_BYTES = 5 * 1024 * 1024


def resolve_web_root() -> str:
    for candidate in ("web", "dist"):
        full = os.path.join(BASE_DIR, candidate)
        if os.path.isdir(full) and os.path.exists(os.path.join(full, "index.html")):
            return full
    return ""


def resolve_sample_csv() -> str:
    path = os.path.join(BASE_DIR, "data", "sample_data.csv")
    if os.path.exists(path):
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8-sig") as f:
        f.write(
            "Month,Branch,Category,Sales,Profit,Cost,Orders,Rating\n"
            "Jan,Sanaa,Electronics,125000,35000,90000,320,4.7\n"
            "Feb,Sanaa,Software,142000,48000,94000,410,4.8\n"
            "Mar,Aden,Electronics,98000,24000,74000,260,4.5\n"
            "Apr,Aden,Services,112000,36000,76000,295,4.6\n"
        )
    return path


class OnlineServerState:
    def __init__(self, config_path: str | None = None) -> None:
        self.config_path = config_path or os.path.join(BASE_DIR, "firebase-applet-config.json")
        self.firebase = FirebaseRestClient(self.config_path)
        self.web_root = resolve_web_root()
        self.sample_csv_path = resolve_sample_csv()


def make_online_handler(state: OnlineServerState):
    class OnlineRequestHandler(BaseHTTPRequestHandler):
        server_version = "DatasetAnalyzerOnline/1.0"

        def log_message(self, format: str, *args: Any) -> None:
            return

        def _send_bytes(self, status: int, content_type: str, body: bytes) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def _send_json(self, status: int, payload: Any) -> None:
            self._send_bytes(status, "application/json; charset=utf-8", json_response_bytes(payload))

        def _read_json(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length", "0") or "0")
            if length <= 0 or length > MAX_JSON_BYTES:
                raise ValueError("حجم الطلب غير صالح.")
            raw = self.rfile.read(length).decode("utf-8")
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise ValueError("صيغة JSON غير صالحة.")
            return parsed

        def _serve_static(self, req_path: str) -> bool:
            if not state.web_root:
                return False
            rel = "index.html" if req_path in ("/", "") else req_path.lstrip("/")
            real_root = os.path.realpath(state.web_root)
            target = os.path.realpath(os.path.join(real_root, rel))
            if not (target == real_root or target.startswith(real_root + os.sep)):
                self._send_json(403, {"error": "Access denied"})
                return True
            if not os.path.isfile(target):
                return False
            mime, _ = mimetypes.guess_type(target)
            if target.endswith(".js") or target.endswith(".mjs"):
                mime = "application/javascript; charset=utf-8"
            elif target.endswith(".css"):
                mime = "text/css; charset=utf-8"
            elif target.endswith(".html"):
                mime = "text/html; charset=utf-8"
            with open(target, "rb") as f:
                self._send_bytes(200, mime or "application/octet-stream", f.read())
            return True

        def do_GET(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path

            if path == "/api/online/status":
                self._send_json(
                    200,
                    {
                        **state.firebase.status_summary(),
                        "mode": "online",
                        "startsWithLoginGate": True,
                        "webBundleReady": bool(state.web_root),
                    },
                )
                return

            if path == "/api/online/sample":
                self._send_json(200, load_csv_dataset(state.sample_csv_path, "sample_data.csv"))
                return

            if path == "/print-voucher":
                qs = urllib.parse.parse_qs(parsed.query)
                ds = load_csv_dataset(state.sample_csv_path, "sample_data.csv")
                chart_type = (qs.get("chart") or ["Bar"])[0]
                if chart_type not in CHART_TYPES_AR:
                    chart_type = "Bar"
                num_cols = ds.get("numeric_columns", [])
                y_col = (qs.get("y") or [ds["default_y"]])[0]
                if qs.get("x"):
                    x_col = qs["x"][0]
                elif chart_type == "Scatter" and num_cols:
                    x_col = next((c for c in num_cols if c != y_col), num_cols[0])
                else:
                    x_col = ds["default_x"]
                try:
                    agg = aggregate_series(ds["rows"], x_col, y_col, "sum", chart_type)
                except ValueError:
                    agg = aggregate_series(ds["rows"], ds["default_x"], ds["default_y"], "sum", "Bar")
                stats = compute_column_stats(ds["rows"], y_col) if y_col in num_cols else None
                pairs: list[tuple[str, Any]] = [
                    ("الملف", ds["name"]),
                    ("محور X", x_col),
                    ("محور Y", y_col),
                    ("نوع المخطط", f"{CHART_TYPES_AR.get(chart_type, chart_type)} ({chart_type})"),
                    ("عدد الصفوف", ds["rows_count"]),
                ]
                if stats:
                    pairs.append(("المجموع", f"{stats['sum']:,.2f}"))
                    pairs.append(("المتوسط", f"{stats['mean']:,.2f}"))
                if chart_type == "Scatter" and agg.get("points"):
                    table_rows = [[f"{pt['x']:,.2f}", f"{pt['y']:,.2f}"] for pt in agg["points"][:50]]
                else:
                    table_rows = [[lbl, f"{val:,.2f}"] for lbl, val in zip(agg.get("labels", []), agg.get("values", []))]
                html_doc = build_print_voucher_html(
                    title=f"تقرير تحليل {ds['name']}",
                    subtitle=f"{CHART_TYPES_AR.get(chart_type, chart_type)} — {y_col} حسب {x_col}",
                    edition_label=f"{EDITION_NAME} — متصل بـ Firebase ({state.firebase.project_id})",
                    voucher_no=generate_voucher_number("BF-ON"),
                    summary_pairs=pairs,
                    headers=[x_col, y_col],
                    rows=table_rows,
                    auto_print=True,
                )
                self._send_bytes(200, "text/html; charset=utf-8", html_doc.encode("utf-8"))
                return

            if self._serve_static(path):
                return

            self._send_json(404, {"error": "Not found"})

        def do_POST(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            try:
                body = self._read_json()
            except ValueError as err:
                self._send_json(400, {"error": str(err)})
                return

            if path == "/api/online/auth/login":
                email = str(body.get("email", "")).strip()
                password = str(body.get("password", ""))
                if not email or not password:
                    self._send_json(400, {"error": "البريد الإلكتروني وكلمة المرور مطلوبان."})
                    return
                try:
                    self._send_json(200, state.firebase.sign_in_with_email(email, password))
                except RuntimeError as err:
                    self._send_json(401, {"error": str(err)})
                return

            if path == "/api/online/auth/register":
                email = str(body.get("email", "")).strip()
                password = str(body.get("password", ""))
                display_name = str(body.get("displayName", "")).strip()
                if not email or len(password) < 6:
                    self._send_json(400, {"error": "يرجى إدخال بريد صحيح وكلمة مرور لا تقل عن 6 أحرف."})
                    return
                try:
                    self._send_json(201, state.firebase.sign_up_with_email(email, password, display_name))
                except RuntimeError as err:
                    self._send_json(400, {"error": str(err)})
                return

            if path == "/api/online/auth/reset":
                email = str(body.get("email", "")).strip()
                if not email:
                    self._send_json(400, {"error": "البريد الإلكتروني مطلوب."})
                    return
                try:
                    self._send_json(200, state.firebase.send_password_reset(email))
                except RuntimeError as err:
                    self._send_json(400, {"error": str(err)})
                return

            if path == "/print-voucher":
                html_doc = build_print_voucher_html(
                    title=str(body.get("title", "سند طباعة سحابي")),
                    subtitle=str(body.get("subtitle", "")),
                    edition_label=f"{EDITION_NAME} — Firebase ({state.firebase.project_id})",
                    voucher_no=generate_voucher_number("BF-ON"),
                    company=body.get("company") or {},
                    summary_pairs=[tuple(p) for p in body.get("summaryPairs", []) if isinstance(p, (list, tuple)) and len(p) == 2],
                    headers=body.get("headers"),
                    rows=body.get("rows"),
                    notes=str(body.get("notes", "")),
                    auto_print=True,
                )
                self._send_bytes(200, "text/html; charset=utf-8", html_doc.encode("utf-8"))
                return

            self._send_json(404, {"error": "Not found"})

    return OnlineRequestHandler


def create_online_server(port: int = DEFAULT_PORT, config_path: str | None = None) -> ThreadingHTTPServer:
    state = OnlineServerState(config_path=config_path)
    return ThreadingHTTPServer(("127.0.0.1", port), make_online_handler(state))


def run_self_check() -> int:
    state = OnlineServerState()
    status = state.firebase.status_summary()
    assert status["configured"] is True, "firebase-applet-config.json must be present"
    ds = load_csv_dataset(state.sample_csv_path, "sample_data.csv")
    voucher = build_print_voucher_html(
        title="فحص سند الطباعة السحابي",
        edition_label=EDITION_NAME,
        voucher_no=generate_voucher_number("BF-ON"),
        summary_pairs=[("المشروع", status["projectId"]), ("الملف", ds["name"])],
    )
    assert "سند طباعة رسمي" in voucher
    print(f"[OK] {EDITION_NAME} check passed | Firebase Project: {status['projectId']} | Rows: {ds['rows_count']}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=EDITION_NAME)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Local port (default: 8766)")
    parser.add_argument("--no-browser", action="store_true", help="Do not launch browser automatically")
    parser.add_argument("--check", action="store_true", help="Verify Firebase config, CSV & print voucher")
    args = parser.parse_args()

    if args.check:
        return run_self_check()

    server = create_online_server(port=args.port)
    url = f"http://127.0.0.1:{server.server_address[1]}/"
    print(f"=== {EDITION_NAME} ===")
    print(f"URL (Starts at Login Page): {url}")
    print(f"Print Voucher: http://127.0.0.1:{server.server_address[1]}/print-voucher")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Dataset Analyzer Online...")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
