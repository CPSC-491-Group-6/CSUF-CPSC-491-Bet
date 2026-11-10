const request = require("supertest");
const app = require("../server");

describe("Bet Authentication Tests", function () {
    const testUser = {
    username: "testuser",
    email: "test@example.com",
    password: "Test1234"
    };

    test("AUTH-01: Register a new user", async function () {
    const response = await request(app)
        .post("/api/auth/register")
        .send(testUser);

    expect(response.statusCode).toBe(201);

    expect(response.body.message).toBe(
        "Account created."
    );

    expect(response.body.user.email).toBe(
        "test@example.com"
    );

    expect(response.body.user.verified).toBe(false);
    });


    test("AUTH-02: Login with correct credentials", async function () {
    const response = await request(app)
        .post("/api/auth/login")
        .send({
        email: testUser.email,
        password: testUser.password
        });

    expect(response.statusCode).toBe(200);

    expect(response.body.message).toBe(
        "Login successful."
    );

    expect(response.body.user.email).toBe(
        testUser.email
    );
    });


    test("AUTH-03: Reject incorrect password", async function () {
    const response = await request(app)
        .post("/api/auth/login")
        .send({
        email: testUser.email,
        password: "WrongPassword"
        });

    expect(response.statusCode).toBe(401);

    expect(response.body.message).toBe(
        "Invalid email or password."
    );
    });


    test("AUTH-04: Reject protected request without authentication", async function () {
        const response = await request(app)
            .post("/api/bets")
            .send({
            title: "Test Bet",
            description: "Will this test pass?",
            amount: 10
            });

        expect(response.statusCode).toBe(401);

        expect(response.body.message).toBe(
            "Authentication required."
        );
    });

    test("AUTH-05: Verify a registered account", async function () {
        const response = await request(app)
        .post("/api/auth/verify")
        .send({
            email: testUser.email
        });

        expect(response.statusCode).toBe(200);

        expect(response.body.message).toBe(
            "Account verified successfully."
        );
    });

});