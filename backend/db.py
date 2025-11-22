from __future__ import annotations
import psycopg
from contextlib import contextmanager
from config import settings

def get_conn() -> psycopg.Connection:
    return psycopg.connect(settings()["DB_URL"])

@contextmanager
def db_cursor():
    with get_conn() as conn, conn.cursor() as cur:
        yield cur
