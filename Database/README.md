# Database skeleton

The database uses SQLite and keeps schema changes in numbered SQL migrations.
The initial migration creates `users`, `bets`, and `bet_participants`, including
foreign keys, status constraints, and lookup indexes.

From the repository root:

```powershell
python database\db.py init
python database\db.py seed
python database\db.py reset
```

`reset` removes the local `database/bet.db`, reapplies every migration, and
loads the deterministic development data from `seed.sql`. The generated database
file is local-only and should not be committed.
