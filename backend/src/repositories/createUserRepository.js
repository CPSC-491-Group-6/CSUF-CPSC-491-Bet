// backend/src/repositories/createUserRepository.js

/**
 * Create a user repository using the provided SQLite database connection.
 *
 * Passing the database as a dependency allows production code to use the
 * application's shared connection while tests can use an isolated in-memory
 * database.
 */

export function createUserRepository(database) {
  const createUserStatement = database.prepare(`
    INSERT INTO users (
      username,
      email,
      passwordHash,
      verificationStatus
    )
    VALUES (
      @username,
      @email,
      @passwordHash,
      @verificationStatus
    )
  `);

  const findByIdStatement = database.prepare(`
    SELECT
      userID,
      username,
      email,
      passwordHash,
      verificationStatus,
      timeStamp
    FROM users
    WHERE userID = ?
  `);

  // Email identity is case-insensitive. Using COLLATE NOCASE here keeps
  // repository lookups consistent with the unique database index.
  const findByEmailStatement = database.prepare(`
    SELECT
      userID,
      username,
      email,
      passwordHash,
      verificationStatus,
      timeStamp
    FROM users
    WHERE email = ? COLLATE NOCASE
  `);

  // Usernames are displayed using the capitalization chosen at registration,
  // but account identity itself is case-insensitive.
  const findByUsernameStatement = database.prepare(`
    SELECT
      userID,
      username,
      email,
      passwordHash,
      verificationStatus,
      timeStamp
    FROM users
    WHERE username = ? COLLATE NOCASE
  `);

  function findById(userID) {
    return findByIdStatement.get(userID);
  }

  function createUser({
    username,
    email,
    passwordHash,
    verificationStatus = 0,
  }) {
    const result = createUserStatement.run({
      username,
      email,
      passwordHash,
      verificationStatus,
    });

    return findById(result.lastInsertRowid);
  }

  function findByEmail(email) {
    return findByEmailStatement.get(email);
  }

  function findByUsername(username) {
    return findByUsernameStatement.get(username);
  }

  return {
    createUser,
    findById,
    findByEmail,
    findByUsername,
  };
}
