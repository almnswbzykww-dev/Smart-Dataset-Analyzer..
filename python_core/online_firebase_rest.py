from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class FirebaseRestClient:
    """
    Pure Python stdlib Firebase Auth + Firestore REST client for Dataset Analyzer Online.
    Reads non-secret public client parameters dynamically from firebase-applet-config.json
    so zero API keys or secrets are hardcoded inside source code.
    """

    def __init__(self, config_path: str) -> None:
        self.config_path = config_path
        self.config = self._load_config(config_path)

    @staticmethod
    def _load_config(config_path: str) -> dict[str, Any]:
        if not os.path.exists(config_path):
            return {}
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    @property
    def is_configured(self) -> bool:
        return bool(self.config.get("apiKey") and self.config.get("projectId"))

    @property
    def project_id(self) -> str:
        return str(self.config.get("projectId", ""))

    @property
    def database_id(self) -> str:
        return str(self.config.get("firestoreDatabaseId", "(default)") or "(default)")

    @property
    def auth_domain(self) -> str:
        return str(self.config.get("authDomain", ""))

    def status_summary(self) -> dict[str, Any]:
        return {
            "edition": "Dataset Analyzer Online",
            "configured": self.is_configured,
            "projectId": self.project_id,
            "authDomain": self.auth_domain,
            "firestoreDatabaseId": self.database_id,
            "supportedAuthProviders": [
                "email_password",
                "register",
                "password_reset",
                "google.com",
                "facebook.com",
                "apple.com",
            ],
        }

    def _post_json(self, url: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        req_headers = {"Content-Type": "application/json"}
        if headers:
            req_headers.update(headers)
        req = urllib.request.Request(url, data=body, headers=req_headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="ignore")
            try:
                parsed = json.loads(err_body)
                msg = parsed.get("error", {}).get("message", str(exc))
            except json.JSONDecodeError:
                msg = str(exc)
            raise RuntimeError(msg) from exc

    def _auth_url(self, action: str) -> str:
        api_key = self.config.get("apiKey", "")
        if not api_key:
            raise RuntimeError("إعدادات Firebase غير متوفرة في firebase-applet-config.json.")
        return f"https://identitytoolkit.googleapis.com/v1/{action}?key={urllib.parse.quote(str(api_key))}"

    def sign_in_with_email(self, email: str, password: str) -> dict[str, Any]:
        return self._post_json(
            self._auth_url("accounts:signInWithPassword"),
            {"email": email.strip(), "password": password, "returnSecureToken": True},
        )

    def sign_up_with_email(self, email: str, password: str, display_name: str = "") -> dict[str, Any]:
        res = self._post_json(
            self._auth_url("accounts:signUp"),
            {"email": email.strip(), "password": password, "returnSecureToken": True},
        )
        if display_name.strip() and res.get("idToken"):
            self._post_json(
                self._auth_url("accounts:update"),
                {
                    "idToken": res["idToken"],
                    "displayName": display_name.strip()[:120],
                    "returnSecureToken": True,
                },
            )
            res["displayName"] = display_name.strip()[:120]
        return res

    def send_password_reset(self, email: str) -> dict[str, Any]:
        return self._post_json(
            self._auth_url("accounts:sendOobCode"),
            {"requestType": "PASSWORD_RESET", "email": email.strip()},
        )

    def list_saved_analyses_rest(self, uid: str, id_token: str) -> list[dict[str, Any]]:
        if not self.project_id:
            return []
        url = (
            f"https://firestore.googleapis.com/v1/projects/{urllib.parse.quote(self.project_id)}"
            f"/databases/{urllib.parse.quote(self.database_id)}/documents/users/{urllib.parse.quote(uid)}/savedAnalyses"
        )
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {id_token}"}, method="GET")
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        docs = data.get("documents", [])
        results: list[dict[str, Any]] = []
        for doc in docs:
            fields = doc.get("fields", {})
            results.append(
                {
                    "id": doc.get("name", "").split("/")[-1],
                    "title": fields.get("title", {}).get("stringValue", ""),
                    "datasetName": fields.get("datasetName", {}).get("stringValue", ""),
                    "chartType": fields.get("chartType", {}).get("stringValue", ""),
                    "summaryText": fields.get("summaryText", {}).get("stringValue", ""),
                }
            )
        return results
