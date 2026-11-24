from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(ROOT_DIR, "dist")
BUILD_DIR = os.path.join(ROOT_DIR, "build")
OFFLINE_OUT = os.path.join(BUILD_DIR, "offline")
ONLINE_OUT = os.path.join(BUILD_DIR, "online")


def copy_file(src: str, dst: str) -> None:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)


def _sanitize_offline_sw(web_out: str) -> None:
    sw_path = os.path.join(web_out, "sw.js")
    if not os.path.exists(sw_path):
        return
    with open(sw_path, "r", encoding="utf-8") as f:
        sw_text = f.read()

    import re

    pattern = re.compile(r"(workbox\.precacheAndRoute\()(\[.*?\])(\s*,\s*\{\}\);)", re.DOTALL)
    match = pattern.search(sw_text)
    if not match:
        return

    entries = json.loads(match.group(2))
    cleaned_entries = [
        entry
        for entry in entries
        if isinstance(entry, dict)
        and entry.get("url") != "index.html"
        and not str(entry.get("url", "")).startswith("assets/main-")
        and os.path.exists(os.path.join(web_out, str(entry.get("url", ""))))
    ]
    new_array_json = json.dumps(cleaned_entries, ensure_ascii=False, indent=2)
    updated_sw = sw_text[: match.start(2)] + new_array_json + sw_text[match.end(2) :]
    with open(sw_path, "w", encoding="utf-8") as f:
        f.write(updated_sw)


def build_offline_package() -> dict[str, object]:
    import glob

    os.makedirs(OFFLINE_OUT, exist_ok=True)
    # Preserve DatasetAnalyzerOffline.spec while refreshing package contents
    copy_file(os.path.join(ROOT_DIR, "offline_app.py"), os.path.join(OFFLINE_OUT, "offline_app.py"))
    copy_file(os.path.join(ROOT_DIR, "python_core", "__init__.py"), os.path.join(OFFLINE_OUT, "python_core", "__init__.py"))
    copy_file(os.path.join(ROOT_DIR, "python_core", "shared_engine.py"), os.path.join(OFFLINE_OUT, "python_core", "shared_engine.py"))
    copy_file(os.path.join(ROOT_DIR, "python_core", "offline_sqlite_db.py"), os.path.join(OFFLINE_OUT, "python_core", "offline_sqlite_db.py"))
    copy_file(os.path.join(ROOT_DIR, "data", "sample_data.csv"), os.path.join(OFFLINE_OUT, "data", "sample_data.csv"))
    copy_file(os.path.join(ROOT_DIR, "requirements.txt"), os.path.join(OFFLINE_OUT, "requirements.txt"))

    # Copy built offline web bundle (keep strictly isolated — remove index.html and Online main-* bundles)
    web_out = os.path.join(OFFLINE_OUT, "web")
    if os.path.exists(web_out):
        shutil.rmtree(web_out)
    if os.path.isdir(DIST_DIR):
        shutil.copytree(DIST_DIR, web_out)
        online_entry = os.path.join(web_out, "index.html")
        if os.path.exists(online_entry):
            os.remove(online_entry)
        for pattern in ("assets/main-*.js", "assets/main-*.css"):
            for path_item in glob.glob(os.path.join(web_out, pattern)):
                os.remove(path_item)
        _sanitize_offline_sw(web_out)

    # Ensure zero Firebase files inside Offline package
    for forbidden in ("firebase-applet-config.json", "online_firebase_rest.py", "online_app.py"):
        for root, _dirs, files in os.walk(OFFLINE_OUT):
            if forbidden in files:
                os.remove(os.path.join(root, forbidden))

    with open(os.path.join(OFFLINE_OUT, "run_offline.sh"), "w", encoding="utf-8") as f:
        f.write("#!/usr/bin/env bash\npython3 offline_app.py \"$@\"\n")
    os.chmod(os.path.join(OFFLINE_OUT, "run_offline.sh"), 0o755)

    with open(os.path.join(OFFLINE_OUT, "run_offline.bat"), "w", encoding="utf-8") as f:
        f.write("@echo off\r\npython offline_app.py %*\r\n")

    manifest = {
        "edition": "Dataset Analyzer Offline",
        "entrypoint": "offline_app.py",
        "database": "data/dataset_analyzer_offline.db (SQLite) + IndexedDB",
        "internetRequired": False,
        "firebaseIncluded": False,
        "defaultPort": 8765,
    }
    with open(os.path.join(OFFLINE_OUT, "edition_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    return manifest


def build_online_package() -> dict[str, object]:
    import glob

    os.makedirs(ONLINE_OUT, exist_ok=True)
    copy_file(os.path.join(ROOT_DIR, "online_app.py"), os.path.join(ONLINE_OUT, "online_app.py"))
    copy_file(os.path.join(ROOT_DIR, "python_core", "__init__.py"), os.path.join(ONLINE_OUT, "python_core", "__init__.py"))
    copy_file(os.path.join(ROOT_DIR, "python_core", "shared_engine.py"), os.path.join(ONLINE_OUT, "python_core", "shared_engine.py"))
    copy_file(os.path.join(ROOT_DIR, "python_core", "online_firebase_rest.py"), os.path.join(ONLINE_OUT, "python_core", "online_firebase_rest.py"))
    copy_file(os.path.join(ROOT_DIR, "firebase-applet-config.json"), os.path.join(ONLINE_OUT, "firebase-applet-config.json"))
    copy_file(os.path.join(ROOT_DIR, "data", "sample_data.csv"), os.path.join(ONLINE_OUT, "data", "sample_data.csv"))
    copy_file(os.path.join(ROOT_DIR, "requirements.txt"), os.path.join(ONLINE_OUT, "requirements.txt"))

    web_out = os.path.join(ONLINE_OUT, "web")
    if os.path.exists(web_out):
        shutil.rmtree(web_out)
    if os.path.isdir(DIST_DIR):
        shutil.copytree(DIST_DIR, web_out)
        for pattern in (
            "offline.html",
            "sw.js",
            "manifest.webmanifest",
            "workbox-*.js",
            "assets/offline-*.js",
            "assets/offline-*.css",
            "assets/workbox-window.*.js",
        ):
            for path_item in glob.glob(os.path.join(web_out, pattern)):
                os.remove(path_item)
        index_path = os.path.join(web_out, "index.html")
        if os.path.exists(index_path):
            with open(index_path, "r", encoding="utf-8") as f:
                idx_html = f.read()
            idx_html = idx_html.replace('<link rel="manifest" href="/manifest.webmanifest">', "")
            with open(index_path, "w", encoding="utf-8") as f:
                f.write(idx_html)

    with open(os.path.join(ONLINE_OUT, "run_online.sh"), "w", encoding="utf-8") as f:
        f.write("#!/usr/bin/env bash\npython3 online_app.py \"$@\"\n")
    os.chmod(os.path.join(ONLINE_OUT, "run_online.sh"), 0o755)

    with open(os.path.join(ONLINE_OUT, "run_online.bat"), "w", encoding="utf-8") as f:
        f.write("@echo off\r\npython online_app.py %*\r\n")

    manifest = {
        "edition": "Dataset Analyzer Online",
        "entrypoint": "online_app.py",
        "authProviders": ["Email/Password", "Register", "Password Reset", "Google", "Facebook", "Apple"],
        "cloudBackend": "Firebase Authentication + Firestore",
        "startsWithLoginPage": True,
        "defaultPort": 8766,
    }
    with open(os.path.join(ONLINE_OUT, "edition_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Build separate Dataset Analyzer Offline & Online editions")
    parser.add_argument("--pyinstaller", action="store_true", help="Also compile standalone binaries via PyInstaller if installed")
    args = parser.parse_args()

    off_manifest = build_offline_package()
    on_manifest = build_online_package()

    # Run --check on both built editions cleanly
    subprocess.run([sys.executable, os.path.join(OFFLINE_OUT, "offline_app.py"), "--check"], check=True)
    subprocess.run([sys.executable, os.path.join(ONLINE_OUT, "online_app.py"), "--check"], check=True)

    has_pyinstaller = importlib.util.find_spec("PyInstaller") is not None
    if args.pyinstaller:
        if not has_pyinstaller:
            print("[WARN] PyInstaller is not installed in this environment; standalone Python+Web folders built cleanly without .exe/.bin binary.")
        else:
            subprocess.run([sys.executable, "-m", "PyInstaller", "--noconfirm", os.path.join(OFFLINE_OUT, "DatasetAnalyzerOffline.spec")], check=True)
            subprocess.run([sys.executable, "-m", "PyInstaller", "--noconfirm", os.path.join(ONLINE_OUT, "DatasetAnalyzerOnline.spec")], check=True)

    print(json.dumps({"offline": off_manifest, "online": on_manifest, "pyinstallerAvailable": has_pyinstaller}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
