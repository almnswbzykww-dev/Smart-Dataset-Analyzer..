from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from offline_app import create_offline_server
from online_app import create_online_server
from python_core.offline_sqlite_db import OfflineSQLiteDatabase
from python_core.online_firebase_rest import FirebaseRestClient
from python_core.shared_engine import (
    CHART_TYPES_AR,
    aggregate_series,
    build_print_voucher_html,
    compute_column_stats,
    generate_voucher_number,
    load_csv_dataset,
)


class SharedEngineTests(unittest.TestCase):
    def test_sample_csv_and_all_six_charts(self) -> None:
        sample_path = os.path.join(ROOT_DIR, "data", "sample_data.csv")
        ds = load_csv_dataset(sample_path, "sample_data.csv")
        self.assertGreaterEqual(ds["rows_count"], 12)
        self.assertGreaterEqual(ds["cols_count"], 8)

        cases = [
            ("Branch", "Sales", "Bar"),
            ("Month", "Profit", "Line"),
            ("Category", "Sales", "Pie"),
            ("Cost", "Profit", "Scatter"),
            ("Branch", "Orders", "Histogram"),
            ("Category", "Sales", "Box Plot"),
        ]
        for x_col, y_col, ctype in cases:
            res = aggregate_series(ds["rows"], x_col, y_col, "sum", ctype)
            self.assertEqual(res["chart_type"], ctype)

        stats = compute_column_stats(ds["rows"], "Sales")
        self.assertEqual(int(stats["count"]), ds["rows_count"])
        self.assertGreater(stats["sum"], 0)

    def test_negative_pie_rejected_and_xss_escaped_voucher(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as tmp:
            tmp.write("Dept,Budget,Balance\nIT,5000,-200\nHR,3000,400\n")
            tmp_path = tmp.name
        try:
            ds = load_csv_dataset(tmp_path, "custom.csv")
            with self.assertRaises(ValueError):
                aggregate_series(ds["rows"], "Dept", "Balance", "sum", "Pie")
            bar = aggregate_series(ds["rows"], "Dept", "Budget", "sum", "Bar")
            self.assertEqual(bar["values"], [5000.0, 3000.0])
        finally:
            os.remove(tmp_path)

        voucher = build_print_voucher_html(
            title="<script>alert(1)</script>",
            edition_label="Dataset Analyzer Offline",
            voucher_no=generate_voucher_number("BF-TEST"),
            company={"companyName": "<img src=x onerror=alert(1)>", "location": "صنعاء", "address": "شارع الزبيري"},
            summary_pairs=[("البند", "100")],
        )
        self.assertIn("سند طباعة رسمي", voucher)
        self.assertNotIn("<script>alert(1)</script>", voucher)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", voucher)


class OfflineEditionTests(unittest.TestCase):
    def test_sqlite_db_lifecycle_and_http_server(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test_offline.db")
            db = OfflineSQLiteDatabase(db_path)

            saved_company = db.save_company_settings(
                {"companyName": "شركة بن فيصل", "location": "صنعاء", "address": "الزبيري"}
            )
            self.assertEqual(saved_company["companyName"], "شركة بن فيصل")

            user = db.save_local_user({"displayName": "زكريا فيصل", "phone": "+967771312997"})
            self.assertEqual(user["displayName"], "زكريا فيصل")

            rec = db.save_analysis(
                {
                    "title": "تقرير المبيعات",
                    "pageType": "dashboard",
                    "datasetName": "sample_data.csv",
                    "xCol": "Branch",
                    "yCol": "Sales",
                    "chartType": "Bar",
                    "aggMode": "sum",
                    "rowCount": 12,
                    "colCount": 8,
                    "summaryText": "ملخص ناجح",
                }
            )
            self.assertEqual(len(db.list_analyses()), 1)
            self.assertTrue(db.delete_analysis(rec["id"]))
            self.assertEqual(len(db.list_analyses()), 0)

            server = create_offline_server(port=0, db_path=db_path)
            port = server.server_address[1]
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/offline/status") as resp:
                    status = json.loads(resp.read().decode("utf-8"))
                    self.assertEqual(status["mode"], "offline")
                    self.assertFalse(status["internetRequired"])
                    self.assertEqual(set(status["chartTypes"].keys()), set(CHART_TYPES_AR.keys()))

                with urllib.request.urlopen(f"http://127.0.0.1:{port}/print-voucher?chart=Bar") as resp:
                    html_out = resp.read().decode("utf-8")
                    self.assertIn("سند طباعة رسمي", html_out)
                    self.assertIn("شركة بن فيصل", html_out)

                # Clear all must reject without confirmed=True
                req = urllib.request.Request(
                    f"http://127.0.0.1:{port}/api/offline/clear-all",
                    data=json.dumps({"confirmed": False}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    urllib.request.urlopen(req)
                self.assertEqual(ctx.exception.code, 400)
            finally:
                server.shutdown()
                server.server_close()


class OnlineEditionTests(unittest.TestCase):
    def test_firebase_config_and_online_server(self) -> None:
        cfg_path = os.path.join(ROOT_DIR, "firebase-applet-config.json")
        client = FirebaseRestClient(cfg_path)
        self.assertTrue(client.is_configured)
        summary = client.status_summary()
        self.assertIn("google.com", summary["supportedAuthProviders"])
        self.assertIn("facebook.com", summary["supportedAuthProviders"])
        self.assertIn("apple.com", summary["supportedAuthProviders"])

        server = create_online_server(port=0, config_path=cfg_path)
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/online/status") as resp:
                status = json.loads(resp.read().decode("utf-8"))
                self.assertEqual(status["mode"], "online")
                self.assertTrue(status["startsWithLoginGate"])
                self.assertTrue(status["configured"])

            with urllib.request.urlopen(f"http://127.0.0.1:{port}/print-voucher?chart=Line") as resp:
                html_out = resp.read().decode("utf-8")
                self.assertIn("سند طباعة رسمي", html_out)
                self.assertIn("Dataset Analyzer Online", html_out)
        finally:
            server.shutdown()
            server.server_close()


def maybe_run_optional_tkinter_tests() -> None:
    if importlib.util.find_spec("tkinter") is None or importlib.util.find_spec("pandas") is None:
        print("[INFO] Optional Tkinter/Pandas desktop check skipped (not installed in container).")
        return
    import tkinter as tk
    from tkinter import messagebox
    from unittest.mock import patch
    from app import CSVChartApp

    root = tk.Tk()
    root.withdraw()
    with patch.object(messagebox, "showerror", return_value="ok"):
        desktop_app = CSVChartApp(root)
        assert desktop_app.df is not None
        assert desktop_app.generate_chart() is True
    root.destroy()
    print("[OK] Optional Tkinter desktop tests passed.")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SharedEngineTests)
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(OfflineEditionTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(OnlineEditionTests))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    maybe_run_optional_tkinter_tests()
    raise SystemExit(0 if result.wasSuccessful() else 1)
