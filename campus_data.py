"""Вымышленные учебные данные: расписание, аудитории, преподаватели, сессия.

Все имена, адреса и номера условные. Расписание строится по правилам настоящего
вузовского графика: номера пар и звонки, чётные и нечётные недели, подгруппы,
онлайн-занятия, корпуса и этажи, а также оперативные изменения.
"""
from datetime import date, timedelta

SEMESTER_START = date(2026, 8, 31)  # понедельник первой учебной недели
TEACHING_WEEKS = 16
TERM = "Осенний семестр 2026/27"
SESSION_STARTS = date(2026, 12, 21)

BELLS = {1: ("09:00", "10:30"), 2: ("10:40", "12:10"), 3: ("12:40", "14:10"),
         4: ("14:20", "15:50"), 5: ("16:00", "17:30"), 6: ("17:40", "19:10")}
WEEKDAYS = ("понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье")

BUILDINGS = {
    "А": {"name": "Учебный корпус А", "floors": 6, "hours": "07:30–21:00",
          "hint": "Главный вход со стороны площади. Гардероб на 1 этаже. Лифты в левом крыле, лестница в центре холла."},
    "Б": {"name": "Учебный корпус Б", "floors": 5, "hours": "08:00–21:00",
          "hint": "Вход с улицы или через переход из корпуса А на 2 этаже. Компьютерные классы на 4 и 5 этажах."},
    "С": {"name": "Спортивный комплекс", "floors": 2, "hours": "08:00–20:00",
          "hint": "Отдельное здание за корпусом Б, 5 минут пешком. Сменная обувь обязательна."},
}
CAMPUS_NOTE = "Кампус условный. Адреса и схемы корпусов вымышлены для конкурсного прототипа."

ROOMS = {
    ("А", "101"): ("Поточная аудитория", 160, "1 этаж, налево от главного холла"),
    ("А", "112"): ("Деканат", 0, "1 этаж, справа от гардероба. Приём пн–пт 10:00–17:00, перерыв 13:00–14:00"),
    ("А", "105"): ("Лингафонный кабинет", 16, "1 этаж, в конце правого коридора"),
    ("А", "206"): ("Семинарская аудитория", 40, "2 этаж, от лифта направо"),
    ("А", "208"): ("Кабинет иностранных языков", 18, "2 этаж, рядом с переходом в корпус Б"),
    ("А", "214"): ("Семинарская аудитория", 30, "2 этаж, левое крыло"),
    ("А", "304"): ("Лекционная аудитория", 90, "3 этаж, от лифта налево"),
    ("А", "305"): ("Лекционная аудитория", 60, "3 этаж, напротив лестницы"),
    ("А", "306"): ("Аудитория для практик", 30, "3 этаж, рядом с аудиторией 305"),
    ("А", "318"): ("Семинарская аудитория", 36, "3 этаж, правое крыло"),
    ("А", "402"): ("Лекционная аудитория", 70, "4 этаж, от лифта направо"),
    ("Б", "410"): ("Аудитория для практик", 28, "4 этаж, левое крыло"),
    ("Б", "414"): ("Компьютерный класс", 24, "4 этаж, в конце коридора"),
    ("Б", "512"): ("Компьютерный класс", 24, "5 этаж, от лифта направо"),
    ("С", "101"): ("Спортивный зал", 60, "1 этаж, вход со стороны стадиона"),
}

TEACHERS = {
    "vetrova": ("Ветрова Ирина Сергеевна", "доцент, канд. физ.-мат. наук", "Кафедра высшей математики", "вт 15:30–17:00, каф. 318А"),
    "granov": ("Гранов Михаил Андреевич", "старший преподаватель", "Кафедра информационных систем", "чт 16:00–17:30, ауд. Б-410"),
    "leskova": ("Лескова Наталья Викторовна", "старший преподаватель", "Кафедра иностранных языков", "пн 15:00–16:00, ауд. А-208"),
    "belova": ("Белова Дарья Алексеевна", "доцент, канд. техн. наук", "Кафедра информационных систем", "ср 14:30–16:00, ауд. Б-414"),
    "gromov": ("Громов Павел Николаевич", "профессор, д-р техн. наук", "Кафедра информационных систем", "пт 15:00–16:30, каф. 410Б"),
    "sedov": ("Седов Артём Игоревич", "старший преподаватель", "Кафедра физической культуры", "по записи в спорткомплексе"),
    "volnaya": ("Вольная Екатерина Павловна", "профессор, д-р ист. наук", "Кафедра истории международных отношений", "ср 15:00–16:30, каф. 211А"),
    "rechin": ("Речин Пётр Андреевич", "доцент, канд. экон. наук", "Кафедра мировой экономики", "вт 14:00–15:30, каф. 315А"),
    "zareva": ("Зарева Анна Сергеевна", "старший преподаватель", "Кафедра романских языков", "чт 15:00–16:00, ауд. А-105"),
    "morskaya": ("Морская Ольга Николаевна", "доцент, канд. геогр. наук", "Кафедра политической географии", "пн 14:30–16:00, каф. 405А"),
    "sokolova": ("Соколова Алла Викторовна", "доцент, канд. полит. наук", "Кафедра политической географии", "пн 14:30–16:00, каф. 405А"),
    "lunin": ("Лунин Тимофей Романович", "доцент, канд. филос. наук", "Кафедра философии", "пт 13:00–14:30, каф. 220А"),
    "krylova": ("Крылова Елена Михайловна", "профессор, д-р полит. наук", "Кафедра теории международных отношений", "вт 16:00–17:30, каф. 312А"),
}

# ключ: (название, преподаватель, вид контроля, баллы, дата контроля, пара, корпус, аудитория)
COURSES = {
    "alina": {
        "mat": ("Математический анализ", "vetrova", "Экзамен", 92, date(2027, 1, 15), 2, "А", "304"),
        "db": ("Базы данных", "granov", "Зачёт с оценкой", 84, date(2026, 12, 23), 2, "Б", "512"),
        "eng": ("Английский язык", "leskova", "Зачёт", 100, date(2026, 12, 18), 1, "А", "208"),
        "ux": ("Проектирование интерфейсов", "belova", "Зачёт", 76, date(2026, 12, 22), 3, "Б", "414"),
        "alg": ("Алгоритмы и структуры данных", "gromov", "Экзамен", 81, date(2027, 1, 12), 2, "А", "304"),
        "pe": ("Физическая культура", "sedov", "Зачёт", 95, date(2026, 12, 17), 2, "С", "101"),
    },
    "mark": {
        "hist": ("История дипломатии", "volnaya", "Экзамен", 86, date(2027, 1, 13), 2, "А", "206"),
        "econ": ("Мировая экономика", "rechin", "Экзамен", 79, date(2027, 1, 16), 1, "А", "318"),
        "spa": ("Испанский язык", "zareva", "Зачёт с оценкой", 93, date(2026, 12, 19), 2, "А", "105"),
        "geo": ("Политическая география", "morskaya", "Зачёт", 81, date(2026, 12, 21), 3, "А", "402"),
        "phil": ("Философия", "lunin", "Зачёт", 58, date(2026, 12, 24), 1, "А", "206"),
        "intro": ("Введение в международные отношения", "krylova", "Экзамен", 88, date(2027, 1, 20), 2, "А", "206"),
    },
}

# день недели (0 = пн), пара, дисциплина, вид, корпус, аудитория, неделя (odd/even/None), подгруппа, формат
SLOTS = {
    "alina": [
        (0, 1, "mat", "Лекция", "А", "304", None, None, "Очно"),
        (0, 2, "alg", "Лекция", "А", "304", None, None, "Очно"),
        (0, 3, "eng", "Семинар", "А", "208", None, "Подгруппа 2", "Очно"),
        (1, 2, "db", "Практика", "А", "305", None, None, "Очно"),
        (1, 3, "ux", "Практика", "Б", "414", "odd", None, "Очно"),
        (1, 3, "alg", "Практика", "Б", "410", "even", None, "Очно"),
        (2, 1, "mat", "Семинар", "А", "306", None, None, "Очно"),
        (2, 3, "db", "Лекция", "А", "101", None, None, "Очно"),
        (3, 2, "ux", "Лекция", None, None, "odd", None, "Онлайн"),
        (3, 4, "eng", "Семинар", "А", "208", None, "Подгруппа 2", "Очно"),
        (4, 2, "db", "Лабораторная работа", "Б", "512", "even", None, "Очно"),
        (4, 3, "mat", "Практика", "А", "306", None, None, "Очно"),
        (5, 2, "pe", "Практика", "С", "101", None, None, "Очно"),
    ],
    "mark": [
        (0, 1, "hist", "Лекция", "А", "206", None, None, "Очно"),
        (0, 2, "econ", "Семинар", "А", "214", None, None, "Очно"),
        (0, 3, "spa", "Практика", "А", "105", None, "Подгруппа 1", "Очно"),
        (1, 2, "intro", "Лекция", "А", "206", None, None, "Очно"),
        (1, 3, "geo", "Лекция", "А", "402", None, None, "Очно"),
        (1, 4, "phil", "Семинар", "А", "206", "odd", None, "Очно"),
        (2, 1, "econ", "Лекция", "А", "318", None, None, "Очно"),
        (2, 2, "hist", "Семинар", "А", "206", "even", None, "Очно"),
        (2, 3, "spa", "Практика", "А", "105", None, "Подгруппа 1", "Очно"),
        (3, 2, "phil", "Лекция", "А", "206", None, None, "Очно"),
        (3, 3, "geo", "Семинар", "А", "402", "even", None, "Очно"),
        (3, 4, "intro", "Семинар", "А", "206", "odd", None, "Очно"),
        (4, 1, "spa", "Практика", "А", "105", None, "Подгруппа 1", "Очно"),
        (4, 2, "econ", "Семинар", "А", "318", "odd", None, "Очно"),
    ],
}

# оперативные изменения: применяются к ближайшему занятию дисциплины, начиная с сегодняшнего дня
CHANGES = {
    "alina": [
        ("db", {"kind": "room", "building": "Б", "room": "512", "reason": "Ремонт аудитории А-305"}),
        ("alg", {"kind": "time", "pair": 4, "reason": "Перенос по просьбе преподавателя"}),
        ("eng", {"kind": "cancel", "reason": "Болезнь преподавателя. Занятие будет заменено на следующей неделе"}),
    ],
    "mark": [
        ("econ", {"kind": "room", "building": "А", "room": "318", "reason": "Аудитория А-214 занята под конференцию"}),
        ("geo", {"kind": "teacher", "teacher": "sokolova", "reason": "Командировка преподавателя"}),
    ],
}

PROFILE_EXTRA = {
    "alina": {"level": "Бакалавриат", "form": "Очная, бюджетная основа", "record_book": "ПИ-241/07",
              "subgroup": "Подгруппа 2 (английский язык)", "curator": "Белова Д. А., кафедра информационных систем"},
    "mark": {"level": "Бакалавриат", "form": "Очная, бюджетная основа", "record_book": "МО-251/15",
             "subgroup": "Подгруппа 1 (испанский язык)", "curator": "Вольная Е. П., кафедра истории международных отношений"},
}


def teacher(key):
    name, title, dept, hours = TEACHERS[key]
    parts = name.split()
    short = f"{parts[0]} {parts[1][0]}. {parts[2][0]}."
    return {"name": name, "short": short, "title": title, "dept": dept, "hours": hours}


def week_info(day):
    """Номер учебной недели (циклически 1–16, чтобы демо работало в любой день) и её чётность."""
    raw = (day - SEMESTER_START).days // 7 + 1
    number = (raw - 1) % TEACHING_WEEKS + 1
    return number, "odd" if number % 2 else "even"


def floor_of(room):
    return int(room[0]) if room and room[0].isdigit() else None


def place(building, room):
    if not building:
        return "Онлайн"
    return f"Корпус {building}, ауд. {room}"


def _lesson(login, day, slot):
    weekday, pair, course, kind, building, room, parity, subgroup, fmt = slot
    title, teacher_key = COURSES[login][course][:2]
    start, end = BELLS[pair]
    return {
        "id": f"{day.isoformat()}-{pair}-{course}", "course": course, "title": title, "type": kind, "pair": pair,
        "start": start, "end": end, "building": building, "room": room, "floor": floor_of(room),
        "place": place(building, room), "format": fmt, "subgroup": subgroup, "parity": parity,
        "teacher": teacher(teacher_key), "change": None, "cancelled": False,
    }


def _apply_change(lesson, spec, login, today):
    published = (today - timedelta(days=1)).isoformat() + "T18:20"
    change = {"kind": spec["kind"], "reason": spec["reason"], "at": published}
    if spec["kind"] == "room":
        change.update(label="Новая аудитория", was=lesson["place"], now=place(spec["building"], spec["room"]))
        lesson.update(building=spec["building"], room=spec["room"], floor=floor_of(spec["room"]),
                      place=change["now"])
    elif spec["kind"] == "time":
        start, end = BELLS[spec["pair"]]
        change.update(label="Перенос времени", was=f"{lesson['pair']} пара, {lesson['start']}–{lesson['end']}",
                      now=f"{spec['pair']} пара, {start}–{end}")
        lesson.update(pair=spec["pair"], start=start, end=end)
    elif spec["kind"] == "cancel":
        change.update(label="Занятие отменено", was=f"{lesson['pair']} пара, {lesson['start']}–{lesson['end']}", now="Отменено")
        lesson["cancelled"] = True
    elif spec["kind"] == "teacher":
        replacement = teacher(spec["teacher"])
        change.update(label="Замена преподавателя", was=lesson["teacher"]["short"], now=replacement["short"])
        lesson["teacher"] = replacement
    lesson["change"] = change


def build_schedule(login, today):
    """Две недели с понедельника текущей недели: текущая и следующая."""
    monday = today - timedelta(days=today.weekday())
    days = []
    for offset in range(14):
        day = monday + timedelta(days=offset)
        number, parity = week_info(day)
        lessons = sorted(
            (_lesson(login, day, slot) for slot in SLOTS[login]
             if slot[0] == day.weekday() and slot[6] in (None, parity)),
            key=lambda lesson: (lesson["pair"], lesson["course"]))
        days.append({"date": day.isoformat(), "weekday": WEEKDAYS[day.weekday()], "week": number,
                     "parity": parity, "lessons": lessons})
    for course, spec in CHANGES[login]:
        for day in days:
            if day["date"] < today.isoformat():
                continue
            target = next((l for l in day["lessons"] if l["course"] == course and not l["change"]), None)
            if target:
                _apply_change(target, spec, login, today)
                day["lessons"].sort(key=lambda lesson: (lesson["pair"], lesson["course"]))
                break
    return days


def semester(today):
    number, parity = week_info(today)
    return {"term": TERM, "week": number, "weeks": TEACHING_WEEKS, "parity": parity,
            "parity_label": "нечётная" if parity == "odd" else "чётная",
            "session_starts": SESSION_STARTS.isoformat()}


def result_label(assessment, points):
    if points < 60:
        return "Нет допуска"
    if assessment == "Зачёт" and points >= 85:
        return "Зачёт автоматом"
    return "Допуск получен"


def build_session(login):
    items = []
    for key, (title, teacher_key, assessment, points, control, pair, building, room) in COURSES[login].items():
        examiner = teacher(teacher_key)
        item = {"course": key, "title": title, "assessment": assessment, "points": points,
                "result": result_label(assessment, points), "date": control.isoformat(),
                "start": BELLS[pair][0], "place": place(building, room), "examiner": examiner["short"],
                "teacher": examiner}
        if assessment == "Экзамен":
            item["consultation"] = {"date": (control - timedelta(days=1)).isoformat(), "start": "12:00",
                                    "place": place(building, room)}
        items.append(item)
    items.sort(key=lambda item: item["date"])
    return items


def directory():
    return {
        "note": CAMPUS_NOTE,
        "bells": [{"pair": pair, "start": start, "end": end} for pair, (start, end) in BELLS.items()],
        "buildings": [{"id": key, **value} for key, value in BUILDINGS.items()],
        "rooms": [{"building": b, "room": r, "kind": kind, "seats": seats, "hint": hint, "floor": floor_of(r),
                   "place": place(b, r)} for (b, r), (kind, seats, hint) in ROOMS.items()],
    }
