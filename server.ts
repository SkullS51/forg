import express from "express";
import { createServer as createViteServer } from "vite";
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL environment variable is not set.");
  process.exit(1);
}
console.log("DEBUG: DATABASE_URL loaded:", DATABASE_URL ? "YES (first 10 chars: " + DATABASE_URL.substring(0, 10) + ")" : "NO");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json()); // Middleware to parse JSON request bodies

  // Database connection setup
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
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

  // API endpoint for image generation
  app.post("/api/generate-image", (req, res) => {
    console.log("Image generation request received:", req.body);
    // Placeholder for Red Hat image generation API call
    const placeholderImage = "https://picsum.photos/seed/redhat/1024/1024";
    res.json({ imageUrl: placeholderImage, description: "Placeholder image from Red Hat API." });
  });

  // API endpoint for text generation
  app.post("/api/generate-text", (req, res) => {
    console.log("Text generation request received:", req.body);
    // Placeholder for Red Hat text generation API call
    const placeholderText = `Red Hat API generated text for: "${req.body.prompt}". This is a placeholder response.`;
    res.json({ text: placeholderText });
  });

  // API endpoint for audio generation
  app.post("/api/generate-audio", (req, res) => {
    console.log("Audio generation request received:", req.body);
    // Placeholder for Red Hat audio generation API call
    const placeholderAudioConfig = {
      bpm: 180,
      pattern: Array(16).fill(0).map(() => Array(8).fill(0).map(() => Math.random() > 0.5 ? 255 : 0)),
      distorted: true,
      gain: 6.0,
      atmosphere: 'red_hat_soundscape'
    };
    res.json({ audioConfig: placeholderAudioConfig });
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

  // Generic error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled server error:", err);
    res.status(500).json({ status: "Server error", error: err.message });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
