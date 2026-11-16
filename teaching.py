"""Преподавательская часть: журнал посещаемости, задания, сдача и оценки.

Демо-история (прошлые отметки, сдачи одногруппников, старые оценки) строится детерминированно
из хеша, поэтому кабинет выглядит живым в любой день. Всё, что меняют преподаватель и студент,
хранится в SQLite и перекрывает демо-историю.
"""
import hashlib
import re
import secrets
from datetime import date, timedelta

import campus_data as cd

MARKS = ("p", "l", "a", "e")  # был, опоздал, не был, уважительная причина
KINDS = ("К занятию", "Загрузка в LMS", "Тест онлайн", "Контрольная")
JOURNAL_WEEKS = 6


def _h(*parts):
    return int(hashlib.md5("|".join(map(str, parts)).encode()).hexdigest(), 16)


def lessons_between(group, course, start, end):
    """Занятия группы по дисциплине в интервале дат по сетке расписания."""
    out, day = [], start
    while day <= end:
        if day.weekday() != 6:
            _, parity = cd.week_info(day)
            for weekday, pair, c, kind, building, room, slot_parity, _sub, fmt in cd.group_slots(group):
                if c == course and weekday == day.weekday() and slot_parity in (None, parity):
                    start_t, end_t = cd.BELLS[pair]
                    out.append({"id": f"{day.isoformat()}-{pair}-{course}", "date": day.isoformat(), "pair": pair,
                                "start": start_t, "end": end_t, "type": kind, "building": building, "room": room,
                                "floor": cd.floor_of(room), "place": cd.place(building, room), "format": fmt})
        day += timedelta(days=1)
    return out


def lesson_overrides(db, group):
    """Изменения занятий группы, внесённые преподавателем: {id занятия: изменение}."""
    result = {}
    for r in db.execute("SELECT * FROM lesson_changes WHERE group_name=?", (group,)):
        spec = {"kind": r["kind"], "reason": r["reason"], "at": r["at"]}
        if r["kind"] == "room":
            spec.update(building=r["building"], room=r["room"])
        elif r["kind"] == "time":
            spec["pair"] = r["pair"]
        result[r["lesson_id"]] = spec
    return result


def upcoming_lessons(group, course, today, schedule=None, db=None):
    """Будущие занятия (после сегодняшнего дня) с учётом отмен и переносов, если они известны."""
    login = cd.GROUP_LOGIN.get(group)
    if login:
        schedule = schedule or cd.build_schedule(login, today, lesson_overrides(db, group) if db else None)
        return [dict(l, date=d["date"]) for d in schedule if d["date"] > today.isoformat()
                for l in d["lessons"] if l["course"] == course and not l["cancelled"]]
    return lessons_between(group, course, today + timedelta(days=1), today + timedelta(days=21))


def window_start(today):
    monday = today - timedelta(days=today.weekday())
    return max(cd.SEMESTER_START, monday - timedelta(weeks=JOURNAL_WEEKS - 1))


# ---------- посещаемость ----------
def seeded_mark(lesson_id, lesson_date, person, today_iso):
    if lesson_date >= today_iso:
        return "-"
    v = _h("att", lesson_id, person["id"]) % 100
    if person["login"]:
        return "p" if v < 90 else "l" if v < 95 else "a" if v < 97 else "e"
    return "p" if v < 80 else "l" if v < 87 else "a" if v < 95 else "e"


def attendance_overrides(db, lesson_ids):
    if not lesson_ids:
        return {}
    marks = "?," * len(lesson_ids)
    rows = db.execute(f"SELECT lesson_id, student_id, mark FROM attendance WHERE lesson_id IN ({marks[:-1]})", lesson_ids)
    return {(r["lesson_id"], r["student_id"]): r["mark"] for r in rows}


def summarize(marks):
    counts = {m: marks.count(m) for m in MARKS}
    base = counts["p"] + counts["l"] + counts["a"]
    return {"att": round((counts["p"] + counts["l"]) / base * 100) if base else None,
            "absent": counts["a"], "late": counts["l"], "excused": counts["e"], "marked": base + counts["e"]}


def base_points(group, course, person):
    if person["login"]:
        return cd.COURSES[person["login"]][course][3]
    return 46 + _h("pts", course, person["id"]) % 54


def journal(db, group, course, today):
    lessons = lessons_between(group, course, window_start(today), today)
    people = cd.roster(group)
    overrides = attendance_overrides(db, [l["id"] for l in lessons])
    today_iso = today.isoformat()
    students = []
    for person in people:
        marks = "".join(overrides.get((l["id"], person["id"]), seeded_mark(l["id"], l["date"], person, today_iso))
                        for l in lessons)
        students.append({**person, "marks": marks, "points": base_points(group, course, person), **summarize(marks)})
    return {"id": f"{course}:{group}", "group": group, "course": course, "title": cd.group_courses(group)[course][0],
            "lessons": [{k: l[k] for k in ("id", "date", "pair", "start", "type", "place")} for l in lessons],
            "students": students}


def student_attendance(db, login, today):
    group, sid = cd.student_id(login)
    if not group:
        return {}
    result = {}
    person = next(p for p in cd.roster(group) if p["id"] == sid)
    for course in cd.group_courses(group):
        lessons = lessons_between(group, course, window_start(today), today)
        overrides = attendance_overrides(db, [l["id"] for l in lessons])
        marks = "".join(overrides.get((l["id"], sid), seeded_mark(l["id"], l["date"], person, today.isoformat()))
                        for l in lessons)
        result[course] = summarize(marks)
    return result


def set_attendance(db, author, group, course, lesson_id, student_ids, mark, today, at):
    lesson = next((l for l in lessons_between(group, course, window_start(today), today) if l["id"] == lesson_id), None)
    known = {p["id"] for p in cd.roster(group)}
    if not lesson or mark not in (*MARKS, "-") or not student_ids or not set(student_ids) <= known:
        raise ValueError()
    for sid in student_ids:
        db.execute("INSERT OR REPLACE INTO attendance VALUES (?,?,?,?,?)", (lesson_id, sid, mark, author, at))


# ---------- задания ----------
def _seeded_tasks(group):
    login = cd.GROUP_LOGIN.get(group)
    if login:
        return [(task_id, *rest) for task_id, *rest in cd.HOMEWORK.get(login, [])]
    # параллельная группа получает задания по тем же дисциплинам с теми же формулировками
    courses = cd.group_courses(group)
    source = [t for t in cd.HOMEWORK["alina"] if t[1] in courses]
    return [(f"{t[0]}-{cd.GROUP_CODE[group][-3:]}", *t[1:]) for t in source]


def group_tasks(db, group, today, schedule=None):
    """Все задания группы: демо-задания и созданные преподавателями, со сроком и занятием."""
    courses = cd.group_courses(group)
    tasks = []
    for task_id, course, title, text, due, kind, points_max, graded in _seeded_tasks(group):
        lesson_id, due_time = None, "23:59"
        if due[0] == "lesson":
            found = upcoming_lessons(group, course, today, schedule, db)
            if len(found) >= due[1]:
                lesson = found[due[1] - 1]
                due_date, due_time, lesson_id = lesson["date"], lesson["start"], lesson["id"]
            else:
                due_date = (today + timedelta(days=7)).isoformat()
        else:
            due_date = (today + timedelta(days=due[1])).isoformat()
        tasks.append({"id": task_id, "group": group, "course": course, "course_title": courses[course][0],
                      "teacher": cd.teacher(courses[course][1]), "title": title, "text": text, "kind": kind,
                      "due_date": due_date, "due_time": due_time, "lesson_id": lesson_id, "points_max": points_max,
                      "source": "seed", "seed_graded": graded, "created": (today - timedelta(days=7)).isoformat()})
    for row in db.execute("SELECT * FROM tasks WHERE group_name=? ORDER BY created", (group,)):
        if row["course"] not in courses:
            continue
        tasks.append({"id": row["id"], "group": group, "course": row["course"], "course_title": courses[row["course"]][0],
                      "teacher": cd.teacher(courses[row["course"]][1]), "title": row["title"], "text": row["text"],
                      "kind": row["kind"], "due_date": row["due_date"], "due_time": row["due_time"],
                      "lesson_id": row["lesson_id"], "points_max": row["points_max"], "source": "teacher",
                      "seed_graded": None, "created": row["created"]})
    return tasks


def _past(task, today_iso, now_minutes):
    h, m = map(int, task["due_time"].split(":"))
    return task["due_date"] < today_iso or (task["due_date"] == today_iso and h * 60 + m <= now_minutes)


def submissions(db, task, today, now_minutes):
    """Сдача и оценка по каждому студенту группы."""
    grades = {r["student_id"]: r for r in db.execute("SELECT * FROM grades WHERE task_id=?", (task["id"],))}
    logins = [p["login"] for p in cd.roster(task["group"]) if p["login"]]
    done = {}
    if logins:
        marks = "?," * len(logins)
        done = {r["login"]: (r["at"], r["note"]) for r in db.execute(
            f"SELECT login, at, note FROM homework_done WHERE task_id=? AND login IN ({marks[:-1]})", (task["id"], *logins))}
    past = _past(task, today.isoformat(), now_minutes)
    days_left = (date.fromisoformat(task["due_date"]) - today).days
    out = []
    for person in cd.roster(task["group"]):
        v = _h("sub", task["id"], person["id"]) % 100
        seeded_points, note = None, ""
        if person["login"]:
            submitted = person["login"] in done
            at, note = done.get(person["login"], (None, ""))
            seeded_points = task["seed_graded"]
            submitted = submitted or seeded_points is not None
        elif task["source"] == "seed":
            if task["seed_graded"] is not None:
                submitted = v < 94
                seeded_points = task["points_max"] - _h("pts", task["id"], person["id"]) % (task["points_max"] // 3 + 1) if submitted else None
            elif task["kind"] == "К занятию" and not past:
                submitted = False  # такие работы сдают на самом занятии
            else:
                submitted = v < (85 if past else 62 if days_left <= 2 else 34)
            at = (date.fromisoformat(task["due_date"]) - timedelta(days=1 + v % 3)).isoformat() + "T21:40" if submitted else None
        else:
            submitted, at = False, None
        grade = grades.get(person["id"])
        points = grade["points"] if grade and grade["points"] is not None else seeded_points
        out.append({"id": person["id"], "submitted": submitted, "at": at, "points": points, "note": note,
                    "comment": grade["comment"] if grade else ""})
    return out


def student_homework(db, login, today, schedule, now_minutes):
    group, sid = cd.student_id(login)
    if not group:
        return []
    done = {r["task_id"]: (r["at"], r["note"]) for r in db.execute("SELECT task_id, at, note FROM homework_done WHERE login=?", (login,))}
    grades = {r["task_id"]: r for r in db.execute("SELECT * FROM grades WHERE student_id=?", (sid,))}
    items = []
    for task in group_tasks(db, group, today, schedule):
        grade = grades.get(task["id"])
        points = grade["points"] if grade and grade["points"] is not None else task["seed_graded"]
        if points is not None:
            status = "graded"
        elif task["id"] in done:
            status = "done"
        elif _past(task, today.isoformat(), now_minutes):
            status = "overdue"
        else:
            status = "todo"
        items.append({k: task[k] for k in ("id", "course", "course_title", "teacher", "title", "text", "kind", "due_date",
                                            "due_time", "lesson_id", "points_max", "source", "created")}
                     | {"points": points, "status": status, "done_at": done.get(task["id"], (None, ""))[0],
                        "note": done.get(task["id"], (None, ""))[1],
                        "comment": grade["comment"] if grade else "", "graded_at": grade["at"] if grade else None})
    order = {"overdue": 0, "todo": 1, "done": 2}
    active = sorted((x for x in items if x["status"] != "graded"), key=lambda x: (order[x["status"]], x["due_date"], x["due_time"]))
    graded = sorted((x for x in items if x["status"] == "graded"), key=lambda x: x["graded_at"] or x["due_date"], reverse=True)
    return active + graded


def create_task(db, teacher_key, body, today, at):
    """Новое задание одной или нескольким группам потока. Возвращает id созданных заданий."""
    offerings = {(o["course"], o["group"]) for o in cd.teacher_offerings(teacher_key)}
    course, groups = body.get("course"), body.get("groups")
    title, text, kind = body.get("title"), body.get("text", ""), body.get("kind")
    points_max, due_mode = body.get("points_max"), body.get("due_mode")
    if (not isinstance(groups, list) or not groups or len(groups) > 6 or not all((course, g) in offerings for g in groups)
            or not isinstance(title, str) or not 3 <= len(title.strip()) <= 140
            or not isinstance(text, str) or len(text) > 2000 or kind not in KINDS
            or not isinstance(points_max, int) or isinstance(points_max, bool) or not 1 <= points_max <= 100
            or due_mode not in ("lesson", "date")):
        raise ValueError()
    created = []
    for group in groups:
        lesson_id, due_time = None, "23:59"
        if due_mode == "lesson":
            found = upcoming_lessons(group, course, today, None, db)
            if not found:
                raise ValueError()
            due_date, due_time, lesson_id = found[0]["date"], found[0]["start"], found[0]["id"]
        else:
            due_date, due_time = body.get("due_date"), body.get("due_time", "23:59")
            try:
                parsed = date.fromisoformat(due_date)
                h, m = map(int, due_time.split(":"))
            except (TypeError, ValueError, AttributeError):
                raise ValueError() from None
            if not (today <= parsed <= today + timedelta(days=120)) or not (0 <= h < 24 and 0 <= m < 60):
                raise ValueError()
            due_time = f"{h:02d}:{m:02d}"
        task_id = "t" + secrets.token_hex(5)
        db.execute("INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (
            task_id, group, course, title.strip(), text.strip(), kind, due_date, due_time, lesson_id, points_max,
            teacher_key, at))
        created.append(task_id)
    return created


def teacher_task(db, teacher_key, task_id, today):
    for offering in cd.teacher_offerings(teacher_key):
        for task in group_tasks(db, offering["group"], today):
            if task["id"] == task_id and task["course"] == offering["course"]:
                return task
    return None


def set_grade(db, teacher_key, body, today, at):
    task = teacher_task(db, teacher_key, body.get("task_id"), today)
    sid, points, comment = body.get("student_id"), body.get("points"), body.get("comment", "")
    if (not task or sid not in {p["id"] for p in cd.roster(task["group"])}
            or not (points is None or (isinstance(points, int) and not isinstance(points, bool) and 0 <= points <= task["points_max"]))
            or not isinstance(comment, str) or len(comment) > 600):
        raise ValueError()
    if points is None and not comment.strip():
        db.execute("DELETE FROM grades WHERE task_id=? AND student_id=?", (task["id"], sid))
    else:
        db.execute("INSERT OR REPLACE INTO grades VALUES (?,?,?,?,?,?)", (task["id"], sid, points, comment.strip(), teacher_key, at))


# ---------- кабинет преподавателя ----------
def teacher_schedule(teacher_key, today, db=None):
    """Две недели занятий преподавателя; лекции потока объединены в одну строку с несколькими группами."""
    monday = today - timedelta(days=today.weekday())
    merged = {}
    for offering in cd.teacher_offerings(teacher_key):
        group, course = offering["group"], offering["course"]
        login = cd.GROUP_LOGIN.get(group)
        overrides = lesson_overrides(db, group) if db else {}
        if login:
            days = cd.build_schedule(login, today, overrides)
            lessons = [dict(l, date=d["date"]) for d in days for l in d["lessons"] if l["course"] == course]
        else:
            lessons = [dict(l, course=course, title=offering["title"], cancelled=False, change=None,
                            teacher=cd.teacher(teacher_key))
                       for l in lessons_between(group, course, monday, monday + timedelta(days=13))]
            for l in lessons:
                if l["id"] in overrides:
                    cd._apply_change(l, overrides[l["id"]], None, today)
        for l in lessons:
            key = (l["date"], l["id"], course)
            entry = merged.setdefault(key, {k: l.get(k) for k in ("id", "course", "title", "type", "pair", "start", "end",
                                                                   "building", "room", "floor", "place", "format",
                                                                   "cancelled", "change")} | {"date": l["date"], "groups": []})
            entry["groups"].append(group)
    days = []
    for offset in range(14):
        day = monday + timedelta(days=offset)
        number, parity = cd.week_info(day)
        lessons = sorted((v for k, v in merged.items() if k[0] == day.isoformat()), key=lambda l: l["pair"])
        for l in lessons:
            l["students"] = sum(len(cd.ROSTER[g]) for g in l["groups"])
        days.append({"date": day.isoformat(), "weekday": cd.WEEKDAYS[day.weekday()], "week": number, "parity": parity,
                     "lessons": lessons})
    return days


def teacher_tasks(db, teacher_key, today, now_minutes):
    out = []
    for offering in cd.teacher_offerings(teacher_key):
        for task in group_tasks(db, offering["group"], today):
            if task["course"] != offering["course"]:
                continue
            subs = submissions(db, task, today, now_minutes)
            out.append({k: v for k, v in task.items() if k not in ("teacher", "seed_graded")} | {
                "subs": subs, "total": len(subs), "submitted": sum(s["submitted"] for s in subs),
                "graded": sum(s["points"] is not None for s in subs),
                "past": _past(task, today.isoformat(), now_minutes)})
    out.sort(key=lambda t: (t["past"] and t["graded"] >= t["submitted"], t["due_date"], t["due_time"]))
    return out


def change_lesson(db, teacher_key, body, today, at):
    """Перенос в другую аудиторию, на другую пару, отмена или возврат к расписанию для всех групп занятия."""
    lesson_id, kind, reason = body.get("lesson_id"), body.get("kind"), body.get("reason", "")
    lesson = next((l for d in teacher_schedule(teacher_key, today, db) for l in d["lessons"] if l["id"] == lesson_id), None)
    if not lesson or lesson["date"] < today.isoformat() or kind not in ("room", "time", "cancel", "restore"):
        raise ValueError()
    if kind == "restore":
        for group in lesson["groups"]:
            db.execute("DELETE FROM lesson_changes WHERE lesson_id=? AND group_name=?", (lesson_id, group))
        return
    if not isinstance(reason, str) or not 3 <= len(reason.strip()) <= 200:
        raise ValueError()
    pair, building, room = None, None, None
    if kind == "room":
        building, room = body.get("building"), body.get("room")
        info = cd.ALL_ROOMS.get((building, room))
        if not info or not info[1]:
            raise ValueError()
    elif kind == "time":
        pair = body.get("pair")
        if pair not in cd.BELLS or isinstance(pair, bool):
            raise ValueError()
    for group in lesson["groups"]:
        db.execute("INSERT OR REPLACE INTO lesson_changes VALUES (?,?,?,?,?,?,?,?,?)",
                   (lesson_id, group, kind, pair, building, room, reason.strip(), teacher_key, at))


# ---------- консультации ----------
WEEKDAY_ABBR = {"пн": 0, "вт": 1, "ср": 2, "чт": 3, "пт": 4, "сб": 5}
CONSULT_TOPICS = ("Разбор контрольной", "Вопросы по типовому расчёту", "Пропущенная тема", "Подготовка к экзамену",
                  "Пересдача теста", "Вопрос по оформлению работы")
SLOT = 15


def consult_days(teacher_key, today, now_minutes):
    """Ближайшие два дня консультаций преподавателя со слотами по 15 минут."""
    hours = cd.TEACHERS[teacher_key][3]
    m = re.match(r"(пн|вт|ср|чт|пт|сб) (\d\d):(\d\d)–(\d\d):(\d\d)(?:, (.+))?$", hours)
    if not m:
        return []
    weekday, start = WEEKDAY_ABBR[m.group(1)], int(m.group(2)) * 60 + int(m.group(3))
    end, place = int(m.group(4)) * 60 + int(m.group(5)), m.group(6) or ""
    days, day = [], today
    while len(days) < 2 and (day - today).days <= 14:
        if day.weekday() == weekday and (day > today or now_minutes < end - SLOT):
            slots = [t for t in range(start, end, SLOT) if day > today or t > now_minutes]
            days.append({"date": day.isoformat(), "place": place,
                         "slots": [f"{t // 60:02d}:{t % 60:02d}" for t in slots]})
        day += timedelta(days=1)
    return days


def _seeded_consult(teacher_key, date_iso, time):
    """Часть слотов заранее занята вымышленными студентами — так выглядит живая запись."""
    v = _h("consult", teacher_key, date_iso, time) % 100
    if v >= 34:
        return None
    groups = [o["group"] for o in cd.teacher_offerings(teacher_key)] or ["ПИ-241"]
    group = groups[v % len(groups)]
    people = [p for p in cd.roster(group) if not p["login"]]
    person = people[v % len(people)]
    return {"name": person["name"], "group": group, "topic": CONSULT_TOPICS[v % len(CONSULT_TOPICS)], "login": None}


def consult_bookings(db, teacher_key, today, now_minutes):
    """Все записи на ближайшие консультации: время → запись."""
    out = {}
    db_rows = {(r["date"], r["time"]): r for r in db.execute("SELECT * FROM consults WHERE teacher=?", (teacher_key,))}
    for day in consult_days(teacher_key, today, now_minutes):
        for time in day["slots"]:
            row = db_rows.get((day["date"], time))
            if row:
                group, sid = cd.student_id(row["login"])
                person = next((p for p in cd.roster(group) if p["id"] == sid), None) if group else None
                out[(day["date"], time)] = {"name": person["name"] if person else row["login"], "group": group or "",
                                            "topic": row["topic"], "login": row["login"]}
            else:
                seeded = _seeded_consult(teacher_key, day["date"], time)
                if seeded:
                    out[(day["date"], time)] = seeded
    return out


def student_consults(db, login, today, now_minutes):
    """Для каждого преподавателя студента: дни, слоты (свободен, занят, ваш) и место."""
    result = {}
    for t in cd.teachers_for(login):
        days = consult_days(t["key"], today, now_minutes)
        if not days:
            continue
        booked = consult_bookings(db, t["key"], today, now_minutes)
        result[t["key"]] = [{"date": d["date"], "place": d["place"], "slots": [
            {"time": s, "state": "mine" if (b := booked.get((d["date"], s))) and b["login"] == login
             else "taken" if b else "free", "topic": b["topic"] if b and b["login"] == login else ""}
            for s in d["slots"]]} for d in days]
    return result


def book_consult(db, login, body, today, now_minutes, at):
    teacher_key, day, time = body.get("teacher"), body.get("date"), body.get("time")
    topic, cancel = body.get("topic", ""), body.get("cancel", False)
    if teacher_key not in {t["key"] for t in cd.teachers_for(login)} or not isinstance(topic, str) or len(topic) > 200:
        raise ValueError()
    if cancel is True:
        db.execute("DELETE FROM consults WHERE teacher=? AND date=? AND time=? AND login=?", (teacher_key, day, time, login))
        return
    slots = {(d["date"], s) for d in consult_days(teacher_key, today, now_minutes) for s in d["slots"]}
    booked = consult_bookings(db, teacher_key, today, now_minutes)
    if (day, time) not in slots or (day, time) in booked or not topic.strip():
        raise ValueError()
    db.execute("DELETE FROM consults WHERE teacher=? AND login=? AND date>=?", (teacher_key, login, today.isoformat()))
    db.execute("INSERT INTO consults VALUES (?,?,?,?,?,?)", (teacher_key, day, time, login, topic.strip(), at))


def teacher_consults(db, teacher_key, today, now_minutes):
    booked = consult_bookings(db, teacher_key, today, now_minutes)
    return [{"date": d["date"], "place": d["place"], "slots": [
        {"time": s, **(booked[(d["date"], s)] if (d["date"], s) in booked else {"name": None})} for s in d["slots"]]}
        for d in consult_days(teacher_key, today, now_minutes)]
