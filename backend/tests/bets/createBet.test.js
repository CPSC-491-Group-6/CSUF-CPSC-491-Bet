import assert from "node:assert/strict";
import test from "node:test";

// Sprint 3 - Member B
// Jira Item 1: Automated Create Bet API Tests
//
// These tests are skipped until the Create Bet API
// is implemented and its contract is confirmed.

// const API_URL = "http://localhost:3000/api/bets";

// example valid request data
const validBet = {
  title: "Will it rain tomorrow?",
  description: "Predict whether it will rain.",
  visibility: "public",
  max_participants: 5,
};

// heper function for sending Create Bet requests
async function createBet(betData) {
  return fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(betData),
  });
}

// Positive Testing
test.skip("B-S3-01: Create Bet succeeds with valid data", async () => {
  const bet = { ...validBet };
  const response = await createBet(bet);
  assert.equal(response.status, 201);
  const data = await response.json();

  // TODO: Confirm actual success response structure.
  assert.equal(data.title, bet.title);
});

// Negative Testing
test.skip("B-S3-02: Create Bet rejects missing title", async () => {
  const invalidBet = { ...validBet };
  delete invalidBet.title;

  // verify validation error
  const response = await createBet(invalidBet);

  // assert
  assert.equal(response.status, 400);

  const data = await response.json();
  assert.equal(data.error, "Title is required");
});

test.skip("B-S3-03: Create Bet rejects empty title", async () => {
  const invalidBet = {
    ...validBet,
    title: "",
  };

  const response = await createBet(invalidBet);

  // assert
  assert.equal(response.status, 400);
});

test.skip("B-S3-04: Create Bet rejects missing required description", async () => {
  const invalidBet = { ...validBet };
  delete invalidBet.description;

  const response = await createBet(invalidBet);

  // assert
  assert.equal(response.status, 400);
});

test.skip("B-S3-05: Create Bet rejects invalid participant capacity", async () => {
  const invalidBet = { ...validBet, max_participants: "abc" };

  const response = await createBet(invalidBet);

  // assert
  assert.equal(response.status, 400);
});

// Boundary Value Analysis
test.skip("B-S3-06: Create Bet rejects capacity below minimum", async () => {
  // minimum capacity is 2
  const invalidBet = {
    ...validBet,
    max_participants: 1,
  };
  const response = await createBet(invalidBet);
  assert.equal(response.status, 400);
});

test.skip("B-S3-07: Create Bet accepts minimum valid capacity", async () => {
  // minimum capacity is 2
  const bet = {
    ...validBet,
    max_participants: 2,
  };
  const response = await createBet(bet);
  assert.equal(response.status, 201);
});

// Input Validation
test.skip("B-S3-08: Create Bet rejects invalid visibility", async () => {
  const invalidBet = {
    ...validBet,
    visibility: "unknown",
  };
  const response = await createBet(invalidBet);
  assert.equal(response.status, 400);
});

// Authentication Response
test.skip("B-S3-09: Create Bet rejects unauthenticated request", async () => {
  const response = await createBet(validBet);
  assert.equal(response.status, 401);
});

// API Contract Testing
test.skip("B-S3-10: Create Bet returns correct success response", async () => {
  const response = await createBet(validBet);
  assert.equal(response.status, 201);

  const data = await response.json();
  assert.ok(data);
  assert.equal(typeof data.id, "string");
  assert.equal(data.title, validBet.title);
});
