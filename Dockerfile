FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8080 \
    CAMPUS_DB=/data/campus.sqlite3

WORKDIR /app
COPY server.py /app/server.py
COPY public/ /app/public/

RUN mkdir -p /data && chown 10001:10001 /data
VOLUME ["/data"]
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/').close()"

CMD ["python", "server.py"]
