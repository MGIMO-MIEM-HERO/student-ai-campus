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
import campus_data  # noqa: E402
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

    def test_session_endpoint_is_quiet_for_anonymous(self):
        status, body = Client(self.base).call("/api/session")
        self.assertEqual((status, body), (200, {"anonymous": True}))
        client = self.client("alina")
        self.assertEqual(client.call("/api/session")[1]["profile"]["login"], "alina")

    def test_students_see_only_their_profile(self):
        _, alina = self.client("alina").call("/api/dashboard")
        _, mark = self.client("mark").call("/api/dashboard")
        self.assertEqual(alina["profile"]["login"], "alina")
        self.assertEqual(mark["profile"]["login"], "mark")
        self.assertNotEqual([d["lessons"] for d in alina["schedule"]], [d["lessons"] for d in mark["schedule"]])
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

    def test_document_verification(self):
        mark = self.client("mark")
        _, created = mark.call("/api/requests", {"kind": "Справка об обучении", "note": ""})
        request_id = created["requests"][0]["id"]
        self.assertIsNone(created["requests"][0]["document"])
        staff = self.client("dekanat")
        self.assertEqual(staff.call(f"/api/staff/requests/{request_id}", {"status": "Готова"})[0], 200)
        code = mark.call(f"/api/requests/{request_id}")[1]["document"]["code"]
        status, found = Client(self.base).call(f"/api/verify/{code}")
        self.assertEqual((status, found["valid"], found["kind"]), (200, True, "Справка об обучении"))
        self.assertEqual(found["holder"], "Марк Л.", "в публичной проверке фамилия скрыта")
        self.assertNotIn("Луговой", json.dumps(found, ensure_ascii=False))
        self.assertEqual(Client(self.base).call("/api/verify/d-wrong-code-123")[1], {"valid": False})
        staff.call(f"/api/staff/requests/{request_id}", {"status": "Отклонена", "comment": "Отозвана"})
        self.assertEqual(Client(self.base).call(f"/api/verify/{code}")[1], {"valid": False}, "отозванный документ не проходит проверку")

    def test_student_card_verification_and_free_rooms(self):
        data = self.client("alina").call("/api/dashboard")[1]
        status, card = Client(self.base).call(f"/api/verify/{data['profile']['card_code']}")
        self.assertEqual((status, card["type"], card["status"]), (200, "card", "Обучается"))
        self.assertNotEqual(data["profile"]["card_code"], self.client("mark").call("/api/dashboard")[1]["profile"]["card_code"])
        for day in data["schedule"]:
            if day["date"] != data["today"]:
                continue
            for lesson in day["lessons"]:
                if lesson["building"] and not lesson["change"]:
                    self.assertIn(f"{lesson['building']}-{lesson['room']}", data["campus"]["busy"][str(lesson["pair"])])

    def test_staff_marks_room_and_students_see_it(self):
        staff = self.client("dekanat")
        free_key = next(r["key"] for r in staff.call("/api/dashboard")[1]["campus"]["rooms"]
                        if r["seats"] and r["key"] not in staff.call("/api/dashboard")[1]["campus"]["busy"]["3"])
        building, room = free_key.split("-")
        status, _ = staff.call("/api/staff/rooms", {"building": building, "room": room, "pair": 3, "state": "busy", "note": "Ремонт"})
        self.assertEqual(status, 200)
        seen = self.client("alina").call("/api/dashboard")[1]["campus"]["busy"]
        self.assertEqual(seen["3"][free_key], {"by": "staff", "note": "Ремонт"})
        self.assertNotEqual(seen["2"].get(free_key, {}).get("by"), "staff")
        staff.call("/api/staff/rooms", {"building": building, "room": room, "pair": 0, "state": "busy", "note": "Конференция"})
        self.assertEqual(self.client("mark").call("/api/dashboard")[1]["campus"]["busy"]["5"][free_key]["note"], "Конференция")
        staff.call("/api/staff/rooms", {"building": building, "room": room, "pair": 0, "state": "auto"})
        self.assertNotEqual(self.client("mark").call("/api/dashboard")[1]["campus"]["busy"]["3"].get(free_key, {}).get("by"), "staff")
        self.assertEqual(self.client("alina").call("/api/staff/rooms", {"building": building, "room": room, "pair": 1, "state": "busy"})[0], 403)
        self.assertEqual(staff.call("/api/staff/rooms", {"building": "Я", "room": "999", "pair": 1, "state": "busy"})[0], 400)

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

    def test_schedule_is_realistic(self):
        from datetime import date
        for login in ("alina", "mark"):
            data = self.client(login).call("/api/dashboard")[1]
            self.assertEqual(len(data["schedule"]), 14)
            self.assertEqual(date.fromisoformat(data["schedule"][0]["date"]).weekday(), 0, "неделя начинается с понедельника")
            for day in data["schedule"]:
                if date.fromisoformat(day["date"]).weekday() == 6:
                    self.assertEqual(day["lessons"], [], "воскресенье свободно")
                pairs = [(l["pair"]) for l in day["lessons"]]
                self.assertEqual(len(pairs), len(set(pairs)), "две пары в один слот у одной группы")
                for lesson in day["lessons"]:
                    self.assertIn(lesson["start"], [b[0] for b in campus_data.BELLS.values()])
                    self.assertTrue(lesson["place"])
            self.assertGreaterEqual(sum(1 for d in data["schedule"] for l in d["lessons"] if l["change"]), 2)
            self.assertLess(min(g["points"] for g in data["grades"]), 101)

    def test_news_feed(self):
        data = self.client("alina").call("/api/dashboard")[1]
        self.assertGreaterEqual(len(data["news"]), 6)
        self.assertEqual({n["cat"] for n in data["news"]}, {"uni", "edu", "abit", "proj"})
        self.assertTrue(all(n["body"] for n in data["news"]))

    def test_homework_and_teachers(self):
        alina, mark = self.client("alina"), self.client("mark")
        data = alina.call("/api/dashboard")[1]
        homework = {h["id"]: h for h in data["homework"]}
        self.assertEqual(homework["hw-alg-4"]["status"], "todo")
        self.assertEqual(homework["hw-mat-k2"]["status"], "graded")
        self.assertTrue(all(h["teacher"]["email"].endswith("@univer.example") for h in data["homework"]))
        self.assertEqual(len(data["teachers"]), 6)
        status, after = alina.call("/api/homework", {"id": "hw-alg-4", "done": True})
        self.assertEqual(status, 200)
        self.assertEqual(next(h for h in after["homework"] if h["id"] == "hw-alg-4")["status"], "done")
        self.assertEqual(alina.call("/api/homework", {"id": "hw-mat-k2", "done": True})[0], 400)
        self.assertEqual(mark.call("/api/homework", {"id": "hw-alg-4", "done": True})[0], 400)
        self.assertEqual(alina.call("/api/homework", {"id": "hw-alg-4", "done": "yes"})[0], 400)
        status, after = alina.call("/api/homework", {"id": "hw-alg-4", "done": False})
        self.assertEqual(next(h for h in after["homework"] if h["id"] == "hw-alg-4")["status"], "todo")
        mark_hw = {h["id"]: h for h in mark.call("/api/dashboard")[1]["homework"]}
        self.assertEqual(mark_hw["hw-phil-e"]["status"], "overdue")

    def test_mark_has_a_risk_course(self):
        grades = self.client("mark").call("/api/dashboard")[1]["grades"]
        self.assertTrue(any(g["result"] == "Нет допуска" for g in grades))

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
        for path in root.rglob("*"):
            if path.suffix in (".js", ".html", ".css", ".svg"):
                text = path.read_text(encoding="utf-8")
                self.assertNotIn("CAMPUS_AI_KEY", text, path)
                self.assertNotIn("Bearer", text, path)

    def test_static_files_are_confined_to_public(self):
        client = Client(self.base)
        for path in ("/../server.py", "/%2e%2e/server.py", "/..%2fserver.py", "/fonts/", "/data/campus.sqlite3"):
            request = urllib.request.Request(self.base + path)
            try:
                response = urllib.request.urlopen(request)
                body = response.read()
                self.assertNotIn(b"import hashlib", body, path)
            except urllib.error.HTTPError as error:
                self.assertIn(error.code, (400, 404), path)

    def test_mark_all_notices_read(self):
        alina = self.client("alina")
        self.assertEqual(alina.call("/api/notice", {"id": "all"})[0], 200)
        notices = alina.call("/api/dashboard")[1]["notices"]
        self.assertTrue(all(n["read"] for n in notices))


if __name__ == "__main__":
    unittest.main()
