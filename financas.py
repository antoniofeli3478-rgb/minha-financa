#!/usr/bin/env python3
"""Minhas Finanças - local server.

Serves the app in ./app and stores data in ./dados/financas.json.
Uses only the Python standard library (no pip install needed).

Usage:  python3 financas.py [--porta 8765] [--sem-navegador]
"""
import argparse
import json
import os
import shutil
import sys
import threading
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE = Path(__file__).resolve().parent
APP_DIR = BASE / "app"
DATA_DIR = BASE / "dados"
DATA_FILE = DATA_DIR / "financas.json"
BACKUP_DIR = DATA_DIR / "backups"
MAX_BACKUPS = 30
MAX_BODY = 50 * 1024 * 1024

_lock = threading.Lock()


def read_data():
    if not DATA_FILE.exists():
        return None
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def daily_backup():
    """Keep one copy of the data file per day, up to MAX_BACKUPS."""
    if not DATA_FILE.exists():
        return
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    target = BACKUP_DIR / f"financas-{datetime.now():%Y-%m-%d}.json"
    if not target.exists():
        shutil.copy2(DATA_FILE, target)
    old = sorted(BACKUP_DIR.glob("financas-*.json"))
    for p in old[:-MAX_BACKUPS]:
        p.unlink(missing_ok=True)


def write_data(data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    daily_backup()
    tmp = DATA_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DATA_FILE)  # atomic: never leaves a half-written file


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR), **kwargs)

    def log_message(self, fmt, *args):
        pass  # keep the terminal quiet

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _same_origin(self):
        # Block other websites open in the browser from touching the data.
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        return origin is None or origin.split("://", 1)[-1] == host

    def do_GET(self):
        if self.path.split("?")[0] == "/api/dados":
            with _lock:
                try:
                    data = read_data()
                except (OSError, json.JSONDecodeError) as e:
                    return self._json(500, {"erro": f"Não consegui ler os dados: {e}"})
            return self._json(200, {"dados": data})
        return super().do_GET()

    def do_PUT(self):
        if self.path.split("?")[0] != "/api/dados":
            return self._json(404, {"erro": "não encontrado"})
        if not self._same_origin():
            return self._json(403, {"erro": "origem não permitida"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._json(400, {"erro": "tamanho inválido"})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._json(400, {"erro": "JSON inválido"})
        if not isinstance(data, dict) or "lancamentos" not in data:
            return self._json(400, {"erro": "formato inesperado"})
        with _lock:
            write_data(data)
        return self._json(200, {"ok": True, "salvoEm": datetime.now().isoformat(timespec="seconds")})


def main():
    ap = argparse.ArgumentParser(description="Minhas Finanças (servidor local)")
    ap.add_argument("--porta", type=int, default=8765)
    ap.add_argument("--sem-navegador", action="store_true", help="não abrir o navegador")
    args = ap.parse_args()

    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.porta), Handler)
    except OSError:
        print(f"A porta {args.porta} já está em uso. Talvez o app já esteja aberto:")
        print(f"  http://127.0.0.1:{args.porta}")
        print("Ou rode com outra porta:  python3 financas.py --porta 8800")
        sys.exit(1)

    url = f"http://127.0.0.1:{args.porta}"
    print("=" * 52)
    print("  Minhas Finanças está rodando!")
    print(f"  Abra no navegador: {url}")
    print(f"  Seus dados ficam em: {DATA_FILE}")
    print("  Para fechar, aperte Ctrl+C (ou feche esta janela).")
    print("=" * 52)
    if not args.sem_navegador:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAté logo!")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
