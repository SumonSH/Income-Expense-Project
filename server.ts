import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

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
  app.get("/api/state", async (req, res) => {
    try {
      const { data: profile } = await supabase.from("profile").select("*").eq("id", 1).single();
      const { data: transactions } = await supabase.from("transactions").select("*").order("date", { ascending: false });
      const { data: googleAuth } = await supabase.from("google_auth").select("tokens").eq("id", 1).single();
      
      res.json({ 
        profile: profile || { id: 1, name: 'ব্যবহারকারী', currency: 'BDT', theme: 'light' }, 
        transactions: transactions || [], 
        isGoogleConnected: !!googleAuth,
        hasGoogleConfig: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      });
    } catch (error) {
      console.error('Fetch state error:', error);
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
      await supabase.from("google_auth").upsert({ id: 1, tokens: JSON.stringify(tokens) });
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
      const { data: authData } = await supabase.from("google_auth").select("tokens").eq("id", 1).single();
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
      
      const { data: profile } = await supabase.from("profile").select("*").eq("id", 1).single();
      const { data: transactions } = await supabase.from("transactions").select("*");
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

  app.put("/api/profile", async (req, res) => {
    const { name, currency, avatar, email, phone, bio, theme } = req.body;
    try {
      await supabase.from("profile").upsert({
        id: 1,
        name,
        currency,
        avatar,
        email,
        phone,
        bio,
        theme
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    const { id, amount, type, category, date, note } = req.body;
    try {
      await supabase.from("transactions").insert({
        id,
        amount,
        type,
        category,
        date,
        note
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to add transaction" });
    }
  });

  app.put("/api/transactions/:id", async (req, res) => {
    const { id } = req.params;
    const { amount, type, category, date, note } = req.body;
    try {
      await supabase.from("transactions").update({
        amount,
        type,
        category,
        date,
        note
      }).eq("id", id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await supabase.from("transactions").delete().eq("id", id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  app.post("/api/import", async (req, res) => {
    const { profile, transactions } = req.body;
    try {
      if (!profile || !transactions) {
        throw new Error("Invalid data format");
      }

      // Update profile
      await supabase.from("profile").upsert({
        id: 1,
        name: profile.name || 'ব্যবহারকারী',
        currency: profile.currency || 'BDT',
        avatar: profile.avatar || null,
        email: profile.email || null,
        phone: profile.phone || null,
        bio: profile.bio || null,
        theme: profile.theme || 'light'
      });

      // Clear and insert transactions
      await supabase.from("transactions").delete().neq("id", "0"); // Delete all

      const formattedTransactions = transactions.map((t: any) => ({
        id: t.id,
        amount: t.amount || 0,
        type: t.type || 'expense',
        category: t.category || 'অন্যান্য',
        date: t.date || new Date().toISOString(),
        note: t.note || null
      }));

      await supabase.from("transactions").insert(formattedTransactions);

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

  if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
