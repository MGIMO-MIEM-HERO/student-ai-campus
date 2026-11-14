"""HTTP integration checks with a separate temporary database; no external services."""
import http.cookiejar
from contextlib import closing
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPCookieProcessor, Request

ROOT = Path(__file__).resolve().parents[1]


class JourneyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.db = str(Path(cls.temp.name) / 'test.sqlite3')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            cls.port = sock.getsockname()[1]
        cls.url = f'http://127.0.0.1:{cls.port}'
        cls.env = {**os.environ, 'CAMPUS_DB': cls.db, 'PORT': str(cls.port),
                   'HOST': '127.0.0.1', 'CAMPUS_TODAY': '2026-11-14',
                   'CAMPUS_SECURE_COOKIE': '0', 'CAMPUS_AI_KEY': '', 'CAMPUS_DEMO_PASSWORD': 'Campus-demo-2026'}
        cls.start()

    @classmethod
    def start(cls):
        cls.process = subprocess.Popen([sys.executable, 'server.py'], cwd=ROOT, env=cls.env,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                with build_opener().open(cls.url, timeout=1):
                    return
            except OSError:
                time.sleep(.05)
        raise RuntimeError('Server did not start')

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=5)
        cls.temp.cleanup()

    def client(self, login):
        client = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
        status, body = self.call(client, 'login', {'login': login, 'password': 'Campus-demo-2026'})
        self.assertEqual(status, 200)
        return client, body

    def call(self, client, path, body=None, origin=None):
        headers = {'Content-Type': 'application/json'}
        if origin:
            headers['Origin'] = origin
        request = Request(self.url + '/api/' + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            response = client.open(request, timeout=5)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            return response.status, json.loads(raw) if 'application/json' in response.headers['Content-Type'] else raw.decode()

    def test_request_lifecycle_is_owned_and_persistent(self):
        alina, _ = self.client('alina')
        mark, _ = self.client('mark')
        dean, _ = self.client('dean')
        status, state = self.call(alina, 'requests', {'kind': 'Справка об обучении', 'note': '<script>demo</script>'})
        self.assertEqual(status, 201)
        request_id = state['requests'][0]['id']
        self.assertEqual(self.call(mark, 'requests/' + request_id)[0], 404)
        self.assertEqual(self.call(mark, 'requests/' + request_id + '/document')[0], 404)
        self.assertEqual(self.call(alina, 'requests/update', {'id': request_id, 'status': 'Готова'})[0], 403)
        self.assertEqual(self.call(dean, 'requests/update', {'id': request_id, 'status': 'Готова'})[0], 400)
        self.assertEqual(self.call(dean, 'requests/update', {'id': request_id, 'status': 'В работе'})[0], 200)
        self.assertEqual(self.call(dean, 'requests/update', {'id': request_id, 'status': 'Готова', 'response': 'Можно скачать'})[0], 200)
        code, doc = self.call(alina, 'requests/' + request_id + '/document')
        self.assertEqual(code, 200)
        self.assertIn('НЕ ЯВЛЯЕТСЯ ДОКУМЕНТОМ', doc)
        self.assertNotIn('Марк', doc)
        self.assertEqual(self.call(mark, 'requests/' + request_id + '/document')[0], 404)
        self.assertIn('Готова', self.call(alina, 'assistant', {'question': 'Какой статус моей справки?'})[1]['answer'])
        self.assertEqual(self.call(dean, 'assistant', {'question': 'Оценки'})[0], 403)
        self.process.terminate()
        self.process.wait(timeout=5)
        self.start()
        self.assertEqual(self.call(alina, 'requests/' + request_id)[1]['status'], 'Готова')
        self.assertEqual(self.call(alina, 'logout', {})[0], 200)
        self.assertEqual(self.call(alina, 'dashboard')[0], 401)

    def test_origin_and_fixed_semester(self):
        alina, state = self.client('alina')
        self.assertEqual(state['grades'][0]['date'], '2026-12-01')
        self.assertEqual(state['week'][0]['date'], '2026-11-14')
        self.assertEqual(self.call(alina, 'requests', {'kind': 'Справка об обучении'}, 'https://other.invalid')[0], 403)

    def test_legacy_database_migration(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location('campus_server', ROOT / 'server.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        legacy = Path(self.temp.name) / 'legacy.sqlite3'
        with closing(sqlite3.connect(legacy)) as db, db:
            db.executescript('CREATE TABLE users(login TEXT PRIMARY KEY,name TEXT,faculty TEXT,program TEXT,group_name TEXT,year INTEGER,salt BLOB,password_hash BLOB); CREATE TABLE requests(id TEXT PRIMARY KEY,login TEXT,kind TEXT,note TEXT,status TEXT,created TEXT);')
        module.DB = legacy
        module.initialize()
        module.initialize()
        with closing(sqlite3.connect(legacy)) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM users').fetchone()[0], 3)
            self.assertEqual(db.execute("SELECT role FROM users WHERE login='dean'").fetchone()[0], 'staff')


if __name__ == '__main__':
    unittest.main()
