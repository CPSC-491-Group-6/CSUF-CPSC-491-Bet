const insertUserSql = `
  INSERT INTO users (username, email, passwordHash)
  VALUES (?, ?, ?)
`;

function createTestUser(database, role) {
  const nextID = database
    .prepare("SELECT COALESCE(MAX(userID), 0) + 1 AS nextID FROM users")
    .get().nextID;

  const username = `test_${role}_${nextID}`;
  const email = `${username}@example.test`;

  const result = database
    .prepare(insertUserSql)
    .run(username, email, "synthetic-test-hash");

  return {
    userID: Number(result.lastInsertRowid),
    username,
    email,
    role,
  };
}

export function createCreatorUser(database) {
  return createTestUser(database, "creator");
}

export function createParticipantUser(database) {
  return createTestUser(database, "participant");
}

export function createNonParticipantUser(database) {
  return createTestUser(database, "nonparticipant");
}
