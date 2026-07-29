import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../mood_tracker.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Initialize DB schema for Valorant features
db.exec(`
  CREATE TABLE IF NOT EXISTS valorant_accounts (
    user_id TEXT PRIMARY KEY,
    riot_cookies TEXT NOT NULL,
    region TEXT
  );

  CREATE TABLE IF NOT EXISTS valorant_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    skin_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export const dbGetAccount = (userId) => {
  try {
    const row = db.prepare('SELECT * FROM valorant_accounts WHERE user_id = ?').get(userId);
    return row ? JSON.parse(row.riot_cookies) : null;
  } catch (e) {
    console.error('Failed to get account from SQLite:', e);
    return null;
  }
};

export const dbSaveAccount = (userId, data, region) => {
  try {
    db.prepare(`
      INSERT INTO valorant_accounts (user_id, riot_cookies, region)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        riot_cookies = excluded.riot_cookies,
        region = excluded.region
    `).run(userId, JSON.stringify(data), region || null);
  } catch (e) {
    console.error('Failed to save account to SQLite:', e);
  }
};

export const dbDeleteAccount = (userId) => {
  try {
    db.prepare('DELETE FROM valorant_accounts WHERE user_id = ?').run(userId);
  } catch (e) {
    console.error('Failed to delete account from SQLite:', e);
  }
};

export const dbGetAlerts = (userId) => {
  try {
    const rows = db.prepare('SELECT skin_name FROM valorant_alerts WHERE user_id = ?').all(userId);
    return rows.map(r => {
      const parts = r.skin_name.split(':');
      return {
        uuid: parts[0],
        channel_id: parts[1] || ''
      };
    });
  } catch (e) {
    console.error('Failed to get alerts from SQLite:', e);
    return [];
  }
};

export const dbAddAlert = (userId, uuid, channelId) => {
  try {
    db.prepare('INSERT INTO valorant_alerts (user_id, skin_name) VALUES (?, ?)')
      .run(userId, `${uuid}:${channelId}`);
  } catch (e) {
    console.error('Failed to add alert to SQLite:', e);
  }
};

export const dbRemoveAlert = (userId, uuid) => {
  try {
    db.prepare('DELETE FROM valorant_alerts WHERE user_id = ? AND skin_name LIKE ?')
      .run(userId, `${uuid}:%`);
  } catch (e) {
    console.error('Failed to remove alert from SQLite:', e);
  }
};

export const dbGetAllUserIds = () => {
  try {
    const rows = db.prepare('SELECT user_id FROM valorant_accounts').all();
    return rows.map(r => r.user_id);
  } catch (e) {
    console.error('Failed to get all user IDs from SQLite:', e);
    return [];
  }
};
