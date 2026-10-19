const dns = require("dns");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const config = require("./config");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");

if (config.jwtSecret.length < 32) {
  console.error("JWT_SECRET is missing or too short in .env (need 32+ chars).");
  console.error(`Generate one: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`);
  process.exit(1);
}
if (!config.adminPassword) {
  console.warn("ADMIN_PASSWORD is not set in .env -> admin dashboard login is disabled.");
} else if (config.adminPassword.length < 10) {
  console.warn("ADMIN_PASSWORD is short. Use 10+ characters.");
}

// Some ISPs / Windows DNS refuse SRV lookups needed by "mongodb+srv://" -> use public DNS.
if (config.mongoUri.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cors({ origin: config.corsOrigins.includes("*") ? true : config.corsOrigins }));
app.use(express.json({ limit: "10kb" }));

app.get("/health", (_req, res) => res.json({ ok: true, games: [...config.games] }));
app.use("/api/admin", adminRoutes);
app.use("/api", authRoutes);

// Example of a protected game endpoint — copy this pattern for score, save, etc.
// const requireAuth = require("./middleware/requireAuth");
// app.post("/api/score", requireAuth, async (req, res) => {
//   // req.user is the logged-in player
//   res.json({ ok: true });
// });

mongoose
  .connect(config.mongoUri, { dbName: config.dbName })
  .then(() => {
    console.log("MongoDB connected");
    app.listen(config.port, () =>
      console.log(`Auth server on port ${config.port} | games: ${[...config.games].join(", ")}`)
    );
  })
  .catch((e) => {
    console.error("MongoDB connection failed:", e.message);
    process.exit(1);
  });
