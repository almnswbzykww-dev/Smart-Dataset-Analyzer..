from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any


class OfflineSQLiteDatabase:
    """100% local SQLite storage for Dataset Analyzer Offline (zero network calls)."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS company_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    company_name TEXT NOT NULL DEFAULT '',
                    location TEXT NOT NULL DEFAULT '',
                    address TEXT NOT NULL DEFAULT '',
                    logo_data_url TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS local_user (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    uid TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    email TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL DEFAULT '',
                    role TEXT NOT NULL DEFAULT 'محلل بيانات محلي',
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS saved_analyses (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    page_type TEXT NOT NULL,
                    dataset_name TEXT NOT NULL,
                    x_col TEXT NOT NULL,
                    y_col TEXT NOT NULL,
                    chart_type TEXT NOT NULL,
                    agg_mode TEXT NOT NULL,
                    row_count INTEGER NOT NULL DEFAULT 0,
                    col_count INTEGER NOT NULL DEFAULT 0,
                    summary_text TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS custom_datasets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    # ---------- Company Settings ----------
    def get_company_settings(self) -> dict[str, str]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM company_settings WHERE id = 1").fetchone()
            if not row:
                return {"companyName": "", "location": "", "address": "", "logoDataUrl": "", "updatedAtIso": ""}
            return {
                "companyName": row["company_name"],
                "location": row["location"],
                "address": row["address"],
                "logoDataUrl": row["logo_data_url"],
                "updatedAtIso": row["updated_at"],
            }

    def save_company_settings(self, payload: dict[str, Any]) -> dict[str, str]:
        now = self._now_iso()
        clean = {
            "companyName": str(payload.get("companyName", "")).strip()[:160],
            "location": str(payload.get("location", "")).strip()[:160],
            "address": str(payload.get("address", "")).strip()[:300],
            "logoDataUrl": str(payload.get("logoDataUrl", ""))[:262144],
            "updatedAtIso": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO company_settings (id, company_name, location, address, logo_data_url, updated_at)
                VALUES (1, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    company_name = excluded.company_name,
                    location = excluded.location,
                    address = excluded.address,
                    logo_data_url = excluded.logo_data_url,
                    updated_at = excluded.updated_at
                """,
                (clean["companyName"], clean["location"], clean["address"], clean["logoDataUrl"], now),
            )
        return clean

    # ---------- Local User Profile ----------
    def get_local_user(self) -> dict[str, str] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM local_user WHERE id = 1").fetchone()
            if not row:
                return None
            return {
                "uid": row["uid"],
                "displayName": row["display_name"],
                "email": row["email"],
                "phone": row["phone"],
                "role": row["role"],
                "updatedAtIso": row["updated_at"],
            }

    def save_local_user(self, payload: dict[str, Any]) -> dict[str, str]:
        name = str(payload.get("displayName", "")).strip()[:120]
        if not name:
            raise ValueError("اسم المستخدم المحلي مطلوب.")
        now = self._now_iso()
        uid = str(payload.get("uid") or "offline_local_user")
        email = str(payload.get("email", "")).strip()[:200]
        phone = str(payload.get("phone", "")).strip()[:32]
        role = str(payload.get("role", "محلل بيانات محلي")).strip()[:80]
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO local_user (id, uid, display_name, email, phone, role, updated_at)
                VALUES (1, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    display_name = excluded.display_name,
                    email = excluded.email,
                    phone = excluded.phone,
                    role = excluded.role,
                    updated_at = excluded.updated_at
                """,
                (uid, name, email, phone, role, now),
            )
        return {
            "uid": uid,
            "displayName": name,
            "email": email,
            "phone": phone,
            "role": role,
            "updatedAtIso": now,
        }

    def clear_local_user(self) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM local_user WHERE id = 1")

    # ---------- Saved Analyses ----------
    def list_analyses(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM saved_analyses ORDER BY created_at DESC").fetchall()
            return [
                {
                    "id": r["id"],
                    "title": r["title"],
                    "pageType": r["page_type"],
                    "datasetName": r["dataset_name"],
                    "xCol": r["x_col"],
                    "yCol": r["y_col"],
                    "chartType": r["chart_type"],
                    "aggMode": r["agg_mode"],
                    "rowCount": r["row_count"],
                    "colCount": r["col_count"],
                    "summaryText": r["summary_text"],
                    "createdAtIso": r["created_at"],
                }
                for r in rows
            ]

    def save_analysis(self, payload: dict[str, Any]) -> dict[str, Any]:
        analysis_id = str(payload.get("id") or f"off_analysis_{int(datetime.now(timezone.utc).timestamp() * 1000)}")
        now = self._now_iso()
        record = {
            "id": analysis_id,
            "title": str(payload.get("title", "تحليل بيانات محلي")).strip()[:160],
            "pageType": str(payload.get("pageType", "dashboard")),
            "datasetName": str(payload.get("datasetName", "dataset.csv")).strip()[:160],
            "xCol": str(payload.get("xCol", "X")).strip()[:120],
            "yCol": str(payload.get("yCol", "Y")).strip()[:120],
            "chartType": str(payload.get("chartType", "Bar")),
            "aggMode": str(payload.get("aggMode", "sum")),
            "rowCount": max(0, int(payload.get("rowCount", 0))),
            "colCount": max(0, int(payload.get("colCount", 0))),
            "summaryText": str(payload.get("summaryText", "")).strip()[:2000],
            "createdAtIso": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO saved_analyses
                (id, title, page_type, dataset_name, x_col, y_col, chart_type, agg_mode, row_count, col_count, summary_text, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["title"],
                    record["pageType"],
                    record["datasetName"],
                    record["xCol"],
                    record["yCol"],
                    record["chartType"],
                    record["aggMode"],
                    record["rowCount"],
                    record["colCount"],
                    record["summaryText"],
                    now,
                ),
            )
        return record

    def delete_analysis(self, analysis_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM saved_analyses WHERE id = ?", (analysis_id,))
            return cur.rowcount > 0

    # ---------- Custom Datasets ----------
    def list_custom_datasets(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT id, name, payload_json, created_at FROM custom_datasets ORDER BY created_at DESC").fetchall()
            out: list[dict[str, Any]] = []
            for r in rows:
                try:
                    data = json.loads(r["payload_json"])
                    data["id"] = r["id"]
                    data["name"] = r["name"]
                    data["createdAtIso"] = r["created_at"]
                    out.append(data)
                except json.JSONDecodeError:
                    continue
            return out

    def save_custom_dataset(self, dataset: dict[str, Any]) -> dict[str, Any]:
        ds_id = str(dataset.get("id") or f"off_ds_{int(datetime.now(timezone.utc).timestamp() * 1000)}")
        name = str(dataset.get("name", "dataset.csv")).strip()[:160]
        now = self._now_iso()
        stored = {**dataset, "id": ds_id, "name": name, "createdAtIso": now}
        with self._connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO custom_datasets (id, name, payload_json, created_at) VALUES (?, ?, ?, ?)",
                (ds_id, name, json.dumps(stored, ensure_ascii=False), now),
            )
        return stored

    def delete_custom_dataset(self, ds_id: str) -> bool:
        with self._connect() as conn:
            cur = conn.execute("DELETE FROM custom_datasets WHERE id = ?", (ds_id,))
            return cur.rowcount > 0

    def clear_all_data(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                DELETE FROM company_settings;
                DELETE FROM local_user;
                DELETE FROM saved_analyses;
                DELETE FROM custom_datasets;
                """
            )
