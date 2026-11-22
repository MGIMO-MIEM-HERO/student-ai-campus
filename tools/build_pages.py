"""Собирает статическую демо-версию для GitHub Pages в папку _site/.

GitHub Pages отдаёт только файлы, поэтому сервер запускается один раз во время сборки: на свежей
временной базе считаются кабинеты всех демо-аккаунтов, коды проверки билетов и документов.
В браузере их обслуживает public/js/demo-api.js, а изменения (заявки, прочтения, отметки «сдано»,
смена статуса деканатом, объявления) хранятся только в localStorage посетителя.

Пароль в сборку не попадает: для каждого аккаунта записан PBKDF2-SHA256 (200 000 итераций) со своей солью,
вход проверяется через WebCrypto.

Запуск: python3 tools/build_pages.py [папка]   (по умолчанию _site)
"""
import hashlib
import json
import os
import secrets
import shutil
import sys
import tempfile
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "_site"
ITERATIONS = 200_000


def main():
    tmp = tempfile.mkdtemp()
    os.environ["CAMPUS_DB"] = str(Path(tmp) / "pages.sqlite3")
    sys.path.insert(0, str(ROOT))
    import server  # noqa: E402 — путь к базе задаётся до импорта

    server.initialize()
    accounts, verify = {}, {}
    with closing(server.connect()) as db:
        for user in db.execute("SELECT * FROM users ORDER BY role, login").fetchall():
            salt = secrets.token_bytes(16)
            accounts[user["login"]] = {
                "role": user["role"], "name": user["name"], "group": user["group_name"],
                "salt": salt.hex(),
                "hash": hashlib.pbkdf2_hmac("sha256", server.PASSWORD.encode(), salt, ITERATIONS).hex(),
                "data": server.Handler.dashboard(None, user, db)}
        for (code,) in db.execute("SELECT code FROM cards UNION SELECT code FROM documents").fetchall():
            verify[code] = server.verify_code(db, code)
    payload = {"built": server.now(), "iterations": ITERATIONS, "kinds": server.KINDS, "statuses": server.STATUSES,
               "closed": server.CLOSED, "tags": server.TAGS, "teacher_tags": server.TEACHER_TAGS,
               "documents": server.DOCUMENTS, "accounts": accounts, "verify": verify}

    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(server.PUBLIC, OUT)
    (OUT / "demo").mkdir()
    (OUT / "demo" / "data.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    index = OUT / "index.html"
    html = index.read_text(encoding="utf-8")
    # Признак статической сборки и та же политика безопасности, что сервер отдаёт заголовком.
    csp = ("default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; "
           "base-uri 'none'; form-action 'self'")
    html = html.replace('<html lang="ru">', '<html lang="ru" data-static="1">', 1)
    html = html.replace('<meta charset="utf-8">',
                        f'<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="{csp}">', 1)
    index.write_text(html, encoding="utf-8")
    (OUT / "404.html").write_text(html, encoding="utf-8")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    shutil.rmtree(tmp, ignore_errors=True)
    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"Static demo built in {OUT} ({size / 1e6:.1f} MB, data {len(json.dumps(payload)) / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
