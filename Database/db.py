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
DATABASE_PATH = DATABASE_DIR / "test_bet.db"
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
    print(f"Database ready: {DATABASE_PATH}")

def insert() -> None:
    id = input("Create an ID: ")
    email = input("Enter your email: ")
    display_name = input("Create a username: ")
    password_hash = input("Create a password: ")
    query = "INSERT INTO users (id, email, display_name, password_hash) VALUES(?, ?, ?, ?)"
    with connect() as connection:
        cursor = connection.cursor()
        cursor.execute(query, (id, email, display_name, password_hash))

def seed() -> None:
    initialize()
    with connect() as connection:
        connection.executescript(SEED_PATH.read_text(encoding="utf-8"))
    print(f"Database ready: {DATABASE_PATH}")

def reset() -> None:
    if DATABASE_PATH.exists():
        DATABASE_PATH.unlink()
    seed()

def search_by_email() -> None:
    email = input("Type email to search for: ")
    query = "SELECT * FROM users WHERE email = ?"
    with connect() as connection:
        cursor = connection.cursor()
        cursor.execute(query, (email,))
        rows = cursor.fetchall()
    print(rows)

def search_by_id() -> None:
    id = input("Type id to search for: ")
    query = "SELECT * FROM users WHERE id = ?"
    with connect() as connection:
        cursor = connection.cursor()
        cursor.execute(query, (id,))
        rows = cursor.fetchall()
    print(rows)

def main() -> None:
    parser = argparse.ArgumentParser(description="Manage the local Bet SQLite database.")
    parser.add_argument("command", choices=("init", "seed", "reset", "search_email", "search_id", "insert"))
    args = parser.parse_args()

    {"init": initialize, "seed": seed, "reset": reset, "search_email": search_by_email, "search_id": search_by_id, "insert": insert}[args.command]()

if __name__ == "__main__":
    main()