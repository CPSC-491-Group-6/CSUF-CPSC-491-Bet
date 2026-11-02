const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", function (req, res) {
  res.json({
    message: "Bet API is running",
    status: "OK"
  });
});

app.get("/api/bets", function (req, res) {
  res.json([
    {
      id: 1,
      title: "MCU",
      description: "Will ___ appear in Avengers Doomsday?",
      amount: 10
    },
    {
      id: 2,
      title: "Weather",
      description: "Will it rain today?",
      amount: 5
    },
    {
      id: 3,
      title: "Pineapple Pizza",
      description: "Which do more people believe? Pineapple on pizza, good or bad?",
      amount: 10
    }
  ]);
});

app.post("/api/login", function (req, res) {
  const email = req.body.email;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required."
    });
  }

  res.json({
    message: "Login request received.",
    email: email
  });
});

app.listen(PORT, function () {
  console.log(`Bet API running on http://localhost:${PORT}`);
});

app.use("/api/auth", authRoutes);
app.use("/api/bets", betRoutes);

app.use(function (err, req, res, next) {
  console.error(err);

  res.status(500).json({
    message: "Internal server error"
  });
});

// Only start the server when this file is run directly.
if (require.main === module) {
  app.listen(PORT, function () {
    console.log(`Bet API running on http://localhost:${PORT}`);
  });
}

module.exports = app;