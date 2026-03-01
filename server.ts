import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("hishab_khata.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT DEFAULT 'ব্যবহারকারী',
    currency TEXT DEFAULT 'BDT',
    avatar TEXT,
    email TEXT,
    phone TEXT,
    bio TEXT,
    theme TEXT DEFAULT 'light'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS google_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    tokens TEXT
  );

  INSERT OR IGNORE INTO profile (id, name, currency, theme) VALUES (1, 'ব্যবহারকারী', 'BDT', 'light');
`);

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${process.env.APP_URL}/auth/google/callback`
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/state", (req, res) => {
    try {
      const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get();
      const transactions = db.prepare("SELECT * FROM transactions ORDER BY date DESC, id DESC").all();
      const googleAuth = db.prepare("SELECT tokens FROM google_auth WHERE id = 1").get();
      res.json({ 
        profile, 
        transactions, 
        isGoogleConnected: !!googleAuth,
        hasGoogleConfig: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch state" });
    }
  });

  // Google Auth Routes
  app.get("/auth/google", (req, res) => {
    const client = getOAuth2Client();
    if (!client) {
      return res.status(400).send("Google API credentials not configured");
    }
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent'
    });
    res.redirect(url);
  });

  app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    const client = getOAuth2Client();
    if (!client) {
      return res.status(400).send("Google API credentials not configured");
    }
    try {
      const { tokens } = await client.getToken(code as string);
      db.prepare("INSERT OR REPLACE INTO google_auth (id, tokens) VALUES (1, ?)").run(JSON.stringify(tokens));
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              window.close();
            </script>
            <p>Authentication successful! You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/google/sync", async (req, res) => {
    try {
      const authData = db.prepare("SELECT tokens FROM google_auth WHERE id = 1").get();
      if (!authData) {
        return res.status(401).json({ error: "Not connected to Google" });
      }

      const client = getOAuth2Client();
      if (!client) {
        return res.status(400).json({ error: "Google API credentials not configured" });
      }

      const tokens = JSON.parse(authData.tokens);
      client.setCredentials(tokens);

      const drive = google.drive({ version: 'v3', auth: client });
      
      const profile = db.prepare("SELECT * FROM profile WHERE id = 1").get();
      const transactions = db.prepare("SELECT * FROM transactions").all();
      const backupData = JSON.stringify({ profile, transactions }, null, 2);

      // Search for existing backup file
      const listRes = await drive.files.list({
        q: "name = 'hishab_khata_backup.json' and trashed = false",
        fields: 'files(id)',
        spaces: 'drive',
      });

      const fileMetadata = {
        name: 'hishab_khata_backup.json',
        mimeType: 'application/json',
      };
      const media = {
        mimeType: 'application/json',
        body: backupData,
      };

      if (listRes.data.files && listRes.data.files.length > 0) {
        // Update existing file
        await drive.files.update({
          fileId: listRes.data.files[0].id!,
          media: media,
        });
      } else {
        // Create new file
        await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id',
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ error: "Sync failed" });
    }
  });

  app.put("/api/profile", (req, res) => {
    const { name, currency, avatar, email, phone, bio, theme } = req.body;
    try {
      db.prepare(`
        UPDATE profile 
        SET name = ?, currency = ?, avatar = ?, email = ?, phone = ?, bio = ?, theme = ?
        WHERE id = 1
      `).run(name, currency, avatar, email, phone, bio, theme);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/transactions", (req, res) => {
    const { id, amount, type, category, date, note } = req.body;
    try {
      db.prepare(`
        INSERT INTO transactions (id, amount, type, category, date, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, amount, type, category, date, note);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to add transaction" });
    }
  });

  app.put("/api/transactions/:id", (req, res) => {
    const { id } = req.params;
    const { amount, type, category, date, note } = req.body;
    try {
      db.prepare(`
        UPDATE transactions 
        SET amount = ?, type = ?, category = ?, date = ?, note = ?
        WHERE id = ?
      `).run(amount, type, category, date, note, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  app.delete("/api/transactions/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  app.post("/api/import", (req, res) => {
    const { profile, transactions } = req.body;
    try {
      if (!profile || !transactions) {
        throw new Error("Invalid data format");
      }

      const transaction = db.transaction(() => {
        // Update profile with fallback values
        db.prepare(`
          UPDATE profile 
          SET name = ?, currency = ?, avatar = ?, email = ?, phone = ?, bio = ?, theme = ?
          WHERE id = 1
        `).run(
          profile.name || 'ব্যবহারকারী',
          profile.currency || 'BDT',
          profile.avatar || null,
          profile.email || null,
          profile.phone || null,
          profile.bio || null,
          profile.theme || 'light'
        );

        // Clear and insert transactions
        db.prepare("DELETE FROM transactions").run();
        const insert = db.prepare(`
          INSERT INTO transactions (id, amount, type, category, date, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const t of transactions) {
          insert.run(
            t.id,
            t.amount || 0,
            t.type || 'expense',
            t.category || 'অন্যান্য',
            t.date || new Date().toISOString(),
            t.note || null
          );
        }
      });
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({ error: "Failed to import data" });
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
