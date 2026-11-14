"""Сквозные проверки API: вход, разделение данных, роли, заявки и защита.

Запуск: python3 -m unittest discover -s tests -v
"""
import http.cookiejar
import json
import os
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

TMP = tempfile.mkdtemp()
os.environ["CAMPUS_DB"] = str(Path(TMP) / "test.sqlite3")
os.environ.pop("CAMPUS_AI_KEY", None)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server  # noqa: E402

server.Handler.log_message = lambda *args: None

PASSWORD = "Campus-demo-2026"


class Client:
    def __init__(self, base):
        self.base = base
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, body=None, headers=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, headers={
            "Content-Type": "application/json", **(headers or {})})
        try:
            with self.opener.open(request) as response:
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or b"{}")

    def login(self, login, password=PASSWORD):
        return self.call("/api/login", {"login": login, "password": password})


class ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.initialize()
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def setUp(self):
        server.FAILED_LOGINS.clear()

    def client(self, login=None):
        client = Client(self.base)
        if login:
            status, _ = client.login(login)
            self.assertEqual(status, 200)
        return client

    def test_passwords_are_salted_hashes(self):
        with sqlite3.connect(os.environ["CAMPUS_DB"]) as db:
            rows = db.execute("SELECT salt, password_hash FROM users").fetchall()
        self.assertGreaterEqual(len(rows), 3)
        self.assertEqual(len({salt for salt, _ in rows}), len(rows), "соль у каждого пользователя своя")
        for _, password_hash in rows:
            self.assertNotIn(PASSWORD.encode(), password_hash)

    def test_wrong_password_and_anonymous_access(self):
        self.assertEqual(Client(self.base).login("alina", "wrong")[0], 401)
        self.assertEqual(Client(self.base).call("/api/dashboard")[0], 401)

    def test_students_see_only_their_profile(self):
        _, alina = self.client("alina").call("/api/dashboard")
        _, mark = self.client("mark").call("/api/dashboard")
        self.assertEqual(alina["profile"]["login"], "alina")
        self.assertEqual(mark["profile"]["login"], "mark")
        self.assertNotEqual(alina["week"][0]["lessons"], mark["week"][0]["lessons"])
        self.assertTrue({r["id"] for r in alina["requests"]}.isdisjoint({r["id"] for r in mark["requests"]}))

    def test_foreign_request_is_not_reachable_by_url(self):
        mark = self.client("mark")
        _, created = mark.call("/api/requests", {"kind": "Справка об обучении", "note": "для визы"})
        mark_request = created["requests"][0]["id"]
        self.assertEqual(mark.call(f"/api/requests/{mark_request}")[0], 200)
        self.assertEqual(self.client("alina").call(f"/api/requests/{mark_request}")[0], 404)

    def test_student_cannot_use_staff_api(self):
        alina = self.client("alina")
        self.assertEqual(alina.call("/api/staff/announcements", {
            "tag": "Деканат", "title": "Взлом", "body": "Тест", "audience": "all"})[0], 403)
        request_id = alina.call("/api/dashboard")[1]["requests"][0]["id"]
        self.assertEqual(alina.call(f"/api/staff/requests/{request_id}", {"status": "Готова"})[0], 403)

    def test_staff_changes_status_and_student_sees_history(self):
        alina = self.client("alina")
        _, created = alina.call("/api/requests", {"kind": "Выписка об успеваемости", "note": "для стажировки"})
        request_id = created["requests"][0]["id"]
        staff = self.client("dekanat")
        _, board = staff.call("/api/dashboard")
        self.assertEqual(board["role"], "staff")
        self.assertIn(request_id, {r["id"] for r in board["requests"]})
        status, _ = staff.call(f"/api/staff/requests/{request_id}", {"status": "Готова", "comment": "Кабинет 101"})
        self.assertEqual(status, 200)
        _, item = alina.call(f"/api/requests/{request_id}")
        self.assertEqual(item["status"], "Готова")
        self.assertEqual([e["status"] for e in item["events"]], ["Принята", "Готова"])
        self.assertEqual(item["events"][-1]["comment"], "Кабинет 101")
        self.assertEqual(staff.call(f"/api/staff/requests/{request_id}", {"status": "Взломана"})[0], 400)

    def test_announcement_reaches_only_target_group(self):
        staff = self.client("dekanat")
        status, _ = staff.call("/api/staff/announcements", {
            "tag": "Мероприятие", "title": "Встреча группы ПИ-241", "body": "В пятницу в 15:00", "audience": "ПИ-241"})
        self.assertEqual(status, 201)
        alina = self.client("alina")
        alina_notices = alina.call("/api/dashboard")[1]["notices"]
        mark_notices = self.client("mark").call("/api/dashboard")[1]["notices"]
        self.assertIn("Встреча группы ПИ-241", [n["title"] for n in alina_notices])
        self.assertNotIn("Встреча группы ПИ-241", [n["title"] for n in mark_notices])
        notice_id = next(n["id"] for n in alina_notices if n["title"] == "Встреча группы ПИ-241")
        self.assertEqual(alina.call("/api/notice", {"id": notice_id})[0], 200)
        self.assertEqual(self.client("mark").call("/api/notice", {"id": notice_id})[0], 400)

    def test_login_is_throttled(self):
        client = Client(self.base)
        for _ in range(server.LOGIN_LIMIT):
            self.assertEqual(client.login("mark", "wrong")[0], 401)
        self.assertEqual(client.login("mark")[0], 429)

    def test_demo_week_has_free_sunday(self):
        week = self.client("alina").call("/api/dashboard")[1]["week"]
        from datetime import date
        for day in week:
            if date.fromisoformat(day["date"]).weekday() == 6:
                self.assertEqual(day["lessons"], [])
        self.assertEqual(sum(1 for d in week for l in d["lessons"] if l["change"]), 1)

    def test_cross_site_post_is_rejected(self):
        alina = self.client("alina")
        status, _ = alina.call("/api/requests", {"kind": "Справка об обучении"},
                               {"Origin": "https://evil.example", "Sec-Fetch-Site": "cross-site"})
        self.assertEqual(status, 403)

    def test_logout_ends_session(self):
        alina = self.client("alina")
        self.assertEqual(alina.call("/api/logout", {})[0], 200)
        self.assertEqual(alina.call("/api/dashboard")[0], 401)

    def test_no_secrets_in_frontend(self):
        root = Path(server.ROOT) / "public"
        for path in root.iterdir():
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("CAMPUS_AI_KEY", text)
            self.assertNotIn("Bearer", text)


if __name__ == "__main__":
    unittest.main()
