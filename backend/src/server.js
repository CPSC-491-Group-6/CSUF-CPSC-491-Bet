// backend/src/server.js

import app from "./app.js";
import { env } from "./config/env.js";

// Start the backend API server using the port loaded from backend/.env.
app.listen(env.port, () => {
  console.log(`Bet backend running on port ${env.port}`);
});
