// backend/src/db/init.js

import db from "./database.js";

// Initialize the preliminary SQLite schema.
//
// CREATE TABLE IF NOT EXISTS makes this script safe to run more than once.
// Existing tables will not be deleted or recreated.
db.exec(`
  -- Stores user account information.
  CREATE TABLE IF NOT EXISTS users (
    userID INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    verificationStatus INTEGER NOT NULL DEFAULT 0,
    timeStamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Treat usernames as case-insensitive for uniqueness.
  -- This prevents accounts such as "Alice" and "alice" from coexisting.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase
    ON users(username COLLATE NOCASE);

  -- Treat email addresses as case-insensitive for uniqueness.
  -- The application also normalizes emails to lowercase before storage,
  -- but this index provides a final database-level guarantee.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase
    ON users(email COLLATE NOCASE);


  -- Stores the main information for each bet.
  CREATE TABLE IF NOT EXISTS bets (
    betID INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Identifies the user who created the bet.
    creatorID INTEGER NOT NULL,

    minimumWager REAL NOT NULL DEFAULT 0,
    decision TEXT,

    -- Preliminary design keeps this field because it already exists
    -- in the implementation plan. We may later decide to calculate
    -- this value from the participants table instead.
    numberOfParticipants INTEGER NOT NULL DEFAULT 0,

    -- A bet must always be in one of the approved lifecycle states.
    status TEXT NOT NULL DEFAULT 'Draft'
      CHECK (
        status IN (
          'Draft',
          'Active',
          'Locked',
          'Resolved',
          'Archived'
        )
      ),

    timeStamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Each bet must reference an existing creator.
    FOREIGN KEY (creatorID)
      REFERENCES users(userID)
  );


  -- Connects users to the bets they have joined.
  CREATE TABLE IF NOT EXISTS participants (
    betID INTEGER NOT NULL,
    userID INTEGER NOT NULL,
    wager REAL NOT NULL,
    timeStamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- A user may participate in a particular bet only once.
    PRIMARY KEY (betID, userID),

    FOREIGN KEY (betID)
      REFERENCES bets(betID),

    FOREIGN KEY (userID)
      REFERENCES users(userID)
  );
`);

console.log("SQLite database initialized successfully.");
