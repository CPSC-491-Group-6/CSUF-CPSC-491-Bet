"""Small SQLite bootstrap utility for local development.

Usage:
    python database/db.py init
    python database/db.py seed
    python database/db.py reset
"""

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


DATABASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = DATABASE_DIR / "bet.db"
MIGRATIONS_DIR = DATABASE_DIR / "migrations"
SEED_PATH = DATABASE_DIR / "seed.sql"


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def apply_migrations(connection: sqlite3.Connection) -> None:
    for migration_path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        connection.executescript(migration_path.read_text(encoding="utf-8"))


def initialize() -> None:
    with connect() as connection:
        apply_migrations(connection)


def seed() -> None:
    initialize()
    with connect() as connection:
        connection.executescript(SEED_PATH.read_text(encoding="utf-8"))


def reset() -> None:
    if DATABASE_PATH.exists():
        DATABASE_PATH.unlink()
    seed()


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage the local Bet SQLite database.")
    parser.add_argument("command", choices=("init", "seed", "reset"))
    args = parser.parse_args()

    {"init": initialize, "seed": seed, "reset": reset}[args.command]()
    print(f"Database ready: {DATABASE_PATH}")


if __name__ == "__main__":
    main()
