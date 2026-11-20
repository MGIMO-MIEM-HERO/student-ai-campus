"""Grounded answers for the demo's document catalogue and short follow-ups."""

DOCUMENTS = (
    {"kind": "Справка об обучении", "sla": "1–2 рабочих дня"},
    {"kind": "Выписка об успеваемости", "sla": "2–3 рабочих дня"},
    {"kind": "Обращение в деканат", "sla": "до 5 рабочих дней"},
)


def normalize(text):
    return text.lower().replace("ё", "е")


def document_topic(text):
    return any(word in normalize(text) for word in
               ("справк", "заявк", "военкомат", "выписк", "обращени", "деканат"))


def document_answer(question, data, history=()):
    q = normalize(question)
    prefixes = ("а сколько", "сколько ждать", "сколько готовится", "а где", "где забрать", "а как", "а для", "а статус")
    previous = ""
    for message in reversed(history):
        candidate = normalize(message)
        if document_topic(candidate):
            previous = candidate
            break
        if not candidate.startswith(prefixes):
            break
    follow_up = (q.startswith(prefixes)
                 and document_topic(previous))
    if not document_topic(q) and not follow_up:
        return None
    context = f"{previous} {q}" if follow_up else q
    kind = "Выписка об успеваемости" if "выписк" in context else "Обращение в деканат" if "обращени" in context else "Справка об обучении"
    doc = next(item for item in DOCUMENTS if item["kind"] == kind)
    if follow_up and any(word in q for word in ("сколько", "ждать", "срок")):
        return f"«{kind}»: срок по каталогу кабинета — {doc['sla']}. Статус и комментарии деканата — в истории заявки."
    if follow_up and any(word in q for word in ("где", "забрать")) and kind != "Обращение в деканат":
        return "Оригинал готового документа можно получить в деканате по студенческому билету. Электронная версия с QR-проверкой — в истории заявки, в разделе «Заявки»."
    if any(word in q for word in ("статус", "готова ли", "готов ли", "где моя", "мои заявк")):
        rows = [r for r in data.get("requests", []) if "мои заявк" in q or r["kind"] == kind]
        if not rows:
            return f"В вашей истории нет заявки «{kind}». Подать её можно в разделе «Заявки»."
        return "Ваши заявки:\n" + "\n".join(
            f"• {r['kind']} № {r['id'][:6].upper()}: {r['status']}."
            + (" Электронный документ доступен в истории заявки." if r.get("document") else "")
            for r in rows)
    if "военкомат" in context:
        return ("В каталоге кабинета для этой цели указана «Справка об обучении». "
                "Откройте «Заявки» → «Справка об обучении» → «Оформить», "
                "в комментарии укажите «Для военкомата» и отправьте заявку. "
                "Срок в прототипе — 1–2 рабочих дня. Электронная версия с QR-проверкой появится "
                "в истории заявки, оригинал можно получить в деканате по студенческому билету. "
                "Если нужен специальный бланк, уточните его через «Обращение в деканат».")
    if any(word in q for word in ("сколько", "срок", "долго", "когда", "ждать")):
        return f"«{kind}»: срок по каталогу кабинета — {doc['sla']}. Текущий статус и комментарии — в разделе «Заявки», в истории заявки."
    if any(word in q for word in ("где забрать", "где получить", "оригинал")) and kind != "Обращение в деканат":
        return "Оригинал готового документа можно получить в деканате по студенческому билету. Электронная версия с QR-проверкой — в истории заявки, в разделе «Заявки»."
    if kind == "Обращение в деканат":
        return "Откройте «Заявки» → «Обращение в деканат» → «Оформить», опишите вопрос и отправьте. Ответ и статус будут в истории заявки. Срок по каталогу — до 5 рабочих дней."
    return (f"Откройте «Заявки» → «{kind}» → «Оформить», при необходимости укажите цель "
            f"в комментарии и отправьте заявку. Срок по каталогу — {doc['sla']}. "
            "Статус, комментарии и готовый электронный документ — в истории заявки.")
