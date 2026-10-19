const express = require("express");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const router = express.Router();


// Temporary user storage
// Later replace this with Firestore/database.
const users = [];


// ------------------------------------
// EMAIL TRANSPORTER
// ------------------------------------

const transporter = nodemailer.createTransport({
    service: "gmail",

    auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
    }
});


// ------------------------------------
// REGISTER USER
// ------------------------------------

router.post("/register", async function (req, res) {

    const {
        username,
        email,
        password
    } = req.body;


  // Check required fields
    if (!username || !email || !password) {

        return res.status(400).json({
        message:
            "Username, email, and password are required."
    });

    }


  // Check if account already exists
    const existingUser = users.find(function (user) {

        return user.email === email;

    });


    if (existingUser) {

        return res.status(409).json({
            message:
            "An account with this email already exists."
        });

    }


  // Create new user
    const newUser = {

        id: users.length + 1,
        username: username,
        email: email,

        // TEMPORARY ONLY.
        // Firebase Auth should eventually handle passwords.
        password: password,
        verified: false
    };


    users.push(newUser);


  // ------------------------------------
  // CREATE EMAIL VERIFICATION TOKEN
  // ------------------------------------

    const verificationToken = jwt.sign(
        {
            id: newUser.id,
            email: newUser.email,
            purpose: "verify-email"
        },

            process.env.JWT_SECRET,

        {
            expiresIn: "15m"
        }
    );


  // ------------------------------------
  // CREATE VERIFICATION LINK
  // ------------------------------------

    const verificationLink =
    `${process.env.BACKEND_URL}` +
    `/api/auth/verify-email?token=` +
    verificationToken;


  // ------------------------------------
  // EMAIL CONTENT
  // ------------------------------------

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: newUser.email,
        subject: "Verify your Bet account",
        html: `
            <h2>Welcome to Bet</h2>
            <p>
                Please verify your email address before
                creating or joining bets.
            </p>

            <p>
            <a href="${verificationLink}">
                Verify Email
            </a>
            </p>

            <p>
                This verification link expires in 15 minutes.
            </p>
    `
    };


    try {

    // Send verification email
        await transporter.sendMail(mailOptions);


        return res.status(201).json({

            message:
            "Account created. Verification email sent.",

            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                verified: newUser.verified
            }
        });
    }

    catch (error) {

        console.error("Email error:", error);

        return res.status(500).json({
        message:
            "Account created, but verification email could not be sent."
        });
    }
});


// ------------------------------------
// VERIFY EMAIL TOKEN
// ------------------------------------

router.get("/verify-email", function (req, res) {

    const token = req.query.token;


    if (!token) {

        return res.status(400).json({
        message:
            "Verification token is required."
        });
    }


    try {

    // Decode and verify JWT
        const tokenData = jwt.verify(
        token,
        process.env.JWT_SECRET
        );


    // Make sure this token is specifically
    // an email verification token.
        if (tokenData.purpose !== "verify-email") {

            return res.status(403).json({
            message:
                "Invalid verification token."
            });
        }


    // Find user
    const user = users.find(function (user) {

        return (
            user.id === tokenData.id &&
            user.email === tokenData.email
        );
    });


    if (!user) {

        return res.status(404).json({
            message:
            "User not found."
        });

    }


    // Mark account verified
    user.verified = true;


    return res.status(200).json({

        message:
            "Email verified successfully.",

        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            verified: user.verified
        }
    });
}

    catch (error) {

        return res.status(403).json({
            message:
                "Verification link is invalid or expired."
        });

    }

});


// ------------------------------------
// LOGIN
// ------------------------------------

router.post("/login", function (req, res) {

    const {
        email,
        password
    } = req.body;


    if (!email || !password) {

        return res.status(400).json({
            message:
                "Email and password are required."
        });

    }


    const user = users.find(function (user) {

        return (
            user.email === email &&
            user.password === password
        );

    });


    if (!user) {

        return res.status(401).json({
        message:
            "Invalid email or password."
        });

    }


  // Prevent unverified users
  // from getting normal application access.
    if (!user.verified) {

        return res.status(403).json({
            message:
                "Please verify your email before logging in."
        });

    }


  // ------------------------------------
  // NORMAL AUTHENTICATION TOKEN
  // ------------------------------------

    const authToken = jwt.sign(
        {
            id: user.id,
            email: user.email,
            verified: user.verified
        },

        process.env.JWT_SECRET,

        {
            expiresIn: "1h"
        }
    );


    return res.status(200).json({

        message:
            "Login successful.",

        token: authToken,

        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            verified: user.verified
        }

    });

});


module.exports = router;