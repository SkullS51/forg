import express from "express";
import { createServer as createViteServer } from "vite";
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config(); // Load environment variables from .env file

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL environment variable is not set.");
  process.exit(1);
}
console.log("DEBUG: DATABASE_URL loaded:", DATABASE_URL ? "YES (first 10 chars: " + DATABASE_URL.substring(0, 10) + ")" : "NO");

const REDHAT_AI_API_URL = process.env.REDHAT_AI_API_URL;
const REDHAT_AI_API_KEY = process.env.REDHAT_AI_API_KEY;

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

  // Generic proxy function for Red Hat AI API calls
  async function proxyToRedHatAI(req, res, endpoint) {
    if (!REDHAT_AI_API_URL || !REDHAT_AI_API_KEY) {
      return res.status(500).json({ status: "Error", error: "Red Hat AI API URL or Key not configured." });
    }

    try {
      // Customize this payload based on your Red Hat AI API's requirements.
      // This example assumes a generic text-to-image/text/audio API.
      const redHatPayload: { [key: string]: any } = {
        prompt: req.body.prompt,
      };

      // Add image-specific parameters if available
      if (req.body.aspectRatio) {
        redHatPayload.aspectRatio = req.body.aspectRatio;
      }
      // Add other parameters like model, imageConfig, etc., as needed by your Red Hat AI API
      // For example, if the Red Hat API expects a specific model:
      // redHatPayload.model = 'redhat-ai-model-v1';

      console.log(`DEBUG: Red Hat AI Request to ${REDHAT_AI_API_URL}${endpoint}:`, JSON.stringify(redHatPayload, null, 2));

      const response = await fetch(`${REDHAT_AI_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${REDHAT_AI_API_KEY}`,
          // Add other headers as required by your Red Hat AI API
        },
        body: JSON.stringify(redHatPayload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Red Hat AI API Error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      // Customize this response parsing based on your Red Hat AI API's output.
      // This example assumes the Red Hat API returns 'imageUrl' for images and 'text' for text.
      // For audio, it might return 'audioConfig' or a direct audio URL.
      console.log(`DEBUG: Red Hat AI Response from ${REDHAT_AI_API_URL}${endpoint}:`, JSON.stringify(data, null, 2));

      if (endpoint.includes('image') && data.imageUrl) {
        res.json({ imageUrl: data.imageUrl });
      } else if (endpoint.includes('text') && data.text) {
        res.json({ text: data.text });
      } else if (endpoint.includes('audio') && data.audioConfig) {
        res.json({ audioConfig: data.audioConfig });
      } else {
        // Fallback or more specific error handling if response format is unexpected
        res.json(data);
      }
    } catch (error) {
      console.error(`Error proxying to Red Hat AI ${endpoint}:`, error);
      res.status(500).json({ status: "Error", error: error.message });
    }
  }

  // API endpoint for image generation (example path - customize as per Red Hat AI API docs)
  app.post("/api/generate-image", (req, res) => proxyToRedHatAI(req, res, '/inference/image')); 

  // API endpoint for text generation (example path - customize as per Red Hat AI API docs)
  app.post("/api/generate-text", (req, res) => proxyToRedHatAI(req, res, '/inference/text')); 

  // API endpoint for audio generation (example path - customize as per Red Hat AI API docs)
  app.post("/api/generate-audio", (req, res) => proxyToRedHatAI(req, res, '/inference/audio')); 

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    // IMPORTANT: Ensure your build process outputs to a 'dist' directory
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
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
