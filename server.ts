import express from "express";
import { createServer as createViteServer } from "vite";
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Database connection setup
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for NeonDB
  });

  // Test database connection
  app.get("/api/db-test", async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      res.json({ status: "Database connected", time: result.rows[0].now });
    } catch (err) {
      console.error("Database connection error:", err);
      res.status(500).json({ status: "Database connection failed", error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
