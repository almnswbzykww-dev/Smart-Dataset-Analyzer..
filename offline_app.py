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

from python_core.offline_sqlite_db import OfflineSQLiteDatabase
from python_core.shared_engine import (
    CHART_TYPES_AR,
    aggregate_series,
    build_print_voucher_html,
    compute_column_stats,
    generate_voucher_number,
    json_response_bytes,
    load_csv_dataset,
)

EDITION_NAME = "Dataset Analyzer Offline"
DEFAULT_PORT = 8765
MAX_JSON_BYTES = 5 * 1024 * 1024


def resolve_web_root() -> str:
    for candidate in ("web", "dist"):
        full = os.path.join(BASE_DIR, candidate)
        if os.path.isdir(full) and os.path.exists(os.path.join(full, "offline.html")):
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


class OfflineServerState:
    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = db_path or os.path.join(BASE_DIR, "data", "dataset_analyzer_offline.db")
        self.db = OfflineSQLiteDatabase(self.db_path)
        self.web_root = resolve_web_root()
        self.sample_csv_path = resolve_sample_csv()


def make_offline_handler(state: OfflineServerState):
    class OfflineRequestHandler(BaseHTTPRequestHandler):
        server_version = "DatasetAnalyzerOffline/1.0"

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
            rel = "offline.html" if req_path in ("/", "", "/index.html") else req_path.lstrip("/")
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
            elif target.endswith(".webmanifest"):
                mime = "application/manifest+json; charset=utf-8"
            with open(target, "rb") as f:
                self._send_bytes(200, mime or "application/octet-stream", f.read())
            return True

        def do_GET(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path

            if path == "/api/offline/status":
                self._send_json(
                    200,
                    {
                        "edition": EDITION_NAME,
                        "mode": "offline",
                        "internetRequired": False,
                        "databaseEngine": "SQLite",
                        "databasePath": state.db_path,
                        "chartTypes": CHART_TYPES_AR,
                        "webBundleReady": bool(state.web_root),
                    },
                )
                return

            if path == "/api/offline/sample":
                ds = load_csv_dataset(state.sample_csv_path, "sample_data.csv")
                self._send_json(200, ds)
                return

            if path == "/api/offline/company":
                self._send_json(200, state.db.get_company_settings())
                return

            if path == "/api/offline/user":
                self._send_json(200, {"user": state.db.get_local_user()})
                return

            if path == "/api/offline/analyses":
                self._send_json(200, {"items": state.db.list_analyses()})
                return

            if path == "/api/offline/datasets":
                self._send_json(200, {"items": state.db.list_custom_datasets()})
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
                    edition_label=f"{EDITION_NAME} — يعمل 100% محلياً بدون إنترنت",
                    voucher_no=generate_voucher_number("BF-OFF"),
                    company=state.db.get_company_settings(),
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

            if path == "/api/offline/company":
                self._send_json(200, state.db.save_company_settings(body))
                return

            if path == "/api/offline/user":
                try:
                    self._send_json(200, state.db.save_local_user(body))
                except ValueError as err:
                    self._send_json(400, {"error": str(err)})
                return

            if path == "/api/offline/analyses":
                self._send_json(201, state.db.save_analysis(body))
                return

            if path == "/api/offline/datasets":
                self._send_json(201, state.db.save_custom_dataset(body))
                return

            if path == "/api/offline/clear-all":
                if body.get("confirmed") is not True:
                    self._send_json(400, {"error": "يلزم تأكيد المستخدم قبل مسح جميع البيانات."})
                    return
                state.db.clear_all_data()
                self._send_json(200, {"cleared": True})
                return

            if path == "/print-voucher":
                html_doc = build_print_voucher_html(
                    title=str(body.get("title", "سند طباعة محلي")),
                    subtitle=str(body.get("subtitle", "")),
                    edition_label=f"{EDITION_NAME} — يعمل 100% محلياً بدون إنترنت",
                    voucher_no=generate_voucher_number("BF-OFF"),
                    company=body.get("company") or state.db.get_company_settings(),
                    summary_pairs=[tuple(p) for p in body.get("summaryPairs", []) if isinstance(p, (list, tuple)) and len(p) == 2],
                    headers=body.get("headers"),
                    rows=body.get("rows"),
                    notes=str(body.get("notes", "")),
                    auto_print=True,
                )
                self._send_bytes(200, "text/html; charset=utf-8", html_doc.encode("utf-8"))
                return

            self._send_json(404, {"error": "Not found"})

        def do_DELETE(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            if path.startswith("/api/offline/analyses/"):
                aid = path.split("/")[-1]
                self._send_json(200, {"deleted": state.db.delete_analysis(aid)})
                return
            if path.startswith("/api/offline/datasets/"):
                did = path.split("/")[-1]
                self._send_json(200, {"deleted": state.db.delete_custom_dataset(did)})
                return
            if path == "/api/offline/user":
                state.db.clear_local_user()
                self._send_json(200, {"loggedOut": True})
                return
            self._send_json(404, {"error": "Not found"})

    return OfflineRequestHandler


def create_offline_server(port: int = DEFAULT_PORT, db_path: str | None = None) -> ThreadingHTTPServer:
    state = OfflineServerState(db_path=db_path)
    return ThreadingHTTPServer(("127.0.0.1", port), make_offline_handler(state))


def run_self_check() -> int:
    state = OfflineServerState()
    ds = load_csv_dataset(state.sample_csv_path, "sample_data.csv")
    assert ds["rows_count"] > 0 and len(ds["columns"]) > 0
    for ctype in CHART_TYPES_AR:
        x_use = ds["numeric_columns"][0] if ctype == "Scatter" else ds["default_x"]
        y_use = ds["numeric_columns"][1] if (ctype == "Scatter" and len(ds["numeric_columns"]) > 1) else ds["default_y"]
        res = aggregate_series(ds["rows"], x_use, y_use, "sum", ctype)
        assert res["chart_type"] == ctype
    voucher = build_print_voucher_html(
        title="فحص سند الطباعة المحلي",
        edition_label=EDITION_NAME,
        voucher_no=generate_voucher_number("BF-OFF"),
        company=state.db.get_company_settings(),
        summary_pairs=[("الملف", ds["name"]), ("الصفوف", ds["rows_count"])],
    )
    assert "سند طباعة رسمي" in voucher
    print(f"[OK] {EDITION_NAME} check passed | SQLite: {state.db_path} | Rows: {ds['rows_count']}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=EDITION_NAME)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Local port (default: 8765)")
    parser.add_argument("--no-browser", action="store_true", help="Do not launch browser automatically")
    parser.add_argument("--check", action="store_true", help="Verify local SQLite, CSV, charts & print voucher")
    args = parser.parse_args()

    if args.check:
        return run_self_check()

    server = create_offline_server(port=args.port)
    url = f"http://127.0.0.1:{server.server_address[1]}/offline.html"
    print(f"=== {EDITION_NAME} ===")
    print(f"URL: {url}")
    print(f"Print Voucher: http://127.0.0.1:{server.server_address[1]}/print-voucher")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down Dataset Analyzer Offline...")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
